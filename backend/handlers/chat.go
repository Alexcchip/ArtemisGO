package handlers

import (
	"artemisgo/db"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Messages    []chatMessage `json:"messages"`
	AutoExecute bool          `json:"autoExecute"`
}

type chatResponse struct {
	Reply       string      `json:"reply"`
	SQL         string      `json:"sql,omitempty"`
	QueryResult interface{} `json:"queryResult,omitempty"`
}

var sqlFenceRe = regexp.MustCompile("(?s)```sql\\s*\n?(.*?)```")

func Chat(c *fiber.Ctx) error {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return c.Status(500).JSON(fiber.Map{"error": "GEMINI_API_KEY not set"})
	}

	var req chatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if len(req.Messages) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No messages provided"})
	}

	// Build schema context
	schemaCtx := buildSchemaContext()

	fence := "```"
	systemPrompt := fmt.Sprintf("You are a DuckDB SQL assistant for the ArtemisGO application.\n"+
		"The user has uploaded a CSV file into a DuckDB table called \"tablename\".\n\n"+
		"Here is the table schema and sample data:\n%s\n\n"+
		"Rules:\n"+
		"- When the user asks a data question, generate a SQL query to answer it.\n"+
		"- Always wrap SQL in a single %ssql code fence.\n"+
		"- Only generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, or ALTER.\n"+
		"- Use DuckDB SQL syntax.\n"+
		"- Always quote column names with double quotes if they contain spaces or special characters.\n"+
		"- Keep queries concise and efficient.\n"+
		"- If the user's question is not about data, respond conversationally without SQL.",
		schemaCtx, fence)

	// Build Gemini API request
	geminiMessages := buildGeminiMessages(systemPrompt, req.Messages)

	reply, err := callGemini(apiKey, geminiMessages)
	if err != nil {
		log.Printf("Chat: Gemini API error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("AI service error: %v", err)})
	}

	resp := chatResponse{Reply: reply}

	// Extract SQL from response
	matches := sqlFenceRe.FindStringSubmatch(reply)
	if len(matches) > 1 {
		extractedSQL := strings.TrimSpace(matches[1])
		resp.SQL = extractedSQL

		// Auto-execute if requested and SQL is safe (SELECT only)
		if req.AutoExecute && isSafeSQL(extractedSQL) {
			result, err := executeSQL(extractedSQL)
			if err == nil {
				resp.QueryResult = result
			}
		}
	}

	return c.JSON(resp)
}

func buildSchemaContext() string {
	var sb strings.Builder

	// Get column info
	rows, err := db.DB.Query(fmt.Sprintf("DESCRIBE %s", db.TableName))
	if err != nil {
		return "No table loaded."
	}
	defer rows.Close()

	sb.WriteString("Columns:\n")
	for rows.Next() {
		var name, colType string
		var isNull, key, defaultVal, extra sql.NullString
		if err := rows.Scan(&name, &colType, &isNull, &key, &defaultVal, &extra); err != nil {
			continue
		}
		sb.WriteString(fmt.Sprintf("  - \"%s\" (%s)\n", name, colType))
	}

	// Get sample rows
	sampleRows, err := db.DB.Query(fmt.Sprintf("SELECT * FROM %s LIMIT 3", db.TableName))
	if err != nil {
		return sb.String()
	}
	defer sampleRows.Close()

	cols, _ := sampleRows.Columns()
	sb.WriteString(fmt.Sprintf("\nSample data (first 3 rows):\n%s\n", strings.Join(cols, " | ")))

	for sampleRows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := sampleRows.Scan(ptrs...); err != nil {
			continue
		}
		strs := make([]string, len(vals))
		for i, v := range vals {
			if v == nil {
				strs[i] = "NULL"
			} else if b, ok := v.([]byte); ok {
				strs[i] = string(b)
			} else {
				strs[i] = fmt.Sprintf("%v", v)
			}
		}
		sb.WriteString(strings.Join(strs, " | ") + "\n")
	}

	// Get row count
	var rowCount int
	if err := db.DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", db.TableName)).Scan(&rowCount); err == nil {
		sb.WriteString(fmt.Sprintf("\nTotal rows: %d\n", rowCount))
	}

	return sb.String()
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiRequest struct {
	Contents         []geminiContent `json:"contents"`
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func buildGeminiMessages(systemPrompt string, messages []chatMessage) geminiRequest {
	req := geminiRequest{
		SystemInstruction: &geminiContent{
			Role:  "user",
			Parts: []geminiPart{{Text: systemPrompt}},
		},
	}

	for _, msg := range messages {
		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}
		req.Contents = append(req.Contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: msg.Content}},
		})
	}

	return req
}

func callGemini(apiKey string, req geminiRequest) (string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", apiKey)

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if httpResp.StatusCode != 200 {
		return "", fmt.Errorf("API returned status %d: %s", httpResp.StatusCode, string(respBody))
	}

	var gemResp geminiResponse
	if err := json.Unmarshal(respBody, &gemResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if gemResp.Error != nil {
		return "", fmt.Errorf("API error: %s", gemResp.Error.Message)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response generated")
	}

	return gemResp.Candidates[0].Content.Parts[0].Text, nil
}

func isSafeSQL(query string) bool {
	upper := strings.ToUpper(strings.TrimSpace(query))
	if !strings.HasPrefix(upper, "SELECT") {
		return false
	}
	dangerous := []string{"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "EXEC", "EXECUTE"}
	for _, kw := range dangerous {
		if strings.Contains(upper, kw) {
			return false
		}
	}
	return true
}

func executeSQL(query string) (fiber.Map, error) {
	rows, err := db.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results [][]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
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

	return fiber.Map{
		"columns": columns,
		"rows":    results,
	}, nil
}
