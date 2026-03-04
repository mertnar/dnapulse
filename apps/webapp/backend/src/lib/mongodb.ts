import { MongoClient, Db, Collection, Document } from 'mongodb';

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
    // Use URL parsing to extract and re-encode credentials
    const urlPattern = /^(mongodb(\+srv)?:\/\/)([^@]+)@(.+)$/;
    const match = MONGO_URL.match(urlPattern);

    if (match) {
      const [, protocol, , credentials, rest] = match;
      const [username, password] = credentials.split(':');

      if (username && password) {
        // Decode first in case it's already encoded, then re-encode
        const decodedUsername = decodeURIComponent(username);
        const decodedPassword = decodeURIComponent(password);
        const encodedUsername = encodeURIComponent(decodedUsername);
        const encodedPassword = encodeURIComponent(decodedPassword);
        MONGO_URL = `${protocol}${encodedUsername}:${encodedPassword}@${rest}`;
      }
    }
  } catch (e) {
    // If parsing fails, try to encode the entire credentials part
    const urlPattern = /^(mongodb(\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/;
    const match = MONGO_URL.match(urlPattern);
    if (match) {
      const [, protocol, , username, password, rest] = match;
      const encodedUsername = encodeURIComponent(username);
      const encodedPassword = encodeURIComponent(password);
      MONGO_URL = `${protocol}${encodedUsername}:${encodedPassword}@${rest}`;
    }
  }
}

const DB_NAME = process.env.MONGO_DB_NAME || 'dna-pulse';

let client: MongoClient | null = null;
let db: Db | null = null;

// Extract database name from connection string if not explicitly provided
function getDatabaseName(): string {
  // If DB_NAME is explicitly set, use it
  if (process.env.MONGO_DB_NAME) {
    return process.env.MONGO_DB_NAME;
  }

  // Try to extract from connection string
  const urlMatch = MONGO_URL.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/);
  if (urlMatch && urlMatch[2]) {
    return urlMatch[2];
  }

  // Default fallback
  return 'dna-pulse';
}

export async function connectDB(): Promise<Db> {
  if (db && client) {
    return db;
  }

  try {
    client = new MongoClient(MONGO_URL);
    await client.connect();
    const databaseName = getDatabaseName();
    db = client.db(databaseName);
    console.log(`Connected to MongoDB: ${databaseName}`);
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function getCollection<T extends Document = Document>(
  name: string
): Promise<Collection<T>> {
  const database = await connectDB();
  return database.collection<T>(name);
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}

// Collection names
export const Collections = {
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  API_KEYS: 'api_keys',
  AGENT_TYPES: 'agent_types',
  AGENTS: 'agents',
  DATA_SOURCES: 'data_sources',
  DISCOVERED_SCHEMAS: 'discovered_schemas',
  EVENTS: 'events',
  RULES: 'rules',
  ALERTS: 'alerts',
  INVESTIGATIONS: 'investigations',
  INVESTIGATION_NOTES: 'investigation_notes',
  DATA_MODELS: 'data_models',
  DATA_MODEL_ATTRIBUTES: 'data_model_attributes',
  DATA_MODEL_PIPELINES: 'data_model_pipelines',
  ML_MODELS: 'ml_models',
  LIFECYCLE_POLICIES: 'lifecycle_policies',
  ROLES: 'roles',
  AUDIT_LOGS: 'audit_logs',
  LIVE_MONITOR_VIEWS: 'live_monitor_views',
};
