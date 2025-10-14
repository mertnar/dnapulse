// Test setup file
import { register } from 'prom-client';

// Clear metrics registry before each test
beforeEach(() => {
  register.clear();
});
