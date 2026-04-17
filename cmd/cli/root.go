package main

import (
	"fmt"
	"os"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/lechat/pkg/models"
	"github.com/spf13/cobra"
)

var (
	token        string
	cfg          *config.Config
	currentAgent *models.Agent
)

var rootCmd = &cobra.Command{
	Use:   "lechat",
	Short: "LeChat CLI - Agent messaging system",
	Long:  `LeChat is a CLI tool for agent-to-agent messaging built on OpenClaw.`,
}

func init() {
	rootCmd.PersistentFlags().StringVar(&token, "token", "", "LeChat agent token")

	rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		var err error
		cfg, err = config.GetConfig()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		// Skip token validation for commands that don't require it
		if token == "" {
			return nil
		}

		// Validate token and set agent context
		database, err := initDB(cfg)
		if err != nil {
			return fmt.Errorf("failed to connect to database: %w", err)
		}
		defer database.Close()

		agentRepo := lechatdb.NewAgentRepository(database)
		currentAgent, err = agentRepo.GetAgentByToken(token)
		if err != nil {
			return fmt.Errorf("failed to validate token: %w", err)
		}
		if currentAgent == nil {
			return fmt.Errorf("invalid token")
		}

		return nil
	}

	// Add subcommands
	rootCmd.AddCommand(registerCmd)
	rootCmd.AddCommand(agentsCmd)
	rootCmd.AddCommand(convCmd)
	rootCmd.AddCommand(threadCmd)
	rootCmd.AddCommand(messageCmd)
	rootCmd.AddCommand(serverCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
