#!/usr/bin/env python3

import asyncio
from app.config import ConfigManager

async def test_config_loading():
    """Test config loading."""
    config_manager = ConfigManager("http://localhost:8083", "model")

    print("Testing config loading...")
    success = await config_manager.load_config()
    print(f"Config loaded: {success}")

    if success:
        config = config_manager.get_config()
        print(f"Config: {config}")
        print(f"Config dict: {config.dict()}")
    else:
        print("Failed to load config")

if __name__ == "__main__":
    asyncio.run(test_config_loading())
