# DNA Platform Config Client - TypeScript

TypeScript/JavaScript client library for interacting with the DNA Platform Config Service.

## Features

- Load configuration from Config Service
- Conditional requests with ETag support
- Server-Sent Events (SSE) for real-time config updates
- Retry logic with exponential backoff
- TypeScript support with full type definitions
- Both functional and class-based interfaces

## Installation

```bash
npm install @dnasol/config-client
```

Or with yarn:

```bash
yarn add @dnasol/config-client
```

## Usage

### Basic Usage

```typescript
import { load } from '@dnasol/config-client';

async function loadConfig() {
  try {
    const result = await load('http://localhost:8080', 'processing');
    console.log('Config loaded:', result.yaml);
    console.log('ETag:', result.etag);
    console.log('Status:', result.status);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}
```

### Using ConfigClient Class

```typescript
import { ConfigClient } from '@dnasol/config-client';

async function useConfigClient() {
  const client = new ConfigClient('http://localhost:8080');
  
  try {
    // Load initial config
    const result = await client.load('decision');
    console.log('Config:', result.yaml);
    
    // Load with conditional request
    const result2 = await client.load('decision', result.etag);
    console.log('Status:', result2.status); // 304 if not modified
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Watching for Updates

```typescript
import { ConfigClient } from '@dnasol/config-client';

function watchUpdates() {
  const client = new ConfigClient('http://localhost:8080');
  
  const eventSource = client.watchSSE((update) => {
    console.log(`Config updated - Scope: ${update.scope}, ETag: ${update.etag}`);
    
    // Reload config when it changes
    client.load(update.scope).then(result => {
      console.log('Reloaded config:', result.yaml);
    }).catch(error => {
      console.error('Error reloading config:', error);
    });
  });
  
  // Close connection after 30 seconds
  setTimeout(() => {
    eventSource.close();
    console.log('SSE connection closed');
  }, 30000);
}
```

### Functional SSE Interface

```typescript
import { watchSSE } from '@dnasol/config-client';

function watchWithFunctional() {
  const eventSource = watchSSE('http://localhost:8080/v1/stream', (update) => {
    console.log(`Update received for scope: ${update.scope}`);
  });
  
  // Handle connection errors
  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
  };
  
  // Close after 10 seconds
  setTimeout(() => {
    eventSource.close();
  }, 10000);
}
```

### With Retry Logic

```typescript
import { ConfigClient } from '@dnasol/config-client';

async function loadWithRetry() {
  const client = new ConfigClient('http://localhost:8080');
  
  try {
    const result = await client.loadWithRetry('processing', undefined, 3, 1000);
    console.log('Config loaded with retry:', result.yaml);
  } catch (error) {
    console.error('Failed to load config after retries:', error);
  }
}
```

## Environment Variables

The client can be configured using environment variables:

- `CONFIG_SERVICE_URL`: Base URL of the Config Service (default: `http://localhost:8080`)
- `CONFIG_REQUEST_TIMEOUT`: Request timeout in milliseconds (default: `30000`)

## API Reference

### Functions

#### `load(baseURL: string, scope: string, etag?: string): Promise<LoadResult>`

Loads configuration for the given scope. If `etag` is provided, sends `If-None-Match` header for conditional requests.

#### `watchSSE(sseURL: string, onUpdate: (update: SSEUpdate) => void): EventSource`

Connects to the SSE stream and returns an EventSource instance.

#### `createClient(baseURL: string): ConfigClient`

Creates a new ConfigClient instance.

### ConfigClient Class

#### Constructor

```typescript
new ConfigClient(baseURL: string)
```

#### Methods

- `load(scope: string, etag?: string): Promise<LoadResult>`
- `watchSSE(onUpdate: (update: SSEUpdate) => void): EventSource`
- `loadWithRetry(scope: string, etag?: string, maxRetries?: number, baseDelayMs?: number): Promise<LoadResult>`

### Types

#### `LoadResult`

```typescript
interface LoadResult {
  yaml: string;
  etag: string;
  status: number;
}
```

#### `SSEUpdate`

```typescript
interface SSEUpdate {
  scope: string;
  etag: string;
}
```

## Error Handling

The client handles various error conditions:

- **Network errors**: Automatic retry with exponential backoff
- **HTTP errors**: Proper error messages with status codes
- **SSE disconnections**: Automatic reconnection (handled by EventSource)
- **JSON parsing errors**: Graceful error handling

## Examples

See `example.ts` for comprehensive usage examples.

## Building

```bash
npm run build
```

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
npm run lint:fix
```

## License

MIT License - see LICENSE file for details.
