package main

import (
	"encoding/json"
	"fmt"
	"time"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/lechat/pkg/models"
	"github.com/spf13/cobra"
)

var convCmd = &cobra.Command{
	Use:   "conv",
	Short: "Manage conversations",
}

var convListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all conversations for the agent",
	RunE:  runConvList,
}

var convGetCmd = &cobra.Command{
	Use:   "get",
	Short: "Get a conversation by ID",
	RunE:  runConvGet,
}

// DM subcommand parent
var convDMCmd = &cobra.Command{
	Use:   "dm",
	Short: "DM conversation commands",
	Long:  `DM conversations are automatically created when agents register.
Use 'lechat conv dm list' to view your DM conversations.`,
}

var convDMListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all DM conversations",
	RunE:  runConvDMList,
}

// Group subcommand parent
var convGroupCmd = &cobra.Command{
	Use:   "group",
	Short: "Group conversation commands",
}

var convGroupListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all group conversations",
	RunE:  runConvGroupList,
}

var convGroupCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a group conversation",
	RunE:  runConvGroupCreate,
}

var convGroupJoinCmd = &cobra.Command{
	Use:   "join",
	Short: "Join a group conversation",
	Long:  `Join an existing group conversation. The agent is identified by its token.
The conversation must be a group type (not DM).`,
	RunE:  runConvGroupJoin,
}

var (
	convID      string
	convName    string
	convMembers string
)

func init() {
	convCmd.AddCommand(convListCmd)
	convCmd.AddCommand(convGetCmd)
	convCmd.AddCommand(convDMCmd)
	convCmd.AddCommand(convGroupCmd)

	// Add dm subcommands
	convDMCmd.AddCommand(convDMListCmd)

	// Add group subcommands
	convGroupCmd.AddCommand(convGroupListCmd)
	convGroupCmd.AddCommand(convGroupCreateCmd)
	convGroupCmd.AddCommand(convGroupJoinCmd)

	convGroupJoinCmd.Flags().StringVar(&convID, "conv-id", "", "Conversation ID")
	convGroupJoinCmd.MarkFlagRequired("conv-id")

	convGetCmd.Flags().StringVar(&convID, "conv-id", "", "Conversation ID")
	convGetCmd.MarkFlagRequired("conv-id")

	convGroupCreateCmd.Flags().StringVar(&convName, "name", "", "Group name")
	convGroupCreateCmd.MarkFlagRequired("name")
	convGroupCreateCmd.Flags().StringVar(&convMembers, "members", "", "JSON array of lechat agent IDs")
	convGroupCreateCmd.MarkFlagRequired("members")
}

func runConvList(cmd *cobra.Command, args []string) error {
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
	convRepo := lechatdb.NewConversationRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	convs, err := convRepo.GetConversationsByAgentID(agent.ID)
	if err != nil {
		return fmt.Errorf("failed to list conversations: %w", err)
	}

	return printConversations(convs)
}

func runConvDMList(cmd *cobra.Command, args []string) error {
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
	convRepo := lechatdb.NewConversationRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	convs, err := convRepo.GetConversationsByAgentID(agent.ID)
	if err != nil {
		return fmt.Errorf("failed to list conversations: %w", err)
	}

	// Filter DM only
	var dmConvs []*models.Conversation
	for _, c := range convs {
		if c.Type == "dm" {
			dmConvs = append(dmConvs, c)
		}
	}

	return printConversations(dmConvs)
}

func runConvGroupList(cmd *cobra.Command, args []string) error {
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
	convRepo := lechatdb.NewConversationRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	convs, err := convRepo.GetConversationsByAgentID(agent.ID)
	if err != nil {
		return fmt.Errorf("failed to list conversations: %w", err)
	}

	// Filter group only
	var groupConvs []*models.Conversation
	for _, c := range convs {
		if c.Type == "group" {
			groupConvs = append(groupConvs, c)
		}
	}

	return printConversations(groupConvs)
}

func runConvGet(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if convID == "" {
		return fmt.Errorf("conv-id is required")
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
	convRepo := lechatdb.NewConversationRepository(database)
	threadRepo := lechatdb.NewThreadRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	// Get conversation
	conv, err := convRepo.GetConversation(convID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	// Check if agent is in conversation
	found := false
	for _, id := range conv.AgentIDs {
		if id == agent.ID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("conversation not found")
	}

	// Get threads for this conversation
	threads, err := threadRepo.ListThreadsByConversation(convID)
	if err != nil {
		return fmt.Errorf("failed to list threads: %w", err)
	}

	type ThreadInfo struct {
		ID    string `json:"id"`
		Topic string `json:"topic"`
	}
	var threadInfos []ThreadInfo
	for _, t := range threads {
		threadInfos = append(threadInfos, ThreadInfo{
			ID:    t.ID,
			Topic: t.Topic,
		})
	}

	type ConvResponse struct {
		ID        string       `json:"id"`
		Type      string       `json:"type"`
		AgentIDs  []string     `json:"lechat_agent_ids"`
		GroupName *string      `json:"group_name,omitempty"`
		Threads   []ThreadInfo `json:"threads"`
		CreatedAt string       `json:"created_at"`
		UpdatedAt string       `json:"updated_at"`
	}

	response := ConvResponse{
		ID:        conv.ID,
		Type:      conv.Type,
		AgentIDs:  conv.AgentIDs,
		GroupName: conv.GroupName,
		Threads:   threadInfos,
		CreatedAt: conv.CreatedAt,
		UpdatedAt: conv.UpdatedAt,
	}

	output, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func runConvGroupCreate(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if convName == "" {
		return fmt.Errorf("--name is required")
	}
	if convMembers == "" {
		return fmt.Errorf("--members is required")
	}

	// Parse members JSON array
	var members []string
	if err := json.Unmarshal([]byte(convMembers), &members); err != nil {
		return fmt.Errorf("invalid --members JSON: %w", err)
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
	convRepo := lechatdb.NewConversationRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	// Verify all members exist
	for _, memberID := range members {
		member, err := agentRepo.GetAgentByID(memberID)
		if err != nil {
			return fmt.Errorf("failed to verify member %s: %w", memberID, err)
		}
		if member == nil {
			return fmt.Errorf("member %s not found", memberID)
		}
	}

	// Prevent adding yourself to a group
	for _, m := range members {
		if m == agent.ID {
			return fmt.Errorf("cannot add yourself to a group")
		}
	}

	// Build agent IDs: caller + all members
	agentIDs := append([]string{agent.ID}, members...)

	// Create new group conversation
	now := time.Now().UTC().Format(time.RFC3339)
	groupName := convName
	conv := &models.Conversation{
		ID:         generateUUID(),
		Type:       "group",
		AgentIDs:   agentIDs,
		ThreadIDs:  []string{},
		GroupName:  &groupName,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := convRepo.CreateConversation(conv); err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}

	output, err := json.MarshalIndent(conv, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func runConvGroupJoin(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if convID == "" {
		return fmt.Errorf("conv-id is required")
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
	convRepo := lechatdb.NewConversationRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	// Get conversation
	conv, err := convRepo.GetConversation(convID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	// Verify it's a group conversation
	if conv.Type != "group" {
		return fmt.Errorf("can only join group conversations")
	}

	// Check if already a member
	for _, id := range conv.AgentIDs {
		if id == agent.ID {
			return fmt.Errorf("already a member of this conversation")
		}
	}

	// Add agent to conversation
	conv.AgentIDs = append(conv.AgentIDs, agent.ID)
	conv.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := convRepo.UpdateConversation(conv); err != nil {
		return fmt.Errorf("failed to update conversation: %w", err)
	}

	fmt.Printf("Successfully joined conversation %s\n", convID)
	return nil
}

func printConversations(convs []*models.Conversation) error {
	type ConvResponse struct {
		ID        string   `json:"id"`
		Type      string   `json:"type"`
		AgentIDs  []string `json:"lechat_agent_ids"`
		GroupName *string  `json:"group_name,omitempty"`
		ThreadIDs []string `json:"thread_ids"`
	}

	var response []ConvResponse
	for _, c := range convs {
		response = append(response, ConvResponse{
			ID:        c.ID,
			Type:      c.Type,
			AgentIDs:  c.AgentIDs,
			GroupName: c.GroupName,
			ThreadIDs: c.ThreadIDs,
		})
	}

	output, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}
