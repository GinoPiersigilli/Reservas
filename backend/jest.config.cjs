module.exports = {
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.cjs',
  maxWorkers: 1
};
