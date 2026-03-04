import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export type AgentCategory = 'system' | 'security' | 'application' | 'network';
export type AgentTypeStatus = 'active' | 'deprecated' | 'beta';

export interface AgentType {
  id: string;
  name: string; // linux-resource-monitor, syslog, etc.
  displayName: string;
  description: string;
  version: string;
  icon: string;
  category: AgentCategory;
  binaryURL: string;
  installScript: string;
  defaultConfig: Record<string, any>;
  configVersion: number; // Configuration version for tracking updates
  configUpdatedAt?: string; // When config was last updated
  configUpdatedBy?: string; // Who updated the config
  dataSourceId: string;
  status: AgentTypeStatus;
  instanceCount: number; // Calculated
  onlineCount: number; // Calculated
  offlineCount: number; // Calculated
  errorCount: number; // Calculated
  suspendedCount: number; // Calculated
  createdAt: string;
  updatedAt: string;
}

const agentTypesService = {
  async getAll(organizationId?: string): Promise<AgentType[]> {
    try {
      const collection = await getCollection(Collections.AGENT_TYPES);
      // If no organizationId provided, get all agent types (for now)
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const agentTypes = await collection.find(filter).toArray();

      // Get instance counts for each agent type
      const agentsCollection = await getCollection(Collections.AGENTS);

      const typesWithCounts = await Promise.all(
        agentTypes.map(async (type) => {
          const instances = await agentsCollection
            .find({
              agent_type_id: type._id,
            })
            .toArray();

          const onlineCount = instances.filter((i) => i.status === 'online').length;
          const offlineCount = instances.filter((i) => i.status === 'offline').length;
          const errorCount = instances.filter((i) => i.status === 'error').length;
          const suspendedCount = instances.filter((i) => i.status === 'suspended').length;

          return {
            id: type._id.toString(),
            name: type.name,
            displayName: type.display_name,
            description: type.description,
            version: type.version,
            icon: type.icon,
            category: type.category as AgentCategory,
            binaryURL: type.binary_url,
            installScript: type.install_script,
            defaultConfig: type.default_config || {},
            configVersion: type.config_version || 1,
            configUpdatedAt: type.config_updated_at?.toISOString(),
            configUpdatedBy: type.config_updated_by,
            dataSourceId: type.data_source_id?.toString(),
            status: type.status as AgentTypeStatus,
            instanceCount: instances.length,
            onlineCount,
            offlineCount,
            errorCount,
            suspendedCount,
            createdAt: type.created_at?.toISOString() || new Date().toISOString(),
            updatedAt: type.updated_at?.toISOString() || new Date().toISOString(),
          };
        })
      );

      return typesWithCounts;
    } catch (error) {
      console.error('Failed to get agent types:', error);
      return [];
    }
  },

  async getById(id: string): Promise<AgentType | null> {
    try {
      const collection = await getCollection(Collections.AGENT_TYPES);
      const agentType = await collection.findOne({ _id: new ObjectId(id) });

      if (!agentType) {
        return null;
      }

      // Get instance counts
      const agentsCollection = await getCollection(Collections.AGENTS);
      const instances = await agentsCollection
        .find({
          agent_type_id: new ObjectId(id),
        })
        .toArray();

      const onlineCount = instances.filter((i) => i.status === 'online').length;
      const offlineCount = instances.filter((i) => i.status === 'offline').length;
      const errorCount = instances.filter((i) => i.status === 'error').length;
      const suspendedCount = instances.filter((i) => i.status === 'suspended').length;

      return {
        id: agentType._id.toString(),
        name: agentType.name,
        displayName: agentType.display_name,
        description: agentType.description,
        version: agentType.version,
        icon: agentType.icon,
        category: agentType.category as AgentCategory,
        binaryURL: agentType.binary_url,
        installScript: agentType.install_script,
        defaultConfig: agentType.default_config || {},
        configVersion: agentType.config_version || 1,
        configUpdatedAt: agentType.config_updated_at?.toISOString(),
        configUpdatedBy: agentType.config_updated_by,
        dataSourceId: agentType.data_source_id?.toString(),
        status: agentType.status as AgentTypeStatus,
        instanceCount: instances.length,
        onlineCount,
        offlineCount,
        errorCount,
        suspendedCount,
        createdAt: agentType.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: agentType.updated_at?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get agent type by ID:', error);
      return null;
    }
  },

  async getInstances(agentTypeId: string): Promise<any[]> {
    try {
      const agentsCollection = await getCollection(Collections.AGENTS);
      const instances = await agentsCollection
        .find({
          agent_type_id: new ObjectId(agentTypeId),
        })
        .toArray();

      return instances.map((instance) => ({
        id: instance._id.toString(),
        agentTypeId: instance.agent_type_id?.toString(),
        dataSourceId: instance.data_source_id?.toString(),
        instanceName: instance.instance_name || instance.hostname,
        hostname: instance.hostname,
        ipAddress: instance.ip_address,
        platform: instance.platform,
        version: instance.version,
        status: instance.status,
        lastHeartbeat: instance.last_heartbeat?.toISOString() || new Date().toISOString(),
        lastSeenAt: instance.last_seen_at?.toISOString() || new Date().toISOString(),
        registeredAt: instance.registered_at?.toISOString() || new Date().toISOString(),
        config: instance.config || {},
        metrics: instance.metrics || {},
      }));
    } catch (error) {
      console.error('Failed to get agent instances:', error);
      return [];
    }
  },

  async create(
    agentType: Omit<
      AgentType,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'instanceCount'
      | 'onlineCount'
      | 'offlineCount'
      | 'errorCount'
      | 'suspendedCount'
    >
  ): Promise<AgentType> {
    try {
      const collection = await getCollection(Collections.AGENT_TYPES);

      const now = new Date();
      const doc = {
        name: agentType.name,
        display_name: agentType.displayName,
        description: agentType.description,
        version: agentType.version,
        icon: agentType.icon,
        category: agentType.category,
        binary_url: agentType.binaryURL,
        install_script: agentType.installScript,
        default_config: agentType.defaultConfig,
        config_version: 1,
        config_updated_at: now,
        config_updated_by: agentType.configUpdatedBy,
        data_source_id: agentType.dataSourceId ? new ObjectId(agentType.dataSourceId) : null,
        status: agentType.status,
        created_at: now,
        updated_at: now,
      };

      const result = await collection.insertOne(doc);

      return {
        ...agentType,
        id: result.insertedId.toString(),
        configVersion: 1,
        configUpdatedAt: now.toISOString(),
        instanceCount: 0,
        onlineCount: 0,
        offlineCount: 0,
        errorCount: 0,
        suspendedCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } catch (error) {
      console.error('Failed to create agent type:', error);
      throw error;
    }
  },

  async updateConfig(
    id: string,
    defaultConfig: Record<string, any>,
    userId?: string
  ): Promise<AgentType | null> {
    try {
      const collection = await getCollection(Collections.AGENT_TYPES);

      // Get current version
      const current = await collection.findOne({ _id: new ObjectId(id) });
      if (!current) {
        return null;
      }

      const now = new Date();
      const newVersion = (current.config_version || 1) + 1;

      await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            default_config: defaultConfig,
            config_version: newVersion,
            config_updated_at: now,
            config_updated_by: userId,
            updated_at: now,
          },
        }
      );

      return this.getById(id);
    } catch (error) {
      console.error('Failed to update agent type config:', error);
      throw error;
    }
  },

  async getConfig(id: string): Promise<{ config: Record<string, any>; version: number } | null> {
    try {
      const collection = await getCollection(Collections.AGENT_TYPES);
      const agentType = await collection.findOne({ _id: new ObjectId(id) });

      if (!agentType) {
        return null;
      }

      return {
        config: agentType.default_config || {},
        version: agentType.config_version || 1,
      };
    } catch (error) {
      console.error('Failed to get agent type config:', error);
      return null;
    }
  },
};

export { agentTypesService };
export default agentTypesService;
