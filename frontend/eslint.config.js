import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dist-e2e']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    }
  },
  {
    // En componentes de presentación la longitud la domina el JSX, por lo que
    // se limita el anidamiento (que sí esconde errores) y se deja la
    // complejidad ciclomática medida y documentada en docs/CALIDAD.md.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/__tests__/**', 'src/test-utils.jsx'],
    rules: {
      'max-depth': ['error', 4]
    }
  },
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest
      }
    }
  }
]);
