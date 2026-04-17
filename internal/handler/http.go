package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	dbpkg "github.com/lechat/internal/db"
	"github.com/lechat/pkg/models"
)

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

	// Conversation endpoints
	mux.HandleFunc("GET /api/conversations", handler.ListConversations)
	mux.HandleFunc("GET /api/conversations/", handler.GetConversation)

	// Thread endpoints
	mux.HandleFunc("GET /api/threads/", handler.GetThread)

	// SSE endpoint
	mux.HandleFunc("GET /api/events", handler.sseHandler.HandleSSE)

	// Health check
	mux.HandleFunc("GET /health", handler.HealthCheck)

	return mux
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
