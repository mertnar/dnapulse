// Script to create a test API key in MongoDB for manual testing
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'dna-pulse';

async function createTestAPIKey() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const orgsCollection = db.collection('organizations');
    const apiKeysCollection = db.collection('api_keys');

    // Get or create default organization
    let org = await orgsCollection.findOne({ name: 'Default Organization' });

    if (!org) {
      const result = await orgsCollection.insertOne({
        name: 'Default Organization',
        created_at: new Date(),
      });
      org = { _id: result.insertedId };
      console.log('✓ Created default organization');
    } else {
      console.log('✓ Using existing organization');
    }

    // Generate API key
    const apiKeyPlain = `dna_test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const apiKeyHash = await bcrypt.hash(apiKeyPlain, 10);

    // Create API key document
    const apiKeyDoc = {
      organization_id: org._id,
      key: apiKeyHash,
      name: 'Test API Key - Manual Testing',
      permissions: ['agent:register', 'agent:ingest'],
      created_at: new Date(),
      expires_at: null,
      last_used: null,
    };

    const result = await apiKeysCollection.insertOne(apiKeyDoc);

    console.log('\n✅ API Key created successfully!');
    console.log('==========================================');
    console.log("API Key (save this - you won't see it again):");
    console.log(apiKeyPlain);
    console.log('==========================================');
    console.log('\nYou can now use this API key in test-agent.sh script');
    console.log('Or set it as environment variable:');
    console.log(`export API_KEY="${apiKeyPlain}"`);
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createTestAPIKey();
