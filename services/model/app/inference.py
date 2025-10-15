"""Inference logic for the Model service."""

import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from kafka import KafkaConsumer, KafkaProducer
from prometheus_client import Counter, Histogram, Gauge

from .config import ConfigManager


# Prometheus metrics
inference_requests_total = Counter('model_inference_requests_total', 'Total inference requests')
inference_duration_seconds = Histogram('model_inference_duration_seconds', 'Inference duration')
correlation_events_processed = Counter('model_correlation_events_processed_total', 'Total correlation events processed')
inferences_emitted = Counter('model_inferences_emitted_total', 'Total inferences emitted')
active_model_version = Gauge('model_active_version', 'Active model version', ['model_name'])


class InferenceEngine:
    """Handles inference operations."""

    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.producer: Optional[KafkaProducer] = None
        self.consumer: Optional[KafkaConsumer] = None
        self.running = False

    def setup_kafka_producer(self, broker: str) -> KafkaProducer:
        """Setup Kafka producer."""
        return KafkaProducer(
            bootstrap_servers=[broker],
            client_id='model-service-producer',
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

    def setup_kafka_consumer(self, broker: str, topic: str, group_id: str) -> KafkaConsumer:
        """Setup Kafka consumer."""
        return KafkaConsumer(
            topic,
            bootstrap_servers=[broker],
            group_id=group_id,
            auto_offset_reset='latest',
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    async def start_consumer_loop(self, broker: str, input_topic: str, output_topic: str):
        """Start the Kafka consumer loop."""
        self.producer = self.setup_kafka_producer(broker)
        self.consumer = self.setup_kafka_consumer(broker, input_topic, "model-service-group")
        self.running = True

        print(f"Started Kafka consumer for topic: {input_topic}")

        while self.running:
            try:
                # Use asyncio to run the synchronous consumer in a thread
                loop = asyncio.get_event_loop()
                messages = await loop.run_in_executor(
                    None,
                    lambda: list(self.consumer.poll(timeout_ms=1000, max_records=10))
                )

                for message in messages:
                    # Process the message
                    await self.process_correlation_event(message.value, output_topic)

                if not messages:
                    await asyncio.sleep(0.1)  # Small delay when no messages

            except Exception as e:
                print(f"Error in consumer loop: {e}")
                await asyncio.sleep(1)

    async def process_correlation_event(self, correlation_data: dict, output_topic: str):
        """Process a correlation event and produce inference if needed."""
        try:
            # correlation_data is already parsed by kafka-python deserializer

            labels = correlation_data.get('labels', [])
            count = correlation_data.get('count', 0)
            group_key = correlation_data.get('group_key', '')

            # Update metrics
            correlation_events_processed.inc()

            # Check if we should emit inference
            if self.config_manager.should_emit_inference(labels, count):
                inference_result = self.config_manager.get_inference_result(labels, count)
                inference_result['ts'] = datetime.now(timezone.utc).isoformat()
                inference_result['correlation_id'] = correlation_data.get('correlation_id')
                inference_result['group_key'] = group_key

                # Produce inference result
                await self.produce_inference(inference_result, output_topic)

                print(f"Inference emitted for group {group_key}: {inference_result['label']} (score={inference_result['score']})")

        except Exception as e:
            print(f"Error processing correlation event: {e}")

    async def produce_inference(self, inference_result: Dict[str, Any], output_topic: str):
        """Produce inference result to Kafka."""
        try:
            # Use asyncio to run the synchronous producer in a thread
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self.producer.send(output_topic, inference_result)
            )

            await loop.run_in_executor(None, self.producer.flush)
            inferences_emitted.inc()

        except Exception as e:
            print(f"Error producing inference: {e}")

    async def infer_from_features(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Perform inference on features (for API endpoint)."""
        with inference_duration_seconds.time():
            inference_requests_total.inc()

            # Extract relevant information from features
            labels = features.get('labels', [])
            count = features.get('count', 0)

            # Get inference result
            result = self.config_manager.get_inference_result(labels, count)
            result['ts'] = datetime.now(timezone.utc).isoformat()
            result['features'] = features

            return result

    def stop(self):
        """Stop the consumer loop."""
        self.running = False
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.close()


def should_emit_inference_threshold(labels: list, count: int, label_required: str = "anomaly", count_threshold: int = 3) -> bool:
    """
    Simple threshold-based inference function for testing.

    Args:
        labels: List of labels from the correlation event
        count: Count of events in the correlation group
        label_required: Required label for anomaly detection
        count_threshold: Minimum count threshold for anomaly

    Returns:
        bool: True if inference should be emitted
    """
    return label_required in labels and count >= count_threshold
