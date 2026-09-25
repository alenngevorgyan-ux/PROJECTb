/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel serverless entry point. Deliberately plain .mjs (not TypeScript):
 * Vercel's Node builder transpiles .ts function files per-file via tsc
 * without rewriting extensionless relative import specifiers, and plain
 * Node's ESM loader (unlike tsx/esbuild) does zero extension inference —
 * so a transpiled server.ts full of `from '../config'`-style imports
 * fails at runtime, and `../server` in particular resolves to the
 * `server/` directory instead of `server.ts` and throws
 * ERR_UNSUPPORTED_DIR_IMPORT.
 *
 * The fix: `npm run build:api` (see vercel.json's buildCommand) uses
 * esbuild — which DOES do proper extension/directory resolution — to
 * bundle server.ts and its entire local module graph into this single
 * ./_app.mjs file ahead of time, leaving only real npm package imports
 * (express, cors, @upstash/redis, etc.) for Node to resolve normally from
 * node_modules at runtime. This file just re-exports that bundle's
 * Express app — Vercel's Node.js runtime accepts a plain Express app as
 * a request handler directly.
 *
 * `_app.mjs` is a build artifact (gitignored, regenerated on every
 * deploy) — do not hand-edit it. Files prefixed with `_` are excluded
 * from Vercel's automatic /api route detection, so this is the only
 * function Vercel creates from this directory.
 */

import { createApp } from './_app.mjs';

export default createApp();
