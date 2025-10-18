import { ILabeler } from './interface';
import { Item, AppliedLabel, ExternalDbArgs } from '../model';

export class ExternalDbLabeler implements ILabeler {
  name(): string {
    return 'external_db';
  }

  async apply(item: Item, args: ExternalDbArgs): Promise<AppliedLabel[]> {
    // Mock implementation - in real scenario, this would query external database
    const results: AppliedLabel[] = [];

    try {
      // Extract lookup value from item
      const lookupValue = this.getNestedValue(item, args.lookup_by);

      if (!lookupValue) {
        return results;
      }

      // Mock database lookup
      const mockResults = await this.mockDbLookup(args.table, lookupValue);

      for (const result of mockResults) {
        results.push({
          kind: 'category',
          name: result.label,
          score: result.confidence || 0.8,
          meta: {
            source: 'external_db',
            table: args.table,
            lookup_field: args.lookup_by,
            lookup_value: lookupValue,
          },
        });
      }
    } catch (error) {
      console.warn('External DB lookup failed', error);
    }

    return results;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async mockDbLookup(
    table: string,
    _value: string
  ): Promise<Array<{ label: string; confidence?: number }>> {
    // Mock implementation
    const mockData: Record<string, Array<{ label: string; confidence?: number }>> = {
      assets: [
        { label: 'production', confidence: 0.9 },
        { label: 'critical', confidence: 0.8 },
      ],
      services: [
        { label: 'microservice', confidence: 0.85 },
        { label: 'api', confidence: 0.7 },
      ],
      hosts: [
        { label: 'server', confidence: 0.9 },
        { label: 'database', confidence: 0.8 },
      ],
    };

    // Simulate async database call
    await new Promise((resolve) => setTimeout(resolve, 10));

    return mockData[table] || [];
  }
}
