# Shared UI foundation

The public stylesheet is composed in `index.css` in this order: base tokens, semantic
themes, typography, accessibility foundation, statuses, reduced-motion overrides, and
then component styles. Consumers should select a theme with `data-theme="light"` or
`data-theme="dark"` on an application or package root.

## Visual tokens

`tokens.css` contains the supplied warm palette primitives (off-white, peach, olive,
mint, and terracotta), spacing, generous rounded radii, and light-default shadow and
transition values. `themes.css` maps those primitives to semantic surfaces, text,
accents, borders, focus rings, status colors, and explicit light/dark shadow values.
Do not use raw palette values in components when a semantic token is available.

Status components intentionally combine color with a visible Spanish label, symbol,
semantic role, and leading border so the state remains understandable without color.

## Typography assets

The package bundles Urbanist Variable and Open Sans Variable through Fontsource `5.3.0`.
Both families use the OFL-1.1 license and load from the installed package without remote
font requests. This keeps web, desktop, Android, and visual-test typography consistent
while preserving explicit readable system fallback stacks in `typography.css`.

## Branding

`src/assets/2free-con-fondi.svg` is the byte-identical package copy of the supplied
root logo and is exported at `@camircode/twofree-ui/assets/2free-con-fondi.svg`. Do not redraw,
optimize, reserialize, or replace the supplied SVG as part of a style change.
