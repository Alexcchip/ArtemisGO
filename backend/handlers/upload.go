package handlers

import (
	"artemisgo/db"

	"github.com/gofiber/fiber/v2"
)

func Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file provided"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer f.Close()

	rowCount, columns, colTypes, err := db.LoadCSV(f)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	cols := make([]fiber.Map, len(columns))
	for i, name := range columns {
		cols[i] = fiber.Map{"name": name, "type": colTypes[i]}
	}

	return c.JSON(fiber.Map{
		"rowCount":    rowCount,
		"columnCount": len(columns),
		"columns":     cols,
	})
}
