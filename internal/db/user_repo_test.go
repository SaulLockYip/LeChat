package db

import (
	"database/sql"
	"testing"

	"github.com/lechat/pkg/models"
)

func setupUserTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS user (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		title TEXT,
		token TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		t.Fatalf("Failed to create schema: %v", err)
	}

	cleanup := func() {
		db.Close()
	}

	return db, cleanup
}

func TestUserRepository_CreateUser(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	user := &models.User{
		ID:        "user-1",
		Name:      "Test User",
		Title:     "Developer",
		Token:     "lc_test_token_123",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Verify by retrieving
	retrieved, err := repo.GetUser()
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}

	if retrieved == nil {
		t.Fatal("GetUser returned nil")
	}

	if retrieved.ID != user.ID {
		t.Errorf("Expected ID %s, got %s", user.ID, retrieved.ID)
	}
	if retrieved.Name != user.Name {
		t.Errorf("Expected Name %s, got %s", user.Name, retrieved.Name)
	}
	if retrieved.Title != user.Title {
		t.Errorf("Expected Title %s, got %s", user.Title, retrieved.Title)
	}
	if retrieved.Token != user.Token {
		t.Errorf("Expected Token %s, got %s", user.Token, retrieved.Token)
	}
}

func TestUserRepository_GetUser(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	// Test with non-existent user
	user, err := repo.GetUser()
	if err != nil {
		t.Fatalf("GetUser returned error: %v", err)
	}
	if user != nil {
		t.Error("Expected nil for non-existent user")
	}

	// Create and retrieve
	user = &models.User{
		ID:        "user-2",
		Name:      "Another User",
		Title:     "Engineer",
		Token:     "lc_another_token",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err = repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	retrieved, err := repo.GetUser()
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}

	if retrieved == nil {
		t.Fatal("Expected to find user")
	}
	if retrieved.ID != user.ID {
		t.Errorf("Expected ID %s, got %s", user.ID, retrieved.ID)
	}
	if retrieved.Name != user.Name {
		t.Errorf("Expected Name %s, got %s", user.Name, retrieved.Name)
	}
}

func TestUserRepository_GetUserByToken(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	// Test with non-existent token
	user, err := repo.GetUserByToken("non_existent_token")
	if err != nil {
		t.Fatalf("GetUserByToken returned error: %v", err)
	}
	if user != nil {
		t.Error("Expected nil for non-existent token")
	}

	// Create user and find by token
	user = &models.User{
		ID:        "user-3",
		Name:      "Token User",
		Title:     "Manager",
		Token:     "lc_find_me_token",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err = repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	retrieved, err := repo.GetUserByToken("lc_find_me_token")
	if err != nil {
		t.Fatalf("GetUserByToken failed: %v", err)
	}

	if retrieved == nil {
		t.Fatal("Expected to find user by token")
	}
	if retrieved.ID != user.ID {
		t.Errorf("Expected ID %s, got %s", user.ID, retrieved.ID)
	}
	if retrieved.Token != user.Token {
		t.Errorf("Expected Token %s, got %s", user.Token, retrieved.Token)
	}
}

func TestUserRepository_UpdateUser(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	// Create initial user
	user := &models.User{
		ID:        "user-4",
		Name:      "Original Name",
		Title:     "Original Title",
		Token:     "lc_update_token",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Update user
	user.Name = "Updated Name"
	user.Title = "Updated Title"

	err = repo.UpdateUser(user)
	if err != nil {
		t.Fatalf("UpdateUser failed: %v", err)
	}

	// Verify update
	retrieved, err := repo.GetUser()
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}

	if retrieved.Name != "Updated Name" {
		t.Errorf("Expected Name 'Updated Name', got '%s'", retrieved.Name)
	}
	if retrieved.Title != "Updated Title" {
		t.Errorf("Expected Title 'Updated Title', got '%s'", retrieved.Title)
	}
	// ID should remain unchanged
	if retrieved.ID != "user-4" {
		t.Errorf("Expected ID 'user-4', got '%s'", retrieved.ID)
	}
}

func TestUserRepository_HasUser(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	// Initially no users
	hasUser, err := repo.HasUser()
	if err != nil {
		t.Fatalf("HasUser returned error: %v", err)
	}
	if hasUser {
		t.Error("Expected false when no users exist")
	}

	// Create a user
	user := &models.User{
		ID:        "user-5",
		Name:      "Existing User",
		Title:     "Admin",
		Token:     "lc_has_user_token",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err = repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Now should have a user
	hasUser, err = repo.HasUser()
	if err != nil {
		t.Fatalf("HasUser returned error: %v", err)
	}
	if !hasUser {
		t.Error("Expected true when user exists")
	}
}

func TestUserRepository_PopulateTokenFromConfig(t *testing.T) {
	db, cleanup := setupUserTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	// Create user without token
	user := &models.User{
		ID:        "user-6",
		Name:      "Config User",
		Title:     "Staff",
		Token:     "", // empty token initially
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateUser(user)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Populate token from config
	newToken := "lc_config_token_456"
	err = repo.PopulateTokenFromConfig(newToken)
	if err != nil {
		t.Fatalf("PopulateTokenFromConfig failed: %v", err)
	}

	// Verify token was updated
	retrieved, err := repo.GetUser()
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}

	if retrieved.Token != newToken {
		t.Errorf("Expected Token '%s', got '%s'", newToken, retrieved.Token)
	}
	// Other fields should remain unchanged
	if retrieved.Name != "Config User" {
		t.Errorf("Expected Name 'Config User', got '%s'", retrieved.Name)
	}
	if retrieved.ID != "user-6" {
		t.Errorf("Expected ID 'user-6', got '%s'", retrieved.ID)
	}
}
