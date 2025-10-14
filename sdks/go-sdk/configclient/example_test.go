package configclient_test

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
)

func ExampleConfigClient_Load() {
	client := configclient.New("http://localhost:8080")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := client.Load(ctx, "processing", nil)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Config loaded: %s\n", result.YAML[:50])
	fmt.Printf("ETag: %s\n", result.ETag)
	fmt.Printf("Status: %d\n", result.Status)
}

func ExampleConfigClient_WatchSSE() {
	client := configclient.New("http://localhost:8080")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := client.WatchSSE(ctx, func(scope, etag string) {
		fmt.Printf("Config updated - Scope: %s, ETag: %s\n", scope, etag)
	})
	if err != nil {
		log.Printf("SSE watch ended: %v", err)
	}
}

func ExampleLoad() {
	ctx := context.Background()

	yaml, etag, status, err := configclient.Load(ctx, "http://localhost:8080", "decision", nil)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Loaded config with status %d\n", status)
	fmt.Printf("ETag: %s\n", etag)
	fmt.Printf("Config: %s\n", yaml[:100])
}

func ExampleWatchSSE() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	err := configclient.WatchSSE(ctx, "http://localhost:8080/v1/stream", func(scope, etag string) {
		fmt.Printf("Update received for scope: %s\n", scope)
	})
	if err != nil {
		log.Printf("SSE watch error: %v", err)
	}
}
