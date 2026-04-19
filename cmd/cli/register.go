package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/lechat/pkg/models"
	"github.com/spf13/cobra"
)

var registerCmd = &cobra.Command{
	Use:   "register",
	Short: "Register an OpenClaw agent to LeChat",
	Long:  `Register an OpenClaw agent to LeChat by providing the OpenClaw agent ID.`,
	Args:  cobra.NoArgs,
	RunE:  runRegister,
}

var openclawAgentID string

func init() {
	registerCmd.Flags().StringVar(&openclawAgentID, "openclaw-agent-id", "", "OpenClaw agent ID to register")
	registerCmd.MarkFlagRequired("openclaw-agent-id")
}

type OpenClawConfig struct {
	Agents struct {
		List     []OpenClawAgent `json:"list"`
		Defaults struct {
			Workspace string `json:"workspace"`
		} `json:"defaults"`
	} `json:"agents"`
}

type OpenClawAgent struct {
	ID        string `json:"id"`
	Workspace string `json:"workspace"`
	AgentDir  string `json:"agentDir"`
}

func runRegister(cmd *cobra.Command, args []string) error {
	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Read openclaw.json
	openclawConfigPath := filepath.Join(cfg.OpenclawDir, "openclaw.json")
	data, err := os.ReadFile(openclawConfigPath)
	if err != nil {
		return fmt.Errorf("failed to read openclaw.json: %w", err)
	}

	var openclawCfg OpenClawConfig
	if err := json.Unmarshal(data, &openclawCfg); err != nil {
		return fmt.Errorf("failed to parse openclaw.json: %w", err)
	}

	// Find agent in list
	var selectedAgent *OpenClawAgent
	for i, agent := range openclawCfg.Agents.List {
		if agent.ID == openclawAgentID {
			selectedAgent = &openclawCfg.Agents.List[i]
			break
		}
	}

	if selectedAgent == nil {
		return fmt.Errorf("agent '%s' not found in openclaw.json", openclawAgentID)
	}

	// Handle "main" agent special case
	workspace := selectedAgent.Workspace
	agentDir := selectedAgent.AgentDir

	if openclawAgentID == "main" {
		workspace = openclawCfg.Agents.Defaults.Workspace
		agentDir = filepath.Join(cfg.OpenclawDir, "agents", "main")
	} else {
		// Strip "/agent" suffix if present to get the correct agent directory
		// sessions.json is at: {openclaw_dir}/agents/{openclaw_agent_id}/sessions/sessions.json
		if strings.HasSuffix(agentDir, "/agent") {
			agentDir = strings.TrimSuffix(agentDir, "/agent")
		}
	}

	// Check sessions.json exists
	sessionsPath := filepath.Join(agentDir, "sessions", "sessions.json")
	if _, err := os.Stat(sessionsPath); os.IsNotExist(err) {
		return fmt.Errorf("sessions.json not found at %s", sessionsPath)
	}

	// Generate UUID for lechat_agent_id
	lechatAgentID := uuid.New().String()

	// Generate token: "sk-lechat-" + random string
	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		return fmt.Errorf("failed to generate token: %w", err)
	}
	token := "sk-lechat-" + hex.EncodeToString(tokenBytes)

	// Insert into agent table
	agent := &models.Agent{
		ID:                lechatAgentID,
		OpenclawAgentID:   openclawAgentID,
		OpenclawWorkspace: workspace,
		OpenclawAgentDir:  agentDir,
		Token:             token,
	}

	database, err := initDB(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	agentRepo := lechatdb.NewAgentRepository(database)

	// Check if agent with same OpenClaw agent ID already exists
	existingAgent, err := agentRepo.GetAgentByOpenClawAgentID(openclawAgentID)
	if err != nil {
		return fmt.Errorf("failed to check existing agent: %w", err)
	}
	if existingAgent != nil {
		return fmt.Errorf("agent with OpenClaw agent ID '%s' is already registered", openclawAgentID)
	}

	if err := agentRepo.CreateAgent(agent); err != nil {
		return fmt.Errorf("failed to create agent: %w", err)
	}

	// Auto-create DMs with all existing agents
	existingAgents, err := agentRepo.ListAgents()
	if err == nil {
		convRepo := lechatdb.NewConversationRepository(database)
		now := time.Now().UTC().Format(time.RFC3339)

		for _, existingAgent := range existingAgents {
			// Skip self
			if existingAgent.ID == agent.ID {
				continue
			}

			// Check if DM already exists
			agentIDs := []string{agent.ID, existingAgent.ID}
			existingConv, err := convRepo.GetConversationByAgents(agentIDs)
			if err == nil && existingConv == nil {
				// Create new DM
				conv := &models.Conversation{
					ID:        generateUUID(),
					Type:      "dm",
					AgentIDs:  agentIDs,
					ThreadIDs: []string{},
					CreatedAt: now,
					UpdatedAt: now,
				}
				convRepo.CreateConversation(conv)
			}
		}
	}

	// Print token to stdout
	fmt.Println(token)

	return nil
}
