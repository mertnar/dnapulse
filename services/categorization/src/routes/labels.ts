import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoStore } from '../store';
import { Label, HttpStatus } from '../model';

export interface LabelsRoutesOptions {
  mongoStore: MongoStore;
}

interface CreateLabelRequest {
  Body: {
    id: string;
    kind: string;
    name: string;
    description?: string;
    active?: boolean;
  };
}

interface UpdateLabelRequest {
  Params: {
    id: string;
  };
  Body: {
    kind?: string;
    name?: string;
    description?: string;
    active?: boolean;
  };
}

interface GetLabelsRequest {
  Querystring: {
    kind?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  };
}

export async function labelsRoutes(fastify: FastifyInstance, options: LabelsRoutesOptions) {
  const { mongoStore } = options;

  // Create or update label
  fastify.post<CreateLabelRequest>(
    '/v1/labels',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'kind', 'name'],
          properties: {
            id: { type: 'string' },
            kind: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            active: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateLabelRequest>, reply: FastifyReply) => {
      try {
        const { id, kind, name, description, active = true } = request.body;

        const label: Omit<Label, 'created_at' | 'updated_at'> = {
          id,
          kind,
          name,
          ...(description && { description }),
          active,
        };

        const result = await mongoStore.upsertLabel(label);

        reply.code(HttpStatus.CREATED).send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create/update label');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to create/update label',
        });
      }
    }
  );

  // Get labels
  fastify.get<GetLabelsRequest>(
    '/v1/labels',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            kind: { type: 'string' },
            active: { type: 'boolean' },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest<GetLabelsRequest>, reply: FastifyReply) => {
      try {
        const { kind, active, limit = 100, offset = 0 } = request.query;

        const labels = await mongoStore.getLabels(kind, active);

        // Apply pagination
        const paginatedLabels = labels.slice(offset, offset + limit);

        reply.send({
          success: true,
          data: paginatedLabels,
          pagination: {
            total: labels.length,
            limit,
            offset,
            hasMore: offset + limit < labels.length,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get labels');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to get labels',
        });
      }
    }
  );

  // Get label by ID
  fastify.get<{ Params: { id: string } }>(
    '/v1/labels/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const label = await mongoStore.getLabelById(id);

        if (!label) {
          reply.code(HttpStatus.NOT_FOUND).send({
            success: false,
            error: 'Label not found',
          });
          return;
        }

        reply.send({
          success: true,
          data: label,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get label');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to get label',
        });
      }
    }
  );

  // Update label
  fastify.put<UpdateLabelRequest>(
    '/v1/labels/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            kind: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            active: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateLabelRequest>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const updates = request.body;

        // Get existing label
        const existingLabel = await mongoStore.getLabelById(id);
        if (!existingLabel) {
          reply.code(HttpStatus.NOT_FOUND).send({
            success: false,
            error: 'Label not found',
          });
          return;
        }

        // Update label
        const updatedLabel: Omit<Label, 'created_at' | 'updated_at'> = {
          ...existingLabel,
          ...updates,
          id, // Ensure ID doesn't change
        };

        const result = await mongoStore.upsertLabel(updatedLabel);

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update label');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to update label',
        });
      }
    }
  );

  // Delete label
  fastify.delete<{ Params: { id: string } }>(
    '/v1/labels/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Check if label exists
        const existingLabel = await mongoStore.getLabelById(id);
        if (!existingLabel) {
          reply.code(HttpStatus.NOT_FOUND).send({
            success: false,
            error: 'Label not found',
          });
          return;
        }

        // Soft delete by setting active to false
        const updatedLabel: Omit<Label, 'created_at' | 'updated_at'> = {
          ...existingLabel,
          active: false,
        };

        await mongoStore.upsertLabel(updatedLabel);

        reply.send({
          success: true,
          message: 'Label deactivated successfully',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete label');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to delete label',
        });
      }
    }
  );
}
