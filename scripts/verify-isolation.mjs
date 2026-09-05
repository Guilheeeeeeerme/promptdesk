#!/usr/bin/env node
/**
 * Live API regression checks (auth + tenant isolation + history search).
 * Requires docker compose stack on localhost:3000.
 *
 *   node scripts/verify-isolation.mjs
 */
const API = process.env.API_URL || 'http://localhost:3000';

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const bad = await req('POST', '/auth/login', {
    body: { email: 'admin@example.com', password: 'WrongPassword123' },
  });
  assert(bad.status === 401, `invalid login expected 401, got ${bad.status}`);

  const login = await req('POST', '/auth/login', {
    body: { email: 'admin@example.com', password: 'Password123!' },
  });
  assert([200, 201].includes(login.status), `login failed: ${login.status}`);
  const token = login.data.token;

  for (const path of ['/companies', '/chat/conversations', '/chat/messages']) {
    const noauth = await req('GET', path);
    assert(noauth.status === 401, `${path} noauth expected 401`);
    const badtok = await req('GET', path, { token: 'deadbeef' });
    assert(badtok.status === 401, `${path} bad token expected 401`);
  }

  const companies = await req('GET', '/companies', { token });
  assert(companies.status === 200, 'companies list failed');
  const bookshop = companies.data.find((c) => c.name === 'Bookshop');
  const vpn = companies.data.find((c) => c.name === 'VPN SaaS');
  assert(bookshop && vpn, 'seed companies missing');

  const rejected = await req('POST', '/chat', {
    token,
    body: { message: 'probe', companyId: vpn.id },
  });
  assert(
    rejected.status === 400,
    `client companyId should be rejected, got ${rejected.status}`,
  );

  await req('PATCH', '/auth/context', {
    token,
    body: { companyId: vpn.id },
  });
  const created = await req('POST', '/chat', {
    token,
    body: { message: 'VERIFY_ISOLATION_BETA_MSG' },
  });
  assert([200, 201].includes(created.status), 'vpn chat failed');
  const conversationId = created.data.conversationId;

  await req('PATCH', '/auth/context', {
    token,
    body: { companyId: bookshop.id },
  });
  const leaked = await req('GET', `/chat/conversations/${conversationId}`, {
    token,
  });
  assert(leaked.status === 404, `cross-company detail expected 404, got ${leaked.status}`);

  const filtered = await req('GET', '/chat/conversations?q=VERIFY_ISOLATION_BETA_MSG', {
    token,
  });
  assert(
    Array.isArray(filtered.data) && filtered.data.length === 0,
    'bookshop search must not include vpn message',
  );

  console.log('verify-isolation: PASS');
}

main().catch((err) => {
  console.error('verify-isolation: FAIL', err.message || err);
  process.exit(1);
});
