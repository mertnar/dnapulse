// Check ALL data models in MongoDB (no org filter)
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function checkAllDataModels() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');

    const count = await dataModelsCol.countDocuments();
    console.log(`\nTotal data models in DB: ${count}`);

    const models = await dataModelsCol.find({}).sort({ created_at: -1 }).toArray();

    console.log('\nAll Data models:');
    models.forEach((model) => {
      console.log(`\n  - ${model.name}`);
      console.log(`    ID: ${model._id}`);
      console.log(`    Org ID: ${model.organization_id}`);
      console.log(`    Type: ${model.type}`);
      console.log(`    Data Index: ${model.data_index}`);
      console.log(`    Created: ${model.created_at}`);
    });

    // Check specific ID from agent
    const agentModelId = '699235807c58d1368766ba5b';
    console.log(`\n\nLooking for agent-created model ID: ${agentModelId}`);
    const agentModel = await dataModelsCol.findOne({ _id: new ObjectId(agentModelId) });
    if (agentModel) {
      console.log('✓ Found agent-created model:', agentModel.name);
    } else {
      console.log('✗ Agent-created model NOT found in database');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAllDataModels();
