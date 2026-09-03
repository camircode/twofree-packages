import { defineConfig } from "prisma/config";

const databaseURL = process.env.DATABASE_URL ?? "postgresql://2free:2free@127.0.0.1:5432/2free";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: databaseURL,
  },
});
