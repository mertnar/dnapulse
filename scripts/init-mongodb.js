// MongoDB Initialization Script for DNA Pulse Platform
// This script creates necessary indexes and initial data

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'dna-pulse';

async function initializeDatabase() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Create collections
    const collections = [
      'organizations',
      'users',
      'api_keys',
      'agents',
      'data_sources',
      'discovered_schemas',
      'events',
      'rules',
      'alerts',
      'investigations',
      'investigation_notes',
      'data_models',
      'ml_models',
      'lifecycle_policies',
      'roles',
      'audit_logs',
    ];

    for (const collectionName of collections) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        await db.createCollection(collectionName);
        console.log(`✓ Created collection: ${collectionName}`);
      }
    }

    // Create indexes

    // api_keys indexes
    await db.collection('api_keys').createIndex({ key: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ organization_id: 1 });
    console.log('✓ Created indexes for api_keys');

    // agents indexes
    await db.collection('agents').createIndex({ organization_id: 1, data_source_id: 1 });
    await db.collection('agents').createIndex({ last_heartbeat: -1 });
    console.log('✓ Created indexes for agents');

    // data_sources indexes
    await db.collection('data_sources').createIndex(
      { organization_id: 1, agent_type: 1 },
      {
        unique: true,
        partialFilterExpression: { agent_type: { $exists: true, $type: 'string' } },
      }
    );
    await db.collection('data_sources').createIndex({ organization_id: 1 });
    console.log('✓ Created indexes for data_sources');

    // discovered_schemas indexes
    await db.collection('discovered_schemas').createIndex({ data_source_id: 1, version: -1 });
    console.log('✓ Created indexes for discovered_schemas');

    // events indexes
    await db.collection('events').createIndex({ event_id: 1 }, { unique: true });
    await db.collection('events').createIndex({ ingested_at: -1 });
    await db.collection('events').createIndex({ organization_id: 1, data_source_id: 1 });
    await db.collection('events').createIndex({ created_at: -1 });
    console.log('✓ Created indexes for events');

    // alerts indexes
    await db.collection('alerts').createIndex({ organization_id: 1, status: 1 });
    await db.collection('alerts').createIndex({ created_at: -1 });
    console.log('✓ Created indexes for alerts');

    // Create default organization (for testing/demo)
    const orgsCollection = db.collection('organizations');
    const orgExists = await orgsCollection.findOne({ name: 'Default Organization' });

    if (!orgExists) {
      const result = await orgsCollection.insertOne({
        name: 'Default Organization',
        created_at: new Date(),
      });
      console.log(`✓ Created default organization: ${result.insertedId}`);
    }

    console.log('\n✅ MongoDB initialization completed successfully!');
  } catch (error) {
    console.error('✗ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initializeDatabase();
