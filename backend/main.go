package main

import (
	"artemisgo/db"
	"artemisgo/handlers"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	if err := db.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	app := fiber.New(fiber.Config{
		BodyLimit: 50 * 1024 * 1024, // 50 MB
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3000",
		AllowMethods: "GET,POST",
		AllowHeaders: "Content-Type",
	}))

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Post("/api/upload", handlers.Upload)
	app.Post("/api/query", handlers.Query)
	app.Get("/api/stats", handlers.Stats)

	log.Println("ArtemisGO backend starting on :8080")
	log.Fatal(app.Listen(":8080"))
}
