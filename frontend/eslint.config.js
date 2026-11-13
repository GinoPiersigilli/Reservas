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
    // Módulos de lógica (.js): mismos límites que el backend.
    files: ['src/**/*.js'],
    ignores: ['src/**/__tests__/**'],
    rules: {
      complexity: ['error', 12],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    // Componentes (.jsx): la complejidad ciclomática cuenta cada condicional
    // del JSX, así que para ellos se limita el tamaño y el anidamiento, que es
    // lo que de verdad señala un componente que hace demasiadas cosas.
    // El razonamiento está en docs/CALIDAD.md.
    files: ['src/**/*.jsx'],
    ignores: ['src/**/__tests__/**', 'src/test-utils.jsx'],
    rules: {
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true }]
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
