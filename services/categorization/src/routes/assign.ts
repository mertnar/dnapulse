import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoStore } from '../store';
import { ElasticsearchStore } from '../store';
import { PipelineExecutor } from '../pipeline';
import { AssignmentRequest, AssignmentResponse, LabelAssignment, Item } from '../model';

export interface AssignRoutesOptions {
  mongoStore: MongoStore;
  elasticsearchStore?: ElasticsearchStore;
  pipelineExecutor: PipelineExecutor;
}

interface AssignRequest {
  Body: AssignmentRequest;
}

export async function assignRoutes(fastify: FastifyInstance, options: AssignRoutesOptions) {
  const { mongoStore, elasticsearchStore, pipelineExecutor } = options;

  // Assign labels to items
  fastify.post<AssignRequest>(
    '/v1/assign',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'tenant_id', 'type', 'ts', 'payload', 'attributes'],
                properties: {
                  id: { type: 'string' },
                  tenant_id: { type: 'string' },
                  type: { type: 'string', enum: ['log', 'metric', 'event', 'trace'] },
                  ts: { type: 'string' },
                  payload: { type: 'object' },
                  attributes: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<AssignRequest>, reply: FastifyReply) => {
      const startTime = Date.now();
      const { items } = request.body;

      const assignments: LabelAssignment[] = [];
      const errors: Array<{ item_id: string; error: string }> = [];

      fastify.log.info({ itemCount: items.length }, 'Processing assignment request');

      // Process items in parallel with concurrency limit
      const concurrency = 10;
      const chunks = [];
      for (let i = 0; i < items.length; i += concurrency) {
        chunks.push(items.slice(i, i + concurrency));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async (item: Item) => {
          try {
            // Execute pipeline to get labels
            const labels = await pipelineExecutor.execute(item);

            if (labels.length > 0) {
              // Store labels in MongoDB
              await mongoStore.assignLabels(item.id, labels);

              // Index in Elasticsearch if enabled
              if (elasticsearchStore) {
                try {
                  await elasticsearchStore.indexItem(item, labels);
                } catch (esError) {
                  fastify.log.warn(
                    {
                      itemId: item.id,
                      error: esError,
                    },
                    'Failed to index item in Elasticsearch'
                  );
                  // Don't fail the whole operation for ES errors
                }
              }

              assignments.push({
                item_id: item.id,
                labels,
                ts: new Date().toISOString(),
              });

              fastify.log.debug(
                {
                  itemId: item.id,
                  labelCount: labels.length,
                },
                'Item processed successfully'
              );
            } else {
              fastify.log.debug({ itemId: item.id }, 'No labels assigned to item');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({
              item_id: item.id,
              error: errorMessage,
            });

            fastify.log.error(
              {
                itemId: item.id,
                error: errorMessage,
              },
              'Failed to process item'
            );
          }
        });

        await Promise.all(promises);
      }

      const processingTime = Date.now() - startTime;
      const response: AssignmentResponse = {
        assignments,
        ...(errors.length > 0 && { errors }),
      };

      fastify.log.info(
        {
          totalItems: items.length,
          successfulAssignments: assignments.length,
          errors: errors.length,
          processingTimeMs: processingTime,
        },
        'Assignment request completed'
      );

      reply.send({
        success: true,
        data: response,
        meta: {
          total_items: items.length,
          successful_assignments: assignments.length,
          errors: errors.length,
          processing_time_ms: processingTime,
        },
      });
    }
  );

  // Bulk assign with custom pipeline
  fastify.post<AssignRequest & { Body: AssignmentRequest & { pipeline_name?: string } }>(
    '/v1/assign/bulk',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'tenant_id', 'type', 'ts', 'payload', 'attributes'],
                properties: {
                  id: { type: 'string' },
                  tenant_id: { type: 'string' },
                  type: { type: 'string', enum: ['log', 'metric', 'event', 'trace'] },
                  ts: { type: 'string' },
                  payload: { type: 'object' },
                  attributes: { type: 'object' },
                },
              },
            },
            pipeline_name: { type: 'string' },
          },
        },
      },
    },
    async (
      _: FastifyRequest<AssignRequest & { Body: AssignmentRequest & { pipeline_name?: string } }>,
      __: FastifyReply
    ) => {
      // For now, this is the same as /v1/assign
      // In the future, this could support custom pipeline selection

      // Forward to regular assign endpoint
      return assignRoutes(fastify, options);
    }
  );
}
