package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	dbpkg "github.com/lechat/internal/db"
	"github.com/lechat/internal/notification"
	"github.com/lechat/internal/queue"
	"github.com/lechat/pkg/models"
	"github.com/google/uuid"
)

// Allowed directories for file serving
var allowedDirs []string

func init() {
	home, err := os.UserHomeDir()
	if err != nil {
		home = os.Getenv("HOME")
	}
	if home == "" {
		home = "/tmp"
	}
	// Allow ~/.lechat/ and /tmp/ directories
	allowedDirs = []string{
		filepath.Join(home, ".lechat"),
		"/tmp",
	}
}

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

// Context key for user
type contextKey string
const ContextKeyUser contextKey = "user"

// AuthMiddleware handles Bearer token authentication
type AuthMiddleware struct {
	userRepo *dbpkg.UserRepository
}

func NewAuthMiddleware(userRepo *dbpkg.UserRepository) *AuthMiddleware {
	return &AuthMiddleware{userRepo: userRepo}
}

func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			JSONError(w, http.StatusUnauthorized, "Missing authorization header", "auth_required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			JSONError(w, http.StatusUnauthorized, "Invalid authorization format", "invalid_auth")
			return
		}
		token := parts[1]

		user, err := m.userRepo.GetUserByToken(token)
		if err != nil || user == nil {
			JSONError(w, http.StatusUnauthorized, "Invalid token", "invalid_token")
			return
		}

		ctx := context.WithValue(r.Context(), ContextKeyUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserFromContext retrieves the user from request context
func GetUserFromContext(r *http.Request) *models.User {
	user, _ := r.Context().Value(ContextKeyUser).(*models.User)
	return user
}

// Handler holds HTTP handler dependencies
type Handler struct {
	db          *sql.DB
	convRepo    *dbpkg.ConversationRepository
	threadRepo  *dbpkg.ThreadRepository
	agentRepo   *dbpkg.AgentRepository
	userRepo    *dbpkg.UserRepository
	jsonl       *dbpkg.JSONLManager
	sseHandler  *SSEHandler
	writeQueue  *queue.WriteQueue
	notifyQueue *notification.NotificationQueue
	auth        *AuthMiddleware
}

// NewHandler creates a new HTTP handler
func NewHandler(db *sql.DB, jsonl *dbpkg.JSONLManager, sseHandler *SSEHandler, writeQueue *queue.WriteQueue, notifyQueue *notification.NotificationQueue) *Handler {
	userRepo := dbpkg.NewUserRepository(db)
	return &Handler{
		db:          db,
		convRepo:    dbpkg.NewConversationRepository(db),
		threadRepo:  dbpkg.NewThreadRepository(db),
		agentRepo:   dbpkg.NewAgentRepository(db),
		userRepo:    userRepo,
		jsonl:       jsonl,
		sseHandler:  sseHandler,
		writeQueue:  writeQueue,
		notifyQueue: notifyQueue,
		auth:        NewAuthMiddleware(userRepo),
	}
}

// SetupRouter configures the HTTP router
func SetupRouter(db *sql.DB, jsonl *dbpkg.JSONLManager, sseBroadcaster *SSEBroadcaster, writeQueue *queue.WriteQueue, notifyQueue *notification.NotificationQueue) http.Handler {
	mux := http.NewServeMux()
	userRepo := dbpkg.NewUserRepository(db)
	handler := NewHandler(db, jsonl, NewSSEHandler(sseBroadcaster, userRepo), writeQueue, notifyQueue)

	log.Printf("[DEBUG] Web root: %s", webRoot)
	log.Printf("[DEBUG] Static dir: %s", staticDir)
	log.Printf("[DEBUG] Index file: %s", indexFile)

	// API routes - register first so they take precedence
	apiMux := http.NewServeMux()

	// Agents (single method)
	apiMux.HandleFunc("/api/agents", handler.ListAgents)
	apiMux.HandleFunc("/api/agents/", handler.ListAgents)

	// Conversations - unified handler for all methods
	// Register both with and without trailing slash (ServeMux requires exact match)
	apiMux.HandleFunc("/api/conversations", handler.ConversationsHandler)
	apiMux.HandleFunc("/api/conversations/", handler.ConversationsHandler)

	// Threads - unified handler for all methods
	// Register both with and without trailing slash (ServeMux requires exact match)
	apiMux.HandleFunc("/api/threads", handler.ThreadsHandler)
	apiMux.HandleFunc("/api/threads/", handler.ThreadsHandler)

	// Messages (single method)
	apiMux.HandleFunc("/api/messages", handler.SendMessage)

	// User (single method)
	apiMux.HandleFunc("/api/user", handler.UpdateUser)

	// Apply auth middleware to /api routes
	authenticatedMux := handler.auth.RequireAuth(apiMux)
	mux.Handle("/api/", authenticatedMux)

	// SSE events (no auth - handled differently)
	mux.HandleFunc("/api/events", handler.sseHandler.HandleSSE)

	// Health check (no auth)
	mux.HandleFunc("/health", handler.HealthCheck)

	// Static files for Next.js
	mux.HandleFunc("/_next/static/", handler.ServeStaticFile)
	mux.HandleFunc("/favicon.ico", handler.ServeStaticFile)

	// SPA fallback - must be last
	mux.HandleFunc("/", handler.ServeSPA)

	return mux
}

// generateUUID generates a new UUID string
func generateUUID() string {
	return uuid.New().String()
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

// AgentResponse represents the API response for an agent
type AgentResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	Unread int    `json:"unread"`
}

// ListAgents handles GET /api/agents
func (h *Handler) ListAgents(w http.ResponseWriter, r *http.Request) {
	agents, err := h.agentRepo.ListAgents()
	if err != nil {
		log.Printf("Error listing agents: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Transform agents to API response format
	response := make([]AgentResponse, 0, len(agents))
	for _, agent := range agents {
		response = append(response, AgentResponse{
			ID:     agent.ID,
			Name:   agent.OpenclawAgentID,
			Status: "online", // Default status
			Unread: 0,        // Default unread count
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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

// ServeFile handles GET /api/files?path={encoded_file_path}
func (h *Handler) ServeFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "Missing path parameter", http.StatusBadRequest)
		return
	}

	// Decode the URL-encoded path
	decodedPath, err := url.QueryUnescape(filePath)
	if err != nil {
		http.Error(w, "Invalid path encoding", http.StatusBadRequest)
		return
	}

	// Clean the path to resolve any ".." or similar
	cleanPath := filepath.Clean(decodedPath)

	// Security: verify path is absolute
	if !filepath.IsAbs(cleanPath) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Check if file exists and is not a directory
	info, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if info.IsDir() {
		http.Error(w, "Cannot serve directory", http.StatusForbidden)
		return
	}

	// Read the file
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		log.Printf("Error reading file %s: %v", cleanPath, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Set content type based on file extension
	contentType := getFileContentType(cleanPath)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	w.Write(data)
}

// getFileContentType returns the content type for a file based on its extension
func getFileContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".txt", ".log", ".md", ".json", ".csv", ".xml", ".html", ".css", ".js", ".ts", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h":
		return "text/plain"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	default:
		return "application/octet-stream"
	}
}

// extractID extracts the ID from a URL path
func extractID(path, prefix string) string {
	id := path[len(prefix):]
	if len(id) == 0 || id[len(id)-1] == '/' {
		return ""
	}
	return id
}

// ConversationsHandler handles all /api/conversations/* methods
func (h *Handler) ConversationsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if this is /conversations (list/create) or /conversations/:id (get/update/delete)
	path := r.URL.Path
	isListPath := path == "/api/conversations" || path == "/api/conversations/"

	switch {
	case isListPath && r.Method == http.MethodGet:
		h.ListConversations(w, r)
	case isListPath && r.Method == http.MethodPost:
		h.CreateConversation(w, r)
	case !isListPath && r.Method == http.MethodGet:
		h.GetConversation(w, r)
	case !isListPath && r.Method == http.MethodPut:
		h.UpdateConversation(w, r)
	case !isListPath && r.Method == http.MethodDelete:
		h.DeleteConversation(w, r)
	default:
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
	}
}

// ThreadsHandler handles all /api/threads/* methods
func (h *Handler) ThreadsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if this is /threads (create) or /threads/:id (get/update)
	path := r.URL.Path
	isListPath := path == "/api/threads" || path == "/api/threads/"

	switch {
	case isListPath && r.Method == http.MethodPost:
		h.CreateThread(w, r)
	case !isListPath && r.Method == http.MethodGet:
		h.GetThread(w, r)
	case !isListPath && r.Method == http.MethodPut:
		h.UpdateThread(w, r)
	default:
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
	}
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

// =============================================================================
// API Endpoint Handlers
// =============================================================================

// CreateConversationRequest represents the request body for creating a conversation
type CreateConversationRequest struct {
	Type      string   `json:"type"`
	AgentIDs  []string `json:"agent_ids"`
	GroupName string   `json:"group_name"`
}

// CreateConversation handles POST /api/conversations
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	var req CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	if req.Type != "group" {
		JSONError(w, http.StatusBadRequest, "Only 'group' type supported", "invalid_type")
		return
	}

	if req.GroupName == "" || len(req.GroupName) > 255 {
		JSONError(w, http.StatusBadRequest, "group_name required (max 255 bytes)", "invalid_group_name")
		return
	}

	if len(req.AgentIDs) < 1 {
		JSONError(w, http.StatusBadRequest, "At least 1 agent_id required", "invalid_agent_ids")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	conv := &models.Conversation{
		ID:        generateUUID(),
		Type:      "group",
		AgentIDs:  req.AgentIDs,
		ThreadIDs: []string{},
		GroupName: &req.GroupName,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.convRepo.CreateConversation(conv); err != nil {
		log.Printf("Error creating conversation: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to create conversation", "db_error")
		return
	}

	JSONResponse(w, http.StatusCreated, conv)
}

// CreateThreadRequest represents the request body for creating a thread
type CreateThreadRequest struct {
	ConvID string `json:"conv_id"`
	Topic  string `json:"topic"`
}

// CreateThread handles POST /api/threads
func (h *Handler) CreateThread(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	var req CreateThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	if req.ConvID == "" {
		JSONError(w, http.StatusBadRequest, "conv_id required", "missing_conv_id")
		return
	}

	if req.Topic == "" || len(req.Topic) > 255 {
		JSONError(w, http.StatusBadRequest, "topic required (max 255 bytes)", "invalid_topic")
		return
	}

	conv, err := h.convRepo.GetConversation(req.ConvID)
	if err != nil || conv == nil {
		JSONError(w, http.StatusNotFound, "Conversation not found", "conv_not_found")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	thread := &models.Thread{
		ID:               generateUUID(),
		ConvID:           req.ConvID,
		Topic:            req.Topic,
		Status:           "active",
		OpenclawSessions: []models.OpenclawSession{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := h.threadRepo.CreateThread(thread); err != nil {
		log.Printf("Error creating thread: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to create thread", "db_error")
		return
	}

	h.convRepo.AddThreadToConversation(req.ConvID, thread.ID)

	JSONResponse(w, http.StatusCreated, thread)
}

// SendMessageRequest represents the request body for sending a message
type SendMessageRequest struct {
	ThreadID       string   `json:"thread_id"`
	Content        string   `json:"content"`
	FilePath       string   `json:"file_path,omitempty"`
	QuoteMessageID int      `json:"quote_message_id,omitempty"`
	Mention        []string `json:"mention,omitempty"`
}

// SendMessage handles POST /api/messages
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	if req.ThreadID == "" {
		JSONError(w, http.StatusBadRequest, "thread_id required", "missing_thread_id")
		return
	}

	if req.Content == "" {
		JSONError(w, http.StatusBadRequest, "content required", "missing_content")
		return
	}

	user := GetUserFromContext(r)
	if user == nil {
		JSONError(w, http.StatusUnauthorized, "User not authenticated", "unauthenticated")
		return
	}

	thread, err := h.threadRepo.GetThread(req.ThreadID)
	if err != nil || thread == nil {
		JSONError(w, http.StatusNotFound, "Thread not found", "thread_not_found")
		return
	}

	// Check if thread is closed
	if thread.Status == "closed" {
		JSONError(w, http.StatusBadRequest, "Cannot send message to closed thread", "thread_closed")
		return
	}

	conv, err := h.convRepo.GetConversation(thread.ConvID)
	if err != nil || conv == nil {
		JSONError(w, http.StatusNotFound, "Conversation not found", "conv_not_found")
		return
	}

	// Build from field: "HUMAN USER: {userName}:{userTitle}"
	fromField := fmt.Sprintf("HUMAN USER: %s", user.Name)
	if user.Title != "" {
		fromField = fmt.Sprintf("HUMAN USER: %s:%s", user.Name, user.Title)
	}

	msg := models.Message{
		From:            fromField,
		Content:         req.Content,
		FilePath:        req.FilePath,
		QuotedMessageID: nil,
		Mention:         req.Mention,
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
	}

	if req.QuoteMessageID != 0 {
		msg.QuotedMessageID = &req.QuoteMessageID
		// Auto-add quoted message sender to mentions
		quotedMsg := h.jsonl.GetMessage(req.ThreadID, thread.ConvID, req.QuoteMessageID)
		if quotedMsg != nil {
			// Check if sender is an agent (not human user)
			if !strings.HasPrefix(quotedMsg.From, "HUMAN USER:") {
				// Convert sender's lechat_agent_id to openclaw_agent_id
				openclawID := h.getOpenClawAgentIDByLechatID(quotedMsg.From)
				if openclawID != "" {
					msg.Mention = append(msg.Mention, openclawID)
				}
			}
		}
	}

	// Enqueue for writing
	writeTask := &queue.WriteTask{
		ThreadID: req.ThreadID,
		ConvID:   thread.ConvID,
		Message:  msg,
	}
	h.writeQueue.Enqueue(writeTask)

	// Enqueue for notification
	notifyTask := &notification.NotificationTask{
		ThreadID:    req.ThreadID,
		ConvID:      thread.ConvID,
		ConvType:    conv.Type,
		FromAgentID: "user:" + user.ID,
		Message:     msg,
		Mentioned:   msg.Mention,
	}
	h.notifyQueue.Enqueue(notifyTask)

	// Broadcast via SSE
	h.sseHandler.BroadcastNewMessage(req.ThreadID, thread.ConvID, msg)
	h.sseHandler.BroadcastThreadUpdated(req.ThreadID, thread.ConvID, msg.Timestamp)

	JSONResponse(w, http.StatusCreated, map[string]interface{}{"message": msg})
}

// getOpenClawAgentIDByLechatID retrieves the OpenClaw agent ID for a given LeChat agent ID
func (h *Handler) getOpenClawAgentIDByLechatID(lechatAgentID string) string {
	query := `SELECT openclaw_agent_id FROM agent WHERE id = ?`
	var openclawID string
	err := h.db.QueryRow(query, lechatAgentID).Scan(&openclawID)
	if err != nil {
		return ""
	}
	return openclawID
}

// UpdateConversationRequest represents the request body for updating a conversation
type UpdateConversationRequest struct {
	GroupName      string   `json:"group_name,omitempty"`
	AddAgentIDs    []string `json:"add_agent_ids,omitempty"`
	RemoveAgentIDs []string `json:"remove_agent_ids,omitempty"`
}

// UpdateConversation handles PUT /api/conversations/:id
func (h *Handler) UpdateConversation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	id := extractID(r.URL.Path, "/api/conversations/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "Missing conversation ID", "missing_id")
		return
	}

	var req UpdateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	conv, err := h.convRepo.GetConversation(id)
	if err != nil || conv == nil {
		JSONError(w, http.StatusNotFound, "Conversation not found", "conv_not_found")
		return
	}

	if conv.Type != "group" {
		JSONError(w, http.StatusBadRequest, "DM conversations cannot be updated via API", "invalid_type")
		return
	}

	if req.GroupName != "" {
		if len(req.GroupName) > 255 {
			JSONError(w, http.StatusBadRequest, "group_name too long (max 255 bytes)", "invalid_group_name")
			return
		}
		conv.GroupName = &req.GroupName
	}

	if len(req.AddAgentIDs) > 0 {
		existingIDs := make(map[string]bool)
		for _, id := range conv.AgentIDs {
			existingIDs[id] = true
		}
		for _, id := range req.AddAgentIDs {
			if !existingIDs[id] {
				conv.AgentIDs = append(conv.AgentIDs, id)
			}
		}
	}

	if len(req.RemoveAgentIDs) > 0 {
		removeIDs := make(map[string]bool)
		for _, id := range req.RemoveAgentIDs {
			removeIDs[id] = true
		}
		newAgentIDs := []string{}
		for _, id := range conv.AgentIDs {
			if !removeIDs[id] {
				newAgentIDs = append(newAgentIDs, id)
			}
		}
		conv.AgentIDs = newAgentIDs
	}

	conv.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.convRepo.UpdateConversation(conv); err != nil {
		log.Printf("Error updating conversation: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to update conversation", "db_error")
		return
	}

	JSONResponse(w, http.StatusOK, conv)
}

// UpdateThreadRequest represents the request body for updating a thread
type UpdateThreadRequest struct {
	Topic  string `json:"topic,omitempty"`
	Status string `json:"status,omitempty"`
}

// UpdateThread handles PUT /api/threads/:id
func (h *Handler) UpdateThread(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	id := extractID(r.URL.Path, "/api/threads/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "Missing thread ID", "missing_id")
		return
	}

	var req UpdateThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	thread, err := h.threadRepo.GetThread(id)
	if err != nil || thread == nil {
		JSONError(w, http.StatusNotFound, "Thread not found", "thread_not_found")
		return
	}

	if req.Status != "" && req.Status != "active" && req.Status != "closed" {
		JSONError(w, http.StatusBadRequest, "status must be 'active' or 'closed'", "invalid_status")
		return
	}

	if req.Topic != "" {
		if len(req.Topic) > 255 {
			JSONError(w, http.StatusBadRequest, "topic too long (max 255 bytes)", "invalid_topic")
			return
		}
		thread.Topic = req.Topic
	}

	if req.Status != "" {
		thread.Status = req.Status
	}

	thread.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.threadRepo.UpdateThread(thread); err != nil {
		log.Printf("Error updating thread: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to update thread", "db_error")
		return
	}

	JSONResponse(w, http.StatusOK, thread)
}

// UpdateUserRequest represents the request body for updating a user
type UpdateUserRequest struct {
	Name  string `json:"name,omitempty"`
	Title string `json:"title,omitempty"`
}

// UpdateUser handles PUT /api/user
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	user := GetUserFromContext(r)
	if user == nil {
		JSONError(w, http.StatusUnauthorized, "User not authenticated", "unauthenticated")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid request body", "invalid_body")
		return
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Title != "" {
		user.Title = req.Title
	}
	user.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.userRepo.UpdateUser(user); err != nil {
		log.Printf("Error updating user: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to update user", "db_error")
		return
	}

	JSONResponse(w, http.StatusOK, user)
}

// DeleteConversation handles DELETE /api/conversations/:id
func (h *Handler) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		JSONError(w, http.StatusMethodNotAllowed, "Method not allowed", "method_not_allowed")
		return
	}

	id := extractID(r.URL.Path, "/api/conversations/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "Missing conversation ID", "missing_id")
		return
	}

	conv, err := h.convRepo.GetConversation(id)
	if err != nil || conv == nil {
		JSONError(w, http.StatusNotFound, "Conversation not found", "conv_not_found")
		return
	}

	if conv.Type != "group" {
		JSONError(w, http.StatusBadRequest, "DM conversations cannot be deleted", "invalid_type")
		return
	}

	// Delete messages folder
	messagesDir := h.jsonl.GetMessagesDir()
	convMessagesDir := filepath.Join(messagesDir, conv.ID)
	os.RemoveAll(convMessagesDir)

	// Delete from database (cascade deletes threads)
	_, err = h.db.Exec("DELETE FROM conversation WHERE id = ?", id)
	if err != nil {
		log.Printf("Error deleting conversation: %v", err)
		JSONError(w, http.StatusInternalServerError, "Failed to delete conversation", "db_error")
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}
