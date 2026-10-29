import path from 'node:path';

// Exercise the actual coverage loader: its scoped YAML override must preserve
// configuration loading, inheritance and option normalization.
const { loadNycConfig } = require('@istanbuljs/load-nyc-config');

test('coverage loader supports YAML configuration with the security override', async () => {
  const config = await loadNycConfig({
    cwd: path.resolve(__dirname, '..'),
    nycrcPath: path.resolve(__dirname, 'fixtures/nyc.yaml'),
  });
  expect(config).toMatchObject({
    include: ['src/**'],
    exclude: ['tests/**'],
    extension: ['.ts'],
    all: true,
    checkCoverage: false,
  });
});
