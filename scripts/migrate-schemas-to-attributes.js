// Migrate existing discovered schemas to data model attributes
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function migrateSchemas() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const schemasCol = db.collection('discovered_schemas');
    const dataSourcesCol = db.collection('data_sources');
    const modelsCol = db.collection('data_models');
    const attributesCol = db.collection('data_model_attributes');

    // Get all discovered schemas
    const schemas = await schemasCol.find({}).toArray();
    console.log(`📋 Found ${schemas.length} discovered schemas\n`);

    let totalCreated = 0;

    for (const schema of schemas) {
      console.log(`\n🔄 Processing schema ${schema._id}...`);
      console.log(`   Data Source: ${schema.data_source_id}`);
      console.log(`   Fields: ${schema.fields?.length || 0}`);

      if (!schema.fields || schema.fields.length === 0) {
        console.log('   ⚠️  No fields, skipping');
        continue;
      }

      // Find data source
      const dataSource = await dataSourcesCol.findOne({ _id: schema.data_source_id });
      if (!dataSource) {
        console.log('   ❌ Data source not found, skipping');
        continue;
      }

      console.log(`   Data Source Name: ${dataSource.name}`);
      console.log(`   Agent Type: ${dataSource.agent_type}`);

      // Find root data model for this data source
      const rootModel = await modelsCol.findOne({
        organization_id: dataSource.organization_id,
        data_index: dataSource.agent_type,
        type: 'root',
      });

      if (!rootModel) {
        console.log('   ❌ Root model not found, skipping');
        continue;
      }

      console.log(`   ✓ Found root model: ${rootModel.name} (${rootModel._id})`);

      // Check if attributes already exist
      const existingCount = await attributesCol.countDocuments({
        data_model_id: rootModel._id,
      });

      if (existingCount > 0) {
        console.log(`   ⚠️  ${existingCount} attributes already exist, skipping`);
        continue;
      }

      // Create attributes from schema fields
      const now = new Date();
      const attributes = schema.fields.map((field, index) => ({
        data_model_id: rootModel._id,
        path: field.name,
        type: field.type,
        source: 'discovered',
        required: field.required || false,
        indexed: field.indexed || false,
        description: field.description || '',
        example: field.example,
        status: 'normal',
        order: index + 1,
        created_at: now,
        updated_at: now,
        created_by: 'migration',
      }));

      const result = await attributesCol.insertMany(attributes);
      console.log(`   ✅ Created ${result.insertedCount} attributes`);
      totalCreated += result.insertedCount;
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Total attributes created: ${totalCreated}`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateSchemas();
