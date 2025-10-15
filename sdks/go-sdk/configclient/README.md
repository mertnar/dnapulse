# DNA Platform Config Client - Go

Go client library for interacting with the DNA Platform Config Service.

## Features

- Load configuration from Config Service
- Conditional requests with ETag support
- Server-Sent Events (SSE) for real-time config updates
- Retry logic with exponential backoff
- Simple functional and class-based interfaces

## Installation

Add to your `go.mod`:

```go
require github.com/dnasol/dna-platform/sdks/go-sdk/configclient v0.1.0
```

## Usage

### Basic Usage

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
)

func main() {
    ctx := context.Background()

    // Load config
    yaml, etag, status, err := configclient.Load(
        ctx,
        "http://localhost:8080",
        "processing",
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Config loaded: %s\n", yaml)
    fmt.Printf("ETag: %s\n", etag)
    fmt.Printf("Status: %d\n", status)
}
```

### Using ConfigClient Class

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
)

func main() {
    client := configclient.New("http://localhost:8080")
    ctx := context.Background()

    // Load initial config
    result, err := client.Load(ctx, "decision", nil)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Config: %s\n", result.YAML)

    // Load with conditional request
    result2, err := client.Load(ctx, "decision", &result.ETag)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Status: %d\n", result2.Status) // 304 if not modified
}
```

### Watching for Updates

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
)

func main() {
    client := configclient.New("http://localhost:8080")

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    err := client.WatchSSE(ctx, func(scope, etag string) {
        fmt.Printf("Config updated - Scope: %s, ETag: %s\n", scope, etag)

        // Reload config when it changes
        result, err := client.Load(ctx, scope, nil)
        if err != nil {
            log.Printf("Error reloading config: %v", err)
            return
        }

        fmt.Printf("Reloaded config: %s\n", result.YAML[:100])
    })

    if err != nil {
        log.Printf("SSE watch ended: %v", err)
    }
}
```

### With Retry Logic

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
)

func main() {
    client := configclient.New("http://localhost:8080")
    ctx := context.Background()

    result, err := client.LoadWithRetry(ctx, "processing", nil, 3)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Config loaded with retry: %s\n", result.YAML)
}
```

## Environment Variables

The client can be configured using environment variables:

- `CONFIG_SERVICE_URL`: Base URL of the Config Service (default: `http://localhost:8080`)
- `CONFIG_REQUEST_TIMEOUT`: Request timeout in seconds (default: `30`)

## API Reference

### Functions

#### `Load(ctx, baseURL, scope string, etag *string) (yaml string, newETag string, status int, err error)`

Loads configuration for the given scope. If `etag` is provided, sends `If-None-Match` header for conditional requests.

#### `WatchSSE(ctx, sseURL string, onUpdate func(scope, etag string)) error`

Connects to the SSE stream and calls `onUpdate` for each config update. Includes automatic reconnection with backoff.

### ConfigClient Methods

#### `New(baseURL string) *ConfigClient`

Creates a new ConfigClient instance.

#### `Load(ctx context.Context, scope string, etag *string) (*LoadResult, error)`

Loads configuration with the same behavior as the `Load` function.

#### `WatchSSE(ctx context.Context, onUpdate func(scope, etag string)) error`

Watches for SSE updates with the same behavior as the `WatchSSE` function.

#### `LoadWithRetry(ctx context.Context, scope string, etag *string, maxRetries int) (*LoadResult, error)`

Loads configuration with exponential backoff retry logic.

### Types

#### `LoadResult`

```go
type LoadResult struct {
    YAML   string
    ETag   string
    Status int
}
```

## Error Handling

The client handles various error conditions:

- **Network errors**: Automatic retry with exponential backoff
- **HTTP errors**: Proper error messages with status codes
- **SSE disconnections**: Automatic reconnection with backoff
- **Context cancellation**: Graceful shutdown

## Examples

See `example_test.go` for comprehensive usage examples.

## License

MIT License - see LICENSE file for details.
