import { ActionPlugin, EvaluationContext } from '../types/policy';
import { IndexEsPlugin } from './index-es.plugin';
import { WebhookPlugin } from './webhook.plugin';

export class PluginRegistry {
  private plugins: Map<string, ActionPlugin> = new Map();

  constructor(elasticsearchUrl: string) {
    // Register built-in plugins
    this.register(new IndexEsPlugin(elasticsearchUrl));
    this.register(new WebhookPlugin());
  }

  register(plugin: ActionPlugin): void {
    this.plugins.set(plugin.name, plugin);
    console.log(`Registered plugin: ${plugin.name}`);
  }

  async execute(pluginName: string, context: EvaluationContext, params: any): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    await plugin.execute(context, params);
  }

  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  list(): string[] {
    return Array.from(this.plugins.keys());
  }
}

