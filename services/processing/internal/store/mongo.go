package store

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// MongoConfig holds MongoDB configuration
type MongoConfig struct {
	URI            string
	Database       string
	ConnectTimeout time.Duration
	PingTimeout    time.Duration
}

// NewMongoClient creates a new MongoDB client
func NewMongoClient(ctx context.Context, cfg MongoConfig) (*mongo.Client, error) {
	if cfg.ConnectTimeout == 0 {
		cfg.ConnectTimeout = 10 * time.Second
	}
	if cfg.PingTimeout == 0 {
		cfg.PingTimeout = 5 * time.Second
	}

	// Set client options
	clientOpts := options.Client().
		ApplyURI(cfg.URI).
		SetConnectTimeout(cfg.ConnectTimeout).
		SetServerSelectionTimeout(cfg.PingTimeout)

	// Connect
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	pingCtx, cancel := context.WithTimeout(ctx, cfg.PingTimeout)
	defer cancel()

	if err := client.Ping(pingCtx, readpref.Primary()); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return client, nil
}
