package db

import (
	"database/sql"
	"encoding/json"
	"sort"
	"strings"

	"github.com/lechat/pkg/models"
)

type ConversationRepository struct {
	db *sql.DB
}

func NewConversationRepository(db *sql.DB) *ConversationRepository {
	return &ConversationRepository{db: db}
}

func (r *ConversationRepository) CreateConversation(conv *models.Conversation) error {
	agentIDsJSON, err := json.Marshal(conv.AgentIDs)
	if err != nil {
		return err
	}

	threadIDsJSON, err := json.Marshal(conv.ThreadIDs)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO conversation (id, type, agent_ids, thread_ids, group_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err = r.db.Exec(query, conv.ID, conv.Type, string(agentIDsJSON), string(threadIDsJSON), conv.GroupName, conv.CreatedAt, conv.UpdatedAt)
	return err
}

func (r *ConversationRepository) GetConversation(id string) (*models.Conversation, error) {
	query := `
		SELECT id, type, agent_ids, thread_ids, group_name, created_at, updated_at
		FROM conversation
		WHERE id = ?
	`
	row := r.db.QueryRow(query, id)

	var conv models.Conversation
	var agentIDsJSON, threadIDsJSON string
	err := row.Scan(&conv.ID, &conv.Type, &agentIDsJSON, &threadIDsJSON, &conv.GroupName, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := json.Unmarshal([]byte(agentIDsJSON), &conv.AgentIDs); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(threadIDsJSON), &conv.ThreadIDs); err != nil {
		return nil, err
	}

	return &conv, nil
}

func (r *ConversationRepository) UpdateConversation(conv *models.Conversation) error {
	agentIDsJSON, err := json.Marshal(conv.AgentIDs)
	if err != nil {
		return err
	}

	threadIDsJSON, err := json.Marshal(conv.ThreadIDs)
	if err != nil {
		return err
	}

	query := `
		UPDATE conversation
		SET type = ?, agent_ids = ?, thread_ids = ?, group_name = ?, updated_at = ?
		WHERE id = ?
	`
	result, err := r.db.Exec(query, conv.Type, string(agentIDsJSON), string(threadIDsJSON), conv.GroupName, conv.UpdatedAt, conv.ID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *ConversationRepository) ListConversations() ([]*models.Conversation, error) {
	query := `
		SELECT id, type, agent_ids, thread_ids, group_name, created_at, updated_at
		FROM conversation
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []*models.Conversation
	for rows.Next() {
		var conv models.Conversation
		var agentIDsJSON, threadIDsJSON string
		if err := rows.Scan(&conv.ID, &conv.Type, &agentIDsJSON, &threadIDsJSON, &conv.GroupName, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(agentIDsJSON), &conv.AgentIDs); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(threadIDsJSON), &conv.ThreadIDs); err != nil {
			return nil, err
		}

		conversations = append(conversations, &conv)
	}
	return conversations, rows.Err()
}

// AddThreadToConversation adds a thread ID to an existing conversation
func (r *ConversationRepository) AddThreadToConversation(convID, threadID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var agentIDsJSON, threadIDsJSON string
	err = tx.QueryRow("SELECT agent_ids, thread_ids FROM conversation WHERE id = ?", convID).Scan(&agentIDsJSON, &threadIDsJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return sql.ErrNoRows
		}
		return err
	}

	var threadIDs []string
	if err := json.Unmarshal([]byte(threadIDsJSON), &threadIDs); err != nil {
		return err
	}

	// Check if thread ID already exists
	for _, t := range threadIDs {
		if t == threadID {
			return nil // already exists
		}
	}

	threadIDs = append(threadIDs, threadID)
	updatedThreadIDs, err := json.Marshal(threadIDs)
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE conversation SET thread_ids = ?, updated_at = datetime('now') WHERE id = ?", string(updatedThreadIDs), convID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetConversationsByAgentID returns all conversations that contain the given agent ID
func (r *ConversationRepository) GetConversationsByAgentID(agentID string) ([]*models.Conversation, error) {
	query := `
		SELECT id, type, agent_ids, thread_ids, group_name, created_at, updated_at
		FROM conversation
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []*models.Conversation
	for rows.Next() {
		var conv models.Conversation
		var agentIDsJSON, threadIDsJSON string
		if err := rows.Scan(&conv.ID, &conv.Type, &agentIDsJSON, &threadIDsJSON, &conv.GroupName, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(agentIDsJSON), &conv.AgentIDs); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(threadIDsJSON), &conv.ThreadIDs); err != nil {
			return nil, err
		}

		// Check if agent ID is in the conversation
		found := false
		for _, aID := range conv.AgentIDs {
			if aID == agentID {
				found = true
				break
			}
		}
		if found {
			conversations = append(conversations, &conv)
		}
	}
	return conversations, rows.Err()
}

// GetConversationByAgents returns a conversation that contains exactly the given agent IDs (for DMs)
func (r *ConversationRepository) GetConversationByAgents(agentIDs []string) (*models.Conversation, error) {
	// First get all DM conversations
	query := `
		SELECT id, type, agent_ids, thread_ids, group_name, created_at, updated_at
		FROM conversation
		WHERE type = 'dm'
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var conv models.Conversation
		var agentIDsJSON, threadIDsJSON string
		if err := rows.Scan(&conv.ID, &conv.Type, &agentIDsJSON, &threadIDsJSON, &conv.GroupName, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(agentIDsJSON), &conv.AgentIDs); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(threadIDsJSON), &conv.ThreadIDs); err != nil {
			return nil, err
		}

		// Check if agent IDs match exactly (order-independent)
		if len(conv.AgentIDs) == len(agentIDs) {
			// Sort both slices for order-independent comparison
			sortedConvAgents := make([]string, len(conv.AgentIDs))
			copy(sortedConvAgents, conv.AgentIDs)
			sortedInputAgents := make([]string, len(agentIDs))
			copy(sortedInputAgents, agentIDs)
			sort.Strings(sortedConvAgents)
			sort.Strings(sortedInputAgents)

			match := true
			for i := range sortedConvAgents {
				if sortedConvAgents[i] != sortedInputAgents[i] {
					match = false
					break
				}
			}
			if match {
				return &conv, nil
			}
		}
	}
	return nil, nil
}

// MarshalThreadIDs converts a slice of thread IDs to JSON string for storage
func MarshalThreadIDs(ids []string) (string, error) {
	data, err := json.Marshal(ids)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalThreadIDs converts a JSON string back to a slice of thread IDs
func UnmarshalThreadIDs(data string) ([]string, error) {
	var ids []string
	if data == "" || data == "[]" {
		return ids, nil
	}
	err := json.Unmarshal([]byte(data), &ids)
	return ids, err
}

// JoinAgentIDs is a helper to join agent IDs for comparison
func JoinAgentIDs(ids []string) string {
	return "[" + strings.Join(ids, ",") + "]"
}
