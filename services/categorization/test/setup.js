'use strict';
beforeAll(() => {
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['BYPASS_AUTH'] = 'true';
});
afterAll(() => {});
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
//# sourceMappingURL=setup.js.map
