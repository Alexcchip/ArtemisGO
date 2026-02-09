package handlers

import (
	"artemisgo/db"
	"database/sql"
	"fmt"
	"math"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func contains(s, substr string) bool {
	return strings.Contains(strings.ToUpper(s), strings.ToUpper(substr))
}

type colMeta struct {
	Name string
	Type string
}

func Stats(c *fiber.Ctx) error {
	// Check if table exists
	var count int
	err := db.DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", db.TableName)).Scan(&count)
	if err != nil {
		return c.JSON(fiber.Map{
			"rowCount":    0,
			"columnCount": 0,
			"columns":     []fiber.Map{},
		})
	}

	// Get column info via DESCRIBE (DuckDB)
	rows, err := db.DB.Query(fmt.Sprintf("DESCRIBE %s", db.TableName))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var cols []colMeta
	for rows.Next() {
		var name, colType string
		var isNull, key, defaultVal, extra sql.NullString
		if err := rows.Scan(&name, &colType, &isNull, &key, &defaultVal, &extra); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		// Map DuckDB types to simple types
		simpleType := "TEXT"
		upper := fmt.Sprintf("%s", colType)
		switch {
		case contains(upper, "INT"):
			simpleType = "INTEGER"
		case contains(upper, "FLOAT"), contains(upper, "DOUBLE"),
			contains(upper, "DECIMAL"), contains(upper, "NUMERIC"):
			simpleType = "REAL"
		}
		cols = append(cols, colMeta{Name: name, Type: simpleType})
	}

	columns := make([]fiber.Map, 0, len(cols))
	for _, col := range cols {
		entry := fiber.Map{"name": col.Name, "type": col.Type}

		switch col.Type {
		case "INTEGER", "REAL":
			stats, dist, err := numericStats(col.Name)
			if err == nil {
				entry["stats"] = stats
				entry["distribution"] = dist
			}
		case "TEXT":
			stats, dist, err := textStats(col.Name)
			if err == nil {
				entry["stats"] = stats
				entry["distribution"] = dist
			}
		}

		columns = append(columns, entry)
	}

	return c.JSON(fiber.Map{
		"rowCount":    count,
		"columnCount": len(columns),
		"columns":     columns,
	})
}

func numericStats(colName string) (fiber.Map, []fiber.Map, error) {
	q := fmt.Sprintf(
		`SELECT MIN("%s"), MAX("%s"), AVG("%s"), SUM(CASE WHEN "%s" IS NULL THEN 1 ELSE 0 END) FROM %s`,
		colName, colName, colName, colName, db.TableName,
	)

	var minVal, maxVal, avgVal sql.NullFloat64
	var nullCount int
	if err := db.DB.QueryRow(q).Scan(&minVal, &maxVal, &avgVal, &nullCount); err != nil {
		return nil, nil, err
	}

	if !minVal.Valid {
		// All nulls
		return fiber.Map{
			"min":       nil,
			"max":       nil,
			"mean":      nil,
			"nullCount": nullCount,
		}, []fiber.Map{}, nil
	}

	stats := fiber.Map{
		"min":       minVal.Float64,
		"max":       maxVal.Float64,
		"mean":      math.Round(avgVal.Float64*1000) / 1000,
		"nullCount": nullCount,
	}

	// Build histogram with 10 equal-width buckets
	mn := minVal.Float64
	mx := maxVal.Float64
	const numBuckets = 10
	dist := make([]fiber.Map, 0, numBuckets)

	if mn == mx {
		// Single bucket
		var cnt int
		cntQ := fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE "%s" IS NOT NULL`, db.TableName, colName)
		if err := db.DB.QueryRow(cntQ).Scan(&cnt); err != nil {
			return stats, dist, nil
		}
		dist = append(dist, fiber.Map{"bucketMin": mn, "bucketMax": mx, "count": cnt})
		return stats, dist, nil
	}

	bucketWidth := (mx - mn) / float64(numBuckets)

	histQ := fmt.Sprintf(
		`SELECT CASE WHEN CAST(("%s" - %f) / %f AS INTEGER) >= %d THEN %d ELSE CAST(("%s" - %f) / %f AS INTEGER) END AS bucket, COUNT(*) FROM %s WHERE "%s" IS NOT NULL GROUP BY bucket ORDER BY bucket`,
		colName, mn, bucketWidth, numBuckets, numBuckets-1,
		colName, mn, bucketWidth,
		db.TableName, colName,
	)

	hRows, err := db.DB.Query(histQ)
	if err != nil {
		return stats, dist, nil
	}
	defer hRows.Close()

	// Pre-fill all buckets with 0
	buckets := make([]int, numBuckets)
	for hRows.Next() {
		var bucket, cnt int
		if err := hRows.Scan(&bucket, &cnt); err != nil {
			continue
		}
		if bucket >= 0 && bucket < numBuckets {
			buckets[bucket] = cnt
		}
	}

	for i := 0; i < numBuckets; i++ {
		bMin := mn + float64(i)*bucketWidth
		bMax := mn + float64(i+1)*bucketWidth
		dist = append(dist, fiber.Map{
			"bucketMin": math.Round(bMin*1000) / 1000,
			"bucketMax": math.Round(bMax*1000) / 1000,
			"count":     buckets[i],
		})
	}

	return stats, dist, nil
}

func textStats(colName string) (fiber.Map, []fiber.Map, error) {
	q := fmt.Sprintf(
		`SELECT COUNT(DISTINCT "%s"), SUM(CASE WHEN "%s" IS NULL THEN 1 ELSE 0 END) FROM %s`,
		colName, colName, db.TableName,
	)

	var uniqueCount, nullCount int
	if err := db.DB.QueryRow(q).Scan(&uniqueCount, &nullCount); err != nil {
		return nil, nil, err
	}

	// Top 10 values
	topQ := fmt.Sprintf(
		`SELECT "%s", COUNT(*) AS cnt FROM %s WHERE "%s" IS NOT NULL GROUP BY "%s" ORDER BY cnt DESC LIMIT 10`,
		colName, db.TableName, colName, colName,
	)

	tRows, err := db.DB.Query(topQ)
	if err != nil {
		return fiber.Map{"uniqueCount": uniqueCount, "nullCount": nullCount}, []fiber.Map{}, nil
	}
	defer tRows.Close()

	var topValues []fiber.Map
	var dist []fiber.Map
	for tRows.Next() {
		var val string
		var cnt int
		if err := tRows.Scan(&val, &cnt); err != nil {
			continue
		}
		topValues = append(topValues, fiber.Map{"value": val, "count": cnt})
		dist = append(dist, fiber.Map{"value": val, "count": cnt})
	}

	if topValues == nil {
		topValues = []fiber.Map{}
	}
	if dist == nil {
		dist = []fiber.Map{}
	}

	stats := fiber.Map{
		"uniqueCount": uniqueCount,
		"nullCount":   nullCount,
		"topValues":   topValues,
	}

	return stats, dist, nil
}
