# twofree-packages

Shared TypeScript packages extracted from the [2free](https://github.com/camircode/2free)
monorepo and published to GitHub Packages under the `@camircode` scope.

| Package                            | Purpose                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `@camircode/twofree-core`          | Money, account, transaction and privacy domain primitives.                      |
| `@camircode/twofree-data-provider` | Finance/product provider ports plus in-memory, browser and PostgreSQL adapters. |
| `@camircode/twofree-database`      | Prisma schema, migrations and the Prisma-backed providers.                      |
| `@camircode/twofree-auth`          | Better Auth configuration and the core auth factory.                            |
| `@camircode/twofree-application`   | Runtime configuration and the application use-case layer.                       |
| `@camircode/twofree-ui`            | React components, tokens, stylesheets and branding assets.                      |

## Local development

```sh
pnpm install
pnpm -r build
pnpm -r test
```

`pnpm check` runs the full gate: formatting, lint, build, typecheck and tests.

## Consuming the database package

The Prisma client is generated code that tracks the consumer's own Prisma version and
runtime, so it is deliberately **not** published. The tarball ships `prisma/schema.prisma`,
`prisma/migrations/**` and `prisma.config.ts`; the consumer runs `prisma generate` during
its own build — the same step the 2free Dockerfiles already perform — before compiling or
bundling anything that imports `@camircode/twofree-database`.

## Publishing

Pushing a `v*` tag runs `.github/workflows/publish.yml`, which builds, tests and publishes
every package to `https://npm.pkg.github.com` using the workflow's `GITHUB_TOKEN`. The npm
scope must stay `@camircode` because GitHub Packages requires the scope to match the
repository owner.
