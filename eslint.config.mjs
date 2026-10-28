import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const NEXT_SPECIAL_FILES = [
  'app/**/{page,layout,not-found,error,global-error,loading,template,default,route}.{ts,tsx}',
  'middleware.ts',
  '*.config.{ts,mjs,js}',
  '.dependency-cruiser.cjs',
  'prisma/**/*.ts',
  'tests/**/global-setup.ts',
];

const engineBans = [
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'Math.random is banned in lib/engine (engine.md 1.3). Use the seeded rng.',
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Date.now is banned in lib/engine (engine.md 1.3). Pass the clock in.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'new Date() without an argument is banned in lib/engine (engine.md 1.3).',
  },
  {
    selector: "MemberExpression[object.name='performance'][property.name='now']",
    message: 'performance.now is banned in lib/engine (engine.md 1.3).',
  },
];

const purityBans = ['react', 'react-dom', 'next', 'next/*', '@prisma/client', 'node:*'];

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'docs/**',
      'tests/fixtures/**',
      '.pgdata/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
    plugins: { import: importPlugin },
    rules: {
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: NEXT_SPECIAL_FILES,
    rules: { 'import/no-default-export': 'off' },
  },
  {
    files: ['scripts/**', 'prisma/**', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['lib/engine/**/*.{ts,tsx}'],
    ignores: ['lib/engine/io/**', 'lib/engine/testing/**'],
    rules: { 'no-restricted-syntax': ['error', ...engineBans] },
  },
  {
    files: ['lib/validation/**/*.ts'],
    ignores: ['lib/validation/client/**', 'lib/validation/server/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: purityBans }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
