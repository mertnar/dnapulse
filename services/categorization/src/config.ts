export interface Config {
  port: number;
  host: string;
  busBroker: string;
  inputTopic: string;
  outputTopic: string;
  configUrl: string;
  configScope: string;
  configSseUrl: string;
  nodeEnv: string;
}

export const config: Config = {
  port: parseInt(process.env['PORT'] || '8080', 10),
  host: process.env['HOST'] || '0.0.0.0',
  busBroker: process.env['BUS_BROKER'] || 'localhost:9092',
  inputTopic: process.env['INPUT_TOPIC'] || 'processing.cleaned.v1',
  outputTopic: process.env['OUTPUT_TOPIC'] || 'categorization.labeled.v1',
  configUrl: process.env['CONFIG_URL'] || 'http://localhost:8080',
  configScope: process.env['CONFIG_SCOPE'] || 'categorization',
  configSseUrl: process.env['CONFIG_SSE_URL'] || 'http://localhost:8080',
  nodeEnv: process.env['NODE_ENV'] || 'development',
};
