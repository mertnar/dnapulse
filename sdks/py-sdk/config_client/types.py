"""
Type definitions for the Config Client
"""

from typing import NamedTuple, Optional
from dataclasses import dataclass


class LoadResult(NamedTuple):
    """Result of a config load operation"""
    yaml: str
    etag: str
    status: int


@dataclass
class SSEUpdate:
    """SSE update message"""
    scope: str
    etag: str
    timestamp: Optional[str] = None
