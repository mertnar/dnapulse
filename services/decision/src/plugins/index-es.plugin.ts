import axios from 'axios';
import { ActionPlugin, EvaluationContext } from '../types/policy';

export class IndexEsPlugin implements ActionPlugin {
  name = 'index-es';
  private elasticsearchUrl: string;

  constructor(elasticsearchUrl: string) {
    this.elasticsearchUrl = elasticsearchUrl;
  }

  async execute(context: EvaluationContext, params: any): Promise<void> {
    const index = params.index || 'alerts';
    const docId = params.id;

    try {
      // Prepare document for indexing
      const document = {
        timestamp: new Date().toISOString(),
        type: context.type,
        payload: context.payload,
        attributes: context.attributes || {},
        event_ts: context.ts,
      };

      // Use bulk API if specified, otherwise use single document index
      if (params.bulk) {
        await this.bulkIndex(index, document, docId);
      } else {
        await this.indexDocument(index, document, docId);
      }

      console.log(`Successfully indexed document to ${index}`);
    } catch (error) {
      console.error(`Failed to index to Elasticsearch: ${error}`);
      throw error;
    }
  }

  private async indexDocument(index: string, document: any, docId?: string): Promise<void> {
    const url = docId
      ? `${this.elasticsearchUrl}/${index}/_doc/${docId}`
      : `${this.elasticsearchUrl}/${index}/_doc`;

    const method = docId ? 'PUT' : 'POST';

    await axios({
      method,
      url,
      data: document,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async bulkIndex(index: string, document: any, docId?: string): Promise<void> {
    const action = docId ? { index: { _index: index, _id: docId } } : { index: { _index: index } };

    const bulkBody = [action, document].map((item) => JSON.stringify(item)).join('\n') + '\n';

    await axios.post(`${this.elasticsearchUrl}/_bulk`, bulkBody, {
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
    });
  }
}
