/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production server startup smoke test. Boots the real Express app
 * (server.ts createApp()) on an OS-assigned ephemeral port — never a fixed
 * port, so this never conflicts with a developer's own `npm run dev`
 * server or with a concurrent CI job. Vite/static asset serving is
 * skipped entirely in test mode (see server.ts mountFrontend), so this
 * only exercises the API surface: health, Gmail status, and the
 * authentication boundary on Case endpoints.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../server.ts';

let server: Server;
let baseUrl: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Production server startup smoke test', () => {
  it('1. GET /api/health responds 200 with the expected schema', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'business-world');
    assert.ok(typeof body.timestamp === 'string');
  });

  it('2. GET /api/gmail/status responds with scopes and configured flag, no secrets', async () => {
    const res = await fetch(`${baseUrl}/api/gmail/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.scopes) && body.scopes.length > 0);
    assert.equal(typeof body.configured, 'boolean');
  });

  it('3. unauthenticated GET /api/cases is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/cases`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  it('4. unauthenticated POST /api/cases/reset is rejected with 401 (real-data endpoint stays protected)', async () => {
    const res = await fetch(`${baseUrl}/api/cases/reset`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('5. a test-mode session header authenticates access to the Case domain', async () => {
    const res = await fetch(`${baseUrl}/api/cases`, {
      headers: { 'x-test-session-email': 'alex@mycompany.example' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.cases));
  });
});
