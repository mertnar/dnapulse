// Check data models in MongoDB
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';
const DEFAULT_ORG_ID = '6976ee903bd20e1f00bc5dd6';

async function checkDataModels() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');

    const count = await dataModelsCol.countDocuments();
    console.log(`\nTotal data models in DB: ${count}`);

    const orgCount = await dataModelsCol.countDocuments({
      organization_id: new ObjectId(DEFAULT_ORG_ID),
    });
    console.log(`Data models for org ${DEFAULT_ORG_ID}: ${orgCount}`);

    const models = await dataModelsCol
      .find({
        organization_id: new ObjectId(DEFAULT_ORG_ID),
      })
      .toArray();

    console.log('\nData models:');
    models.forEach((model) => {
      console.log(`  - ${model.name}`);
      console.log(`    ID: ${model._id}`);
      console.log(`    Org ID: ${model.organization_id}`);
      console.log(`    Type: ${model.type}`);
      console.log(`    Data Index: ${model.data_index}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkDataModels();
