module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.spec.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup-env.js"],
  testTimeout: 60000,

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

    // لو عندك Utils أو Jobs خارج نطاق الاختبار (أضفها هنا)
    "!utils/**",
    "!jobs/**",
  ],

  // تجاهل مسارات من الحساب (احتياطي)
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/tests/",
    "<rootDir>/app.js",
    "<rootDir>/server.js",
    "<rootDir>/utils/",
    "<rootDir>/jobs/",
  ],

  /**
   * 🎯 عتبات مرحلية (تحت النتائج الحالية بقليل حتى يمرّ الـ CI الآن):
   * - statements ~38.48% → نضبط 38
   * - branches   ~20.75% → نضبط 20
   * - functions  ~22.83% → نضبط 22
   * - lines      ~40.65% → نضبط 40
   *
   * لاحقًا نرفعها تدريجيًا مع إضافة اختبارات جديدة.
   */
  coverageThreshold: {
    global: {
      statements: 38,
      branches: 20,
      functions: 22,
      lines: 40,
    },
  },
};
