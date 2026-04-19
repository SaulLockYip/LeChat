package db

import (
	"database/sql"
	"time"

	"github.com/lechat/pkg/models"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) CreateUser(user *models.User) error {
	query := `INSERT INTO user (id, name, title, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, user.ID, user.Name, user.Title, user.Token, user.CreatedAt, user.UpdatedAt)
	return err
}

func (r *UserRepository) GetUser() (*models.User, error) {
	query := `SELECT id, name, title, token, created_at, updated_at FROM user LIMIT 1`
	row := r.db.QueryRow(query)

	var user models.User
	err := row.Scan(&user.ID, &user.Name, &user.Title, &user.Token, &user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetUserByToken(token string) (*models.User, error) {
	query := `SELECT id, name, title, token, created_at, updated_at FROM user WHERE token = ?`
	row := r.db.QueryRow(query, token)

	var user models.User
	err := row.Scan(&user.ID, &user.Name, &user.Title, &user.Token, &user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpdateUser(user *models.User) error {
	query := `UPDATE user SET name = ?, title = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, user.Name, user.Title, time.Now().UTC().Format(time.RFC3339), user.ID)
	return err
}

func (r *UserRepository) PopulateTokenFromConfig(token string) error {
	query := `UPDATE user SET token = ?, updated_at = ? WHERE id = (SELECT id FROM user LIMIT 1)`
	_, err := r.db.Exec(query, token, time.Now().UTC().Format(time.RFC3339))
	return err
}

func (r *UserRepository) HasUser() (bool, error) {
	query := `SELECT COUNT(*) FROM user`
	var count int
	err := r.db.QueryRow(query).Scan(&count)
	return count > 0, err
}
