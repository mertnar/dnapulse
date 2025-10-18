// Test setup file

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['BYPASS_AUTH'] = 'true';
});

afterAll(() => {
  // Cleanup after all tests
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
