# CLAUDE.md — `camircode/twofree-packages`

Six packages, published to GitHub Packages as `@camircode/twofree-{core,
database,auth,data-provider,application,ui}`. Everything here was lifted out of
the `camircode/2free` pnpm monorepo; `twofree-api`, `twofree-web` and the desktop
app in `2free` consume it as ordinary published dependencies. (`twofree-landing`
does not — it has no `@camircode` dependency and no scope mapping in its
`.npmrc`.)

This repository is the **upstream of the whole product**. Nothing downstream can
use a change here until it is published.

---

## 1. The cost of the split — read this before editing any `packages/*/src`

Inside the old monorepo, `workspace:*` meant a consumer saw your edit the moment
you saved. It does not any more. A change here reaches a consumer only by:

1. Bumping the version in **every** `packages/*/package.json` (they release as a
   set — `pnpm -r publish` publishes all six from one tag).
2. Pushing a `v*` tag, which runs `.github/workflows/publish.yml`.
3. The consumer bumping its `^0.1.x` range and reinstalling.

A consumer that bumps to a version that is not published yet does not fail with
a helpful message: it fails in the `deps` stage of its Docker build, as a
resolver error about a tarball, minutes into a Jenkins run.

`workspace:*` in the internal dependencies (`database` → `core`, `auth` →
`database`, `application` → `auth`, `ui` → `core`) is **not** a leftover. pnpm
rewrites those to the concrete version at publish time. Do not "fix" them into
literal versions.

There is no consumer-side integration test here. The only thing that proves a
published tarball is usable is a consumer's build — so a change to an `exports`
map, the `files` array or an emitted path is discovered downstream, or not at
all.

## 2. `@camircode/twofree-database` ships no client

Prisma 7's `prisma-client` generator emits **TypeScript**, not JavaScript, so a
generated client cannot ride inside a package consumed as plain ESM. The `files`
array therefore reads `["dist", "!dist/generated", "prisma",
"prisma.config.ts"]`: the tarball carries `prisma/schema.prisma` and
`prisma/migrations/**`, and every consumer runs `prisma generate` and then
compiles or bundles the result itself.

Consequences you have to hold in mind when editing this package:

- `exports["./generated/client"]` points at `./dist/generated/client/client.js`,
  a path that **does not exist in the published tarball**. That is intentional.
- The generator `output` in `prisma/schema.prisma` is `../src/generated/client`,
  resolved relative to the schema — that is, relative to *the consumer's copy of
  the package*, not to this checkout. Changing that path breaks
  `twofree-api/scripts/prisma-client.mjs`, which spawns `prisma generate` with
  `cwd` set to the installed package root.
- Adding a migration means adding a directory under `prisma/migrations/`. It
  ships as data; nothing here applies it. The migrate image in `twofree-api`
  does, and it refuses a database that `classifyDatabaseState` calls `partial`
  or `drift`. Keep `inspectDatabase`, `classifyDatabaseState` and
  `assertMigrationPreflight` exported — `twofree-api/scripts/migrate.mjs`
  imports them precisely so the safety rule lives in one place.

## 3. `moduleResolution: Bundler`, deliberately

`tsconfig.base.json` says `NodeNext`; every `packages/*/tsconfig.json` overrides
it with `module: ESNext` + `moduleResolution: Bundler`. Do not "align" them.

`decimal.js` (a dependency of `core`) publishes one `decimal.d.ts` behind both
the `import` and `require` conditions, and that file is CJS-shaped
(`export default Decimal` plus `export declare function Decimal(...)` — a value
and a type of the same name). Under `NodeNext` that resolves as an ESM
declaration file and typechecking fails on the call signature. `Bundler` is what
makes it resolve the way esbuild, Vite and Next actually load it.

## 4. `tsc` emits JS and `.d.ts` only

Anything else that has to reach `dist/` is copied by `scripts/copy-static.mjs`,
invoked from the package's own `build` script: `.sql` for `data-provider`,
`.css` and `.svg` for `ui`. If you add a stylesheet, an asset or a runtime SQL
file and do not extend that call, the build succeeds and the package ships
without it — the failure surfaces as a 404 or an `ENOENT` in a consumer.

For the same reason, `@/` alias imports in `src/` were rewritten as relative
specifiers: `tsc` does not rewrite path aliases on emit. Do not reintroduce them
in emitted source. (Tests still use `@/`; tests are not emitted.)

## 5. `RuntimeProfile` — two declarations that must be edited together

`packages/application/src/config.ts` declares the union `RuntimeProfile` and the
runtime guard array `runtimeProfiles` separately. The array is typed
`readonly RuntimeProfile[]`, which catches an array entry that is *not* in the
union — but **not** a union member missing from the array. Add a profile to one
and forget the other and `loadRuntimeConfig` rejects a value the type system
says is valid, at container start, as `APP_PROFILE is not supported`. Edit both,
in the same change.

## 6. Working here

```sh
pnpm install
pnpm check     # format:check, lint, build, typecheck, test — what CI runs
```

`pretypecheck` and `pretest` both run `db:generate` first: the database package
does not typecheck or test without a generated client, and the generated
directory is gitignored.

`.github/workflows/quality.yml` (push to `main`, and PRs) and `publish.yml`
(`v*` tags) both install with `--frozen-lockfile`. `pnpm-lock.yaml` is committed
here — this repository depends on nothing private, so it resolves. Any manifest
change must commit the regenerated lockfile in the same commit or CI stops at
the install step.

`pnpm-workspace.yaml` carries an explicit `allowBuilds` allow-list
(`@prisma/engines`, `esbuild`, `prisma`); everything else installs as inert
files, so a compromised transitive dependency cannot execute during
`pnpm install`. Adding a dependency with a postinstall script means deciding in
writing that it may run.

## 7. Rules from the platform that reach this repository

- Secrets come from **Bitwarden Secrets Manager** — never in this repository,
  never on a command line (shell history, and `ps`). Publishing uses the
  workflow's own `GITHUB_TOKEN`; nothing else here needs a credential.
- The npm scope must stay `@camircode`: GitHub Packages requires the scope to
  match the repository owner.
- Infrastructure changes belong in `/home/camir/Desarrollo/infrastructure`.
