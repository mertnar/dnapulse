import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { FastifyLoggerInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export class SchemaService {
  private ajv: Ajv;
  private schemas: Map<string, any> = new Map();
  private logger: FastifyLoggerInstance | Console;

  constructor(logger?: FastifyLoggerInstance) {
    this.logger = logger || console;
    this.ajv = new Ajv({
      allErrors: true,
      strict: config.strictValidation,
      allowUnionTypes: true,
    });
    addFormats(this.ajv);

    this.loadSchemas();
  }

  private loadSchemas(): void {
    try {
      const schemasDir = path.join(process.cwd(), '..', '..', 'contracts', 'schemas');

      if (!fs.existsSync(schemasDir)) {
        this.logger.warn('Schemas directory not found, validation will be skipped');
        return;
      }

      const schemaFiles = fs
        .readdirSync(schemasDir)
        .filter((file) => file.endsWith('.schema.json'));

      for (const file of schemaFiles) {
        try {
          const schemaPath = path.join(schemasDir, file);
          const schemaContent = fs.readFileSync(schemaPath, 'utf8');
          const schema = JSON.parse(schemaContent);

          // Extract scope from filename (e.g., processing.rules.schema.json -> processing)
          const scope = file.split('.')[0];

          if (!scope) {
            throw new Error(`Invalid schema filename: ${file}`);
          }

          // Compile schema
          this.ajv.addSchema(schema, scope);
          this.schemas.set(scope, schema);

          this.logger.info(`Loaded schema for scope: ${scope}`);
        } catch (error) {
          this.logger.error(`Failed to load schema from ${file}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load schemas: ${error}`);
    }
  }

  async validateConfig(scope: string, config: any): Promise<void> {
    if (!this.schemas.has(scope)) {
      this.logger.warn(`No schema found for scope: ${scope}, skipping validation`);
      return;
    }

    const validate = this.ajv.getSchema(scope);

    if (!validate) {
      throw new Error(`Schema validation not available for scope: ${scope}`);
    }

    const isValid = validate(config);

    if (!isValid) {
      const errors = validate.errors || [];
      const errorMessages = errors
        .map((err) => `${err.instancePath || 'root'}: ${err.message}`)
        .join(', ');

      throw new Error(`Schema validation failed for scope ${scope}: ${errorMessages}`);
    }

    this.logger.debug(`Config validated successfully for scope: ${scope}`);
  }

  getAvailableSchemas(): string[] {
    return Array.from(this.schemas.keys()).sort();
  }

  getSchema(scope: string): any | undefined {
    return this.schemas.get(scope);
  }

  hasSchema(scope: string): boolean {
    return this.schemas.has(scope);
  }
}
