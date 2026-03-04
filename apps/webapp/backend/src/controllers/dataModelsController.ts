import { Response } from 'express';
import { dataModelsService } from '../services/dataModelsService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const dataModelsController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { type, status } = req.query;

      const models = await dataModelsService.getAll(organization_id, {
        type: type as string,
        status: status as string,
      });

      res.json(models);
    } catch (error: any) {
      console.error('Error getting data models:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const model = await dataModelsService.getById(id, organization_id);

      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json(model);
    } catch (error: any) {
      console.error('Error getting data model:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;

      const model = await dataModelsService.create({
        ...req.body,
        organization_id,
        created_by: user_id,
      });

      res.status(201).json(model);
    } catch (error: any) {
      console.error('Error creating data model:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const model = await dataModelsService.update(id, organization_id, req.body);

      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json(model);
    } catch (error: any) {
      console.error('Error updating data model:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const deleted = await dataModelsService.delete(id, organization_id);

      if (!deleted) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting data model:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async createVersion(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const newModel = await dataModelsService.createVersion(id, organization_id);

      res.status(201).json(newModel);
    } catch (error: any) {
      console.error('Error creating model version:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async getLineage(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const lineage = await dataModelsService.getLineage(id, organization_id);

      res.json(lineage);
    } catch (error: any) {
      console.error('Error getting model lineage:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async testPipeline(req: AuthRequest, res: Response) {
    try {
      const { pipeline, sample_input } = req.body;

      if (!pipeline || !sample_input) {
        return res.status(400).json({ error: 'pipeline and sample_input are required' });
      }

      // Forward to Processing Service for testing
      const processingServiceUrl = process.env.PROCESSING_SERVICE_URL || 'http://processing:8080';

      const response = await fetch(`${processingServiceUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline, sample_input }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Processing service test failed: ${errorText}`);
      }

      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      console.error('Error testing pipeline:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Data Model Attributes
  async getAttributes(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const attributes = await dataModelsService.getAttributes(id, organization_id);

      res.json(attributes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createAttribute(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { id } = req.params;

      const attribute = await dataModelsService.createAttribute(id, organization_id, {
        ...req.body,
        created_by: user_id,
      });

      res.status(201).json(attribute);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateAttribute(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { attrId } = req.params;

      const attribute = await dataModelsService.updateAttribute(attrId, organization_id, {
        ...req.body,
        updated_by: user_id,
      });

      if (!attribute) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      res.json(attribute);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async deleteAttribute(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { attrId } = req.params;

      const deleted = await dataModelsService.deleteAttribute(attrId, organization_id);

      if (!deleted) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // Pipeline Management
  async getPipeline(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;

      const pipeline = await dataModelsService.getPipeline(id, organization_id);

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      res.json(pipeline);
    } catch (error: any) {
      console.error('Error getting pipeline:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async createPipeline(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { id } = req.params;

      const pipeline = await dataModelsService.createPipeline(id, organization_id, {
        ...req.body,
        created_by: user_id,
      });

      res.status(201).json(pipeline);
    } catch (error: any) {
      console.error('Error creating pipeline:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async updatePipeline(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { id, pipelineId } = req.params;

      const pipeline = await dataModelsService.updatePipeline(id, pipelineId, organization_id, {
        ...req.body,
        updated_by: user_id,
      });

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      res.json(pipeline);
    } catch (error: any) {
      console.error('Error updating pipeline:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async deployPipeline(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id, pipelineId } = req.params;

      await dataModelsService.deployPipeline(id, pipelineId, organization_id);

      // Trigger Processing Service reload
      const processingServiceUrl = process.env.PROCESSING_SERVICE_URL || 'http://processing:8080';
      try {
        await fetch(`${processingServiceUrl}/reload-configs`, { method: 'POST' });
      } catch (reloadError) {
        console.warn('Failed to trigger processing service reload:', reloadError);
      }

      res.json({ success: true, message: 'Pipeline deployed successfully' });
    } catch (error: any) {
      console.error('Error deploying pipeline:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async testPipelineStep(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { step, sample_input } = req.body;

      if (!step || !sample_input) {
        return res.status(400).json({ error: 'step and sample_input are required' });
      }

      // Forward to Processing Service for testing
      const processingServiceUrl = process.env.PROCESSING_SERVICE_URL || 'http://processing:8080';

      const response = await fetch(`${processingServiceUrl}/test-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, sample_input }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Processing service test failed: ${errorText}`);
      }

      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      console.error('Error testing pipeline step:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Derived Model Creation
  async createDerivedModel(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { name, source_model_ids, attributes, pipeline } = req.body;

      if (!name || !source_model_ids || !Array.isArray(source_model_ids)) {
        return res.status(400).json({ error: 'name and source_model_ids are required' });
      }

      const model = await dataModelsService.createDerivedModel({
        organization_id,
        name,
        source_model_ids,
        attributes: attributes || [],
        pipeline: pipeline || { steps: [] },
        created_by: user_id,
      });

      res.status(201).json(model);
    } catch (error: any) {
      console.error('Error creating derived model:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Vector Model Creation
  async createVectorModel(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const { name, source_model_id, text_field, embedding_model, dimensions } = req.body;

      if (!name || !source_model_id || !text_field) {
        return res
          .status(400)
          .json({ error: 'name, source_model_id, and text_field are required' });
      }

      const model = await dataModelsService.createVectorModel({
        organization_id,
        name,
        source_model_id,
        text_field,
        embedding_model: embedding_model || 'text-embedding-3-small',
        dimensions: dimensions || 1536,
        created_by: user_id,
      });

      res.status(201).json(model);
    } catch (error: any) {
      console.error('Error creating vector model:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Available Operations
  async getAvailableOperations(req: AuthRequest, res: Response) {
    try {
      const operations = [
        {
          id: 'math',
          name: 'Mathematical Operation',
          category: 'transform',
          description: 'Perform mathematical calculations on numeric fields',
          inputs: [{ type: 'number', multiple: true }],
          outputs: [{ type: 'number' }],
          params: {
            operation: {
              type: 'select',
              options: ['add', 'subtract', 'multiply', 'divide', 'percentage', 'modulo'],
              required: true,
            },
            expression: {
              type: 'text',
              placeholder: 'field1 + field2',
              description: 'Mathematical expression using field names',
            },
          },
          examples: [
            {
              expression: 'cpu_used / cpu_total * 100',
              description: 'Calculate CPU usage percentage',
            },
            { expression: 'memory_total - memory_used', description: 'Calculate available memory' },
          ],
        },
        {
          id: 'concat',
          name: 'Concatenate Strings',
          category: 'transform',
          description: 'Join multiple string fields together',
          inputs: [{ type: 'string', multiple: true }],
          outputs: [{ type: 'string' }],
          params: {
            separator: {
              type: 'text',
              default: ' ',
              description: 'Character(s) to join fields with',
            },
            fields: { type: 'multi-select', required: true },
          },
          examples: [
            {
              fields: ['hostname', 'agent_id'],
              separator: '-',
              description: 'Create unique host identifier',
            },
          ],
        },
        {
          id: 'conditional',
          name: 'Conditional Logic',
          category: 'logic',
          description: 'Apply if-then-else logic to create derived values',
          inputs: [{ type: 'any', multiple: true }],
          outputs: [{ type: 'any' }],
          params: {
            condition: {
              type: 'expression',
              placeholder: 'field > 100',
              required: true,
              description: 'Boolean expression to evaluate',
            },
            then_value: {
              type: 'text',
              required: true,
              description: 'Value when condition is true',
            },
            else_value: {
              type: 'text',
              required: true,
              description: 'Value when condition is false',
            },
          },
          examples: [
            {
              condition: 'cpu_usage > 80',
              then_value: 'high',
              else_value: 'normal',
              description: 'Classify CPU usage',
            },
          ],
        },
        {
          id: 'vectorize',
          name: 'Create Vector Embedding',
          category: 'ml',
          description: 'Generate vector embeddings from text using OpenAI',
          inputs: [{ type: 'string' }],
          outputs: [{ type: 'vector' }],
          params: {
            model: {
              type: 'select',
              options: ['text-embedding-3-small', 'text-embedding-3-large'],
              default: 'text-embedding-3-small',
              required: true,
            },
            dimensions: {
              type: 'number',
              default: 1536,
              description: 'Vector dimension size',
            },
          },
          examples: [
            {
              model: 'text-embedding-3-small',
              dimensions: 1536,
              description: 'Create embeddings for semantic search',
            },
          ],
        },
        {
          id: 'extract_regex',
          name: 'Extract with Regex',
          category: 'transform',
          description: 'Extract values from text using regular expressions',
          inputs: [{ type: 'string' }],
          outputs: [{ type: 'string' }],
          params: {
            pattern: { type: 'text', required: true, placeholder: '\\d+\\.\\d+\\.\\d+\\.\\d+' },
            group: {
              type: 'number',
              default: 0,
              description: 'Capture group to extract (0 = full match)',
            },
          },
          examples: [
            { pattern: '\\d+\\.\\d+\\.\\d+\\.\\d+', description: 'Extract IP address from text' },
          ],
        },
        {
          id: 'normalize',
          name: 'Normalize Value',
          category: 'transform',
          description: 'Normalize values to a standard range',
          inputs: [{ type: 'number' }],
          outputs: [{ type: 'number' }],
          params: {
            min: { type: 'number', required: true, description: 'Minimum value in range' },
            max: { type: 'number', required: true, description: 'Maximum value in range' },
            target_min: { type: 'number', default: 0 },
            target_max: { type: 'number', default: 1 },
          },
          examples: [
            {
              min: 0,
              max: 100,
              target_min: 0,
              target_max: 1,
              description: 'Normalize percentage to 0-1 range',
            },
          ],
        },
      ];

      res.json(operations);
    } catch (error: any) {
      console.error('Error getting available operations:', error);
      res.status(500).json({ error: error.message });
    }
  },
};
