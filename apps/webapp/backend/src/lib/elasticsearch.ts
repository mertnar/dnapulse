import { Client } from '@elastic/elasticsearch';

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

export const esClient = new Client({
  node: ELASTICSEARCH_URL,
  requestTimeout: 30000,
  maxRetries: 3,
});

export interface ELKSearchParams {
  index: string;
  query?: string;
  time_range?: {
    from?: string;
    to?: string;
  };
  size?: number;
  from?: number;
  sort?: Array<{ [key: string]: 'asc' | 'desc' }>;
  filters?: Array<{
    field: string;
    value: any;
    operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  }>;
}

export interface ELKSearchResult {
  hits: {
    total: { value: number; relation: string };
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: any;
    }>;
  };
  aggregations?: any;
}

/**
 * Build Elasticsearch query from search params
 */
export function buildELKQuery(params: ELKSearchParams): any {
  const must: any[] = [];
  const filter: any[] = [];

  // Time range filter
  if (params.time_range) {
    const timeFilter: any = { range: { '@timestamp': {} } };
    if (params.time_range.from) {
      timeFilter.range['@timestamp'].gte = params.time_range.from;
    }
    if (params.time_range.to) {
      timeFilter.range['@timestamp'].lte = params.time_range.to;
    }
    filter.push(timeFilter);
  }

  // Query string search
  if (params.query && params.query.trim()) {
    must.push({
      query_string: {
        query: params.query,
        default_operator: 'AND',
        analyze_wildcard: true,
      },
    });
  }

  // Additional filters
  if (params.filters && params.filters.length > 0) {
    params.filters.forEach((f) => {
      switch (f.operator) {
        case 'equals':
          filter.push({ term: { [f.field]: f.value } });
          break;
        case 'contains':
          filter.push({ wildcard: { [f.field]: `*${f.value}*` } });
          break;
        case 'gt':
          filter.push({ range: { [f.field]: { gt: f.value } } });
          break;
        case 'gte':
          filter.push({ range: { [f.field]: { gte: f.value } } });
          break;
        case 'lt':
          filter.push({ range: { [f.field]: { lt: f.value } } });
          break;
        case 'lte':
          filter.push({ range: { [f.field]: { lte: f.value } } });
          break;
        default:
          filter.push({ term: { [f.field]: f.value } });
      }
    });
  }

  const query: any = {
    bool: {},
  };

  if (must.length > 0) query.bool.must = must;
  if (filter.length > 0) query.bool.filter = filter;

  // If no conditions, match all
  if (must.length === 0 && filter.length === 0) {
    return { match_all: {} };
  }

  return query;
}

/**
 * Search events in Elasticsearch
 */
export async function searchELK(params: ELKSearchParams): Promise<ELKSearchResult> {
  const query = buildELKQuery(params);

  const response = await esClient.search({
    index: params.index,
    query,
    size: params.size || 100,
    from: params.from || 0,
    sort: params.sort || [{ '@timestamp': 'desc' }],
  } as any);

  return response as any;
}

/**
 * Get field mappings from Elasticsearch index
 */
export async function getIndexMappings(index: string): Promise<any> {
  try {
    const response = await esClient.indices.getMapping({ index });
    return response;
  } catch (error) {
    console.error('Failed to get index mappings:', error);
    throw error;
  }
}

/**
 * Get aggregated histogram data
 */
export async function getHistogram(
  index: string,
  timeRange: { from: string; to: string },
  interval: string = '1m'
): Promise<any> {
  const response = await esClient.search({
    index,
    size: 0,
    query: {
      bool: {
        filter: [
          {
            range: {
              '@timestamp': {
                gte: timeRange.from,
                lte: timeRange.to,
              },
            },
          },
        ],
      },
    },
    aggs: {
      events_over_time: {
        date_histogram: {
          field: '@timestamp',
          fixed_interval: interval,
        },
        aggs: {
          by_severity: {
            terms: {
              field: 'severity.keyword',
              missing: 'info',
            },
          },
        },
      },
    },
  } as any);

  return response.aggregations;
}

/**
 * Get field statistics and cardinality
 */
export async function getFieldStats(index: string, field: string): Promise<any> {
  const response = await esClient.search({
    index,
    size: 0,
    aggs: {
      field_stats: {
        stats: { field },
      },
      field_cardinality: {
        cardinality: { field },
      },
      top_values: {
        terms: {
          field: `${field}.keyword`,
          size: 10,
        },
      },
    },
  } as any);

  return response.aggregations;
}

/**
 * Check if index exists
 */
export async function indexExists(index: string): Promise<boolean> {
  try {
    const response = await esClient.indices.exists({ index });
    return response;
  } catch (error) {
    return false;
  }
}

/**
 * Get all indices matching a pattern
 */
export async function getIndices(pattern: string = '*'): Promise<string[]> {
  try {
    const response = await esClient.cat.indices({
      index: pattern,
      format: 'json',
    });
    return (response as any).map((idx: any) => idx.index);
  } catch (error) {
    console.error('Failed to get indices:', error);
    return [];
  }
}
