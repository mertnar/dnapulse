// Debug organization_id type
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function debugOrgId() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const dataModelsCol = db.collection('data_models');

    const model = await dataModelsCol.findOne({});
    if (model) {
      console.log('Sample model:');
      console.log('  organization_id:', model.organization_id);
      console.log('  organization_id type:', typeof model.organization_id);
      console.log(
        '  organization_id instanceof ObjectId:',
        model.organization_id instanceof ObjectId
      );
      console.log('  organization_id.toString():', model.organization_id.toString());

      // Try query with ObjectId
      const orgId = '6976ee903bd20e1f00bc5dd6';
      console.log('\nQuerying with new ObjectId(orgId):');
      const count1 = await dataModelsCol.countDocuments({ organization_id: new ObjectId(orgId) });
      console.log('  Count:', count1);

      // Try query with string
      console.log('\nQuerying with string orgId:');
      const count2 = await dataModelsCol.countDocuments({ organization_id: orgId });
      console.log('  Count:', count2);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugOrgId();
