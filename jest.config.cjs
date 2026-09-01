/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@jadezhou/sticky-tab-view$': '<rootDir>/src/index.ts',
    '^@jadezhou/sticky-tab-view/scheduleOnReactNative$': '<rootDir>/src/scheduleOnReactNative.ts',
    '^react-native$': '<rootDir>/tests/mocks/react-native.tsx',
    '^react-native-gesture-handler$': '<rootDir>/tests/mocks/react-native-gesture-handler.tsx',
    '^react-native-reanimated$': '<rootDir>/tests/mocks/react-native-reanimated.tsx',
    '^react-native-safe-area-context$': '<rootDir>/tests/mocks/react-native-safe-area-context.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
