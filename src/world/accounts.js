'use strict';

const crypto = require('crypto');

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

/**
 * Accounts and bearer-token sessions. An account owns several characters;
 * role 'admin' unlocks the admin API.
 */
class Accounts {
  constructor(store, opts = {}) {
    this.store = store;
    this.tokens = new Map();
    this.byUsername = new Map();
    for (const a of store.all('accounts')) this.byUsername.set(a.username.toLowerCase(), a.id);
    for (const t of store.all('tokens')) if (t.expires > Date.now()) this.tokens.set(t.token, t);
    this.adminUsernames = new Set((opts.admins || []).map((u) => u.toLowerCase()));
  }

  register(username, password) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username || '')) throw err('Username must be 3-20 letters, digits or underscores');
    if (typeof password !== 'string' || password.length < 8) throw err('Password must be at least 8 characters');
    if (this.byUsername.has(username.toLowerCase())) throw err('Username already taken', 409);
    const { salt, hash } = hashPassword(password);
    const account = {
      id: crypto.randomUUID(), username, salt, hash, createdAt: Date.now(), characters: [],
      role: this.byUsername.size === 0 || this.adminUsernames.has(username.toLowerCase()) ? 'admin' : 'player',
    };
    this.store.put('accounts', account.id, account);
    this.byUsername.set(username.toLowerCase(), account.id);
    return this.publicAccount(account);
  }

  login(username, password) {
    const id = this.byUsername.get(String(username || '').toLowerCase());
    const account = id && this.store.get('accounts', id);
    if (!account) throw err('Invalid username or password', 401);
    const { hash } = hashPassword(String(password || ''), account.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(account.hash, 'hex'))) throw err('Invalid username or password', 401);
    const token = crypto.randomBytes(32).toString('hex');
    const session = { token, accountId: account.id, expires: Date.now() + TOKEN_TTL_MS };
    this.tokens.set(token, session);
    this.store.put('tokens', token.slice(0, 32), session);
    return { token, expires: session.expires, account: this.publicAccount(account) };
  }

  logout(token) {
    this.tokens.delete(token);
    this.store.delete('tokens', token.slice(0, 32));
  }

  authenticate(token) {
    const s = token && this.tokens.get(token);
    if (!s || s.expires < Date.now()) return null;
    return this.store.get('accounts', s.accountId);
  }

  get(id) {
    return this.store.get('accounts', id);
  }

  save(account) {
    this.store.put('accounts', account.id, account);
  }

  publicAccount(a) {
    return { id: a.id, username: a.username, role: a.role, characters: a.characters, createdAt: a.createdAt };
  }
}

module.exports = { Accounts, hashPassword };
