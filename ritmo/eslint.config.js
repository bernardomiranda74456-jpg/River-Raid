// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['scripts/*', 'dist/*', '.expo/*', '.expo-export-check/*', 'node_modules/*', 'supabase/.temp/*'],
  },
]);
