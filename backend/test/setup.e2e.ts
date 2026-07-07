
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  "postgresql://hypertube_test:hypertube_test_secret@localhost:5433/hypertube_test";
