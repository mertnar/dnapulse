import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export type DataSourceType =
  | 'Agent'
  | 'ELK/Elastic'
  | 'API/Webhook'
  | 'Custom SDK'
  | 'Network/IoT Stream';
export type DataSourceStatus = 'active' | 'inactive' | 'error';
export type DriftStatus = 'none' | 'minor' | 'major';

export interface DataSource {
  id: string;
  organization_id: string;
  name: string;
  type: DataSourceType;
  agent_type?: string;
  status: DataSourceStatus;
  throughput: number;
  latencyP95?: number;
  last_seen: string;
  model_id?: string;
  drift_status?: DriftStatus;
  connection_config?: Record<string, any>;
  pipeline_config?: {
    steps?: any[];
    mappings?: any[];
  };
  config?: Record<string, any>;
  created_at: string;
}

export interface DataModelDetail {
  id: string;
  organization_id: string;
  name: string;
  version: number;
  source_id: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    example: any;
    last_seen?: string;
  }>;
  created_at: string;
}

const dataSourcesService = {
  async getAll(organizationId?: string): Promise<DataSource[]> {
    try {
      const collection = await getCollection(Collections.DATA_SOURCES);
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const sources = await collection.find(filter).toArray();

      return sources.map((source) => ({
        id: source._id.toString(),
        organization_id: source.organization_id.toString(),
        name: source.name,
        type: source.type as DataSourceType,
        agent_type: source.agent_type,
        status: source.status as DataSourceStatus,
        throughput: source.throughput || 0,
        latencyP95: source.latency_p95,
        last_seen: source.last_seen?.toISOString() || new Date().toISOString(),
        model_id: source.schema_id?.toString(),
        drift_status: (source.drift_status as DriftStatus) || 'none',
        connection_config: source.connection_config,
        pipeline_config: source.pipeline_config || { steps: [], mappings: [] },
        config: source.config,
        created_at: source.created_at?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching data sources:', error);
      return [];
    }
  },

  async getById(id: string): Promise<DataSource | undefined> {
    try {
      const collection = await getCollection(Collections.DATA_SOURCES);
      const source = await collection.findOne({ _id: new ObjectId(id) });

      if (!source) return undefined;

      return {
        id: source._id.toString(),
        organization_id: source.organization_id.toString(),
        name: source.name,
        type: source.type as DataSourceType,
        agent_type: source.agent_type,
        status: source.status as DataSourceStatus,
        throughput: source.throughput || 0,
        latencyP95: source.latency_p95,
        last_seen: source.last_seen?.toISOString() || new Date().toISOString(),
        model_id: source.schema_id?.toString(),
        drift_status: (source.drift_status as DriftStatus) || 'none',
        connection_config: source.connection_config,
        pipeline_config: source.pipeline_config || { steps: [], mappings: [] },
        config: source.config,
        created_at: source.created_at?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching data source:', error);
      return undefined;
    }
  },

  async getDataModel(sourceId: string): Promise<DataModelDetail | undefined> {
    try {
      // Get data source first
      const source = await this.getById(sourceId);
      if (!source) {
        console.log(`Data source not found: ${sourceId}`);
        return undefined;
      }

      // Try to get schema by data_source_id first (ingestion service uses this)
      const schemasCollection = await getCollection(Collections.DISCOVERED_SCHEMAS);
      let schema = await schemasCollection.findOne({ data_source_id: new ObjectId(sourceId) });

      // Fallback: try using model_id/schema_id from data source
      if (!schema && source.model_id) {
        schema = await schemasCollection.findOne({ _id: new ObjectId(source.model_id) });
      }

      // Fallback: try using schema_id field
      if (!schema && (source as any).schema_id) {
        schema = await schemasCollection.findOne({ _id: new ObjectId((source as any).schema_id) });
      }

      if (!schema) {
        console.log(`Schema not found for data source: ${sourceId}`);
        return undefined;
      }

      return {
        id: schema._id.toString(),
        organization_id: source.organization_id,
        name: `${source.name} Schema`,
        version: schema.version || 1,
        source_id: sourceId,
        fields: (schema.fields || []).map((field: any) => ({
          name: field.name,
          type: field.type,
          required: field.required || false,
          example: field.example,
          last_seen: schema.discovered_at?.toISOString() || new Date().toISOString(),
        })),
        created_at: schema.discovered_at?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching data model:', error);
      return undefined;
    }
  },

  async getPipelineConfig(sourceId: string): Promise<any> {
    try {
      const source = await this.getById(sourceId);
      return source?.pipeline_config || { steps: [], mappings: [] };
    } catch (error) {
      console.error('Error fetching pipeline config:', error);
      return { steps: [], mappings: [] };
    }
  },

  async create(dataSource: Omit<DataSource, 'id' | 'created_at'>): Promise<DataSource> {
    try {
      const collection = await getCollection(Collections.DATA_SOURCES);
      const now = new Date();

      const doc = {
        organization_id: new ObjectId(dataSource.organization_id),
        name: dataSource.name,
        type: dataSource.type,
        agent_type: dataSource.agent_type,
        status: dataSource.status,
        throughput: dataSource.throughput || 0,
        latency_p95: dataSource.latencyP95,
        last_seen: now,
        schema_id: dataSource.model_id ? new ObjectId(dataSource.model_id) : undefined,
        drift_status: dataSource.drift_status || 'none',
        connection_config: dataSource.connection_config,
        pipeline_config: dataSource.pipeline_config || { steps: [], mappings: [] },
        config: dataSource.config,
        agent_count: 0,
        created_at: now,
      };

      const result = await collection.insertOne(doc);

      return {
        ...dataSource,
        id: result.insertedId.toString(),
        created_at: now.toISOString(),
      };
    } catch (error) {
      console.error('Error creating data source:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<DataSource>): Promise<DataSource | undefined> {
    try {
      const collection = await getCollection(Collections.DATA_SOURCES);

      const updateDoc: any = {};
      if (updates.name) updateDoc.name = updates.name;
      if (updates.type) updateDoc.type = updates.type;
      if (updates.agent_type !== undefined) updateDoc.agent_type = updates.agent_type;
      if (updates.status) updateDoc.status = updates.status;
      if (updates.throughput !== undefined) updateDoc.throughput = updates.throughput;
      if (updates.latencyP95 !== undefined) updateDoc.latency_p95 = updates.latencyP95;
      if (updates.model_id) updateDoc.schema_id = new ObjectId(updates.model_id);
      if (updates.drift_status) updateDoc.drift_status = updates.drift_status;
      if (updates.connection_config) updateDoc.connection_config = updates.connection_config;
      if (updates.pipeline_config) updateDoc.pipeline_config = updates.pipeline_config;
      if (updates.config) updateDoc.config = updates.config;

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

      return await this.getById(id);
    } catch (error) {
      console.error('Error updating data source:', error);
      return undefined;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.DATA_SOURCES);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting data source:', error);
      return false;
    }
  },

  async getConnectedAgents(sourceId: string): Promise<any[]> {
    try {
      const agentsCollection = await getCollection(Collections.AGENTS);
      const agents = await agentsCollection
        .find({ data_source_id: new ObjectId(sourceId) })
        .toArray();

      return agents.map((agent) => ({
        id: agent._id.toString(),
        name: agent.name,
        version: agent.version,
        status: agent.status,
        platform: agent.platform,
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        hostname: agent.hostname,
        ipAddress: agent.ip_address,
      }));
    } catch (error) {
      console.error('Error fetching connected agents:', error);
      return [];
    }
  },

  // Stub methods for controller compatibility
  async testConnection(id: string): Promise<any> {
    // TODO: Implement connection testing
    return { connected: true, latency: 0 };
  },

  async runDiscovery(id: string): Promise<any> {
    // TODO: Implement schema discovery
    return null;
  },

  async getSampleEvents(id: string): Promise<any[]> {
    try {
      const eventsCollection = await getCollection(Collections.EVENTS);
      const events = await eventsCollection
        .find({ data_source_id: new ObjectId(id) })
        .sort({ ingested_at: -1 })
        .limit(10)
        .toArray();

      return events.map((event) => ({
        id: event._id.toString(),
        timestamp: event.ingested_at?.toISOString() || new Date().toISOString(),
        payload: event.payload,
      }));
    } catch (error) {
      console.error('Error fetching sample events:', error);
      return [];
    }
  },

  async getSchemaChanges(id: string): Promise<any[]> {
    // TODO: Implement schema change detection
    return [];
  },

  async acceptSchemaChanges(id: string): Promise<void> {
    // TODO: Implement schema change acceptance
  },

  async getErrors(id: string): Promise<any[]> {
    // TODO: Implement error tracking
    return [];
  },

  async getAuditLogs(id: string): Promise<any[]> {
    // TODO: Implement audit logs
    return [];
  },

  async sendTestEvent(id: string): Promise<any> {
    // TODO: Implement test event sending
    return { success: true };
  },

  async simulateDrift(id: string): Promise<void> {
    // TODO: Implement drift simulation
  },
};

export { dataSourcesService };
export default dataSourcesService;
