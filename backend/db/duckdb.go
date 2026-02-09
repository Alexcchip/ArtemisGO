package db

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/marcboeker/go-duckdb"
)

var DB *sql.DB

const TableName = "tablename"

func Init() error {
	var err error
	DB, err = sql.Open("duckdb", "")
	if err != nil {
		return fmt.Errorf("failed to open duckdb: %w", err)
	}
	return DB.Ping()
}

// LoadCSV uses DuckDB's native CSV reader to ingest a file.
// csvPath must be an on-disk file path.
func LoadCSV(csvPath string) (int, []string, []string, error) {
	start := time.Now()

	_, _ = DB.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", TableName))

	// DuckDB reads the CSV natively — handles parsing, type inference, everything
	createSQL := fmt.Sprintf(
		"CREATE TABLE %s AS SELECT * FROM read_csv_auto('%s')",
		TableName, strings.ReplaceAll(csvPath, "'", "''"),
	)
	if _, err := DB.Exec(createSQL); err != nil {
		return 0, nil, nil, fmt.Errorf("failed to load CSV: %w", err)
	}

	log.Printf("  CSV loaded in %.1fs", time.Since(start).Seconds())

	// Get row count
	var rowCount int
	if err := DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", TableName)).Scan(&rowCount); err != nil {
		return 0, nil, nil, fmt.Errorf("failed to count rows: %w", err)
	}

	// Get column names and types from DuckDB's schema
	rows, err := DB.Query(fmt.Sprintf("DESCRIBE %s", TableName))
	if err != nil {
		return 0, nil, nil, fmt.Errorf("failed to describe table: %w", err)
	}
	defer rows.Close()

	var columns []string
	var colTypes []string
	for rows.Next() {
		var name, colType string
		var isNull, key, defaultVal, extra sql.NullString
		if err := rows.Scan(&name, &colType, &isNull, &key, &defaultVal, &extra); err != nil {
			return 0, nil, nil, fmt.Errorf("failed to scan column info: %w", err)
		}
		columns = append(columns, name)
		colTypes = append(colTypes, mapDuckDBType(colType))
	}

	log.Printf("  done: %d rows, %d columns in %.1fs", rowCount, len(columns), time.Since(start).Seconds())
	return rowCount, columns, colTypes, nil
}

// mapDuckDBType maps DuckDB types to simple types for the frontend
func mapDuckDBType(t string) string {
	upper := strings.ToUpper(t)
	switch {
	case strings.Contains(upper, "INT"):
		return "INTEGER"
	case strings.Contains(upper, "FLOAT"), strings.Contains(upper, "DOUBLE"),
		strings.Contains(upper, "DECIMAL"), strings.Contains(upper, "NUMERIC"):
		return "REAL"
	default:
		return "TEXT"
	}
}
