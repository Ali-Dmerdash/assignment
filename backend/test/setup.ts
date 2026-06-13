// Runs before each test file (and before the modules under test are imported),
// so env-required modules (auth, upload) can load.
process.env.JWT_SECRET = "test-secret-key-for-jest-only";
process.env.UPLOAD_DIR = "test/uploads-tmp";
