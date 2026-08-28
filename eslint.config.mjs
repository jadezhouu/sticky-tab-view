import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'example/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // These React Compiler checks treat Reanimated SharedValues and context
      // JSI handles as ordinary mutable React refs. This package does not use
      // the React Compiler, so retain rules-of-hooks/exhaustive-deps while
      // validating shared-value ownership with component and device tests.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
);
