// Check latest data model in MongoDB
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function checkLatestDataModel() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');

    const count = await dataModelsCol.countDocuments();
    console.log(`\nTotal data models in DB: ${count}`);

    // Get latest model
    const latestModel = await dataModelsCol.findOne({}, { sort: { created_at: -1 } });

    if (latestModel) {
      console.log('\n📊 Latest Data Model:');
      console.log(`  Name: ${latestModel.name}`);
      console.log(`  ID: ${latestModel._id}`);
      console.log(`  Org ID: ${latestModel.organization_id}`);
      console.log(`  Type: ${latestModel.type}`);
      console.log(`  Data Index: ${latestModel.data_index}`);
      console.log(`  Status: ${latestModel.status}`);
      console.log(`  Version: ${latestModel.version}`);
      console.log(`  Created: ${latestModel.created_at}`);
      console.log(`  Created By: ${latestModel.created_by}`);
      console.log(`  ELK Index: ${latestModel.elk?.index_name}`);
    }

    // Check specific ID from latest agent registration
    const newModelId = '69923b506daafa4959ae2134';
    console.log(`\n\n🔍 Looking for agent-created model ID: ${newModelId}`);
    const agentModel = await dataModelsCol.findOne({ _id: new ObjectId(newModelId) });
    if (agentModel) {
      console.log('✅ Found agent-created model:', agentModel.name);
      console.log('   Data Index:', agentModel.data_index);
      console.log('   Type:', agentModel.type);
    } else {
      console.log('❌ Agent-created model NOT found in database');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkLatestDataModel();
