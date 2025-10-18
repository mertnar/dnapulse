import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoStore } from '../store';
import { ElasticsearchStore } from '../store';
import { HttpStatus } from '../model';

export interface ItemsRoutesOptions {
  mongoStore: MongoStore;
  elasticsearchStore?: ElasticsearchStore;
}

interface GetItemLabelsRequest {
  Params: {
    id: string;
  };
  Querystring: {
    kind?: string;
    limit?: number;
    offset?: number;
  };
}

interface SearchItemsRequest {
  Querystring: {
    labels?: string; // Comma-separated label names
    tenant_id?: string;
    limit?: number;
    offset?: number;
  };
}

export async function itemsRoutes(fastify: FastifyInstance, options: ItemsRoutesOptions) {
  const { mongoStore, elasticsearchStore } = options;

  // Get labels for a specific item
  fastify.get<GetItemLabelsRequest>(
    '/v1/items/:id/labels',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            kind: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest<GetItemLabelsRequest>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { kind, limit = 100, offset = 0 } = request.query;

        // Get item labels from MongoDB
        let itemLabels = await mongoStore.getItemLabels(id);

        // Filter by kind if specified
        if (kind) {
          itemLabels = itemLabels.filter((label) => label.kind === kind);
        }

        // Apply pagination
        const paginatedLabels = itemLabels.slice(offset, offset + limit);

        // Get full label details
        const labelsWithDetails = await Promise.all(
          paginatedLabels.map(async (itemLabel) => {
            const label = await mongoStore.getLabelById(itemLabel.label_id);
            return {
              ...itemLabel,
              label: label || { id: itemLabel.label_id, name: 'Unknown', kind: itemLabel.kind },
            };
          })
        );

        reply.send({
          success: true,
          data: {
            item_id: id,
            labels: labelsWithDetails,
          },
          pagination: {
            total: itemLabels.length,
            limit,
            offset,
            hasMore: offset + limit < itemLabels.length,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get item labels');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to get item labels',
        });
      }
    }
  );

  // Search items by labels (requires Elasticsearch)
  fastify.get<SearchItemsRequest>(
    '/v1/items/search',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            labels: { type: 'string' },
            tenant_id: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest<SearchItemsRequest>, reply: FastifyReply) => {
      if (!elasticsearchStore) {
        reply.code(HttpStatus.BAD_REQUEST).send({
          success: false,
          error: 'Elasticsearch is not enabled. Search functionality requires Elasticsearch.',
        });
        return;
      }

      try {
        const { labels, tenant_id, limit = 100, offset = 0 } = request.query;

        if (!labels) {
          reply.code(HttpStatus.BAD_REQUEST).send({
            success: false,
            error: 'labels parameter is required',
          });
          return;
        }

        const labelNames = labels
          .split(',')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        // Search in Elasticsearch
        const searchResults = await elasticsearchStore.searchByLabels(
          labelNames,
          tenant_id,
          limit + offset // Get more results to handle pagination
        );

        // Apply pagination
        const paginatedResults = searchResults.slice(offset, offset + limit);

        reply.send({
          success: true,
          data: paginatedResults,
          pagination: {
            total: searchResults.length,
            limit,
            offset,
            hasMore: offset + limit < searchResults.length,
          },
          query: {
            labels: labelNames,
            tenant_id,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to search items');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to search items',
        });
      }
    }
  );

  // Get items by label ID
  fastify.get<{ Params: { labelId: string }; Querystring: { limit?: number; offset?: number } }>(
    '/v1/labels/:labelId/items',
    {
      schema: {
        params: {
          type: 'object',
          required: ['labelId'],
          properties: {
            labelId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { labelId: string };
        Querystring: { limit?: number; offset?: number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { labelId } = request.params;
        const { limit = 100, offset = 0 } = request.query;

        // Get items with this label from MongoDB
        const itemLabels = await mongoStore.getItemsByLabel(labelId, limit + offset);

        // Apply pagination
        const paginatedItemLabels = itemLabels.slice(offset, offset + limit);

        reply.send({
          success: true,
          data: {
            label_id: labelId,
            items: paginatedItemLabels,
          },
          pagination: {
            total: itemLabels.length,
            limit,
            offset,
            hasMore: offset + limit < itemLabels.length,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get items by label');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to get items by label',
        });
      }
    }
  );

  // Remove labels from item
  fastify.delete<{ Params: { id: string }; Querystring: { label_ids?: string } }>(
    '/v1/items/:id/labels',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            label_ids: { type: 'string' }, // Comma-separated label IDs
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { label_ids?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { label_ids } = request.query;

        let labelIds: string[] | undefined;
        if (label_ids) {
          labelIds = label_ids
            .split(',')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        }

        // Remove labels from MongoDB
        const deletedCount = await mongoStore.removeItemLabels(id, labelIds);

        // Remove from Elasticsearch if enabled
        if (elasticsearchStore && (!labelIds || labelIds.length === 0)) {
          // If removing all labels, delete the item from ES
          try {
            await elasticsearchStore.deleteItem(id);
          } catch (esError) {
            fastify.log.warn(
              {
                itemId: id,
                error: esError,
              },
              'Failed to delete item from Elasticsearch'
            );
          }
        }

        reply.send({
          success: true,
          data: {
            item_id: id,
            deleted_count: deletedCount,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to remove item labels');
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: 'Failed to remove item labels',
        });
      }
    }
  );
}
