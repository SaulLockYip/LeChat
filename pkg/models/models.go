package models

import "database/sql"

type Agent struct {
	ID                string `json:"id"`
	OpenclawAgentID   string `json:"openclaw_agent_id"`
	OpenclawWorkspace string `json:"openclaw_workspace"`
	OpenclawAgentDir  string `json:"openclaw_agent_dir"`
	Token             string `json:"-"` // hidden from API
}

type Conversation struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"` // "dm" or "group"
	AgentIDs   []string `json:"lechat_agent_ids"`
	ThreadIDs  []string `json:"thread_ids"`
	GroupName  *string  `json:"group_name,omitempty"`
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
}

type OpenclawSession struct {
	LechatAgentID   string `json:"lechat_agent_id"`
	OpenclawAgentID string `json:"openclaw_agent_id"`
	SessionID       string `json:"openclaw_session_id"`
}

type Thread struct {
	ID               string            `json:"id"`
	ConvID           string            `json:"conv_id"`
	Topic            string            `json:"topic"`
	Status           string            `json:"status"`
	OpenclawSessions []OpenclawSession `json:"openclaw_sessions"`
	CreatedAt        string            `json:"created_at"`
	UpdatedAt        string            `json:"updated_at"`
}

type Message struct {
	ID              int      `json:"id"`
	From            string   `json:"from"`
	Content         string   `json:"content"`
	FilePath        string   `json:"file_path,omitempty"`
	QuotedMessageID *int     `json:"quoted_message_id,omitempty"`
	Mention         []string `json:"mention,omitempty"`
	Timestamp       string   `json:"timestamp"`
}

// NullableString is used for scanning nullable string columns from SQLite
type NullableString = sql.NullString

type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Title     string `json:"title,omitempty"`
	Token     string `json:"-"` // hidden from API
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
