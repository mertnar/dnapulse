import express from 'express';
import { agentTypesService } from '../services/agentTypesService.js';

const router = express.Router();

// GET /api/agent-types - List all agent types
router.get('/', async (req, res) => {
  try {
    const organizationId = req.query.organizationId as string | undefined;
    const agentTypes = await agentTypesService.getAll(organizationId);
    res.json(agentTypes);
  } catch (error: any) {
    console.error('Error fetching agent types:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent-types/:id - Get agent type details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agentType = await agentTypesService.getById(id);

    if (!agentType) {
      return res.status(404).json({ error: 'Agent type not found' });
    }

    res.json(agentType);
  } catch (error: any) {
    console.error('Error fetching agent type:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent-types/:id/instances - Get all instances of this type
router.get('/:id/instances', async (req, res) => {
  try {
    const { id } = req.params;
    const instances = await agentTypesService.getInstances(id);
    res.json(instances);
  } catch (error: any) {
    console.error('Error fetching agent instances:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent-types - Create new agent type (admin)
router.post('/', async (req, res) => {
  try {
    const agentType = await agentTypesService.create(req.body);
    res.status(201).json(agentType);
  } catch (error: any) {
    console.error('Error creating agent type:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent-types/:id/config - Get agent type config (for agents to download)
router.get('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await agentTypesService.getConfig(id);

    if (!result) {
      return res.status(404).json({ error: 'Agent type not found' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching agent type config:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/agent-types/:id/config - Update agent type config
router.put('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const { config, userId } = req.body;

    const agentType = await agentTypesService.updateConfig(id, config, userId);

    if (!agentType) {
      return res.status(404).json({ error: 'Agent type not found' });
    }

    res.json(agentType);
  } catch (error: any) {
    console.error('Error updating agent type config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent-types/:id/download-info - Get download information
router.get('/:id/download-info', async (req, res) => {
  try {
    const { id } = req.params;
    const agentType = await agentTypesService.getById(id);

    if (!agentType) {
      return res.status(404).json({ error: 'Agent type not found' });
    }

    // Return available platforms and architectures
    const downloadInfo = {
      agentType: agentType.name,
      displayName: agentType.displayName,
      platforms: [
        {
          name: 'linux',
          display: 'Linux',
          architectures: ['amd64', 'arm64'],
          icon: '🐧',
        },
        {
          name: 'windows',
          display: 'Windows',
          architectures: ['amd64'],
          icon: '🪟',
        },
        {
          name: 'darwin',
          display: 'macOS',
          architectures: ['amd64', 'arm64'],
          icon: '🍎',
        },
      ],
      defaultConfig: agentType.defaultConfig,
    };

    res.json(downloadInfo);
  } catch (error: any) {
    console.error('Error fetching download info:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
