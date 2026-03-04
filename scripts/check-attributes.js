// Check data model attributes
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';
const DB_NAME = 'dna-pulse';

async function checkAttributes() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(DB_NAME);

    // Get all data models
    const modelsCol = db.collection('data_models');
    const models = await modelsCol.find({}).sort({ created_at: -1 }).toArray();

    console.log(`📊 Total data models: ${models.length}\n`);

    // Check attributes for each model
    const attributesCol = db.collection('data_model_attributes');

    for (const model of models) {
      console.log(`\n🔍 Model: ${model.name} (${model._id})`);
      console.log(`   Type: ${model.type}`);
      console.log(`   Data Index: ${model.data_index}`);

      const attributes = await attributesCol
        .find({
          data_model_id: model._id,
        })
        .sort({ order: 1 })
        .toArray();

      console.log(`   Attributes: ${attributes.length}`);

      if (attributes.length > 0) {
        console.log(`   Sample attributes:`);
        attributes.slice(0, 5).forEach((attr) => {
          console.log(
            `     - ${attr.path} (${attr.type}) ${attr.required ? '[required]' : ''} ${
              attr.indexed ? '[indexed]' : ''
            }`
          );
        });
        if (attributes.length > 5) {
          console.log(`     ... and ${attributes.length - 5} more`);
        }
      } else {
        console.log(`   ⚠️  No attributes found`);
      }
    }

    // Check discovered schemas
    console.log(`\n\n📋 Discovered Schemas:`);
    const schemasCol = db.collection('discovered_schemas');
    const schemas = await schemasCol.find({}).sort({ created_at: -1 }).toArray();

    console.log(`Total schemas: ${schemas.length}\n`);

    for (const schema of schemas) {
      console.log(`Schema ID: ${schema._id}`);
      console.log(`  Data Source: ${schema.data_source_id}`);
      console.log(`  Fields: ${schema.fields?.length || 0}`);
      console.log(`  Created: ${schema.created_at}`);
      if (schema.fields && schema.fields.length > 0) {
        console.log(`  Sample fields:`);
        schema.fields.slice(0, 3).forEach((field) => {
          console.log(`    - ${field.name} (${field.type})`);
        });
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAttributes();
