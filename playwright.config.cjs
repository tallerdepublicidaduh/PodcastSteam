const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e', workers: 1, timeout: 60000,
  reporter: 'list', use: { trace: 'retain-on-failure' }
});
