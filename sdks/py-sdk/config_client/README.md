# DNA Platform Config Client - Python

Python client library for interacting with the DNA Platform Config Service.

## Features

- Load configuration from Config Service
- Conditional requests with ETag support
- Server-Sent Events (SSE) for real-time config updates
- Retry logic with exponential backoff
- Simple functional and class-based interfaces
- Full type hints support

## Installation

### From Source

```bash
cd sdks/py-sdk/config_client
pip install .
```

### Development Installation

```bash
cd sdks/py-sdk/config_client
pip install -e .[dev]
```

## Dependencies

- Python 3.8+
- `sseclient-py` for Server-Sent Events support
- `urllib3` for HTTP requests

## Usage

### Basic Usage

```python
from config_client import load

# Load config using functional interface
try:
    yaml_content, etag, status = load('http://localhost:8080', 'processing')
    print(f'Config loaded: {yaml_content}')
    print(f'ETag: {etag}')
    print(f'Status: {status}')
except Exception as error:
    print(f'Error loading config: {error}')
```

### Using ConfigClient Class

```python
from config_client import ConfigClient

# Create client instance
client = ConfigClient('http://localhost:8080')

try:
    # Load initial config
    result = client.load('decision')
    print(f'Config: {result.yaml}')
    print(f'ETag: {result.etag}')
    print(f'Status: {result.status}')

    # Load with conditional request
    result2 = client.load('decision', result.etag)
    print(f'Status: {result2.status}')  # 304 if not modified

except Exception as error:
    print(f'Error: {error}')
```

### Watching for Updates

```python
from config_client import ConfigClient
import time

def on_update(scope: str, etag: str):
    print(f'Config updated - Scope: {scope}, ETag: {etag}')

    # Reload config when it changes
    try:
        result = client.load(scope)
        print(f'Reloaded config: {result.yaml[:100]}...')
    except Exception as error:
        print(f'Error reloading config: {error}')

client = ConfigClient('http://localhost:8080')

try:
    # Watch for updates (will run until interrupted)
    print('Watching for config updates...')
    client.watch_sse(on_update)
except KeyboardInterrupt:
    print('SSE watch stopped by user')
except Exception as error:
    print(f'SSE watch error: {error}')
```

### Functional SSE Interface

```python
from config_client import watch_sse

def on_update(scope: str, etag: str):
    print(f'Update received for scope: {scope}')

try:
    print('Watching SSE stream...')
    watch_sse('http://localhost:8080/v1/stream', on_update)
except KeyboardInterrupt:
    print('SSE watch stopped')
except Exception as error:
    print(f'SSE error: {error}')
```

### With Retry Logic

```python
from config_client import ConfigClient

client = ConfigClient('http://localhost:8080')

try:
    result = client.load_with_retry('processing', max_retries=3, base_delay=1.0)
    print(f'Config loaded with retry: {result.yaml}')
except Exception as error:
    print(f'Failed to load config after retries: {error}')
```

## Environment Variables

The client can be configured using environment variables:

- `CONFIG_SERVICE_URL`: Base URL of the Config Service (default: `http://localhost:8080`)
- `CONFIG_REQUEST_TIMEOUT`: Request timeout in seconds (default: `30`)

## API Reference

### Functions

#### `load(base_url: str, scope: str, etag: str | None = None) -> tuple[str, str, int]`

Loads configuration for the given scope. Returns a tuple of `(yaml_content, etag, status_code)`.

#### `watch_sse(sse_url: str, on_update: Callable[[str, str], None]) -> None`

Connects to the SSE stream and calls `on_update` for each config update.

### ConfigClient Class

#### Constructor

```python
ConfigClient(base_url: str, timeout: int = 30)
```

#### Methods

- `load(scope: str, etag: str | None = None) -> LoadResult`
- `watch_sse(on_update: Callable[[str, str], None]) -> None`
- `load_with_retry(scope: str, etag: str | None = None, max_retries: int = 3, base_delay: float = 1.0) -> LoadResult`

### Types

#### `LoadResult`

```python
class LoadResult(NamedTuple):
    yaml: str
    etag: str
    status: int
```

#### `SSEUpdate`

```python
@dataclass
class SSEUpdate:
    scope: str
    etag: str
    timestamp: str | None = None
```

## Error Handling

The client handles various error conditions:

- **Network errors**: Automatic retry with exponential backoff
- **HTTP errors**: Proper error messages with status codes (including 304 Not Modified)
- **SSE disconnections**: Automatic reconnection with backoff
- **JSON parsing errors**: Graceful error handling
- **Keyboard interrupts**: Graceful shutdown

## Logging

The client uses Python's standard logging module. Configure logging to see debug information:

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
```

## Examples

See `example.py` for comprehensive usage examples:

```bash
python example.py
```

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black .
```

### Linting

```bash
flake8 .
mypy .
```

## License

MIT License - see LICENSE file for details.
