// List ALL data models in MongoDB (no filter)
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function listAllDataModels() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');

    const count = await dataModelsCol.countDocuments();
    console.log(`\nTotal data models in DB: ${count}\n`);

    const models = await dataModelsCol.find({}).sort({ created_at: -1 }).toArray();

    console.log('All Data Models:');
    console.log('='.repeat(80));

    models.forEach((model, index) => {
      console.log(`\n${index + 1}. ${model.name}`);
      console.log(`   ID: ${model._id}`);
      console.log(`   Org ID: ${model.organization_id}`);
      console.log(`   Type: ${model.type}`);
      console.log(`   Data Index: ${model.data_index}`);
      console.log(`   Status: ${model.status}`);
      console.log(`   Version: ${model.version}`);
      console.log(`   Created: ${model.created_at}`);
      console.log(`   Created By: ${model.created_by}`);
      if (model.elk?.index_name) {
        console.log(`   ELK Index: ${model.elk.index_name}`);
      }
    });

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

listAllDataModels();
