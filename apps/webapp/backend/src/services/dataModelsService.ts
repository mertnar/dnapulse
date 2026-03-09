import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export interface DataModel {
  id?: string;
  organization_id: string;
  name: string;
  data_index: string;
  type: 'root' | 'derived' | 'composite' | 'vector';
  version: number;
  status: 'draft' | 'active' | 'archived';
  source: {
    data_source_ids: string[];
    agent_type?: string;
    source_type?: string;
  };
  schema: {
    fields: SchemaField[];
  };
  attributes?: SchemaField[];
  tags?: string[];
  description?: string;
  source_count?: number;
  record_count?: number;
  last_updated?: Date;
  processing?: {
    pipeline: PipelineStep[];
  };
  composite?: {
    join_type: 'inner' | 'left' | 'full';
    time_window_sec: number;
    join_keys: JoinKey[];
  };
  elk: {
    index_name: string;
    template_name?: string;
    mapping_hash?: string;
    last_write_at?: Date;
  };
  created_at?: Date;
  updated_at?: Date;
  created_by: string;
}

export interface SchemaField {
  id?: string;
  name?: string;
  path: string;
  type: 'string' | 'number' | 'date' | 'ip' | 'bool' | 'object' | 'array' | 'vector';
  required?: boolean;
  indexed?: boolean;
  description?: string;
  example?: any;
  status?: 'normal' | 'deprecated';
  order?: number;
}

export interface PipelineStep {
  id: string;
  operation: string;
  when?: string;
  inputs: Array<{ field: string }>;
  params?: Record<string, any>;
  outputs: Array<{ field: string; type: string }>;
}

export interface JoinKey {
  left_model_id: string;
  left_field: string;
  right_model_id: string;
  right_field: string;
}

export interface ModelVersion {
  id?: string;
  model_id: string;
  version: number;
  schema_snapshot: any;
  changes: string[];
  schema_diff: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      old_type: string;
      new_type: string;
    }>;
  };
  created_at?: Date;
  created_by: string;
}

export const dataModelsService = {
  async getAll(
    organizationId: string,
    filters?: {
      type?: string;
      status?: string;
    }
  ): Promise<DataModel[]> {
    const collection = await getCollection(Collections.DATA_MODELS);
    const query: any = { organization_id: new ObjectId(organizationId) };

    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;

    const models = await collection.find(query).sort({ created_at: -1 }).toArray();

    // For list view, we don't need to fetch all fields from ES (performance)
    // Just return basic info with empty attributes
    return models.map((m) => ({
      id: m._id.toString(),
      organization_id: m.organization_id.toString(),
      name: m.name,
      data_index: m.data_index,
      type: m.type,
      version: m.version,
      status: m.status,
      source: {
        data_source_ids: m.source.data_source_ids.map((id: ObjectId) => id.toString()),
        agent_type: m.source.agent_type,
        source_type: m.source.source_type,
      },
      schema: m.schema,
      attributes: m.schema?.fields || [],
      tags: m.tags || [],
      description: m.description || '',
      source_count: m.source?.data_source_ids?.length || 0,
      record_count: m.record_count || 0,
      last_updated: m.updated_at,
      processing: m.processing,
      composite: m.composite,
      elk: m.elk,
      created_at: m.created_at,
      updated_at: m.updated_at,
      created_by: m.created_by,
    }));
  },

  async getById(id: string, organizationId: string): Promise<DataModel | null> {
    const collection = await getCollection(Collections.DATA_MODELS);
    const model = await collection.findOne({
      _id: new ObjectId(id),
      organization_id: new ObjectId(organizationId),
    });

    if (!model) return null;

    // First, try to get attributes from data_model_attributes collection
    let attributes: SchemaField[] = [];
    try {
      const attributesCollection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);
      const dbAttributes = await attributesCollection
        .find({ data_model_id: new ObjectId(id) })
        .sort({ order: 1 })
        .toArray();

      if (dbAttributes.length > 0) {
        attributes = dbAttributes.map((attr: any) => ({
          id: attr._id.toString(),
          name: attr.path,
          path: attr.path,
          type: attr.type,
          required: attr.required || false,
          indexed: attr.indexed || false,
          description: attr.description || '',
          example: attr.example,
          status: attr.status || 'normal',
          order: attr.order || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching attributes from data_model_attributes:', error);
    }

    // If no attributes found in data_model_attributes, try schema.fields
    if (attributes.length === 0) {
      attributes = model.schema?.fields || [];
    }

    // If still no attributes and ELK index exists, fetch fields from Elasticsearch
    if (attributes.length === 0 && model.elk?.index_name) {
      try {
        const { esClient } = await import('../lib/elasticsearch.js');
        const response = await esClient.indices.getMapping({ index: model.elk.index_name } as any);
        const mappings = (response as any)[model.elk.index_name]?.mappings?.properties || {};

        // Convert ES mappings to attributes
        const extractFields = (properties: any, prefix: string = ''): SchemaField[] => {
          const fields: SchemaField[] = [];

          for (const [fieldName, fieldDef] of Object.entries(properties)) {
            const fullPath = prefix ? `${prefix}.${fieldName}` : fieldName;
            const def = fieldDef as any;

            if (def.type && def.type !== 'object') {
              fields.push({
                id: fullPath.replace(/\./g, '_'),
                name: fullPath,
                path: fullPath,
                type: mapESTypeToSchemaType(def.type),
                required: false,
                description: '',
                order: fields.length,
              });
            }

            if (def.properties) {
              fields.push(...extractFields(def.properties, fullPath));
            }
          }

          return fields;
        };

        attributes = extractFields(mappings);
      } catch (error) {
        console.error('Error fetching fields from Elasticsearch:', error);
      }
    }

    return {
      id: model._id.toString(),
      organization_id: model.organization_id.toString(),
      name: model.name,
      data_index: model.data_index,
      type: model.type,
      version: model.version,
      status: model.status,
      source: {
        data_source_ids: model.source.data_source_ids.map((id: ObjectId) => id.toString()),
        agent_type: model.source.agent_type,
        source_type: model.source.source_type,
      },
      schema: model.schema,
      attributes: attributes,
      tags: model.tags || [],
      description: model.description || '',
      source_count: model.source?.data_source_ids?.length || 0,
      record_count: model.record_count || 0,
      last_updated: model.updated_at,
      processing: model.processing,
      composite: model.composite,
      elk: model.elk,
      created_at: model.created_at,
      updated_at: model.updated_at,
      created_by: model.created_by,
    };
  },

  async create(model: Omit<DataModel, 'id' | 'created_at' | 'updated_at'>): Promise<DataModel> {
    const collection = await getCollection(Collections.DATA_MODELS);
    const now = new Date();

    // Generate ELK index name
    const elkIndexName = `org_${model.organization_id}__${model.data_index}__v${model.version}`;

    const doc = {
      organization_id: new ObjectId(model.organization_id),
      name: model.name,
      data_index: model.data_index,
      type: model.type,
      version: model.version,
      status: model.status,
      source: {
        data_source_ids: model.source.data_source_ids.map((id) => new ObjectId(id)),
        agent_type: model.source.agent_type,
        source_type: model.source.source_type,
      },
      schema: model.schema,
      processing: model.processing,
      composite: model.composite,
      elk: {
        index_name: elkIndexName,
        template_name: model.elk.template_name,
        mapping_hash: model.elk.mapping_hash,
      },
      created_at: now,
      updated_at: now,
      created_by: model.created_by,
    };

    const result = await collection.insertOne(doc);

    const createdModel = {
      ...model,
      id: result.insertedId.toString(),
      elk: {
        ...model.elk,
        index_name: elkIndexName,
      },
      created_at: now,
      updated_at: now,
    };

    // Create Elasticsearch index with mapping
    try {
      await this.updateElasticsearchMapping(createdModel);
      console.log(`Elasticsearch index created: ${elkIndexName}`);
    } catch (error) {
      console.error('Failed to create Elasticsearch index:', error);
      // Don't fail model creation if ES index creation fails
    }

    // Create and deploy default pipeline for the model
    try {
      const pipeline = await this.createPipeline(createdModel.id!, model.organization_id, {
        pipeline: {
          steps: [
            {
              id: 'persist_es',
              operation: 'persist_es',
              inputs: [],
              outputs: [],
              params: {
                index: elkIndexName,
              },
            },
          ],
        },
        created_by: model.created_by,
      });

      // Auto-deploy the pipeline
      if (pipeline && pipeline.id) {
        await this.deployPipeline(createdModel.id!, pipeline.id, model.organization_id);
      }
    } catch (error) {
      console.error('Failed to create/deploy default pipeline for model:', error);
    }

    return createdModel;
  },

  async update(
    id: string,
    organizationId: string,
    updates: Partial<DataModel>
  ): Promise<DataModel | null> {
    const collection = await getCollection(Collections.DATA_MODELS);

    const updateDoc: any = { updated_at: new Date() };
    if (updates.name) updateDoc.name = updates.name;
    if (updates.status) updateDoc.status = updates.status;
    if (updates.schema) updateDoc.schema = updates.schema;
    if (updates.processing) updateDoc.processing = updates.processing;
    if (updates.composite) updateDoc.composite = updates.composite;

    await collection.updateOne(
      { _id: new ObjectId(id), organization_id: new ObjectId(organizationId) },
      { $set: updateDoc }
    );

    return this.getById(id, organizationId);
  },

  async delete(id: string, organizationId: string): Promise<boolean> {
    const collection = await getCollection(Collections.DATA_MODELS);
    const result = await collection.deleteOne({
      _id: new ObjectId(id),
      organization_id: new ObjectId(organizationId),
    });
    return result.deletedCount > 0;
  },

  async createVersion(modelId: string, organizationId: string): Promise<DataModel> {
    const model = await this.getById(modelId, organizationId);
    if (!model) throw new Error('Model not found');

    const newVersion = model.version + 1;
    const newModel = {
      ...model,
      version: newVersion,
      status: 'draft' as const,
    };
    delete newModel.id;
    delete newModel.created_at;
    delete newModel.updated_at;

    return this.create(newModel);
  },

  async getLineage(
    modelId: string,
    organizationId: string
  ): Promise<{
    sources: any[];
    consumers: any[];
  }> {
    const collection = await getCollection(Collections.DATA_MODELS);
    const model = await this.getById(modelId, organizationId);

    if (!model) return { sources: [], consumers: [] };

    // Find source data sources
    const dataSourcesCol = await getCollection(Collections.DATA_SOURCES);
    const sources = await dataSourcesCol
      .find({
        _id: { $in: model.source.data_source_ids.map((id) => new ObjectId(id)) },
      })
      .toArray();

    // Find consumer models (models that use this model as source)
    const consumers = await collection
      .find({
        organization_id: new ObjectId(organizationId),
        'source.data_source_ids': { $in: [new ObjectId(modelId)] },
      })
      .toArray();

    return {
      sources: sources.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        type: 'data-source',
        status: s.status,
      })),
      consumers: consumers.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        type: 'model',
        status: c.status,
      })),
    };
  },

  async getVersions(modelId: string, organizationId: string): Promise<ModelVersion[]> {
    const model = await this.getById(modelId, organizationId);
    if (!model) return [];

    const collection = await getCollection('model_versions' as any);
    const versions = await collection
      .find({
        model_id: new ObjectId(modelId),
      })
      .sort({ version: -1 })
      .toArray();

    return versions.map((v) => ({
      id: v._id.toString(),
      model_id: v.model_id.toString(),
      version: v.version,
      schema_snapshot: v.schema_snapshot,
      changes: v.changes,
      schema_diff: v.schema_diff,
      created_at: v.created_at,
      created_by: v.created_by,
    }));
  },

  // Legacy methods for compatibility with existing UI
  async getDataModels(): Promise<any[]> {
    // Get all models from all organizations for now (including draft models)
    // In production, this should come from auth context
    const collection = await getCollection(Collections.DATA_MODELS);
    const models = await collection.find({}).sort({ created_at: -1 }).toArray();

    return models.map((m) => ({
      id: m._id.toString(),
      organization_id: m.organization_id.toString(),
      name: m.name,
      data_index: m.data_index,
      type: m.type,
      version: m.version,
      status: m.status,
      source: {
        data_source_ids: m.source.data_source_ids.map((id: ObjectId) => id.toString()),
        agent_type: m.source.agent_type,
        source_type: m.source.source_type,
      },
      schema: m.schema,
      attributes: m.schema?.fields || [],
      tags: m.tags || [],
      description: m.description || '',
      source_count: m.source?.data_source_ids?.length || 0,
      record_count: m.record_count || 0,
      last_updated: m.updated_at,
      elk: m.elk,
      created_at: m.created_at,
      updated_at: m.updated_at,
      created_by: m.created_by,
    }));
  },

  async getDataModelById(id: string): Promise<any> {
    // Find model and use its organization_id
    const collection = await getCollection(Collections.DATA_MODELS);
    const model = await collection.findOne({ _id: new ObjectId(id) });
    if (!model) return null;

    return this.getById(id, model.organization_id.toString());
  },

  async getModelAttributes(id: string): Promise<any[]> {
    const model = await this.getDataModelById(id);
    return model?.attributes || [];
  },

  async getModelVersions(id: string): Promise<any[]> {
    const model = await this.getDataModelById(id);
    if (!model) return [];
    return this.getVersions(id, model.organization_id);
  },

  async getModelLineage(id: string): Promise<any> {
    const model = await this.getDataModelById(id);
    if (!model) return { sources: [], consumers: [] };
    return this.getLineage(id, model.organization_id);
  },

  async getModelNotes(id: string): Promise<any[]> {
    return [];
  },

  async getModelUsage(id: string): Promise<any> {
    return {
      rules: [],
      alerts_triggered: 0,
      investigations: [],
      ml_pipelines: [],
    };
  },

  async getModelContributors(id: string): Promise<any[]> {
    return [];
  },

  async getModelSampleData(id: string): Promise<any[]> {
    return [];
  },

  async getModelComposition(id: string): Promise<any> {
    const model = await this.getById(id, '6976ee903bd20e1f00bc5dd6');
    return model?.composite || null;
  },

  // Data Model Attributes
  async getAttributes(modelId: string, organizationId: string): Promise<any[]> {
    console.log(
      `[DataModelsService] getAttributes called: modelId=${modelId}, orgId=${organizationId}`
    );
    const collection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);
    console.log(`[DataModelsService] Collection: ${collection.collectionName}`);

    const query = { data_model_id: new ObjectId(modelId) };
    console.log(`[DataModelsService] Query:`, query);
    console.log(`[DataModelsService] Query data_model_id type:`, typeof query.data_model_id);

    // Try direct count first
    const count = await collection.countDocuments(query);
    console.log(`[DataModelsService] Count with ObjectId query: ${count}`);

    // Try without filter
    const totalCount = await collection.countDocuments({});
    console.log(`[DataModelsService] Total attributes in collection: ${totalCount}`);

    const attributes = await collection.find(query).sort({ order: 1 }).toArray();
    console.log(`[DataModelsService] Found ${attributes.length} attributes`);

    return attributes.map((attr: any) => ({
      id: attr._id.toString(),
      data_model_id: attr.data_model_id.toString(),
      path: attr.path,
      type: attr.type,
      source: attr.source,
      required: attr.required,
      indexed: attr.indexed,
      description: attr.description,
      example: attr.example,
      status: attr.status,
      order: attr.order,
      derivation: attr.derivation,
      created_at: attr.created_at,
      updated_at: attr.updated_at,
      created_by: attr.created_by,
    }));
  },

  async createAttribute(modelId: string, organizationId: string, attribute: any): Promise<any> {
    // Verify model exists and belongs to organization
    const model = await this.getById(modelId, organizationId);
    if (!model) throw new Error('Model not found');

    const collection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);
    const now = new Date();

    const doc = {
      data_model_id: new ObjectId(modelId),
      path: attribute.path,
      type: attribute.type,
      source: attribute.source || 'user-added',
      required: attribute.required || false,
      indexed: attribute.indexed || false,
      description: attribute.description || '',
      example: attribute.example,
      status: attribute.status || 'normal',
      order: attribute.order || 999,
      derivation: attribute.derivation,
      created_at: now,
      updated_at: now,
      created_by: attribute.created_by || 'system',
    };

    const result = await collection.insertOne(doc);

    // Update Elasticsearch mapping to include new attribute
    try {
      // Reload model with new attribute
      const updatedModel = await this.getById(modelId, organizationId);
      if (updatedModel) {
        await this.updateElasticsearchMapping(updatedModel);
        console.log(`Elasticsearch mapping updated with new attribute: ${attribute.path}`);

        // Trigger processing service to reload models
        const processingServiceUrl = process.env.PROCESSING_SERVICE_URL || 'http://processing:8080';
        try {
          const response = await fetch(`${processingServiceUrl}/reload-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            console.log('Processing service models reloaded after attribute addition');
          }
        } catch (reloadError) {
          console.warn('Failed to trigger processing service reload:', reloadError);
        }
      }
    } catch (error) {
      console.error('Failed to update Elasticsearch mapping after adding attribute:', error);
      // Don't fail attribute creation if mapping update fails
    }

    return {
      id: result.insertedId.toString(),
      ...doc,
      data_model_id: modelId,
    };
  },

  async updateAttribute(attrId: string, organizationId: string, updates: any): Promise<any> {
    const collection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);

    const updateDoc: any = { updated_at: new Date() };
    if (updates.path !== undefined) updateDoc.path = updates.path;
    if (updates.type !== undefined) updateDoc.type = updates.type;
    if (updates.required !== undefined) updateDoc.required = updates.required;
    if (updates.indexed !== undefined) updateDoc.indexed = updates.indexed;
    if (updates.description !== undefined) updateDoc.description = updates.description;
    if (updates.example !== undefined) updateDoc.example = updates.example;
    if (updates.status !== undefined) updateDoc.status = updates.status;
    if (updates.order !== undefined) updateDoc.order = updates.order;
    if (updates.derivation !== undefined) updateDoc.derivation = updates.derivation;
    if (updates.updated_by !== undefined) updateDoc.updated_by = updates.updated_by;

    await collection.updateOne({ _id: new ObjectId(attrId) }, { $set: updateDoc });

    const updated = await collection.findOne({ _id: new ObjectId(attrId) });
    if (!updated) return null;

    return {
      id: updated._id.toString(),
      data_model_id: updated.data_model_id.toString(),
      path: updated.path,
      type: updated.type,
      source: updated.source,
      required: updated.required,
      indexed: updated.indexed,
      description: updated.description,
      example: updated.example,
      status: updated.status,
      order: updated.order,
      derivation: updated.derivation,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      created_by: updated.created_by,
      updated_by: updated.updated_by,
    };
  },

  async deleteAttribute(attrId: string, organizationId: string): Promise<boolean> {
    const collection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);
    const result = await collection.deleteOne({ _id: new ObjectId(attrId) });
    return result.deletedCount > 0;
  },

  // Pipeline Management
  async getPipeline(modelId: string, organizationId: string): Promise<any | null> {
    const collection = await getCollection(Collections.DATA_MODEL_PIPELINES);
    const pipeline = await collection.findOne(
      {
        data_model_id: new ObjectId(modelId),
        organization_id: new ObjectId(organizationId),
        status: { $in: ['draft', 'active'] },
      },
      { sort: { version: -1 } }
    );

    if (!pipeline) return null;

    return {
      id: pipeline._id.toString(),
      data_model_id: pipeline.data_model_id.toString(),
      organization_id: pipeline.organization_id.toString(),
      version: pipeline.version,
      status: pipeline.status,
      pipeline: pipeline.pipeline,
      elk_config: pipeline.elk_config,
      created_at: pipeline.created_at,
      updated_at: pipeline.updated_at,
      created_by: pipeline.created_by,
      updated_by: pipeline.updated_by,
      last_deployed_at: pipeline.last_deployed_at,
    };
  },

  async createPipeline(modelId: string, organizationId: string, data: any): Promise<any> {
    const collection = await getCollection(Collections.DATA_MODEL_PIPELINES);

    // Get the latest version for this model
    const latestPipeline = await collection.findOne(
      { data_model_id: new ObjectId(modelId) },
      { sort: { version: -1 } }
    );

    const nextVersion = latestPipeline ? latestPipeline.version + 1 : 1;

    // Get model to generate ELK config
    const model = await this.getById(modelId, organizationId);
    if (!model) throw new Error('Model not found');

    const newPipeline = {
      data_model_id: new ObjectId(modelId),
      organization_id: new ObjectId(organizationId),
      version: nextVersion,
      status: data.status || 'draft',
      pipeline: data.pipeline || { steps: [] },
      elk_config: {
        index_name: model.elk.index_name,
        mapping: data.elk_mapping || {},
      },
      created_at: new Date(),
      created_by: data.created_by,
    };

    const result = await collection.insertOne(newPipeline);

    return {
      id: result.insertedId.toString(),
      ...newPipeline,
      data_model_id: newPipeline.data_model_id.toString(),
      organization_id: newPipeline.organization_id.toString(),
    };
  },

  async updatePipeline(
    modelId: string,
    pipelineId: string,
    organizationId: string,
    data: any
  ): Promise<any | null> {
    const collection = await getCollection(Collections.DATA_MODEL_PIPELINES);

    const updateData: any = {
      updated_at: new Date(),
      updated_by: data.updated_by,
    };

    if (data.pipeline) updateData.pipeline = data.pipeline;
    if (data.status) updateData.status = data.status;
    if (data.elk_config) updateData.elk_config = data.elk_config;

    const result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(pipelineId),
        data_model_id: new ObjectId(modelId),
        organization_id: new ObjectId(organizationId),
      },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      id: result._id.toString(),
      data_model_id: result.data_model_id.toString(),
      organization_id: result.organization_id.toString(),
      version: result.version,
      status: result.status,
      pipeline: result.pipeline,
      elk_config: result.elk_config,
      created_at: result.created_at,
      updated_at: result.updated_at,
      created_by: result.created_by,
      updated_by: result.updated_by,
      last_deployed_at: result.last_deployed_at,
    };
  },

  async deployPipeline(modelId: string, pipelineId: string, organizationId: string): Promise<void> {
    const collection = await getCollection(Collections.DATA_MODEL_PIPELINES);

    const pipeline = await collection.findOne({
      _id: new ObjectId(pipelineId),
      data_model_id: new ObjectId(modelId),
      organization_id: new ObjectId(organizationId),
    });

    if (!pipeline) throw new Error('Pipeline not found');

    // Get the data model to include in config
    const model = await this.getById(modelId, organizationId);
    if (!model) throw new Error('Model not found');

    // Transform pipeline to Processing Service config format
    const config = this.transformPipelineToProcessingConfig(pipeline, model);

    // Write to file system for Processing Service to pick up
    const fs = await import('fs');
    const path = await import('path');
    const pipelinesDir = process.env.PIPELINES_DIR || '/app/pipelines';

    // Ensure directory exists
    if (!fs.existsSync(pipelinesDir)) {
      fs.mkdirSync(pipelinesDir, { recursive: true });
    }

    const configPath = path.join(pipelinesDir, `model_${modelId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Update pipeline status
    await collection.updateOne(
      { _id: pipeline._id },
      {
        $set: {
          status: 'active',
          last_deployed_at: new Date(),
        },
      }
    );

    // Update Elasticsearch mapping
    try {
      await this.updateElasticsearchMapping(model);
      console.log(`Elasticsearch mapping updated for index: ${model.elk.index_name}`);
    } catch (error) {
      console.error('Failed to update Elasticsearch mapping:', error);
      // Don't fail the deployment if mapping update fails
    }

    console.log(`Pipeline deployed: ${configPath}`);
  },

  transformPipelineToProcessingConfig(pipeline: any, model?: DataModel): any {
    // Transform from UI pipeline format to Processing Service format
    const rules = pipeline.pipeline.steps.map((step: any) => ({
      name: step.id,
      type: this.mapOperationToRuleType(step.type),
      args: {
        ...step.params,
        input_field: step.inputs[0]?.path,
        output_field: step.outputs[0]?.path,
      },
      on_error: 'skip',
    }));

    const config: any = {
      version: pipeline.version,
      rules,
      persist: {
        elasticsearch: {
          enabled: true,
          index: pipeline.elk_config.index_name,
        },
      },
    };

    // Include model metadata if available
    if (model) {
      config.model = {
        id: model.id,
        name: model.name,
        data_index: model.data_index,
        type: model.type,
        elk_index: model.elk.index_name,
      };
    }

    return config;
  },

  async updateElasticsearchMapping(model: DataModel): Promise<void> {
    const { esClient } = await import('../lib/elasticsearch.js');

    // Build mapping from attributes with proper nested handling
    const properties: Record<string, any> = {};
    const nestedFields: Record<string, any> = {};

    // First pass: identify nested/array fields and their children
    for (const attr of model.attributes || []) {
      const path = attr.path;

      // Skip array notation like "field[]"
      if (path.includes('[]')) {
        continue;
      }

      // Check if this is a nested field (has a parent that's an array)
      const parts = path.split('.');
      let isNestedChild = false;
      let parentPath = '';

      for (let i = parts.length - 1; i > 0; i--) {
        const potentialParent = parts.slice(0, i).join('.');
        const parentAttr = (model.attributes || []).find(
          (a) => a.path === potentialParent && (a.type === 'array' || a.type === 'object')
        );

        if (parentAttr && parentAttr.type === 'array') {
          isNestedChild = true;
          parentPath = potentialParent;
          break;
        }
      }

      if (isNestedChild && parentPath) {
        // This is a child of a nested field
        if (!nestedFields[parentPath]) {
          nestedFields[parentPath] = { properties: {} };
        }
        const childPath = path.substring(parentPath.length + 1);
        const esType = this.mapTypeToElasticsearch(attr.type);
        const fieldMapping: any = { type: esType };

        if (esType === 'text') {
          fieldMapping.fields = {
            keyword: { type: 'keyword', ignore_above: 256 },
          };
        }

        nestedFields[parentPath].properties[childPath] = fieldMapping;
      } else if (attr.type === 'array') {
        // This is the parent array field
        properties[path] = {
          type: 'nested',
          properties: nestedFields[path]?.properties || {},
        };
      } else if (attr.type === 'object') {
        // Regular object field
        properties[path] = { type: 'object' };
      } else {
        // Regular field
        const esType = this.mapTypeToElasticsearch(attr.type);
        const fieldMapping: any = { type: esType };

        if (esType === 'text') {
          fieldMapping.fields = {
            keyword: { type: 'keyword', ignore_above: 256 },
          };
        }

        properties[path] = fieldMapping;
      }
    }

    // Add nested fields that were collected
    for (const [parentPath, nestedDef] of Object.entries(nestedFields)) {
      if (!properties[parentPath]) {
        properties[parentPath] = {
          type: 'nested',
          properties: nestedDef.properties,
        };
      } else if (properties[parentPath].type === 'nested') {
        properties[parentPath].properties = {
          ...properties[parentPath].properties,
          ...nestedDef.properties,
        };
      }
    }

    // Add common metadata fields
    properties['@timestamp'] = { type: 'date' };
    properties['event_id'] = { type: 'keyword' };
    properties['organization_id'] = { type: 'keyword' };
    properties['data_source_id'] = { type: 'keyword' };
    properties['agent_id'] = { type: 'keyword' };
    properties['tenant_id'] = { type: 'keyword' };
    properties['ingested_at'] = { type: 'date' };

    const mapping = {
      properties,
    };

    // Check if index exists
    const indexExists = await esClient.indices.exists({ index: model.elk.index_name } as any);

    if (!indexExists) {
      // Create index with mapping
      await esClient.indices.create({
        index: model.elk.index_name,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            'index.max_result_window': 10000,
          },
          mappings: mapping,
        },
      } as any);
      console.log(`Created Elasticsearch index: ${model.elk.index_name}`);
    } else {
      // Update mapping
      await esClient.indices.putMapping({
        index: model.elk.index_name,
        body: mapping,
      } as any);
      console.log(`Updated Elasticsearch mapping: ${model.elk.index_name}`);
    }
  },

  mapTypeToElasticsearch(
    type: string
  ):
    | 'text'
    | 'keyword'
    | 'long'
    | 'double'
    | 'date'
    | 'boolean'
    | 'ip'
    | 'object'
    | 'nested'
    | 'dense_vector' {
    switch (type) {
      case 'string':
        return 'text';
      case 'number':
        return 'long';
      case 'date':
        return 'date';
      case 'ip':
        return 'ip';
      case 'bool':
      case 'boolean':
        return 'boolean';
      case 'vector':
        return 'dense_vector';
      case 'object':
        return 'object';
      case 'array':
        return 'nested';
      default:
        return 'text';
    }
  },

  mapOperationToRuleType(operationType: string): string {
    const mapping: Record<string, string> = {
      math: 'derive_math',
      concat: 'derive_concat',
      conditional: 'derive_conditional',
      vectorize: 'vectorize_openai',
      extract_regex: 'extract_regex',
      normalize: 'normalize_value',
    };
    return mapping[operationType] || operationType;
  },

  // Derived Model Creation
  async createDerivedModel(data: {
    organization_id: string;
    name: string;
    source_model_ids: string[];
    attributes: any[];
    pipeline: any;
    created_by: string;
  }): Promise<any> {
    // Create data model (without creating ELK index yet)
    const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const dataIndex = `${slugify(data.name)}_derived`;
    const elkIndexName = `org_${data.organization_id}__${dataIndex}__v1`;

    const collection = await getCollection(Collections.DATA_MODELS);
    const now = new Date();

    const doc = {
      organization_id: new ObjectId(data.organization_id),
      name: data.name,
      data_index: dataIndex,
      type: 'derived' as const,
      version: 1,
      status: 'draft' as const,
      source: {
        data_source_ids: data.source_model_ids.map((id) => new ObjectId(id)),
        source_type: 'derived',
      },
      schema: { fields: [] },
      elk: {
        index_name: elkIndexName,
      },
      created_at: now,
      updated_at: now,
      created_by: data.created_by,
    };

    const result = await collection.insertOne(doc);
    const modelId = result.insertedId.toString();

    // Create attributes BEFORE creating ELK index
    for (let i = 0; i < data.attributes.length; i++) {
      const attr = data.attributes[i];
      const attrCollection = await getCollection(Collections.DATA_MODEL_ATTRIBUTES);
      await attrCollection.insertOne({
        data_model_id: new ObjectId(modelId),
        path: attr.path,
        type: attr.type,
        source: attr.source || 'user-selected',
        required: attr.required || false,
        indexed: attr.indexed || false,
        description: attr.description || '',
        example: attr.example,
        status: attr.status || 'normal',
        order: i + 1,
        derivation: attr.derivation,
        created_at: now,
        updated_at: now,
        created_by: data.created_by,
      });
    }

    // Now get the full model with attributes and create ELK index
    const fullModel = await this.getById(modelId, data.organization_id);
    if (fullModel) {
      try {
        await this.updateElasticsearchMapping(fullModel);
        console.log(
          `Elasticsearch index created for derived model: ${elkIndexName} with ${data.attributes.length} attributes`
        );
      } catch (error) {
        console.error('Failed to create Elasticsearch index for derived model:', error);
      }
    }

    // Create pipeline
    if (data.pipeline && data.pipeline.steps && data.pipeline.steps.length > 0) {
      await this.createPipeline(modelId, data.organization_id, {
        pipeline: data.pipeline,
        status: 'draft',
        created_by: data.created_by,
      });
    }

    return fullModel;
  },

  // Vector Model Creation
  async createVectorModel(data: {
    organization_id: string;
    name: string;
    source_model_id: string;
    text_field: string;
    embedding_model: string;
    dimensions: number;
    created_by: string;
  }): Promise<any> {
    const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const dataIndex = `${slugify(data.name)}_vector`;

    // Create vector model
    const model = await this.create({
      organization_id: data.organization_id,
      name: data.name,
      data_index: dataIndex,
      type: 'vector',
      version: 1,
      status: 'draft',
      source: {
        data_source_ids: [data.source_model_id],
        source_type: 'vector',
      },
      schema: {
        fields: [
          {
            path: `${data.text_field}_vector`,
            type: 'vector',
            description: `Vector embedding of ${data.text_field}`,
          },
        ],
      },
      elk: {
        index_name: `org_${data.organization_id}__${dataIndex}__v1`,
      },
      created_by: data.created_by,
    });

    // Create vector attribute
    await this.createAttribute(model.id!, data.organization_id, {
      path: `${data.text_field}_vector`,
      type: 'vector',
      source: 'derived',
      required: false,
      indexed: true,
      description: `Vector embedding of ${data.text_field}`,
      order: 1,
      derivation: {
        operation: 'vectorize',
        source_attributes: [data.text_field],
        params: {
          model: data.embedding_model,
          dimensions: data.dimensions,
        },
      },
      created_by: data.created_by,
    });

    // Create vectorization pipeline
    await this.createPipeline(model.id!, data.organization_id, {
      pipeline: {
        steps: [
          {
            id: 'vectorize_text',
            type: 'vectorize',
            operation: 'vectorize_openai',
            inputs: [{ path: data.text_field }],
            params: {
              model: data.embedding_model,
              dimensions: data.dimensions,
            },
            outputs: [{ path: `${data.text_field}_vector`, type: 'vector' }],
          },
        ],
      },
      status: 'draft',
      created_by: data.created_by,
    });

    return model;
  },
};

/**
 * Map Elasticsearch field type to schema field type
 */
function mapESTypeToSchemaType(
  esType: string
): 'string' | 'number' | 'date' | 'ip' | 'bool' | 'object' | 'array' | 'vector' {
  switch (esType) {
    case 'text':
    case 'keyword':
      return 'string';
    case 'long':
    case 'integer':
    case 'short':
    case 'byte':
    case 'double':
    case 'float':
    case 'half_float':
    case 'scaled_float':
      return 'number';
    case 'date':
      return 'date';
    case 'ip':
      return 'ip';
    case 'boolean':
      return 'bool';
    case 'nested':
      return 'array';
    case 'dense_vector':
      return 'vector';
    default:
      return 'object';
  }
}
