"""Configuration management for the Model service."""

import os
from typing import List, Optional
from pydantic import BaseModel


class ModelParams(BaseModel):
    """Model parameters configuration."""
    label_required: str = "anomaly"
    count_threshold: int = 3
    score_threshold: float = 0.8
    emit_normal: bool = False


class ModelConfig(BaseModel):
    """Model service configuration."""
    active_model: str = "threshold_model"
    version: str = "1.0.0"
    params: ModelParams = ModelParams()


class ConfigManager:
    """Manages configuration loading and hot-reloading."""

    def __init__(self, config_url: str, scope: str):
        self.config_url = config_url
        self.scope = scope
        self.config: Optional[ModelConfig] = None
        self._lock = None  # Will be set up in async context

    async def load_config(self) -> bool:
        """Load configuration from Config Service."""
        import httpx
        import yaml

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.config_url}/v1/config/{self.scope}")

                if response.status_code == 200:
                    config_data = yaml.safe_load(response.text)
                    self.config = ModelConfig(**config_data)
                    return True
                else:
                    print(f"Failed to load config: {response.status_code}")
                    return False

        except Exception as e:
            print(f"Error loading config: {e}")
            return False

    def get_config(self) -> ModelConfig:
        """Get current configuration."""
        if self.config is None:
            # Return default config if not loaded
            return ModelConfig()
        return self.config

    def should_emit_inference(self, labels: List[str], count: int) -> bool:
        """Check if inference should be emitted based on config."""
        config = self.get_config()

        # Check if required label is in labels
        if config.params.label_required not in labels:
            return False

        # Check count threshold
        if count < config.params.count_threshold:
            return False

        return True

    def get_inference_result(self, labels: List[str], count: int) -> dict:
        """Get inference result based on configuration."""
        config = self.get_config()

        # Determine if this is an anomaly
        is_anomaly = (
            config.params.label_required in labels and
            count >= config.params.count_threshold
        )

        if is_anomaly:
            return {
                "label": "anomaly",
                "score": 1.0,
                "model": config.active_model,
                "ts": None  # Will be set by caller
            }
        else:
            return {
                "label": "normal",
                "score": 0.0,
                "model": config.active_model,
                "ts": None  # Will be set by caller
            }


def get_env_config() -> dict:
    """Get configuration from environment variables."""
    return {
        "bus_broker": os.getenv("BUS_BROKER", "localhost:9092"),
        "input_topic": os.getenv("INPUT_TOPIC", "correlation.grouped.v1"),
        "output_topic": os.getenv("OUTPUT_TOPIC", "model.inference.v1"),
        "config_url": os.getenv("CONFIG_URL", "http://localhost:8083"),
        "config_scope": os.getenv("CONFIG_SCOPE", "model"),
        "config_sse_url": os.getenv("CONFIG_SSE_URL", "http://localhost:8083"),
        "port": int(os.getenv("PORT", "8080")),
        "debug": os.getenv("DEBUG", "0") == "1"
    }
