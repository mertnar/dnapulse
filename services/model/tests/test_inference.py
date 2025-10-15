"""Tests for the inference module."""

import pytest
from unittest.mock import Mock, AsyncMock

from app.inference import InferenceEngine, should_emit_inference_threshold
from app.config import ConfigManager


class TestInferenceThreshold:
    """Test the threshold inference function."""

    def test_should_emit_inference_threshold_anomaly(self):
        """Test that anomaly is detected when conditions are met."""
        labels = ["error", "anomaly", "critical"]
        count = 5

        result = should_emit_inference_threshold(labels, count)
        assert result is True

    def test_should_emit_inference_threshold_normal(self):
        """Test that normal events don't trigger inference."""
        labels = ["info", "normal"]
        count = 2

        result = should_emit_inference_threshold(labels, count)
        assert result is False

    def test_should_emit_inference_threshold_missing_label(self):
        """Test that missing required label doesn't trigger inference."""
        labels = ["error", "critical"]
        count = 10

        result = should_emit_inference_threshold(labels, count)
        assert result is False

    def test_should_emit_inference_threshold_low_count(self):
        """Test that low count doesn't trigger inference."""
        labels = ["error", "anomaly"]
        count = 1

        result = should_emit_inference_threshold(labels, count)
        assert result is False

    def test_should_emit_inference_threshold_custom_params(self):
        """Test with custom parameters."""
        labels = ["custom_anomaly"]
        count = 5

        result = should_emit_inference_threshold(
            labels, count,
            label_required="custom_anomaly",
            count_threshold=3
        )
        assert result is True


class TestInferenceEngine:
    """Test the InferenceEngine class."""

    @pytest.fixture
    def mock_config_manager(self):
        """Create a mock config manager."""
        config_manager = Mock(spec=ConfigManager)
        config_manager.should_emit_inference = Mock(return_value=True)
        config_manager.get_inference_result = Mock(return_value={
            "label": "anomaly",
            "score": 1.0,
            "model": "test_model",
            "ts": None
        })
        return config_manager

    @pytest.fixture
    def inference_engine(self, mock_config_manager):
        """Create an inference engine with mocked dependencies."""
        return InferenceEngine(mock_config_manager)

    def test_inference_engine_initialization(self, mock_config_manager):
        """Test inference engine initialization."""
        engine = InferenceEngine(mock_config_manager)
        assert engine.config_manager == mock_config_manager
        assert engine.producer is None
        assert engine.consumer is None
        assert engine.running is False

    @pytest.mark.asyncio
    async def test_infer_from_features(self, inference_engine):
        """Test inference from features."""
        features = {
            "labels": ["error", "anomaly"],
            "count": 5,
            "group_key": "test-group"
        }

        result = await inference_engine.infer_from_features(features)

        assert result["label"] == "anomaly"
        assert result["score"] == 1.0
        assert result["model"] == "test_model"
        assert "ts" in result
        assert result["features"] == features

        # Verify config manager methods were called
        inference_engine.config_manager.get_inference_result.assert_called_once_with(
            ["error", "anomaly"], 5
        )

    @pytest.mark.asyncio
    async def test_process_correlation_event(self, inference_engine):
        """Test processing correlation events."""
        # Mock the producer
        inference_engine.producer = Mock()

        correlation_data = {
            "correlation_id": "corr_123",
            "group_key": "server-01|production",
            "labels": ["error", "anomaly"],
            "count": 5,
            "first_seen": "2024-01-15T10:00:00Z",
            "last_seen": "2024-01-15T10:05:00Z"
        }

        # Mock the produce_inference method
        inference_engine.produce_inference = AsyncMock()

        await inference_engine.process_correlation_event(correlation_data, "test-topic")

        # Verify produce_inference was called
        inference_engine.produce_inference.assert_called_once()

        # Check the call arguments
        call_args = inference_engine.produce_inference.call_args
        inference_result = call_args[0][0]  # First positional argument

        assert inference_result["label"] == "anomaly"
        assert inference_result["score"] == 1.0
        assert inference_result["correlation_id"] == "corr_123"
        assert inference_result["group_key"] == "server-01|production"

    def test_stop(self, inference_engine):
        """Test stopping the inference engine."""
        inference_engine.consumer = Mock()
        inference_engine.producer = Mock()

        inference_engine.stop()

        assert inference_engine.running is False
        inference_engine.consumer.close.assert_called_once()
        inference_engine.producer.close.assert_called_once()


class TestConfigManager:
    """Test the ConfigManager class."""

    def test_get_config_default(self):
        """Test getting default configuration."""
        config_manager = ConfigManager("http://localhost:8083", "test")
        config = config_manager.get_config()

        assert config.active_model == "threshold_model"
        assert config.params.label_required == "anomaly"
        assert config.params.count_threshold == 3

    def test_should_emit_inference_true(self):
        """Test should_emit_inference returns true when conditions are met."""
        config_manager = ConfigManager("http://localhost:8083", "test")

        labels = ["error", "anomaly"]
        count = 5

        result = config_manager.should_emit_inference(labels, count)
        assert result is True

    def test_should_emit_inference_false_missing_label(self):
        """Test should_emit_inference returns false when label is missing."""
        config_manager = ConfigManager("http://localhost:8083", "test")

        labels = ["error", "critical"]
        count = 5

        result = config_manager.should_emit_inference(labels, count)
        assert result is False

    def test_should_emit_inference_false_low_count(self):
        """Test should_emit_inference returns false when count is low."""
        config_manager = ConfigManager("http://localhost:8083", "test")

        labels = ["error", "anomaly"]
        count = 1

        result = config_manager.should_emit_inference(labels, count)
        assert result is False

    def test_get_inference_result_anomaly(self):
        """Test get_inference_result for anomaly case."""
        config_manager = ConfigManager("http://localhost:8083", "test")

        labels = ["error", "anomaly"]
        count = 5

        result = config_manager.get_inference_result(labels, count)

        assert result["label"] == "anomaly"
        assert result["score"] == 1.0
        assert result["model"] == "threshold_model"

    def test_get_inference_result_normal(self):
        """Test get_inference_result for normal case."""
        config_manager = ConfigManager("http://localhost:8083", "test")

        labels = ["info", "normal"]
        count = 1

        result = config_manager.get_inference_result(labels, count)

        assert result["label"] == "normal"
        assert result["score"] == 0.0
        assert result["model"] == "threshold_model"
