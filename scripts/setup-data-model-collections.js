// MongoDB Data Model Collections Setup Script
// Creates data_models and model_versions collections with indexes

import { MongoClient } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function setupDataModelCollections() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // 1. Create data_models collection
    const dataModelsExists = await db.listCollections({ name: 'data_models' }).hasNext();
    if (!dataModelsExists) {
      await db.createCollection('data_models');
      console.log('✓ Created collection: data_models');
    } else {
      console.log('✓ Collection already exists: data_models');
    }

    // 2. Create model_versions collection
    const modelVersionsExists = await db.listCollections({ name: 'model_versions' }).hasNext();
    if (!modelVersionsExists) {
      await db.createCollection('model_versions');
      console.log('✓ Created collection: model_versions');
    } else {
      console.log('✓ Collection already exists: model_versions');
    }

    // 3. Create indexes for data_models
    const dataModelsCol = db.collection('data_models');

    // Unique data_index per organization
    await dataModelsCol.createIndex(
      { organization_id: 1, data_index: 1 },
      { unique: true, name: 'unique_org_data_index' }
    );
    console.log('✓ Created index: data_models.unique_org_data_index');

    // Query by type and status
    await dataModelsCol.createIndex(
      { organization_id: 1, type: 1, status: 1 },
      { name: 'org_type_status' }
    );
    console.log('✓ Created index: data_models.org_type_status');

    // Find by data source
    await dataModelsCol.createIndex(
      { 'source.data_source_ids': 1 },
      { name: 'source_data_source_ids' }
    );
    console.log('✓ Created index: data_models.source_data_source_ids');

    // ELK index lookup
    await dataModelsCol.createIndex({ 'elk.index_name': 1 }, { name: 'elk_index_name' });
    console.log('✓ Created index: data_models.elk_index_name');

    // Created at for sorting
    await dataModelsCol.createIndex(
      { organization_id: 1, created_at: -1 },
      { name: 'org_created_at' }
    );
    console.log('✓ Created index: data_models.org_created_at');

    // 4. Create indexes for model_versions
    const modelVersionsCol = db.collection('model_versions');

    // Query versions by model_id
    await modelVersionsCol.createIndex({ model_id: 1, version: -1 }, { name: 'model_versions' });
    console.log('✓ Created index: model_versions.model_versions');

    // Created at for sorting
    await modelVersionsCol.createIndex(
      { model_id: 1, created_at: -1 },
      { name: 'model_created_at' }
    );
    console.log('✓ Created index: model_versions.model_created_at');

    console.log('\n✅ All data model collections and indexes created successfully');
  } catch (error) {
    console.error('❌ Error setting up data model collections:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupDataModelCollections();
