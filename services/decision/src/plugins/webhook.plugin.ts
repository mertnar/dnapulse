import axios from 'axios';
import { ActionPlugin, EvaluationContext } from '../types/policy';

export class WebhookPlugin implements ActionPlugin {
  name = 'webhook';

  async execute(context: EvaluationContext, params: any): Promise<void> {
    const url = params.url;
    const method = params.method || 'POST';
    const headers = params.headers || { 'Content-Type': 'application/json' };
    const timeout = params.timeout || 5000;

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    try {
      // Prepare webhook payload
      const payload = {
        timestamp: new Date().toISOString(),
        type: context.type,
        payload: context.payload,
        attributes: context.attributes || {},
        event_ts: context.ts,
        // Include custom data if provided
        ...(params.data || {}),
      };

      // Send webhook request
      const response = await axios({
        method: method as any,
        url,
        data: payload,
        headers,
        timeout,
      });

      console.log(`Webhook sent successfully to ${url}, status: ${response.status}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Webhook failed: ${error.message}, url: ${url}`);

        // Don't throw on webhook failures unless configured to do so
        if (params.failOnError) {
          throw error;
        }
      } else {
        console.error(`Webhook error: ${error}`);
        throw error;
      }
    }
  }
}
