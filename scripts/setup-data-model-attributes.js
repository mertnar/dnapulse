// Setup data_model_attributes collection
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function setupDataModelAttributes() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Create data_model_attributes collection
    const collections = await db.listCollections({ name: 'data_model_attributes' }).toArray();

    if (collections.length === 0) {
      await db.createCollection('data_model_attributes');
      console.log('✓ Created data_model_attributes collection');
    } else {
      console.log('✓ data_model_attributes collection already exists');
    }

    const attributesCol = db.collection('data_model_attributes');

    // Create indexes
    console.log('\n📑 Creating indexes...');

    // Unique index: data_model_id + path
    await attributesCol.createIndex(
      { data_model_id: 1, path: 1 },
      { unique: true, name: 'idx_model_path_unique' }
    );
    console.log('  ✓ Unique index on data_model_id + path');

    // Query by data_model_id
    await attributesCol.createIndex({ data_model_id: 1, order: 1 }, { name: 'idx_model_order' });
    console.log('  ✓ Index on data_model_id + order');

    // Query by status
    await attributesCol.createIndex({ data_model_id: 1, status: 1 }, { name: 'idx_model_status' });
    console.log('  ✓ Index on data_model_id + status');

    // Query by indexed flag
    await attributesCol.createIndex(
      { data_model_id: 1, indexed: 1 },
      { name: 'idx_model_indexed' }
    );
    console.log('  ✓ Index on data_model_id + indexed');

    console.log('\n✅ data_model_attributes collection setup complete!');

    // Show schema
    console.log('\n📋 Schema:');
    console.log(`
DataModelAttribute {
  _id: ObjectId,
  data_model_id: ObjectId,           // Reference to data_models._id
  path: string,                      // "hostname", "user.name", "cpu.usage"
  type: string,                      // "string", "number", "date", "ip", "bool", "object", "array", "vector"
  source: string,                    // "discovered", "derived", "user-added"
  required: boolean,
  indexed: boolean,
  description: string,
  example: any,
  status: string,                    // "normal", "deprecated", "undefined"
  order: number,                     // Display order

  // For derived attributes
  derivation: {
    operation: string,               // "concat", "math", "conditional", "vectorize"
    expression: string,              // Expression or formula
    source_attributes: [string]      // Source attribute paths
  },

  // Metadata
  created_at: Date,
  updated_at: Date,
  created_by: string,
  updated_by: string
}
    `);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupDataModelAttributes();
