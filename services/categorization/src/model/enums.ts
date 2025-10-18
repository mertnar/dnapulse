export enum ItemType {
  LOG = 'log',
  METRIC = 'metric',
  EVENT = 'event',
  TRACE = 'trace',
}

export enum Cardinality {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_ONE = 'many_to_one',
  MANY_TO_MANY = 'many_to_many',
}

export enum LabelerType {
  RULE_BASED = 'rule_based',
  EXTERNAL_DB = 'external_db',
  ML = 'ml',
  USER = 'user',
}

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}
