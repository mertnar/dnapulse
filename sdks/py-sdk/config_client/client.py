"""
Config Client implementation for Python
"""

import json
import logging
import time
from typing import Callable, Optional, Tuple
import urllib.request
import urllib.error
import urllib.parse
import sseclient

from .types import LoadResult, SSEUpdate

logger = logging.getLogger(__name__)


class ConfigClient:
    """Client for interacting with the DNA Platform Config Service"""
    
    def __init__(self, base_url: str, timeout: int = 30):
        """
        Initialize the Config Client
        
        Args:
            base_url: Base URL of the Config Service
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
    
    def load(self, scope: str, etag: Optional[str] = None) -> LoadResult:
        """
        Load configuration for the given scope
        
        Args:
            scope: Configuration scope (e.g., 'processing', 'decision')
            etag: Optional ETag for conditional requests
            
        Returns:
            LoadResult containing yaml, etag, and status code
            
        Raises:
            urllib.error.URLError: If the request fails
        """
        url = f"{self.base_url}/v1/config/{scope}"
        
        headers = {
            'Accept': 'application/x-yaml',
            'User-Agent': 'dna-platform-config-client/0.1.0'
        }
        
        if etag:
            headers['If-None-Match'] = etag
        
        req = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                yaml_content = response.read().decode('utf-8')
                response_etag = response.headers.get('ETag', '')
                status_code = response.getcode()
                
                return LoadResult(yaml=yaml_content, etag=response_etag, status=status_code)
                
        except urllib.error.HTTPError as e:
            # Handle HTTP errors (like 304 Not Modified)
            if e.code == 304:
                return LoadResult(yaml='', etag=etag or '', status=304)
            
            # Read response body for other errors
            try:
                error_body = e.read().decode('utf-8')
                logger.error(f"HTTP {e.code}: {error_body}")
            except:
                pass
            
            raise urllib.error.URLError(f"HTTP {e.code}: {e.reason}")
    
    def watch_sse(self, on_update: Callable[[str, str], None]) -> None:
        """
        Watch for configuration updates via Server-Sent Events
        
        Args:
            on_update: Callback function called when config updates are received
                      Function signature: (scope: str, etag: str) -> None
        """
        sse_url = f"{self.base_url}/v1/stream"
        
        while True:
            try:
                self._connect_sse(sse_url, on_update)
            except Exception as e:
                logger.error(f"SSE connection error: {e}")
                time.sleep(5)  # Wait before retrying
    
    def _connect_sse(self, sse_url: str, on_update: Callable[[str, str], None]) -> None:
        """Internal method to connect to SSE stream"""
        try:
            messages = sseclient.SSEClient(sse_url)
            
            for msg in messages:
                if msg.event == 'config:update':
                    try:
                        data = json.loads(msg.data)
                        on_update(data['scope'], data['etag'])
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(f"Failed to parse SSE message: {e}")
                
                elif msg.event == 'connected':
                    logger.info(f"Connected to config stream: {msg.data}")
                
                elif msg.event == 'heartbeat':
                    logger.debug(f"Config stream heartbeat: {msg.data}")
                
        except Exception as e:
            logger.error(f"SSE connection failed: {e}")
            raise
    
    def load_with_retry(
        self, 
        scope: str, 
        etag: Optional[str] = None, 
        max_retries: int = 3, 
        base_delay: float = 1.0
    ) -> LoadResult:
        """
        Load configuration with exponential backoff retry
        
        Args:
            scope: Configuration scope
            etag: Optional ETag for conditional requests
            max_retries: Maximum number of retry attempts
            base_delay: Base delay between retries in seconds
            
        Returns:
            LoadResult containing config data
            
        Raises:
            urllib.error.URLError: If all retries fail
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return self.load(scope, etag)
            except urllib.error.URLError as e:
                last_error = e
                
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Load attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                    time.sleep(delay)
        
        raise urllib.error.URLError(f"Failed to load config after {max_retries} retries: {last_error}")


# Convenience functions for simple usage

def load(base_url: str, scope: str, etag: Optional[str] = None) -> Tuple[str, str, int]:
    """
    Load configuration using a simple function interface
    
    Args:
        base_url: Base URL of the Config Service
        scope: Configuration scope
        etag: Optional ETag for conditional requests
        
    Returns:
        Tuple of (yaml_content, etag, status_code)
        
    Raises:
        urllib.error.URLError: If the request fails
    """
    client = ConfigClient(base_url)
    result = client.load(scope, etag)
    return result.yaml, result.etag, result.status


def watch_sse(sse_url: str, on_update: Callable[[str, str], None]) -> None:
    """
    Watch for configuration updates via SSE
    
    Args:
        sse_url: Full URL to the SSE endpoint
        on_update: Callback function for updates
    """
    client = ConfigClient(sse_url)
    client.watch_sse(on_update)
