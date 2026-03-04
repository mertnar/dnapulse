// Seed script for Data Models
// Creates sample data models for testing

import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';
const DEFAULT_ORG_ID = '6976ee903bd20e1f00bc5dd6';

async function seedDataModels() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');
    const dataSourcesCol = db.collection('data_sources');

    // Get or create a data source
    let dataSource = await dataSourcesCol.findOne({
      organization_id: new ObjectId(DEFAULT_ORG_ID),
      agent_type: 'linux-resource-monitor',
    });

    if (!dataSource) {
      console.log('⚠️  No data source found. Creating sample data source...');
      const result = await dataSourcesCol.insertOne({
        organization_id: new ObjectId(DEFAULT_ORG_ID),
        name: 'Linux Resource Monitor',
        type: 'agent-based',
        agent_type: 'linux-resource-monitor',
        status: 'active',
        throughput: 0,
        agent_count: 0,
        last_seen: new Date(),
        created_at: new Date(),
      });
      dataSource = { _id: result.insertedId, agent_type: 'linux-resource-monitor' };
      console.log('✓ Created sample data source');
    }

    // Check if root model already exists
    const existingRootModel = await dataModelsCol.findOne({
      organization_id: new ObjectId(DEFAULT_ORG_ID),
      data_index: 'linux-resource-monitor',
      type: 'root',
    });

    if (existingRootModel) {
      console.log('✓ Root model already exists:', existingRootModel.name);
    } else {
      // Create root data model
      const rootModel = {
        organization_id: new ObjectId(DEFAULT_ORG_ID),
        name: 'Linux Resource Monitor - Root Model',
        data_index: 'linux-resource-monitor',
        type: 'root',
        version: 1,
        status: 'active',
        source: {
          data_source_ids: [dataSource._id],
          agent_type: 'linux-resource-monitor',
          source_type: 'linux-resource-monitor',
        },
        schema: {
          fields: [
            { path: 'hostname', type: 'string', required: true, indexed: true },
            { path: 'cpu_usage', type: 'number', required: false, indexed: false },
            { path: 'memory_usage', type: 'number', required: false, indexed: false },
            { path: 'disk_usage', type: 'number', required: false, indexed: false },
            { path: 'timestamp', type: 'date', required: true, indexed: true },
            { path: 'severity', type: 'string', required: false, indexed: true },
          ],
        },
        elk: {
          index_name: `org_${DEFAULT_ORG_ID}__linux-resource-monitor__v1`,
          template_name: 'linux-resource-monitor-template',
        },
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'system',
      };

      await dataModelsCol.insertOne(rootModel);
      console.log('✓ Created root data model:', rootModel.name);
    }

    // Check if derived model already exists
    const existingDerivedModel = await dataModelsCol.findOne({
      organization_id: new ObjectId(DEFAULT_ORG_ID),
      data_index: 'linux-resource-monitor-enriched',
      type: 'derived',
    });

    if (existingDerivedModel) {
      console.log('✓ Derived model already exists:', existingDerivedModel.name);
    } else {
      // Create derived data model
      const derivedModel = {
        organization_id: new ObjectId(DEFAULT_ORG_ID),
        name: 'Linux Resource Monitor - Enriched',
        data_index: 'linux-resource-monitor-enriched',
        type: 'derived',
        version: 1,
        status: 'active',
        source: {
          data_source_ids: [dataSource._id],
          agent_type: 'linux-resource-monitor',
          source_type: 'linux-resource-monitor',
        },
        schema: {
          fields: [
            { path: 'hostname', type: 'string', required: true, indexed: true },
            { path: 'cpu_usage', type: 'number', required: false, indexed: false },
            { path: 'memory_usage', type: 'number', required: false, indexed: false },
            { path: 'disk_usage', type: 'number', required: false, indexed: false },
            { path: 'timestamp', type: 'date', required: true, indexed: true },
            { path: 'severity', type: 'string', required: false, indexed: true },
            {
              path: 'resource_status',
              type: 'string',
              required: false,
              indexed: true,
              description: 'Derived field: normal, warning, critical',
            },
            {
              path: 'alert_level',
              type: 'number',
              required: false,
              indexed: false,
              description: 'Derived field: 0-100 alert score',
            },
          ],
        },
        processing: {
          pipeline: [
            {
              id: 'normalize_severity',
              operation: 'normalize_live_monitor',
              inputs: [{ field: 'severity' }],
              outputs: [{ field: 'severity', type: 'string' }],
            },
            {
              id: 'calculate_resource_status',
              operation: 'derive_field',
              inputs: [{ field: 'cpu_usage' }, { field: 'memory_usage' }, { field: 'disk_usage' }],
              params: {
                expression:
                  'if cpu_usage > 90 or memory_usage > 90 or disk_usage > 90 then "critical" else if cpu_usage > 70 or memory_usage > 70 or disk_usage > 70 then "warning" else "normal"',
              },
              outputs: [{ field: 'resource_status', type: 'string' }],
            },
            {
              id: 'calculate_alert_level',
              operation: 'derive_field',
              inputs: [{ field: 'cpu_usage' }, { field: 'memory_usage' }, { field: 'disk_usage' }],
              params: {
                expression: 'max(cpu_usage, memory_usage, disk_usage)',
              },
              outputs: [{ field: 'alert_level', type: 'number' }],
            },
          ],
        },
        elk: {
          index_name: `org_${DEFAULT_ORG_ID}__linux-resource-monitor-enriched__v1`,
          template_name: 'linux-resource-monitor-enriched-template',
        },
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'admin',
      };

      await dataModelsCol.insertOne(derivedModel);
      console.log('✓ Created derived data model:', derivedModel.name);
    }

    console.log('\n✅ Data models seeded successfully!');

    // List all data models
    const models = await dataModelsCol
      .find({
        organization_id: new ObjectId(DEFAULT_ORG_ID),
      })
      .toArray();

    console.log(`\n📊 Total data models: ${models.length}`);
    models.forEach((model) => {
      console.log(`  - ${model.name} (${model.type}, v${model.version})`);
    });
  } catch (error) {
    console.error('❌ Error seeding data models:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedDataModels();
