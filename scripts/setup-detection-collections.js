import { MongoClient } from 'mongodb';
import 'dotenv/config';

// Get MongoDB URL and ensure username/password are properly encoded
let MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';

// If MONGO_URL contains ${MONGO_PASSWORD}, replace it with encoded password
if (MONGO_URL.includes('${MONGO_PASSWORD}') && process.env.MONGO_PASSWORD) {
  const encodedPassword = encodeURIComponent(process.env.MONGO_PASSWORD);
  MONGO_URL = MONGO_URL.replace('${MONGO_PASSWORD}', encodedPassword);
}

// Always encode username and password in connection string to handle special characters
if (MONGO_URL.startsWith('mongodb+srv://') || MONGO_URL.startsWith('mongodb://')) {
  try {
    const urlPattern = /^(mongodb(\+srv)?:\/\/)([^@]+)@(.+)$/;
    const match = MONGO_URL.match(urlPattern);

    if (match) {
      const [, protocol, , credentials, rest] = match;
      const [username, password] = credentials.split(':');

      if (username && password) {
        const decodedUsername = decodeURIComponent(username);
        const decodedPassword = decodeURIComponent(password);
        const encodedUsername = encodeURIComponent(decodedUsername);
        const encodedPassword = encodeURIComponent(decodedPassword);
        MONGO_URL = `${protocol}${encodedUsername}:${encodedPassword}@${rest}`;
      }
    }
  } catch (e) {
    console.warn('URL encoding failed, using original URL');
  }
}

const DB_NAME = process.env.MONGO_DB_NAME || 'dna-pulse';

async function setupDetectionCollections() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log(`Connected to MongoDB: ${DB_NAME}`);

    const db = client.db(DB_NAME);

    console.log('\n📊 Setting up Detection & Investigation collections and indexes...\n');

    // 1. Rules collection indexes
    console.log('Creating indexes for "rules" collection...');
    const rulesCol = db.collection('rules');
    await rulesCol.createIndex({ organization_id: 1, enabled: 1 }, { name: 'org_enabled_idx' });
    await rulesCol.createIndex({ organization_id: 1, created_at: -1 }, { name: 'org_created_idx' });
    console.log('✅ Rules indexes created');

    // 2. Alerts collection indexes
    console.log('Creating indexes for "alerts" collection...');
    const alertsCol = db.collection('alerts');
    await alertsCol.createIndex(
      { organization_id: 1, status: 1, created_at: -1 },
      { name: 'org_status_created_idx' }
    );
    await alertsCol.createIndex(
      { organization_id: 1, rule_id: 1, created_at: -1 },
      { name: 'org_rule_created_idx' }
    );
    await alertsCol.createIndex({ dedupe_key: 1 }, { unique: true, name: 'dedupe_key_unique_idx' });
    await alertsCol.createIndex(
      { organization_id: 1, 'window.from': 1, 'window.to': 1 },
      { name: 'org_window_idx' }
    );
    console.log('✅ Alerts indexes created');

    // 3. Investigations collection indexes
    console.log('Creating indexes for "investigations" collection...');
    const investigationsCol = db.collection('investigations');
    await investigationsCol.createIndex(
      { organization_id: 1, status: 1, updated_at: -1 },
      { name: 'org_status_updated_idx' }
    );
    await investigationsCol.createIndex(
      { organization_id: 1, created_at: -1 },
      { name: 'org_created_idx' }
    );
    console.log('✅ Investigations indexes created');

    // 4. Investigation notes collection indexes
    console.log('Creating indexes for "investigation_notes" collection...');
    const notesCol = db.collection('investigation_notes');
    await notesCol.createIndex(
      { investigation_id: 1, created_at: -1 },
      { name: 'inv_created_idx' }
    );
    await notesCol.createIndex({ organization_id: 1, created_at: -1 }, { name: 'org_created_idx' });
    console.log('✅ Investigation notes indexes created');

    // 5. Events collection - ensure required indexes exist
    console.log('Ensuring indexes for "events" collection...');
    const eventsCol = db.collection('events');
    try {
      await eventsCol.createIndex(
        { organization_id: 1, 'payload.@ts': -1 },
        { name: 'org_ts_idx' }
      );
      console.log('✅ Events indexes ensured');
    } catch (error) {
      if (error.code === 85 || error.code === 86) {
        console.log('⚠️  Events index already exists (different options), skipping');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All detection collections and indexes created successfully!\n');

    // Display current indexes
    console.log('📋 Current indexes summary:');
    const collections = ['rules', 'alerts', 'investigations', 'investigation_notes', 'events'];
    for (const collName of collections) {
      const indexes = await db.collection(collName).indexes();
      console.log(`\n  ${collName} (${indexes.length} indexes):`);
      indexes.forEach((idx) => {
        if (idx.name !== '_id_') {
          console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error setting up collections:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

setupDetectionCollections();
