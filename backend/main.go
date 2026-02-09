package main

import (
	"artemisgo/db"
	"artemisgo/handlers"
	"bufio"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if k, v, ok := strings.Cut(line, "="); ok {
			os.Setenv(strings.TrimSpace(k), strings.TrimSpace(v))
		}
	}
}

func main() {
	loadEnv(".env")
	if err := db.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	app := fiber.New(fiber.Config{
		BodyLimit:    4 * 1024 * 1024 * 1024, // 4 GB
		ReadTimeout:  30 * time.Minute,
		WriteTimeout: 30 * time.Minute,
	})

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:3000"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		AllowMethods: "GET,POST",
		AllowHeaders: "Content-Type",
	}))

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Post("/api/upload", handlers.Upload)
	app.Post("/api/query", handlers.Query)
	app.Get("/api/stats", handlers.Stats)
	app.Post("/api/chat", handlers.Chat)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("ArtemisGO backend starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
