package main

import (
	"encoding/json"
	"fmt"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/spf13/cobra"
)

var agentsCmd = &cobra.Command{
	Use:   "agents",
	Short: "Manage agents",
}

var agentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all registered agents",
	RunE:  runAgentsList,
}

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Get current agent info",
	RunE:  runWhoami,
}

func init() {
	agentsCmd.AddCommand(agentsListCmd)
	agentsCmd.AddCommand(whoamiCmd)
}

func runAgentsList(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}

	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	database, err := initDB(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	agentRepo := lechatdb.NewAgentRepository(database)

	// Validate token first
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil {
		return fmt.Errorf("failed to validate token: %w", err)
	}
	if agent == nil {
		return fmt.Errorf("invalid token")
	}

	// List all agents
	agents, err := agentRepo.ListAgents()
	if err != nil {
		return fmt.Errorf("failed to list agents: %w", err)
	}

	// Hide token field for each agent
	type AgentResponse struct {
		ID                string `json:"id"`
		OpenclawAgentID   string `json:"openclaw_agent_id"`
		OpenclawWorkspace string `json:"openclaw_workspace"`
		OpenclawAgentDir  string `json:"openclaw_agent_dir"`
	}

	var response []AgentResponse
	for _, a := range agents {
		response = append(response, AgentResponse{
			ID:                a.ID,
			OpenclawAgentID:   a.OpenclawAgentID,
			OpenclawWorkspace: a.OpenclawWorkspace,
			OpenclawAgentDir:  a.OpenclawAgentDir,
		})
	}

	output, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func runWhoami(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}

	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	database, err := initDB(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	agentRepo := lechatdb.NewAgentRepository(database)

	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil {
		return fmt.Errorf("failed to validate token: %w", err)
	}
	if agent == nil {
		return fmt.Errorf("invalid token")
	}

	type WhoamiResponse struct {
		ID                string `json:"lechat_agent_id"`
		OpenclawAgentID   string `json:"openclaw_agent_id"`
		OpenclawWorkspace string `json:"openclaw_workspace"`
		OpenclawAgentDir  string `json:"openclaw_agent_dir"`
	}

	response := WhoamiResponse{
		ID:                agent.ID,
		OpenclawAgentID:   agent.OpenclawAgentID,
		OpenclawWorkspace: agent.OpenclawWorkspace,
		OpenclawAgentDir:  agent.OpenclawAgentDir,
	}

	output, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}
