import { getCollection, Collections } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { parseKQLQuery, getAllowedFieldsFromSchema } from './queryParser.js';
import {
  searchELK,
  getHistogram as getELKHistogram,
  getIndexMappings,
  buildELKQuery,
  esClient,
} from '../lib/elasticsearch.js';

export interface SearchParams {
  organization_id: string;
  index?: string; // ELK index name (from data model)
  time_range?: {
    preset?: '15m' | '1h' | '4h' | '24h' | '7d' | '1m';
    from?: string;
    to?: string;
  };
  query?: string;
  limit?: number;
  cursor?: string;
  data_source_id?: string;
  agent_id?: string;
  severity?: string[];
}

export interface SearchResult {
  events: any[];
  next_cursor?: string;
  total_estimate?: number;
}

export interface AggParams {
  organization_id: string;
  time_range?: {
    preset?: '15m' | '1h' | '4h' | '24h' | '7d' | '1m';
    from?: string;
    to?: string;
  };
  query?: string;
  interval?: number; // minutes per bucket
}

export interface HistogramBucket {
  timestamp: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface FieldGroup {
  category: 'common' | 'system' | 'payload' | 'metadata';
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  category: 'common' | 'system' | 'payload' | 'metadata';
  example?: any;
}

export interface FacetValue {
  value: string;
  count: number;
}

/**
 * Parse time range preset to from/to dates
 */
function parseTimePreset(preset: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case '15m':
      from.setMinutes(from.getMinutes() - 15);
      break;
    case '1h':
      from.setHours(from.getHours() - 1);
      break;
    case '4h':
      from.setHours(from.getHours() - 4);
      break;
    case '24h':
      from.setDate(from.getDate() - 1);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '1m':
      from.setDate(from.getDate() - 30); // 1 month = 30 days
      break;
    default:
      from.setHours(from.getHours() - 1); // Default 1 hour
  }

  return { from, to };
}

/**
 * Build MongoDB filter from search params
 */
async function buildFilter(params: SearchParams): Promise<any> {
  const filter: any = {
    organization_id: new ObjectId(params.organization_id),
  };

  // Time range - check both payload.@ts (normalized) and created_at (fallback)
  if (params.time_range) {
    let from: Date;
    let to: Date;

    if (params.time_range.preset) {
      ({ from, to } = parseTimePreset(params.time_range.preset));
    } else {
      from = params.time_range.from
        ? new Date(params.time_range.from)
        : new Date(Date.now() - 3600000);
      to = params.time_range.to ? new Date(params.time_range.to) : new Date();
    }

    // Use OR condition to match events with either @ts or created_at in range
    filter.$or = [
      {
        'payload.@ts': {
          $gte: from.toISOString(),
          $lte: to.toISOString(),
        },
      },
      {
        created_at: {
          $gte: from,
          $lte: to,
        },
      },
    ];
  }

  // Data source filter
  if (params.data_source_id) {
    filter.data_source_id = new ObjectId(params.data_source_id);
  }

  // Agent filter
  if (params.agent_id) {
    filter.agent_id = new ObjectId(params.agent_id);
  }

  // Severity filter
  if (params.severity && params.severity.length > 0) {
    filter['payload.severity'] = { $in: params.severity };
  }

  // KQL query
  if (params.query && params.query.trim() !== '') {
    try {
      // Get allowed fields from schema
      const allowedFields = await getAllowedFields(params.data_source_id);
      const kqlFilter = parseKQLQuery(params.query, allowedFields);

      // Merge KQL filter with base filter
      if (Object.keys(kqlFilter).length > 0) {
        // Save the base filter before modifying
        const baseFilter = { ...filter };

        // Create $and with base filter and KQL filter
        filter.$and = [baseFilter, kqlFilter];

        // Remove top-level fields that are now in $and
        delete filter.organization_id;
        delete filter.$or;
        delete filter.data_source_id;
        delete filter.agent_id;
        delete filter['payload.severity'];
      }
    } catch (error) {
      console.error('KQL parse error:', error);
      // Continue with base filter only
    }
  }

  return filter;
}

/**
 * Get allowed fields from discovered schema
 */
async function getAllowedFields(dataSourceId?: string): Promise<string[]> {
  if (!dataSourceId) {
    return []; // No restrictions
  }

  try {
    const schemasCollection = await getCollection(Collections.DISCOVERED_SCHEMAS);
    const schema = await schemasCollection.findOne({
      data_source_id: new ObjectId(dataSourceId),
    });

    if (schema && schema.fields) {
      return getAllowedFieldsFromSchema(schema.fields);
    }
  } catch (error) {
    console.error('Error fetching schema:', error);
  }

  return [];
}

/**
 * Parse cursor string to timestamp and ID
 */
function parseCursor(cursor: string): { ts: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [ts, id] = decoded.split('|');
    return { ts, id };
  } catch (error) {
    return null;
  }
}

/**
 * Create cursor string from timestamp and ID
 */
function createCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`).toString('base64');
}

export const liveMonitorService = {
  /**
   * Search events with pagination using Elasticsearch
   */
  async searchEvents(params: SearchParams): Promise<SearchResult> {
    // If no index specified, search all indices for this organization
    const orgId = params.organization_id?.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fallbackIndex = orgId ? `org_${orgId}__*` : 'org_*';
    const searchIndex = params.index || fallbackIndex;

    const limit = params.limit || 100;
    const from = params.cursor ? parseInt(params.cursor, 10) : 0;

    // Build time range
    let timeRange: { from: string; to: string } | undefined;
    if (params.time_range?.preset) {
      const { from: fromDate, to: toDate } = parseTimePreset(params.time_range.preset);
      timeRange = {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      };
    } else if (params.time_range?.from && params.time_range?.to) {
      timeRange = {
        from: params.time_range.from,
        to: params.time_range.to,
      };
    }

    // Build filters
    const filters: any[] = [];
    if (params.severity && params.severity.length > 0) {
      filters.push({
        field: 'severity.keyword',
        value: params.severity,
        operator: 'equals',
      });
    }

    try {
      const result = await searchELK({
        index: searchIndex,
        query: params.query,
        time_range: timeRange,
        size: limit,
        from,
        filters,
        sort: [{ '@timestamp': 'desc' }],
      });

      const events = result.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));

      // Calculate next cursor
      const nextCursor = result.hits.total.value > from + limit ? String(from + limit) : undefined;

      return {
        events,
        next_cursor: nextCursor,
        total_estimate: result.hits.total.value,
      };
    } catch (error) {
      console.error('Elasticsearch search error:', error);
      return {
        events: [],
        total_estimate: 0,
      };
    }
  },

  /**
   * Get histogram aggregation grouped by severity using Elasticsearch
   */
  async getAggregation(
    params: AggParams & { index?: string; organization_id?: string }
  ): Promise<HistogramBucket[]> {
    const orgId = params.organization_id?.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fallbackIndex = orgId ? `org_${orgId}__*` : 'org_*';
    const searchIndex = params.index || fallbackIndex;

    // Determine time range
    let from: Date;
    let to: Date;

    if (params.time_range?.preset) {
      ({ from, to } = parseTimePreset(params.time_range.preset));
    } else if (params.time_range?.from && params.time_range?.to) {
      from = new Date(params.time_range.from);
      to = new Date(params.time_range.to);
    } else {
      from = new Date(Date.now() - 3600000); // Default 1 hour
      to = new Date();
    }

    // Determine interval
    const interval = params.interval || 5; // Default 5 minutes
    const intervalStr = `${interval}m`;

    try {
      const aggs = await getELKHistogram(
        searchIndex,
        {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        intervalStr
      );

      // Parse Elasticsearch aggregation response
      const buckets = aggs?.events_over_time?.buckets || [];

      return buckets.map((bucket: any) => {
        const severityBuckets = bucket.by_severity?.buckets || [];
        const severityCounts: any = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        };

        severityBuckets.forEach((sev: any) => {
          const key = sev.key.toLowerCase();
          if (severityCounts.hasOwnProperty(key)) {
            severityCounts[key] = sev.doc_count;
          }
        });

        return {
          timestamp: new Date(bucket.key).toISOString(),
          total: bucket.doc_count || 0,
          critical: severityCounts.critical,
          high: severityCounts.high,
          medium: severityCounts.medium,
          low: severityCounts.low,
          info: severityCounts.info,
        };
      });
    } catch (error) {
      console.error('Elasticsearch histogram error:', error);
      return [];
    }
  },

  /**
   * Get available fields from Elasticsearch index mappings
   */
  async getFields(index?: string): Promise<FieldGroup[]> {
    const fieldGroups: FieldGroup[] = [
      { category: 'common', fields: [] },
      { category: 'system', fields: [] },
      { category: 'payload', fields: [] },
      { category: 'metadata', fields: [] },
    ];

    if (!index) {
      return fieldGroups;
    }

    try {
      // Get mappings from Elasticsearch
      const response = await esClient.indices.getMapping({ index } as any);
      const mappings = (response as any)[index]?.mappings?.properties || {};

      // Recursively extract all fields from nested structures
      const extractFields = (properties: any, prefix: string = '') => {
        const fields: FieldInfo[] = [];

        for (const [fieldName, fieldDef] of Object.entries(properties)) {
          const fullPath = prefix ? `${prefix}.${fieldName}` : fieldName;
          const def = fieldDef as any;

          // Add the field itself if it has a type
          if (def.type && def.type !== 'object') {
            fields.push({
              name: fullPath,
              type: mapElasticsearchType(def.type),
              category: inferFieldCategory(fullPath),
            });
          }

          // Handle nested objects
          if (def.properties) {
            fields.push(...extractFields(def.properties, fullPath));
          }

          // Handle keyword sub-fields
          if (def.fields) {
            for (const [subFieldName, subFieldDef] of Object.entries(def.fields)) {
              const subDef = subFieldDef as any;
              if (subDef.type) {
                fields.push({
                  name: `${fullPath}.${subFieldName}`,
                  type: mapElasticsearchType(subDef.type),
                  category: inferFieldCategory(fullPath),
                });
              }
            }
          }
        }

        return fields;
      };

      const allFields = extractFields(mappings);

      // Distribute fields into categories
      allFields.forEach((field) => {
        const group = fieldGroups.find((g) => g.category === field.category);
        if (group) {
          group.fields.push(field);
        }
      });

      // Sort fields within each group
      fieldGroups.forEach((group) => {
        group.fields.sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch (error) {
      console.error('Error fetching Elasticsearch mappings:', error);
    }

    // Filter out empty groups
    return fieldGroups.filter((g) => g.fields.length > 0);
  },

  /**
   * Get facet values (top values) for a field from Elasticsearch
   */
  async getFacetValues(
    field: string,
    index: string,
    time_range: { from: Date; to: Date },
    query: string = '',
    limit: number = 10
  ): Promise<FacetValue[]> {
    try {
      // Determine the correct field name for aggregation
      // Use .keyword for text fields to get exact values
      let aggField = field;
      if (!field.endsWith('.keyword') && !field.includes('_id') && !field.includes('timestamp')) {
        // Check if field has a keyword subfield
        const mappingResponse = await esClient.indices.getMapping({ index } as any);
        const mappings = (mappingResponse as any)[index]?.mappings?.properties || {};

        // Navigate to the field in nested structure
        const fieldParts = field.split('.');
        let currentMapping: any = mappings;
        for (const part of fieldParts) {
          currentMapping = currentMapping?.[part];
          if (!currentMapping) break;
        }

        // If field has keyword subfield, use it
        if (currentMapping?.fields?.keyword) {
          aggField = `${field}.keyword`;
        }
      }

      const must: any[] = [
        {
          range: {
            '@timestamp': {
              gte: time_range.from.toISOString(),
              lte: time_range.to.toISOString(),
            },
          },
        },
        {
          exists: {
            field: field,
          },
        },
      ];

      if (query && query.trim()) {
        must.push({
          query_string: {
            query: query,
            default_field: '*',
          },
        });
      }

      const response = await esClient.search({
        index,
        body: {
          query: {
            bool: { must },
          },
          size: 0,
          aggs: {
            top_values: {
              terms: {
                field: aggField,
                size: limit,
                order: { _count: 'desc' },
              },
            },
          },
        },
      } as any);

      const buckets = (response as any).aggregations?.top_values?.buckets || [];
      return buckets.map((bucket: any) => ({
        value: String(bucket.key),
        count: bucket.doc_count,
      }));
    } catch (error) {
      console.error('Error fetching facet values from Elasticsearch:', error);
      return [];
    }
  },

  /**
   * Get event by ID with full payload
   */
  async getEventById(eventId: string): Promise<any> {
    const collection = await getCollection(Collections.EVENTS);
    const event = await collection.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return null;
    }

    return {
      ...event,
      id: event._id.toString(),
      organization_id: event.organization_id?.toString(),
      data_source_id: event.data_source_id?.toString(),
      agent_id: event.agent_id?.toString(),
    };
  },

  /**
   * Get stats summary
   */
  async getStats(organization_id: string): Promise<any> {
    const collection = await getCollection(Collections.EVENTS);

    // Get counts for last hour
    const oneHourAgo = new Date(Date.now() - 3600000);

    const pipeline = [
      {
        $match: {
          organization_id: new ObjectId(organization_id),
          'payload.@ts': { $gte: oneHourAgo.toISOString() },
        },
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          by_severity: [
            {
              $group: {
                _id: '$payload.severity',
                count: { $sum: 1 },
              },
            },
          ],
          by_source: [
            {
              $group: {
                _id: '$data_source_id',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    const stats = results[0] || {};

    return {
      total: stats.total?.[0]?.count || 0,
      by_severity: stats.by_severity || [],
      top_sources: stats.by_source || [],
      time_range: '1h',
    };
  },
};

/**
 * Helper: Generate bucket boundaries for time bucketing
 */
function generateBucketBoundaries(from: Date, to: Date, bucketSizeMs: number): Date[] {
  const boundaries: Date[] = [];
  let current = new Date(Math.floor(from.getTime() / bucketSizeMs) * bucketSizeMs);

  while (current <= to) {
    boundaries.push(new Date(current));
    current = new Date(current.getTime() + bucketSizeMs);
  }

  // Add one more boundary for the last bucket
  boundaries.push(new Date(current));

  return boundaries;
}

/**
 * Helper: Map Elasticsearch field type to our field type
 */
function mapElasticsearchType(esType: string): 'string' | 'number' | 'boolean' | 'date' {
  switch (esType?.toLowerCase()) {
    case 'long':
    case 'integer':
    case 'short':
    case 'byte':
    case 'double':
    case 'float':
    case 'half_float':
    case 'scaled_float':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'date_nanos':
      return 'date';
    case 'text':
    case 'keyword':
    case 'ip':
    case 'geo_point':
    default:
      return 'string';
  }
}

/**
 * Helper: Infer TypeScript type from schema type
 */
function inferFieldType(schemaType: string): 'string' | 'number' | 'boolean' | 'date' {
  switch (schemaType?.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'float':
    case 'double':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'date';
    default:
      return 'string';
  }
}

/**
 * Helper: Infer category from field name
 */
function inferFieldCategory(fieldName: string): 'common' | 'system' | 'payload' | 'metadata' {
  const name = fieldName.toLowerCase();

  // Metadata fields (IDs, timestamps, etc.)
  if (
    name === 'organization_id' ||
    name === 'data_source_id' ||
    name === 'agent_id' ||
    name === 'event_id' ||
    name === 'tenant_id' ||
    name === '@timestamp' ||
    name === 'ingested_at' ||
    name === 'kind' ||
    name === 'type'
  ) {
    return 'metadata';
  }

  // System-level fields (CPU, memory, disk, network)
  if (
    name.includes('cpu') ||
    name.includes('memory') ||
    name.includes('disk') ||
    name.includes('network') ||
    name.includes('process') ||
    name.includes('pid') ||
    name.includes('thread') ||
    name.includes('system') ||
    name.includes('usage') ||
    name.includes('percent')
  ) {
    return 'system';
  }

  // Common fields (severity, source, host, etc.)
  if (
    name.includes('severity') ||
    name.includes('level') ||
    name.includes('host') ||
    name.includes('source') ||
    name.includes('user') ||
    name.includes('status') ||
    name.includes('message')
  ) {
    return 'common';
  }

  // Everything else goes to payload
  return 'payload';
}
