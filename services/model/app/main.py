"""FastAPI application for the Model service."""

import asyncio
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from .config import ConfigManager, get_env_config
from .inference import InferenceEngine


# Request/Response models
class InferenceRequest(BaseModel):
    features: Dict[str, Any]


class InferenceResponse(BaseModel):
    label: str
    score: float
    model: str
    ts: str
    features: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    config_loaded: bool


# Global variables
app = FastAPI(title="Model Service", version="1.0.0")
config_manager: ConfigManager = None
inference_engine: InferenceEngine = None
env_config = get_env_config()


@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup."""
    global config_manager, inference_engine
    
    print("Starting Model service...")
    
    # Initialize config manager
    config_manager = ConfigManager(env_config["config_url"], env_config["config_scope"])
    
    # Load initial configuration
    config_loaded = await config_manager.load_config()
    if config_loaded:
        print("Configuration loaded successfully")
    else:
        print("Failed to load configuration, using defaults")
    
    # Initialize inference engine
    inference_engine = InferenceEngine(config_manager)
    
    # Start Kafka consumer loop in background
    asyncio.create_task(
        inference_engine.start_consumer_loop(
            env_config["bus_broker"],
            env_config["input_topic"],
            env_config["output_topic"]
        )
    )
    
    # Start SSE hot reload in background
    asyncio.create_task(start_sse_hot_reload())
    
    print(f"Model service started on port {env_config['port']}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    if inference_engine:
        inference_engine.stop()
    print("Model service stopped")


@app.post("/v1/infer", response_model=InferenceResponse)
async def infer(request: InferenceRequest) -> InferenceResponse:
    """
    Perform inference on provided features.
    
    Args:
        request: Inference request with features
        
    Returns:
        InferenceResponse: Inference result
    """
    try:
        result = await inference_engine.infer_from_features(request.features)
        return InferenceResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    config_loaded = config_manager.config is not None
    
    return HealthResponse(
        status="healthy",
        service="model",
        timestamp=datetime.now(timezone.utc).isoformat(),
        config_loaded=config_loaded
    )


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@app.get("/config/debug")
async def debug_config():
    """Debug endpoint to show current configuration."""
    if not env_config["debug"]:
        raise HTTPException(status_code=403, detail="Debug mode not enabled")
    
    config = config_manager.get_config()
    return {
        "config": config.model_dump(),
        "env_config": env_config,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def start_sse_hot_reload():
    """Start SSE hot reload for configuration updates."""
    import sseclient
    import httpx
    
    sse_url = f"{env_config['config_sse_url']}/v1/stream"
    
    while True:
        try:
            print(f"Connecting to SSE: {sse_url}")
            
            async with httpx.AsyncClient() as client:
                async with client.stream('GET', sse_url) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            if line.startswith('data: '):
                                try:
                                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                                    
                                    if data.get('scope') == env_config['config_scope']:
                                        print(f"Config update received for scope: {data.get('scope')}")
                                        
                                        # Reload configuration
                                        success = await config_manager.load_config()
                                        if success:
                                            print("Configuration reloaded successfully")
                                        else:
                                            print("Failed to reload configuration")
                                            
                                except json.JSONDecodeError:
                                    continue  # Skip non-JSON data
                    else:
                        print(f"SSE connection failed: {response.status_code}")
                        
        except Exception as e:
            print(f"SSE connection error: {e}")
            
        # Wait before retrying
        await asyncio.sleep(5)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=env_config["port"],
        reload=env_config["debug"]
    )
