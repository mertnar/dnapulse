import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';

const Collections = {
  AGENTS: 'agents',
  EVENTS: 'events',
};

export interface AgentInstance {
  id: string;
  agentTypeId: string; // NEW: Link to AgentType
  agentTypeName?: string; // NEW: Denormalized
  dataSourceId: string;
  instanceName: string; // NEW: server-prod-01
  hostname: string;
  ipAddress: string;
  platform: 'linux' | 'windows' | 'macos' | 'docker';
  version: string;
  status: 'online' | 'offline' | 'error' | 'suspended';
  lastHeartbeat: string;
  lastSeenAt: string;
  registeredAt: string;
  config: Record<string, any>;
  currentConfigVersion?: number; // Current config version on agent
  configLastSyncedAt?: string; // When agent last synced config
  metrics: Record<string, any>; // NEW: Latest metrics snapshot
  organizationId?: string;
}

const agentInstancesService = {
  async getAllInstances(organizationId?: string): Promise<AgentInstance[]> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const filter: any = {};

      if (organizationId) {
        filter.organization_id = new ObjectId(organizationId);
      }

      const agents = await collection.find(filter).toArray();

      return agents.map((agent) => ({
        id: agent._id.toString(),
        agentTypeId: agent.agent_type_id?.toString() || agent._id.toString(),
        dataSourceId: agent.data_source_id?.toString() || '',
        instanceName: agent.instance_name || agent.hostname || agent.name,
        hostname: agent.hostname || '',
        ipAddress: agent.ip_address || '',
        platform: (agent.platform || 'linux') as 'linux' | 'windows' | 'macos' | 'docker',
        version: agent.version || '1.0.0',
        status: (agent.status || 'offline') as 'online' | 'offline' | 'error' | 'suspended',
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        lastSeenAt:
          agent.last_seen_at?.toISOString() ||
          agent.last_heartbeat?.toISOString() ||
          new Date().toISOString(),
        registeredAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config || {},
        currentConfigVersion: agent.current_config_version,
        configLastSyncedAt: agent.config_last_synced_at?.toISOString(),
        metrics: agent.metrics || {},
        organizationId: agent.organization_id?.toString() || '',
      }));
    } catch (error) {
      console.error('Error fetching agent instances:', error);
      return [];
    }
  },

  async getByAgentType(agentTypeId: string): Promise<AgentInstance[]> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const agents = await collection.find({ agent_type_id: new ObjectId(agentTypeId) }).toArray();

      return agents.map((agent) => ({
        id: agent._id.toString(),
        agentTypeId: agent.agent_type_id?.toString() || agentTypeId,
        dataSourceId: agent.data_source_id?.toString() || '',
        instanceName: agent.instance_name || agent.hostname || agent.name,
        hostname: agent.hostname || '',
        ipAddress: agent.ip_address || '',
        platform: (agent.platform || 'linux') as 'linux' | 'windows' | 'macos' | 'docker',
        version: agent.version || '1.0.0',
        status: (agent.status || 'offline') as 'online' | 'offline' | 'error' | 'suspended',
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        lastSeenAt:
          agent.last_seen_at?.toISOString() ||
          agent.last_heartbeat?.toISOString() ||
          new Date().toISOString(),
        registeredAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config || {},
        currentConfigVersion: agent.current_config_version,
        configLastSyncedAt: agent.config_last_synced_at?.toISOString(),
        metrics: agent.metrics || {},
        organizationId: agent.organization_id?.toString() || '',
      }));
    } catch (error) {
      console.error('Error fetching instances by agent type:', error);
      return [];
    }
  },

  async getByDataSource(dataSourceId: string): Promise<AgentInstance[]> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const agents = await collection
        .find({ data_source_id: new ObjectId(dataSourceId) })
        .toArray();

      return agents.map((agent) => ({
        id: agent._id.toString(),
        agentTypeId: agent.agent_type_id?.toString() || agent._id.toString(),
        dataSourceId: agent.data_source_id?.toString() || '',
        instanceName: agent.instance_name || agent.hostname || agent.name,
        hostname: agent.hostname || '',
        ipAddress: agent.ip_address || '',
        platform: (agent.platform || 'linux') as 'linux' | 'windows' | 'macos' | 'docker',
        version: agent.version || '1.0.0',
        status: (agent.status || 'offline') as 'online' | 'offline' | 'error' | 'suspended',
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        lastSeenAt:
          agent.last_seen_at?.toISOString() ||
          agent.last_heartbeat?.toISOString() ||
          new Date().toISOString(),
        registeredAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config || {},
        currentConfigVersion: agent.current_config_version,
        configLastSyncedAt: agent.config_last_synced_at?.toISOString(),
        metrics: agent.metrics || {},
        organizationId: agent.organization_id?.toString() || '',
      }));
    } catch (error) {
      console.error('Error fetching instances by data source:', error);
      return [];
    }
  },

  async updateStatus(instanceId: string, status: string): Promise<void> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      await collection.updateOne(
        { _id: new ObjectId(instanceId) },
        {
          $set: {
            status,
            last_seen_at: new Date(),
          },
        }
      );
    } catch (error) {
      console.error('Error updating instance status:', error);
      throw error;
    }
  },

  async getInstancesByAgent(agentId: string): Promise<AgentInstance[]> {
    try {
      const collection = await getCollection(Collections.AGENTS);

      // For now, return the agent itself
      // In a full implementation, you'd have separate agent definitions and instances
      const agent = await collection.findOne({ _id: new ObjectId(agentId) });

      if (!agent) {
        return [];
      }

      return [
        {
          id: agent._id.toString(),
          agentTypeId: agent.agent_type_id?.toString() || agentId,
          dataSourceId: agent.data_source_id?.toString() || '',
          instanceName: agent.instance_name || agent.hostname || agent.name,
          hostname: agent.hostname || '',
          ipAddress: agent.ip_address || '',
          platform: (agent.platform || 'linux') as 'linux' | 'windows' | 'macos' | 'docker',
          version: agent.version || '1.0.0',
          status: (agent.status || 'offline') as 'online' | 'offline' | 'error' | 'suspended',
          lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
          lastSeenAt:
            agent.last_seen_at?.toISOString() ||
            agent.last_heartbeat?.toISOString() ||
            new Date().toISOString(),
          registeredAt:
            agent.registered_at?.toISOString() ||
            agent.created_at?.toISOString() ||
            new Date().toISOString(),
          config: agent.config || {},
          currentConfigVersion: agent.current_config_version,
          configLastSyncedAt: agent.config_last_synced_at?.toISOString(),
          metrics: agent.metrics || {},
          organizationId: agent.organization_id?.toString() || '',
        },
      ];
    } catch (error) {
      console.error('Error fetching instances by agent:', error);
      return [];
    }
  },

  async getInstance(instanceId: string): Promise<AgentInstance | null> {
    try {
      const collection = await getCollection(Collections.AGENTS);
      const agent = await collection.findOne({ _id: new ObjectId(instanceId) });

      if (!agent) {
        return null;
      }

      return {
        id: agent._id.toString(),
        agentTypeId: agent.agent_type_id?.toString() || agent._id.toString(),
        dataSourceId: agent.data_source_id?.toString() || '',
        instanceName: agent.instance_name || agent.hostname || agent.name,
        hostname: agent.hostname || '',
        ipAddress: agent.ip_address || '',
        platform: (agent.platform || 'linux') as 'linux' | 'windows' | 'macos' | 'docker',
        version: agent.version || '1.0.0',
        status: (agent.status || 'offline') as 'online' | 'offline' | 'error' | 'suspended',
        lastHeartbeat: agent.last_heartbeat?.toISOString() || new Date().toISOString(),
        lastSeenAt:
          agent.last_seen_at?.toISOString() ||
          agent.last_heartbeat?.toISOString() ||
          new Date().toISOString(),
        registeredAt:
          agent.registered_at?.toISOString() ||
          agent.created_at?.toISOString() ||
          new Date().toISOString(),
        config: agent.config || {},
        currentConfigVersion: agent.current_config_version,
        configLastSyncedAt: agent.config_last_synced_at?.toISOString(),
        metrics: agent.metrics || {},
        organizationId: agent.organization_id?.toString() || '',
      };
    } catch (error) {
      console.error('Error fetching instance:', error);
      return null;
    }
  },

  async updateConfig(
    instanceId: string,
    config: Record<string, any>
  ): Promise<AgentInstance | null> {
    try {
      const collection = await getCollection(Collections.AGENTS);

      await collection.updateOne(
        { _id: new ObjectId(instanceId) },
        { $set: { config, updated_at: new Date() } }
      );

      return await this.getInstance(instanceId);
    } catch (error) {
      console.error('Error updating config:', error);
      return null;
    }
  },

  async updateConfigVersion(instanceId: string, configVersion: number): Promise<void> {
    try {
      const collection = await getCollection(Collections.AGENTS);

      await collection.updateOne(
        { _id: new ObjectId(instanceId) },
        {
          $set: {
            current_config_version: configVersion,
            config_last_synced_at: new Date(),
            updated_at: new Date(),
          },
        }
      );
    } catch (error) {
      console.error('Error updating config version:', error);
      throw error;
    }
  },

  async sendCommand(instanceId: string, command: string): Promise<any> {
    try {
      // TODO: Implement command queue or websocket to send commands to agents
      // For now, just return a simulated response
      return {
        instanceId,
        command,
        status: 'queued',
        message: `Command '${command}' queued for agent ${instanceId}`,
      };
    } catch (error) {
      console.error('Error sending command:', error);
      throw error;
    }
  },

  async getLogs(instanceId: string, limit: number = 100): Promise<any[]> {
    try {
      // TODO: Implement proper log fetching from log storage
      // For now, return events as logs
      const collection = await getCollection(Collections.EVENTS);
      const events = await collection
        .find({ agent_id: new ObjectId(instanceId) })
        .sort({ ingested_at: -1 })
        .limit(limit)
        .toArray();

      return events.map((event) => ({
        timestamp: event.ingested_at?.toISOString() || new Date().toISOString(),
        level: 'info',
        message: JSON.stringify(event.payload),
      }));
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  },

  async getMetrics(instanceId: string): Promise<any> {
    try {
      // TODO: Implement metrics fetching from monitoring system
      return {
        instanceId,
        cpu: 25.5,
        memory: 45.2,
        disk: 60.0,
        network_in: 1024,
        network_out: 2048,
        uptime: 86400,
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return null;
    }
  },
};

export { agentInstancesService };
export default agentInstancesService;
