/**
 * KQL-like Query Parser for Rule Engine
 * Simplified version from backend queryParser.ts
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
  type: 'AND' | 'OR' | 'NOT' | 'FIELD_MATCH';
  field?: string;
  value?: string;
  children?: ASTNode[];
}

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < query.length) {
    // Skip whitespace
    if (/\s/.test(query[i])) {
      i++;
      continue;
    }

    // Parentheses
    if (query[i] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: i });
      i++;
      continue;
    }
    if (query[i] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: i });
      i++;
      continue;
    }

    // Colon
    if (query[i] === ':') {
      tokens.push({ type: 'COLON', value: ':', position: i });
      i++;
      continue;
    }

    // Quoted string
    if (query[i] === '"') {
      let value = '';
      i++; // Skip opening quote
      while (i < query.length && query[i] !== '"') {
        value += query[i];
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ type: 'QUOTED', value, position: i });
      continue;
    }

    // Range [value TO value]
    if (query[i] === '[') {
      let value = '';
      while (i < query.length && query[i] !== ']') {
        value += query[i];
        i++;
      }
      value += query[i]; // Include ]
      i++;
      tokens.push({ type: 'RANGE', value, position: i });
      continue;
    }

    // Field or operator
    let value = '';
    while (i < query.length && !/[\s():"]/.test(query[i])) {
      value += query[i];
      i++;
    }

    if (value === 'AND' || value === 'OR' || value === 'NOT') {
      tokens.push({ type: 'OPERATOR', value, position: i });
    } else {
      tokens.push({ type: 'FIELD', value, position: i });
    }
  }

  return tokens;
}

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

function mapFieldToMongoPath(field: string): string {
  // Common fields are stored in payload
  const payloadFields = ['@ts', 'severity', 'event_type', 'host', 'user', 'service', 'message'];

  if (payloadFields.includes(field)) {
    return `payload.${field}`;
  }

  // If field already has payload prefix, return as-is
  if (field.startsWith('payload.')) {
    return field;
  }

  // Otherwise, assume it's in payload
  return `payload.${field}`;
}

function parseTimeRange(rangeStr: string): any {
  // Remove brackets
  const content = rangeStr.slice(1, -1);
  const parts = content.split(' TO ');

  if (parts.length !== 2) {
    throw new Error('Invalid time range format');
  }

  const from = parseTimeValue(parts[0].trim());
  const to = parseTimeValue(parts[1].trim());

  if (!from || !to) {
    throw new Error('Invalid time range values');
  }

  return {
    $gte: from,
    $lte: to,
  };
}

function parseTimeValue(value: string): string | null {
  if (value === 'now') {
    return new Date().toISOString();
  }

  // Parse relative time: now-1h, now-30m, now-7d
  const relativeMatch = value.match(/^now-(\d+)([mhd])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];

    const now = new Date();
    let ms = 0;

    switch (unit) {
      case 'm':
        ms = amount * 60 * 1000;
        break;
      case 'h':
        ms = amount * 60 * 60 * 1000;
        break;
      case 'd':
        ms = amount * 24 * 60 * 60 * 1000;
        break;
    }

    return new Date(now.getTime() - ms).toISOString();
  }

  // Try parsing as ISO date
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function compileToMongo(ast: ASTNode): MongoFilter {
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

export function parseKQLQuery(query: string): MongoFilter {
  if (!query || query.trim() === '') {
    return {};
  }

  try {
    const tokens = tokenize(query);
    const ast = parse(tokens);
    return compileToMongo(ast);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Query parse error: ${error.message}`);
    }
    throw error;
  }
}
