package db

import (
	"database/sql"
	"encoding/json"

	"github.com/lechat/pkg/models"
)

type AgentRepository struct {
	db *sql.DB
}

func NewAgentRepository(db *sql.DB) *AgentRepository {
	return &AgentRepository{db: db}
}

func (r *AgentRepository) CreateAgent(agent *models.Agent) error {
	query := `
		INSERT INTO agent (id, openclaw_agent_id, openclaw_workspace, openclaw_agent_dir, token)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, agent.ID, agent.OpenclawAgentID, agent.OpenclawWorkspace, agent.OpenclawAgentDir, agent.Token)
	return err
}

func (r *AgentRepository) GetAgentByToken(token string) (*models.Agent, error) {
	query := `
		SELECT id, openclaw_agent_id, openclaw_workspace, openclaw_agent_dir, token
		FROM agent
		WHERE token = ?
	`
	row := r.db.QueryRow(query, token)

	var agent models.Agent
	err := row.Scan(&agent.ID, &agent.OpenclawAgentID, &agent.OpenclawWorkspace, &agent.OpenclawAgentDir, &agent.Token)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

func (r *AgentRepository) GetAgentByID(id string) (*models.Agent, error) {
	query := `
		SELECT id, openclaw_agent_id, openclaw_workspace, openclaw_agent_dir, token
		FROM agent
		WHERE id = ?
	`
	row := r.db.QueryRow(query, id)

	var agent models.Agent
	err := row.Scan(&agent.ID, &agent.OpenclawAgentID, &agent.OpenclawWorkspace, &agent.OpenclawAgentDir, &agent.Token)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

func (r *AgentRepository) GetAgentByOpenClawAgentID(openclawAgentID string) (*models.Agent, error) {
	query := `
		SELECT id, openclaw_agent_id, openclaw_workspace, openclaw_agent_dir, token
		FROM agent
		WHERE openclaw_agent_id = ?
	`
	row := r.db.QueryRow(query, openclawAgentID)

	var agent models.Agent
	err := row.Scan(&agent.ID, &agent.OpenclawAgentID, &agent.OpenclawWorkspace, &agent.OpenclawAgentDir, &agent.Token)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

func (r *AgentRepository) ListAgents() ([]*models.Agent, error) {
	query := `
		SELECT id, openclaw_agent_id, openclaw_workspace, openclaw_agent_dir, token
		FROM agent
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*models.Agent
	for rows.Next() {
		var agent models.Agent
		if err := rows.Scan(&agent.ID, &agent.OpenclawAgentID, &agent.OpenclawWorkspace, &agent.OpenclawAgentDir, &agent.Token); err != nil {
			return nil, err
		}
		agents = append(agents, &agent)
	}
	return agents, rows.Err()
}

// GetAgentIDsByTokenSet returns a map of agent IDs for a given set of tokens
func (r *AgentRepository) GetAgentIDsByTokenSet(tokens []string) (map[string]string, error) {
	if len(tokens) == 0 {
		return make(map[string]string), nil
	}

	placeholders := ""
	args := make([]interface{}, len(tokens))
	for i, token := range tokens {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = token
	}

	query := `SELECT id, token FROM agent WHERE token IN (` + placeholders + `)`
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var id, token string
		if err := rows.Scan(&id, &token); err != nil {
			return nil, err
		}
		result[token] = id
	}
	return result, rows.Err()
}

// MarshalAgentIDs converts a slice of agent IDs to JSON string for storage
func MarshalAgentIDs(ids []string) (string, error) {
	data, err := json.Marshal(ids)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalAgentIDs converts a JSON string back to a slice of agent IDs
func UnmarshalAgentIDs(data string) ([]string, error) {
	var ids []string
	if data == "" {
		return ids, nil
	}
	err := json.Unmarshal([]byte(data), &ids)
	return ids, err
}
