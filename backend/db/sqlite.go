package db

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

const TableName = "tablename"

func Init() error {
	var err error
	DB, err = sql.Open("sqlite", ":memory:")
	if err != nil {
		return fmt.Errorf("failed to open sqlite: %w", err)
	}
	return DB.Ping()
}

// InferType tries to determine if a column is INTEGER, REAL, or TEXT
// by scanning all values for that column.
func InferType(values []string) string {
	isInt := true
	isReal := true
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, err := strconv.ParseInt(v, 10, 64); err != nil {
			isInt = false
		}
		if _, err := strconv.ParseFloat(v, 64); err != nil {
			isReal = false
		}
	}
	if isInt {
		return "INTEGER"
	}
	if isReal {
		return "REAL"
	}
	return "TEXT"
}

// LoadCSV reads a CSV from the given reader, infers types, creates a table,
// and inserts all rows. Returns (rowCount, columns, colTypes, error).
func LoadCSV(r io.Reader) (int, []string, []string, error) {
	reader := csv.NewReader(r)
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return 0, nil, nil, fmt.Errorf("failed to parse CSV: %w", err)
	}
	if len(records) < 1 {
		return 0, nil, nil, fmt.Errorf("CSV is empty")
	}

	headers := records[0]
	dataRows := records[1:]

	// Sanitize headers for use as SQL column names
	sanitized := make([]string, len(headers))
	for i, h := range headers {
		s := strings.TrimSpace(h)
		s = strings.ReplaceAll(s, " ", "_")
		s = strings.ReplaceAll(s, "-", "_")
		if s == "" {
			s = fmt.Sprintf("col_%d", i)
		}
		sanitized[i] = s
	}

	// Infer types by scanning column values
	colTypes := make([]string, len(sanitized))
	for col := range sanitized {
		vals := make([]string, len(dataRows))
		for row, rec := range dataRows {
			if col < len(rec) {
				vals[row] = rec[col]
			}
		}
		colTypes[col] = InferType(vals)
	}

	// Drop and recreate table
	_, _ = DB.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", TableName))

	colDefs := make([]string, len(sanitized))
	for i, name := range sanitized {
		colDefs[i] = fmt.Sprintf(`"%s" %s`, name, colTypes[i])
	}
	createSQL := fmt.Sprintf("CREATE TABLE %s (%s)", TableName, strings.Join(colDefs, ", "))
	if _, err := DB.Exec(createSQL); err != nil {
		return 0, nil, nil, fmt.Errorf("failed to create table: %w", err)
	}

	// Batch insert in a transaction
	tx, err := DB.Begin()
	if err != nil {
		return 0, nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	placeholders := make([]string, len(sanitized))
	for i := range placeholders {
		placeholders[i] = "?"
	}
	insertSQL := fmt.Sprintf("INSERT INTO %s VALUES (%s)", TableName, strings.Join(placeholders, ", "))
	stmt, err := tx.Prepare(insertSQL)
	if err != nil {
		tx.Rollback()
		return 0, nil, nil, fmt.Errorf("failed to prepare insert: %w", err)
	}
	defer stmt.Close()

	for _, rec := range dataRows {
		vals := make([]interface{}, len(sanitized))
		for i := range sanitized {
			if i < len(rec) {
				v := strings.TrimSpace(rec[i])
				if v == "" {
					vals[i] = nil
				} else {
					vals[i] = v
				}
			} else {
				vals[i] = nil
			}
		}
		if _, err := stmt.Exec(vals...); err != nil {
			tx.Rollback()
			return 0, nil, nil, fmt.Errorf("failed to insert row: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, nil, nil, fmt.Errorf("failed to commit: %w", err)
	}

	return len(dataRows), sanitized, colTypes, nil
}
