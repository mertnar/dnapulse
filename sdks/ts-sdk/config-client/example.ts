import { ConfigClient, load, watchSSE } from './index';

// Example 1: Using the class interface
async function exampleClassUsage() {
  const client = new ConfigClient('http://localhost:8080');

  try {
    // Load initial config
    const result = await client.load('processing');
    console.log('Initial config loaded:', result.yaml.substring(0, 100));
    console.log('ETag:', result.etag);

    // Load with conditional request (will return 304 if not modified)
    const result2 = await client.load('processing', result.etag);
    console.log('Conditional request status:', result2.status);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Example 2: Using the functional interface
async function exampleFunctionalUsage() {
  try {
    const result = await load('http://localhost:8080', 'decision');
    console.log('Decision config:', result.yaml);
    console.log('Status:', result.status);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 3: Watching for updates
function exampleSSEWatch() {
  const client = new ConfigClient('http://localhost:8080');

  const eventSource = client.watchSSE((update) => {
    console.log(`Config updated - Scope: ${update.scope}, ETag: ${update.etag}`);

    // Reload config when it changes
    client
      .load(update.scope)
      .then((result) => {
        console.log('Reloaded config:', result.yaml);
      })
      .catch((error) => {
        console.error('Error reloading config:', error);
      });
  });

  // Close connection after 30 seconds
  setTimeout(() => {
    eventSource.close();
    console.log('SSE connection closed');
  }, 30000);
}

// Example 4: Using functional SSE watch
function exampleFunctionalSSE() {
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

// Example 5: Load with retry
async function exampleRetry() {
  const client = new ConfigClient('http://localhost:8080');

  try {
    const result = await client.loadWithRetry('processing', undefined, 3, 1000);
    console.log('Config loaded with retry:', result.yaml);
  } catch (error) {
    console.error('Failed to load config after retries:', error);
  }
}

// Run examples
if (require.main === module) {
  console.log('=== Config Client Examples ===\n');

  // Run class example
  exampleClassUsage()
    .then(() => {
      console.log('\n--- Class example completed ---\n');

      // Run functional example
      return exampleFunctionalUsage();
    })
    .then(() => {
      console.log('\n--- Functional example completed ---\n');

      // Run retry example
      return exampleRetry();
    })
    .then(() => {
      console.log('\n--- Retry example completed ---\n');

      // Start SSE examples
      console.log('Starting SSE examples (will run for 30 seconds)...\n');
      exampleSSEWatch();
      exampleFunctionalSSE();
    })
    .catch((error) => {
      console.error('Example error:', error);
    });
}
