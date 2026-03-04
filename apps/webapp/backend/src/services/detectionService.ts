import { esClient } from '../lib/elasticsearch.js';

export const detectionService = {
  async searchEvents(params: {
    index: string;
    query: string;
    time_range: { from: Date; to: Date };
    limit?: number;
  }) {
    try {
      const must: any[] = [
        {
          range: {
            '@timestamp': {
              gte: params.time_range.from.toISOString(),
              lte: params.time_range.to.toISOString(),
            },
          },
        },
      ];

      if (params.query && params.query.trim()) {
        must.push({
          query_string: {
            query: params.query,
            default_field: '*',
          },
        });
      }

      const response = await esClient.search({
        index: params.index,
        body: {
          query: {
            bool: { must },
          },
          sort: [{ '@timestamp': { order: 'desc' } }],
          size: params.limit || 100,
        },
      } as any);

      const hits = (response as any).hits?.hits || [];
      return hits.map((hit: any) => ({
        id: hit._id,
        organization_id: hit._source.organization_id,
        data_source_id: hit._source.data_source_id,
        agent_id: hit._source.agent_id,
        timestamp: hit._source['@timestamp'],
        payload: hit._source.payload,
        ingested_at: hit._source.ingested_at,
      }));
    } catch (error) {
      console.error('Error searching events:', error);
      throw error;
    }
  },

  async aggregateEvents(params: {
    index: string;
    query: string;
    time_range: { from: Date; to: Date };
    interval_min: number;
  }) {
    try {
      const must: any[] = [
        {
          range: {
            '@timestamp': {
              gte: params.time_range.from.toISOString(),
              lte: params.time_range.to.toISOString(),
            },
          },
        },
      ];

      if (params.query && params.query.trim()) {
        must.push({
          query_string: {
            query: params.query,
            default_field: '*',
          },
        });
      }

      const response = await esClient.search({
        index: params.index,
        body: {
          query: {
            bool: { must },
          },
          size: 0,
          aggs: {
            events_over_time: {
              date_histogram: {
                field: '@timestamp',
                fixed_interval: `${params.interval_min}m`,
                time_zone: 'UTC',
                min_doc_count: 0,
                extended_bounds: {
                  min: params.time_range.from.toISOString(),
                  max: params.time_range.to.toISOString(),
                },
              },
              aggs: {
                by_severity: {
                  terms: {
                    field: 'payload.severity.keyword',
                    missing: 'info',
                  },
                },
              },
            },
          },
        },
      } as any);

      const buckets = (response as any).aggregations?.events_over_time?.buckets || [];
      return buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key_as_string || bucket.key),
        total: bucket.doc_count,
        by_severity: bucket.by_severity.buckets.reduce((acc: any, b: any) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {}),
      }));
    } catch (error) {
      console.error('Error aggregating events:', error);
      throw error;
    }
  },
};
