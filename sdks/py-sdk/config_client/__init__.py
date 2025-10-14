"""
DNA Platform Config Service Client for Python

This module provides a Python client for interacting with the DNA Platform Config Service.
It supports loading configurations and watching for updates via Server-Sent Events (SSE).
"""

from .client import ConfigClient, load, watch_sse
from .types import LoadResult, SSEUpdate

__version__ = "0.1.0"
__all__ = ["ConfigClient", "load", "watch_sse", "LoadResult", "SSEUpdate"]
