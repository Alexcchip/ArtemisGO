package handlers

import (
	"artemisgo/db"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

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

	// Get column info
	rows, err := db.DB.Query(fmt.Sprintf("PRAGMA table_info(%s)", db.TableName))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var columns []fiber.Map
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var dfltValue interface{}
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		columns = append(columns, fiber.Map{"name": name, "type": colType})
	}

	if columns == nil {
		columns = []fiber.Map{}
	}

	return c.JSON(fiber.Map{
		"rowCount":    count,
		"columnCount": len(columns),
		"columns":     columns,
	})
}
