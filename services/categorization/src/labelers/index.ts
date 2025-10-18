import { ILabeler, LabelerFactory } from './interface';
import { RuleBasedLabeler } from './rule_based';
import { ExternalDbLabeler } from './external_db';
import { MLLabeler } from './ml';
import { UserLabeler } from './user';

export class LabelerRegistry {
  private labelers: Map<string, LabelerFactory> = new Map();

  constructor() {
    this.registerBuiltInLabelers();
  }

  private registerBuiltInLabelers(): void {
    this.register('rule_based', (_) => new RuleBasedLabeler());
    this.register('external_db', (_) => new ExternalDbLabeler());
    this.register('ml', (_) => new MLLabeler());
    this.register('user', (_) => new UserLabeler());
  }

  register(name: string, factory: LabelerFactory): void {
    this.labelers.set(name, factory);
  }

  create(name: string, args: any): ILabeler {
    const factory = this.labelers.get(name);
    if (!factory) {
      throw new Error(`Unknown labeler: ${name}`);
    }
    return factory(args);
  }

  getAvailableLabelers(): string[] {
    return Array.from(this.labelers.keys());
  }
}

export * from './interface';
export * from './rule_based';
export * from './external_db';
export * from './ml';
export * from './user';
