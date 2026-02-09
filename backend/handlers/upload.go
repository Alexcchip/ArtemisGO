package handlers

import (
	"artemisgo/db"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
)

func Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file provided"})
	}

	// Save upload to a temp file — DuckDB reads directly from disk
	tmpFile, err := os.CreateTemp("", "artemis_upload_*.csv")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create temp file"})
	}
	tempPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tempPath)

	log.Printf("Upload: saving %s (%d bytes) to temp file", file.Filename, file.Size)
	if err := c.SaveFile(file, tempPath); err != nil {
		log.Printf("Upload: SaveFile failed: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save uploaded file"})
	}
	log.Println("Upload: temp file saved, loading into DuckDB")

	rowCount, columns, colTypes, err := db.LoadCSV(tempPath)
	if err != nil {
		log.Printf("Upload: LoadCSV failed: %v", err)
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	log.Printf("Upload: done — %d rows, %d columns", rowCount, len(columns))

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
