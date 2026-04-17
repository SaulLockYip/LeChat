package main

import (
	"database/sql"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
)

func initDB(cfg *config.Config) (*sql.DB, error) {
	return lechatdb.InitDB(cfg.DBPath())
}
