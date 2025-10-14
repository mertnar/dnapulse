export const config = {
  port: parseInt(process.env['PORT'] || '8080', 10),
  host: process.env['HOST'] || '0.0.0.0',
  mongoUrl:
    process.env['MONGO_URL'] || 'mongodb://admin:admin123@mongodb:27017/dna?authSource=admin',
  nodeEnv: process.env['NODE_ENV'] || 'development',
  logLevel: process.env['LOG_LEVEL'] || 'info',
  metricsPort: parseInt(process.env['METRICS_PORT'] || '8081', 10),

  // Config service specific
  collectionName: 'configs',
  maxConfigSize: parseInt(process.env['MAX_CONFIG_SIZE'] || '1048576', 10), // 1MB
  cacheTtl: parseInt(process.env['CACHE_TTL'] || '300', 10), // 5 minutes

  // SSE settings
  sseHeartbeatInterval: parseInt(process.env['SSE_HEARTBEAT_INTERVAL'] || '30000', 10), // 30 seconds
  sseMaxClients: parseInt(process.env['SSE_MAX_CLIENTS'] || '100', 10),

  // Validation settings
  strictValidation: process.env['STRICT_VALIDATION'] === 'true',
  allowUnknownFields: process.env['ALLOW_UNKNOWN_FIELDS'] !== 'false',
};
