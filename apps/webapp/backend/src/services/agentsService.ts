import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export type AgentPlatform = 'windows' | 'macos' | 'linux' | 'docker';
export type AgentStatus = 'online' | 'offline' | 'error';

export interface DataCollectionConfig {
  systemMetrics: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  processActivity: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  fileSystemEvents: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  networkActivity: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  applicationLogs: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  customAttributes: {
    enabled: boolean;
    attributes: Record<string, string>;
  };
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  platform: AgentPlatform;
  status: AgentStatus;
  version: string;
  configHash?: string;
  dataSourceId?: string;
  dataModelId?: string;
  throughput?: number;
  lastHeartbeat: string;
  createdAt: string;
  config?: DataCollectionConfig;
  authToken?: string;
  ingestionEndpoint?: string;
  organizationId: string;
  hostname?: string;
  ipAddress?: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  timestamp: string;
  eventType: string;
  data: Record<string, any>;
}

const agentsService = {
  async getAll(organizationId?: string): Promise<Agent[]> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const agents = await collection.find(filter).toArray();

      return agents.map((agent) => ({
        id: agent._id.toString(),
        name: agent.name,
        description: agent.description || '',
        platform: agent.platform as AgentPlatform,
        status: agent.status as AgentStatus,
        version: agent.version,
        configHash: agent.config_hash,
        dataSourceId: agent.data_source_id?.toString(),
        dataModelId: agent.data_model_id?.toString(),
        throughput: agent.throughput || 0,
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        createdAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config,
        authToken: agent.auth_token,
        ingestionEndpoint: agent.ingestion_endpoint,
        organizationId: agent.organization_id.toString(),
        hostname: agent.hostname,
        ipAddress: agent.ip_address,
      }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Agent | null> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const agent = await collection.findOne({ _id: new ObjectId(id) });

      if (!agent) return null;

      return {
        id: agent._id.toString(),
        name: agent.name,
        description: agent.description || '',
        platform: agent.platform as AgentPlatform,
        status: agent.status as AgentStatus,
        version: agent.version,
        configHash: agent.config_hash,
        dataSourceId: agent.data_source_id?.toString(),
        dataModelId: agent.data_model_id?.toString(),
        throughput: agent.throughput || 0,
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        createdAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config,
        authToken: agent.auth_token,
        ingestionEndpoint: agent.ingestion_endpoint,
        organizationId: agent.organization_id.toString(),
        hostname: agent.hostname,
        ipAddress: agent.ip_address,
      };
    } catch (error) {
      console.error('Error fetching agent:', error);
      return null;
    }
  },

  async create(agent: Omit<Agent, 'id' | 'createdAt' | 'lastHeartbeat'>): Promise<Agent> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const now = new Date();

      const doc = {
        name: agent.name,
        description: agent.description,
        platform: agent.platform,
        status: agent.status,
        version: agent.version,
        config_hash: agent.configHash,
        data_source_id: agent.dataSourceId ? new ObjectId(agent.dataSourceId) : undefined,
        data_model_id: agent.dataModelId ? new ObjectId(agent.dataModelId) : undefined,
        throughput: agent.throughput || 0,
        config: agent.config,
        auth_token: agent.authToken,
        ingestion_endpoint: agent.ingestionEndpoint,
        organization_id: new ObjectId(agent.organizationId),
        hostname: agent.hostname,
        ip_address: agent.ipAddress,
        last_heartbeat: now,
        registered_at: now,
        created_at: now,
      };

      const result = await collection.insertOne(doc);

      return {
        ...agent,
        id: result.insertedId.toString(),
        createdAt: now.toISOString(),
        lastHeartbeat: now.toISOString(),
      };
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Agent>): Promise<Agent | null> {
    try {
      const collection = await getCollection(Collections.AGENTS);

      const updateDoc: any = {};
      if (updates.name) updateDoc.name = updates.name;
      if (updates.description !== undefined) updateDoc.description = updates.description;
      if (updates.platform) updateDoc.platform = updates.platform;
      if (updates.status) updateDoc.status = updates.status;
      if (updates.version) updateDoc.version = updates.version;
      if (updates.configHash) updateDoc.config_hash = updates.configHash;
      if (updates.dataSourceId) updateDoc.data_source_id = new ObjectId(updates.dataSourceId);
      if (updates.dataModelId) updateDoc.data_model_id = new ObjectId(updates.dataModelId);
      if (updates.throughput !== undefined) updateDoc.throughput = updates.throughput;
      if (updates.config) updateDoc.config = updates.config;
      if (updates.authToken) updateDoc.auth_token = updates.authToken;
      if (updates.ingestionEndpoint) updateDoc.ingestion_endpoint = updates.ingestionEndpoint;
      if (updates.hostname) updateDoc.hostname = updates.hostname;
      if (updates.ipAddress) updateDoc.ip_address = updates.ipAddress;

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

      return await this.getById(id);
    } catch (error) {
      console.error('Error updating agent:', error);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting agent:', error);
      return false;
    }
  },

  async getLogs(agentId: string, limit: number = 100): Promise<AgentLog[]> {
    // TODO: Implement logs collection
    return [];
  },

  async getEvents(agentId: string, limit: number = 100): Promise<AgentEvent[]> {
    try {
      const collection = await getCollection(Collections.EVENTS);
      const events = await collection
        .find({ agent_id: new ObjectId(agentId) })
        .sort({ ingested_at: -1 })
        .limit(limit)
        .toArray();

      return events.map((event) => ({
        id: event._id.toString(),
        agentId: agentId,
        timestamp:
          event.ingested_at?.toISOString() ||
          event.created_at?.toISOString() ||
          new Date().toISOString(),
        eventType: event.type,
        data: event.payload,
      }));
    } catch (error) {
      console.error('Error fetching agent events:', error);
      return [];
    }
  },
};

export { agentsService };
export default agentsService;
