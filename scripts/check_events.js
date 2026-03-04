import { MongoClient } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL;

async function checkEvents() {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    const db = client.db('dna-pulse');

    const count = await db.collection('events').countDocuments();
    console.log(`Total events in DB: ${count}`);

    const recentEvents = await db
      .collection('events')
      .find()
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    console.log('\nRecent events:');
    recentEvents.forEach((e, i) => {
      console.log(`\n${i + 1}. Event ID: ${e._id}`);
      console.log(`   Organization ID: ${e.organization_id}`);
      console.log(`   Data Source ID: ${e.data_source_id}`);
      console.log(`   Agent ID: ${e.agent_id}`);
      console.log(`   Ingested at: ${e.ingested_at}`);
      console.log(`   Created at: ${e.created_at}`);
      console.log(`   Payload keys: ${Object.keys(e.payload || {}).join(', ')}`);
      if (e.payload) {
        console.log(`   Payload.@ts: ${e.payload['@ts']}`);
        console.log(`   Payload.severity: ${e.payload['severity']}`);
      }
    });
  } finally {
    await client.close();
  }
}

checkEvents();
