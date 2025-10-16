// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.spec.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup-env.js"],

  // ⏱️ CI أبطأ: زودنا المهلة
  testTimeout: 90000,

  // ✅ تغطية
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "cobertura", "json-summary"],

  // 🔎 احسب التغطية لهذه المجلدات
  collectCoverageFrom: [
    "controllers/**/*.js",
    "models/**/*.js",
    "middleware/**/*.js",
    "routes/**/*.js",

    // ❌ استثناءات
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/*.spec.js",
    "!app.js",
    "!server.js",

    "!utils/**",
    "!jobs/**",
  ],

  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/tests/",
    "<rootDir>/app.js",
    "<rootDir>/server.js",
    "<rootDir>/utils/",
    "<rootDir>/jobs/",
  ],

  // 👇 العتبات الحالية (نرفعها تدريجيًا لاحقًا)
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 23,
      lines: 41,
      statements: 41,
    },
  },
};
