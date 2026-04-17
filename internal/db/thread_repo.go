package db

import (
	"database/sql"
	"encoding/json"

	"github.com/lechat/pkg/models"
)

type ThreadRepository struct {
	db *sql.DB
}

func NewThreadRepository(db *sql.DB) *ThreadRepository {
	return &ThreadRepository{db: db}
}

func (r *ThreadRepository) CreateThread(thread *models.Thread) error {
	openclawSessionsJSON, err := json.Marshal(thread.OpenclawSessions)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO thread (id, conv_id, topic, status, openclaw_sessions, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err = r.db.Exec(query, thread.ID, thread.ConvID, thread.Topic, thread.Status, string(openclawSessionsJSON), thread.CreatedAt, thread.UpdatedAt)
	return err
}

func (r *ThreadRepository) GetThread(id string) (*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
		WHERE id = ?
	`
	row := r.db.QueryRow(query, id)

	var thread models.Thread
	var openclawSessionsJSON string
	err := row.Scan(&thread.ID, &thread.ConvID, &thread.Topic, &thread.Status, &openclawSessionsJSON, &thread.CreatedAt, &thread.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := json.Unmarshal([]byte(openclawSessionsJSON), &thread.OpenclawSessions); err != nil {
		return nil, err
	}

	return &thread, nil
}

func (r *ThreadRepository) UpdateThread(thread *models.Thread) error {
	openclawSessionsJSON, err := json.Marshal(thread.OpenclawSessions)
	if err != nil {
		return err
	}

	query := `
		UPDATE thread
		SET conv_id = ?, topic = ?, status = ?, openclaw_sessions = ?, updated_at = ?
		WHERE id = ?
	`
	result, err := r.db.Exec(query, thread.ConvID, thread.Topic, thread.Status, string(openclawSessionsJSON), thread.UpdatedAt, thread.ID)
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

func (r *ThreadRepository) ListThreadsByConversation(convID string) ([]*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
		WHERE conv_id = ?
	`
	rows, err := r.db.Query(query, convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var threads []*models.Thread
	for rows.Next() {
		var thread models.Thread
		var openclawSessionsJSON string
		if err := rows.Scan(&thread.ID, &thread.ConvID, &thread.Topic, &thread.Status, &openclawSessionsJSON, &thread.CreatedAt, &thread.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(openclawSessionsJSON), &thread.OpenclawSessions); err != nil {
			return nil, err
		}

		threads = append(threads, &thread)
	}
	return threads, rows.Err()
}

// ListThreadsByStatus returns all threads with the given status
func (r *ThreadRepository) ListThreadsByStatus(status string) ([]*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
		WHERE status = ?
	`
	rows, err := r.db.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var threads []*models.Thread
	for rows.Next() {
		var thread models.Thread
		var openclawSessionsJSON string
		if err := rows.Scan(&thread.ID, &thread.ConvID, &thread.Topic, &thread.Status, &openclawSessionsJSON, &thread.CreatedAt, &thread.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(openclawSessionsJSON), &thread.OpenclawSessions); err != nil {
			return nil, err
		}

		threads = append(threads, &thread)
	}
	return threads, rows.Err()
}

// ListAllThreads returns all threads
func (r *ThreadRepository) ListAllThreads() ([]*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var threads []*models.Thread
	for rows.Next() {
		var thread models.Thread
		var openclawSessionsJSON string
		if err := rows.Scan(&thread.ID, &thread.ConvID, &thread.Topic, &thread.Status, &openclawSessionsJSON, &thread.CreatedAt, &thread.UpdatedAt); err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(openclawSessionsJSON), &thread.OpenclawSessions); err != nil {
			return nil, err
		}

		threads = append(threads, &thread)
	}
	return threads, rows.Err()
}

// AddOpenclawSession adds an openclaw session to a thread
func (r *ThreadRepository) AddOpenclawSession(threadID string, session models.OpenclawSession) error {
	thread, err := r.GetThread(threadID)
	if err != nil {
		return err
	}
	if thread == nil {
		return sql.ErrNoRows
	}

	// Check if session already exists for this agent
	for i, s := range thread.OpenclawSessions {
		if s.LechatAgentID == session.LechatAgentID {
			// Update existing session
			thread.OpenclawSessions[i].SessionID = session.SessionID
			return r.UpdateThread(thread)
		}
	}

	thread.OpenclawSessions = append(thread.OpenclawSessions, session)
	return r.UpdateThread(thread)
}

// MarshalOpenclawSessions converts openclaw sessions to JSON string for storage
func MarshalOpenclawSessions(sessions []models.OpenclawSession) (string, error) {
	data, err := json.Marshal(sessions)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalOpenclawSessions converts a JSON string back to openclaw sessions
func UnmarshalOpenclawSessions(data string) ([]models.OpenclawSession, error) {
	var sessions []models.OpenclawSession
	if data == "" || data == "[]" {
		return sessions, nil
	}
	err := json.Unmarshal([]byte(data), &sessions)
	return sessions, err
}
