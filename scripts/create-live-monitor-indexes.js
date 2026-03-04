import { MongoClient } from 'mongodb';
import 'dotenv/config'; // Load environment variables from .env

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';

async function createLiveMonitorIndexes() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('dna-pulse');
    const eventsCollection = db.collection('events');

    console.log('\n📊 Creating indexes for Live Monitor...\n');

    // 1. Organization + @ts (most common query pattern)
    console.log('Creating index: { organization_id: 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.@ts': -1 },
      { name: 'org_ts_idx', background: true }
    );

    // 2. Organization + Severity + @ts (filtered by severity)
    console.log('Creating index: { organization_id: 1, "payload.severity": 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.severity': 1, 'payload.@ts': -1 },
      { name: 'org_severity_ts_idx', background: true }
    );

    // 3. Organization + Data Source + @ts (per data source view)
    console.log('Creating index: { organization_id: 1, data_source_id: 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, data_source_id: 1, 'payload.@ts': -1 },
      { name: 'org_datasource_ts_idx', background: true }
    );

    // 4. Organization + Agent + @ts (per agent view)
    console.log('Creating index: { organization_id: 1, agent_id: 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, agent_id: 1, 'payload.@ts': -1 },
      { name: 'org_agent_ts_idx', background: true }
    );

    // 5. Keyset cursor pagination (@ts + _id)
    console.log('Creating index: { "payload.@ts": -1, _id: 1 }');
    await eventsCollection.createIndex(
      { 'payload.@ts': -1, _id: 1 },
      { name: 'ts_id_cursor_idx', background: true }
    );

    // 6. Flattened fields for hot field queries
    console.log('Creating index: { "payload.flattened": 1 }');
    await eventsCollection.createIndex(
      { 'payload.flattened': 1 },
      { name: 'flattened_fields_idx', background: true, sparse: true }
    );

    // 7. Common field queries
    console.log(
      'Creating index: { organization_id: 1, "payload.event_type": 1, "payload.@ts": -1 }'
    );
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.event_type': 1, 'payload.@ts': -1 },
      { name: 'org_eventtype_ts_idx', background: true }
    );

    console.log('Creating index: { organization_id: 1, "payload.host": 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.host': 1, 'payload.@ts': -1 },
      { name: 'org_host_ts_idx', background: true, sparse: true }
    );

    console.log('Creating index: { organization_id: 1, "payload.user": 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.user': 1, 'payload.@ts': -1 },
      { name: 'org_user_ts_idx', background: true, sparse: true }
    );

    console.log('Creating index: { organization_id: 1, "payload.service": 1, "payload.@ts": -1 }');
    await eventsCollection.createIndex(
      { organization_id: 1, 'payload.service': 1, 'payload.@ts': -1 },
      { name: 'org_service_ts_idx', background: true, sparse: true }
    );

    console.log('\n✅ All indexes created successfully!\n');

    // List all indexes
    console.log('📋 Current indexes on events collection:');
    const indexes = await eventsCollection.indexes();
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n🎉 Live Monitor indexes are ready!');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the migration
createLiveMonitorIndexes();
