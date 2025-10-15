#!/usr/bin/env python3
"""
Example usage of the DNA Platform Config Client
"""

from config_client import ConfigClient, load, watch_sse


def example_class_usage():
    """Example using the ConfigClient class"""
    print("=== ConfigClient Class Example ===")

    client = ConfigClient('http://localhost:8080')

    try:
        # Load initial config
        result = client.load('processing')
        print(f"Initial config loaded: {result.yaml[:100]}...")
        print(f"ETag: {result.etag}")
        print(f"Status: {result.status}")

        # Load with conditional request
        result2 = client.load('processing', result.etag)
        print(f"Conditional request status: {result2.status}")

    except Exception as error:
        print(f"Error loading config: {error}")


def example_functional_usage():
    """Example using the functional interface"""
    print("\n=== Functional Interface Example ===")

    try:
        yaml_content, etag, status = load('http://localhost:8080', 'decision')
        print(f"Decision config: {yaml_content[:100]}...")
        print(f"Status: {status}")
        print(f"ETag: {etag}")

    except Exception as error:
        print(f"Error: {error}")


def example_sse_watch():
    """Example watching for SSE updates"""
    print("\n=== SSE Watch Example ===")

    def on_update(scope: str, etag: str):
        print(f"Config updated - Scope: {scope}, ETag: {etag}")

    client = ConfigClient('http://localhost:8080')

    try:
        # This will run for 10 seconds
        print("Watching for config updates (10 seconds)...")
        client.watch_sse(on_update)
    except KeyboardInterrupt:
        print("SSE watch stopped by user")
    except Exception as error:
        print(f"SSE watch error: {error}")


def example_functional_sse():
    """Example using functional SSE interface"""
    print("\n=== Functional SSE Example ===")

    def on_update(scope: str, etag: str):
        print(f"Update received for scope: {scope}")

    try:
        print("Watching SSE stream (5 seconds)...")
        watch_sse('http://localhost:8080/v1/stream', on_update)
    except KeyboardInterrupt:
        print("SSE watch stopped")
    except Exception as error:
        print(f"SSE error: {error}")


def example_retry():
    """Example with retry logic"""
    print("\n=== Retry Example ===")

    client = ConfigClient('http://localhost:8080')

    try:
        result = client.load_with_retry('processing', max_retries=3, base_delay=1.0)
        print(f"Config loaded with retry: {result.yaml[:100]}...")

    except Exception as error:
        print(f"Failed to load config after retries: {error}")


def main():
    """Run all examples"""
    print("DNA Platform Config Client Examples")
    print("=" * 40)

    # Run examples
    example_class_usage()
    example_functional_usage()
    example_retry()

    # SSE examples (will run for limited time)
    try:
        example_sse_watch()
    except KeyboardInterrupt:
        pass

    try:
        example_functional_sse()
    except KeyboardInterrupt:
        pass

    print("\nExamples completed!")


if __name__ == "__main__":
    main()
