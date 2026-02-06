package handlers

import (
	"artemisgo/db"

	"github.com/gofiber/fiber/v2"
)

type queryRequest struct {
	SQL string `json:"sql"`
}

func Query(c *fiber.Ctx) error {
	var req queryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.SQL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "SQL query is required"})
	}

	rows, err := db.DB.Query(req.SQL)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error(), "columns": []string{}, "rows": [][]interface{}{}})
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error(), "columns": []string{}, "rows": [][]interface{}{}})
	}

	var results [][]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return c.JSON(fiber.Map{"error": err.Error(), "columns": columns, "rows": results})
		}

		// Convert []byte values to string for JSON serialization
		row := make([]interface{}, len(vals))
		for i, v := range vals {
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		results = append(results, row)
	}

	if results == nil {
		results = [][]interface{}{}
	}

	return c.JSON(fiber.Map{
		"columns": columns,
		"rows":    results,
	})
}
