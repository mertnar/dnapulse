package store

import (
	"fmt"

	"github.com/elastic/go-elasticsearch/v8"
)

// ElasticsearchConfig holds Elasticsearch configuration
type ElasticsearchConfig struct {
	Addresses []string
	Username  string
	Password  string
}

// NewElasticsearchClient creates a new Elasticsearch client
func NewElasticsearchClient(cfg ElasticsearchConfig) (*elasticsearch.Client, error) {
	esCfg := elasticsearch.Config{
		Addresses: cfg.Addresses,
	}

	if cfg.Username != "" {
		esCfg.Username = cfg.Username
		esCfg.Password = cfg.Password
	}

	client, err := elasticsearch.NewClient(esCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Elasticsearch client: %w", err)
	}

	// Ping to verify connection
	res, err := client.Info()
	if err != nil {
		return nil, fmt.Errorf("failed to ping Elasticsearch: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("elasticsearch error: %s", res.Status())
	}

	return client, nil
}
