module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs'
      }
    }],
  },
  moduleNameMapper: {
    '^node-fetch$': '<rootDir>/tests/mocks/node-fetch.ts',
    '^\.\/schemas\.js$': '<rootDir>/schemas.ts',
    '^\.\/customSchemas\.js$': '<rootDir>/customSchemas.ts',
    '^\.\.\/\.\.\/index\.js$': '<rootDir>/index.ts',
    '^\.\.\/server\/(.*)\.js$': '<rootDir>/tests/server/$1.ts',
    '^\./client\.js$': '<rootDir>/tests/server/clients/client.ts'
  },
  collectCoverageFrom: [
    'index.ts',
    'schemas.ts',
    'customSchemas.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [],
  testTimeout: 120000, // 2분으로 증가 (e2e 테스트용)
  verbose: true
};
