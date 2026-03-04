/**
 * KQL-like Query Parser for Live Monitor
 *
 * Supports:
 * - Field matching: severity:high, host:web-*
 * - Boolean operators: AND, OR, NOT
 * - Parentheses for grouping
 * - Quoted values: message:"user login"
 * - Time ranges: @ts:[now-1h TO now]
 */

export interface MongoFilter {
  [key: string]: any;
}

interface Token {
  type: 'FIELD' | 'OPERATOR' | 'VALUE' | 'LPAREN' | 'RPAREN' | 'COLON' | 'QUOTED' | 'RANGE';
  value: string;
  position: number;
}

interface ASTNode {
  type: 'FIELD_MATCH' | 'AND' | 'OR' | 'NOT';
  field?: string;
  value?: string;
  children?: ASTNode[];
}

const OPERATORS = ['AND', 'OR', 'NOT'];
const RESERVED_KEYWORDS = [...OPERATORS, 'TO'];

/**
 * Tokenize the query string
 */
function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: i });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: i });
      i++;
      continue;
    }

    // Colon
    if (char === ':') {
      tokens.push({ type: 'COLON', value: ':', position: i });
      i++;
      continue;
    }

    // Quoted string
    if (char === '"') {
      let value = '';
      i++; // Skip opening quote
      while (i < query.length && query[i] !== '"') {
        if (query[i] === '\\' && i + 1 < query.length) {
          i++; // Skip escape character
        }
        value += query[i];
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ type: 'QUOTED', value, position: i - value.length - 2 });
      continue;
    }

    // Range bracket [now-1h TO now]
    if (char === '[') {
      let value = '';
      i++; // Skip opening bracket
      while (i < query.length && query[i] !== ']') {
        value += query[i];
        i++;
      }
      i++; // Skip closing bracket
      tokens.push({ type: 'RANGE', value, position: i - value.length - 2 });
      continue;
    }

    // Regular word (field name, value, or operator)
    if (/[a-zA-Z0-9_@.*-]/.test(char)) {
      let value = '';
      const startPos = i;
      while (i < query.length && /[a-zA-Z0-9_@.*-]/.test(query[i])) {
        value += query[i];
        i++;
      }

      // Check if it's an operator
      if (OPERATORS.includes(value.toUpperCase())) {
        tokens.push({ type: 'OPERATOR', value: value.toUpperCase(), position: startPos });
      } else {
        tokens.push({ type: 'FIELD', value, position: startPos });
      }
      continue;
    }

    // Unknown character - skip
    i++;
  }

  return tokens;
}

/**
 * Parse tokens into AST
 */
function parse(tokens: Token[]): ASTNode {
  let position = 0;

  function parseExpression(): ASTNode {
    let left = parseTerm();

    while (position < tokens.length) {
      const token = tokens[position];

      if (token.type === 'OPERATOR' && (token.value === 'OR' || token.value === 'AND')) {
        position++;
        const right = parseTerm();
        left = {
          type: token.value as 'AND' | 'OR',
          children: [left, right],
        };
      } else {
        break;
      }
    }

    return left;
  }

  function parseTerm(): ASTNode {
    const token = tokens[position];

    // NOT operator
    if (token && token.type === 'OPERATOR' && token.value === 'NOT') {
      position++;
      const child = parseTerm();
      return {
        type: 'NOT',
        children: [child],
      };
    }

    // Parentheses
    if (token && token.type === 'LPAREN') {
      position++; // Skip (
      const expr = parseExpression();
      position++; // Skip )
      return expr;
    }

    // Field match: field:value
    if (token && token.type === 'FIELD') {
      const field = token.value;
      position++;

      const colonToken = tokens[position];
      if (colonToken && colonToken.type === 'COLON') {
        position++;
        const valueToken = tokens[position];

        if (valueToken) {
          let value = '';

          if (valueToken.type === 'QUOTED') {
            value = valueToken.value;
          } else if (valueToken.type === 'RANGE') {
            value = valueToken.value;
          } else if (valueToken.type === 'FIELD') {
            value = valueToken.value;
          }

          position++;

          return {
            type: 'FIELD_MATCH',
            field,
            value,
          };
        }
      }
    }

    throw new Error(
      `Unexpected token at position ${token?.position || position}: ${token?.value || 'EOF'}`
    );
  }

  if (tokens.length === 0) {
    return { type: 'AND', children: [] };
  }

  return parseExpression();
}

/**
 * Parse time range like "now-1h TO now"
 */
function parseTimeRange(rangeStr: string): { $gte?: string; $lte?: string } {
  const parts = rangeStr.split(/\s+TO\s+/i);
  if (parts.length !== 2) {
    throw new Error('Invalid range format. Expected: [start TO end]');
  }

  const start = parseTimeValue(parts[0].trim());
  const end = parseTimeValue(parts[1].trim());

  const result: { $gte?: string; $lte?: string } = {};
  if (start) result.$gte = start;
  if (end) result.$lte = end;

  return result;
}

/**
 * Parse time value like "now-1h", "now", or ISO timestamp
 */
function parseTimeValue(value: string): string | null {
  if (value === 'now') {
    return new Date().toISOString();
  }

  // Match patterns like "now-1h", "now-30m", "now-1d"
  const match = value.match(/^now-(\d+)([smhd])$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 's': // seconds
        now.setSeconds(now.getSeconds() - amount);
        break;
      case 'm': // minutes
        now.setMinutes(now.getMinutes() - amount);
        break;
      case 'h': // hours
        now.setHours(now.getHours() - amount);
        break;
      case 'd': // days
        now.setDate(now.getDate() - amount);
        break;
    }

    return now.toISOString();
  }

  // Try to parse as ISO timestamp
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

/**
 * Compile AST to MongoDB filter
 */
function compileToMongo(ast: ASTNode, allowedFields: string[]): MongoFilter {
  function compile(node: ASTNode): MongoFilter {
    switch (node.type) {
      case 'AND':
        if (!node.children || node.children.length === 0) {
          return {};
        }
        if (node.children.length === 1) {
          return compile(node.children[0]);
        }
        return { $and: node.children.map(compile) };

      case 'OR':
        if (!node.children || node.children.length === 0) {
          return {};
        }
        if (node.children.length === 1) {
          return compile(node.children[0]);
        }
        return { $or: node.children.map(compile) };

      case 'NOT':
        if (!node.children || node.children.length === 0) {
          return {};
        }
        return { $nor: [compile(node.children[0])] };

      case 'FIELD_MATCH':
        if (!node.field || !node.value) {
          return {};
        }

        // Map user-friendly field names to MongoDB paths
        let mongoField = mapFieldToMongoPath(node.field);

        // Validate field is allowed
        if (allowedFields.length > 0 && !isFieldAllowed(node.field, allowedFields)) {
          throw new Error(`Field "${node.field}" is not allowed`);
        }

        // Handle time range for @ts field
        if (node.field === '@ts' && node.value.includes('TO')) {
          const range = parseTimeRange(node.value);
          return { [mongoField]: range };
        }

        // Handle wildcard (*)
        if (node.value.includes('*')) {
          const pattern = node.value.replace(/\*/g, '.*');
          return { [mongoField]: { $regex: `^${pattern}$`, $options: 'i' } };
        }

        // Exact match
        return { [mongoField]: node.value };

      default:
        return {};
    }
  }

  return compile(ast);
}

/**
 * Map user-friendly field names to MongoDB document paths
 */
function mapFieldToMongoPath(field: string): string {
  // Common fields are stored in payload
  const payloadFields = [
    '@ts',
    'severity',
    'event_type',
    'host',
    'user',
    'service',
    'message',
    'level',
    'status',
    'ip_address',
    'port',
    'protocol',
    'process_name',
    'file_path',
    'url',
    'method',
    'status_code',
  ];

  if (payloadFields.includes(field)) {
    return `payload.${field}`;
  }

  // Top-level fields
  const topLevelFields = [
    'organization_id',
    'data_source_id',
    'agent_id',
    'tenant_id',
    'type',
    'source',
  ];
  if (topLevelFields.includes(field)) {
    return field;
  }

  // Default: assume it's in payload
  return `payload.${field}`;
}

/**
 * Check if a field is in the allowed list
 */
function isFieldAllowed(field: string, allowedFields: string[]): boolean {
  if (allowedFields.length === 0) {
    return true; // No restrictions
  }

  // Check exact match or prefix match (for nested fields)
  return allowedFields.some((allowed) => field === allowed || field.startsWith(allowed + '.'));
}

/**
 * Main export: Parse KQL query and return MongoDB filter
 */
export function parseKQLQuery(query: string, allowedFields: string[] = []): MongoFilter {
  if (!query || query.trim() === '') {
    return {};
  }

  try {
    const tokens = tokenize(query);
    const ast = parse(tokens);
    return compileToMongo(ast, allowedFields);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Query parse error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get allowed fields from discovered schemas
 */
export function getAllowedFieldsFromSchema(schemaFields: any[]): string[] {
  const fields = [
    // Always allowed common fields
    '@ts',
    'severity',
    'event_type',
    'host',
    'user',
    'service',
    'organization_id',
    'data_source_id',
    'agent_id',
    'tenant_id',
  ];

  // Add fields from schema
  if (schemaFields && Array.isArray(schemaFields)) {
    schemaFields.forEach((field) => {
      if (field.name) {
        fields.push(field.name);
      }
    });
  }

  return fields;
}
