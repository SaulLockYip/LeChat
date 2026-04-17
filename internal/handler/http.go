package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	dbpkg "github.com/lechat/internal/db"
	"github.com/lechat/pkg/models"
)

// Static file paths
var (
	webRoot    = getWebRoot()
	staticDir  = webRoot
	serverDir  = filepath.Join(webRoot, "server", "app")
	indexFile  = filepath.Join(serverDir, "index.html")
)

func getWebRoot() string {
	// Try environment variable first
	if root := os.Getenv("LECHAT_WEB_ROOT"); root != "" {
		return root
	}
	// Default to web/ relative to the executable's directory
	exe, err := os.Executable()
	if err != nil {
		return "./web"
	}
	return filepath.Dir(exe) + "/web"
}

// Handler holds HTTP handler dependencies
type Handler struct {
	db          *sql.DB
	convRepo    *dbpkg.ConversationRepository
	threadRepo  *dbpkg.ThreadRepository
	agentRepo   *dbpkg.AgentRepository
	jsonl       *dbpkg.JSONLManager
	sseHandler  *SSEHandler
}

// NewHandler creates a new HTTP handler
func NewHandler(db *sql.DB, jsonl *dbpkg.JSONLManager, sseHandler *SSEHandler) *Handler {
	return &Handler{
		db:         db,
		convRepo:   dbpkg.NewConversationRepository(db),
		threadRepo: dbpkg.NewThreadRepository(db),
		agentRepo:  dbpkg.NewAgentRepository(db),
		jsonl:      jsonl,
		sseHandler: sseHandler,
	}
}

// SetupRouter configures the HTTP router
func SetupRouter(db *sql.DB, jsonl *dbpkg.JSONLManager, sseBroadcaster *SSEBroadcaster) http.Handler {
	mux := http.NewServeMux()
	handler := NewHandler(db, jsonl, NewSSEHandler(sseBroadcaster))

	log.Printf("[DEBUG] Web root: %s", webRoot)
	log.Printf("[DEBUG] Static dir: %s", staticDir)
	log.Printf("[DEBUG] Index file: %s", indexFile)

	// API routes - register first so they take precedence
	mux.HandleFunc("/api/conversations", handler.ListConversations)
	mux.HandleFunc("/api/conversations/", handler.GetConversation)
	mux.HandleFunc("/api/threads/", handler.GetThread)
	mux.HandleFunc("/api/events", handler.sseHandler.HandleSSE)

	// Health check
	mux.HandleFunc("/health", handler.HealthCheck)

	// Static files for Next.js
	mux.HandleFunc("/_next/static/", handler.ServeStaticFile)
	mux.HandleFunc("/favicon.ico", handler.ServeStaticFile)

	// SPA fallback - must be last
	mux.HandleFunc("/", handler.ServeSPA)

	return mux
}

// ServeStaticFile serves files from static directory
func (h *Handler) ServeStaticFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Remove /_next/ prefix to get the relative path
	staticPath := strings.TrimPrefix(path, "/_next/")

	// Special handling for favicon - query param contains actual filename in static/media/
	if path == "/favicon.ico" {
		faviconName := r.URL.Query().Get("favicon")
		if faviconName != "" {
			staticPath = filepath.Join("static", "media", faviconName)
		} else {
			// Fallback to index.html for favicon route
			staticPath = filepath.Join("server", "app", "favicon.ico", "route.js")
		}
	}

	filePath := filepath.Join(staticDir, staticPath)

	// Security: prevent directory traversal
	if !strings.HasPrefix(filePath, filepath.Clean(staticDir)+string(filepath.Separator)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Set content type based on file extension
	contentType := getContentType(filePath)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	w.Write(data)
}

// ServeSPA serves the Next.js SPA index page
func (h *Handler) ServeSPA(w http.ResponseWriter, r *http.Request) {
	// API routes should not be handled by SPA
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}

	data, err := os.ReadFile(indexFile)
	if err != nil {
		log.Printf("Error reading index.html: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(data)
}

func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript"
	case ".css":
		return "text/css"
	case ".json":
		return "application/json"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".eot":
		return "application/vnd.ms-fontobject"
	case ".map":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}

// ListConversations handles GET /api/conversations
func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	conversations, err := h.convRepo.ListConversations()
	if err != nil {
		log.Printf("Error listing conversations: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": conversations,
	})
}

// GetConversation handles GET /api/conversations/:id
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/conversations/")
	if id == "" {
		http.Error(w, "Missing conversation ID", http.StatusBadRequest)
		return
	}

	conv, err := h.convRepo.GetConversation(id)
	if err != nil {
		log.Printf("Error getting conversation: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if conv == nil {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conv)
}

// GetThread handles GET /api/threads/:id
func (h *Handler) GetThread(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/threads/")
	if id == "" {
		http.Error(w, "Missing thread ID", http.StatusBadRequest)
		return
	}

	thread, err := h.threadRepo.GetThread(id)
	if err != nil {
		log.Printf("Error getting thread: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if thread == nil {
		http.Error(w, "Thread not found", http.StatusNotFound)
		return
	}

	// Get messages for this thread
	messages, err := h.jsonl.ReadMessages(thread.ID, thread.ConvID)
	if err != nil {
		log.Printf("Error reading messages: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"thread":   thread,
		"messages": messages,
	})
}

// HealthCheck handles GET /health
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

// extractID extracts the ID from a URL path
func extractID(path, prefix string) string {
	id := path[len(prefix):]
	if len(id) == 0 || id[len(id)-1] == '/' {
		return ""
	}
	return id
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// JSONError sends a JSON error response
func JSONError(w http.ResponseWriter, code int, err string, errCode string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error: err,
		Code:  errCode,
	})
}

// JSONResponse sends a JSON response
func JSONResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// MessageResponse represents a message response with metadata
type MessageResponse struct {
	Message *models.Message `json:"message"`
}

// extractConvID extracts conversation ID from path
func extractConvID(path string) string {
	// Path format: /api/conversations/{id}/messages
	parts := splitPath(path)
	if len(parts) >= 3 && parts[0] == "api" && parts[1] == "conversations" {
		return parts[2]
	}
	return ""
}

func splitPath(path string) []string {
	if path == "" {
		return nil
	}
	if path[0] == '/' {
		path = path[1:]
	}
	var parts []string
	for i := 0; i < len(path); i++ {
		if path[i] == '/' {
			if i > 0 {
				parts = append(parts, path[:i])
			}
			path = path[i+1:]
			i = -1
		}
	}
	if len(path) > 0 {
		parts = append(parts, path)
	}
	return parts
}
