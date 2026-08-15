'use strict';

const fs = require('fs');
const path = require('path');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); }
catch {
  throw new Error('当前 Node.js 不支持 node:sqlite；请使用 Node 22.23.2+ 或 Node 24。');
}

const STATE_NAMESPACES = new Set([
  'settings',
  'uiTheme',
  'customWords',
  'knownWords',
  'reminders',
  'engine',
  'review',
  'seeded',
  'moduleLayout',
  'petMemoryCursor',
  'petSyncCursor',
  'dragHint',
]);

function openStorage(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const databasePath = path.join(dataDir, 'wordpaper.sqlite');
  const db = new DatabaseSync(databasePath);

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      allow_legacy_import INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS password_credentials (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_state (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      namespace TEXT NOT NULL,
      value_json TEXT NOT NULL CHECK(json_valid(value_json)),
      revision INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, namespace)
    );

    CREATE TABLE IF NOT EXISTS auth_identities (
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      display_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, provider_subject)
    );

    CREATE INDEX IF NOT EXISTS auth_identities_user_id ON auth_identities(user_id);

    CREATE TABLE IF NOT EXISTS email_verifications (
      email_key TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS email_verifications_expires_at ON email_verifications(expires_at);

    CREATE TABLE IF NOT EXISTS oauth_flows (
      state_hash TEXT PRIMARY KEY,
      binding_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      initiating_session_hash TEXT,
      redirect_uri TEXT NOT NULL,
      next_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS oauth_flows_expires_at ON oauth_flows(expires_at);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all().map(row => row.name);
  if (!sessionColumns.includes('allow_legacy_import')) {
    db.exec('ALTER TABLE sessions ADD COLUMN allow_legacy_import INTEGER NOT NULL DEFAULT 0');
  }
  const oauthFlowColumns = db.prepare('PRAGMA table_info(oauth_flows)').all().map(row => row.name);
  if (!oauthFlowColumns.includes('redirect_uri')) {
    db.exec("ALTER TABLE oauth_flows ADD COLUMN redirect_uri TEXT NOT NULL DEFAULT ''");
  }
  if (!oauthFlowColumns.includes('initiating_session_hash')) {
    db.exec('ALTER TABLE oauth_flows ADD COLUMN initiating_session_hash TEXT');
  }
  db.exec(`
    INSERT OR IGNORE INTO password_credentials (user_id, password_hash, created_at, updated_at)
    SELECT id, password_hash, created_at, created_at FROM users
    WHERE password_hash LIKE 'scrypt$%'
  `);

  try { fs.chmodSync(databasePath, 0o600); } catch {}

  const statements = {
    createUser: db.prepare('INSERT INTO users (username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    passwordInsert: db.prepare('INSERT INTO password_credentials (user_id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'),
    userByKey: db.prepare(`
      SELECT u.id, u.username, p.password_hash, u.created_at
      FROM users u LEFT JOIN password_credentials p ON p.user_id = u.id
      WHERE u.username_key = ?
    `),
    identityBySubject: db.prepare(`
      SELECT i.provider, i.provider_subject, i.email, i.email_verified, i.display_name,
             u.id AS user_id, u.username
      FROM auth_identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = ? AND i.provider_subject = ?
    `),
    identityInsert: db.prepare(`
      INSERT INTO auth_identities
        (provider, provider_subject, user_id, email, email_verified, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    emailVerificationByEmail: db.prepare(`
      SELECT email_key, code_hash, attempts, created_at, expires_at
      FROM email_verifications WHERE email_key = ?
    `),
    emailVerificationUpsert: db.prepare(`
      INSERT INTO email_verifications
        (email_key, code_hash, attempts, created_at, expires_at)
      VALUES (?, ?, 0, ?, ?)
      ON CONFLICT(email_key) DO UPDATE SET
        code_hash = excluded.code_hash,
        attempts = 0,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `),
    emailVerificationIncrement: db.prepare(`
      UPDATE email_verifications SET attempts = attempts + 1 WHERE email_key = ?
    `),
    emailVerificationDelete: db.prepare('DELETE FROM email_verifications WHERE email_key = ?'),
    emailVerificationDeleteClaim: db.prepare('DELETE FROM email_verifications WHERE email_key = ? AND code_hash = ?'),
    emailVerificationsDeleteExpired: db.prepare('DELETE FROM email_verifications WHERE expires_at <= ?'),
    oauthFlowInsert: db.prepare(`
      INSERT INTO oauth_flows
        (state_hash, binding_hash, provider, code_verifier, initiating_session_hash, redirect_uri, next_path, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    oauthFlowByState: db.prepare(`
      SELECT state_hash, binding_hash, provider, code_verifier, initiating_session_hash, redirect_uri, next_path, expires_at
      FROM oauth_flows WHERE state_hash = ?
    `),
    oauthFlowDelete: db.prepare('DELETE FROM oauth_flows WHERE state_hash = ?'),
    oauthFlowsDeleteExpired: db.prepare('DELETE FROM oauth_flows WHERE expires_at <= ?'),
    sessionInsert: db.prepare('INSERT INTO sessions (token_hash, user_id, csrf_token, allow_legacy_import, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'),
    sessionByHash: db.prepare(`
      SELECT s.token_hash, s.csrf_token, s.allow_legacy_import, s.expires_at, u.id AS user_id, u.username
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `),
    sessionDelete: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    sessionsDeleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    stateAll: db.prepare('SELECT namespace, value_json, revision, updated_at FROM user_state WHERE user_id = ?'),
    stateOne: db.prepare('SELECT value_json, revision, updated_at FROM user_state WHERE user_id = ? AND namespace = ?'),
    stateInsert: db.prepare('INSERT INTO user_state (user_id, namespace, value_json, revision, updated_at) VALUES (?, ?, ?, 1, ?)'),
    stateUpdate: db.prepare('UPDATE user_state SET value_json = ?, revision = ?, updated_at = ? WHERE user_id = ? AND namespace = ?'),
    metaGet: db.prepare('SELECT value FROM app_meta WHERE key = ?'),
    metaInsert: db.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)'),
  };

  function assertNamespace(namespace) {
    if (!STATE_NAMESPACES.has(namespace)) {
      const error = new Error('unknown state namespace');
      error.code = 'INVALID_NAMESPACE';
      throw error;
    }
  }

  function createUser(username, usernameKey, passwordHash) {
    const now = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      // Keep the legacy users.password_hash copy during the compatibility
      // migration, while password_credentials is the authoritative capability.
      const info = statements.createUser.run(username, usernameKey, passwordHash, now);
      const userId = Number(info.lastInsertRowid);
      statements.passwordInsert.run(userId, passwordHash, now, now);
      db.exec('COMMIT');
      return { id: userId, username };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function findUserByKey(usernameKey) {
    return statements.userByKey.get(usernameKey) || null;
  }

  function cleanIdentityText(value, maxLength) {
    return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
  }

  function findOrCreateFederatedUser(provider, providerSubject, profile) {
    const normalizedProvider = cleanIdentityText(provider, 24).toLowerCase();
    const subject = cleanIdentityText(providerSubject, 255);
    if (!['google', 'wechat'].includes(normalizedProvider) || !subject) {
      throw new Error('invalid federated identity');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = statements.identityBySubject.get(normalizedProvider, subject);
      if (existing) {
        db.exec('COMMIT');
        return {
          user: { id: Number(existing.user_id), username: existing.username },
          created: false,
        };
      }

      const fallback = normalizedProvider === 'wechat' ? '微信用户' : 'Google 用户';
      const base = cleanIdentityText(profile && profile.displayName, 28) || fallback;
      const username = base.slice(0, 32);
      // Provider-controlled display names must never reserve an email or
      // legacy username. Keep the login key in a separate internal namespace.
      const usernameKey = `federated:${normalizedProvider}:${subject}`;

      const now = Date.now();
      // The legacy column remains NOT NULL for in-place migration, but the
      // absence of password_credentials is what makes this provider-only.
      const info = statements.createUser.run(username, usernameKey, '', now);
      const userId = Number(info.lastInsertRowid);
      const email = cleanIdentityText(profile && profile.email, 320) || null;
      const displayName = cleanIdentityText(profile && profile.displayName, 120) || null;
      statements.identityInsert.run(
        normalizedProvider, subject, userId, email,
        profile && profile.emailVerified ? 1 : 0,
        displayName, now, now,
      );
      db.exec('COMMIT');
      return { user: { id: userId, username }, created: true };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function claimEmailVerification(emailKey, codeHash, expiresAt, cooldownMs) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const now = Date.now();
      const row = statements.emailVerificationByEmail.get(emailKey);
      const active = row && Number(row.expires_at) > now;
      // Five wrong guesses lock this email until the code expires. Keep the
      // row as a tombstone so requesting a new code cannot reset the counter.
      const cooldown = active && Number(row.attempts) >= 5
        ? Number(row.expires_at) - now
        : active
          ? Math.max(0, Number(cooldownMs) - (now - Number(row.created_at)))
          : 0;
      if (cooldown > 0) {
        db.exec('COMMIT');
        return { claimed: false, retryAfterMs: cooldown };
      }
      statements.emailVerificationUpsert.run(emailKey, codeHash, now, expiresAt);
      db.exec('COMMIT');
      return { claimed: true, retryAfterMs: 0 };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function releaseEmailVerification(emailKey, codeHash) {
    statements.emailVerificationDeleteClaim.run(emailKey, codeHash);
  }

  function consumeEmailVerification(emailKey, codeHash) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = statements.emailVerificationByEmail.get(emailKey);
      if (!row || Number(row.expires_at) <= Date.now()) {
        if (row) statements.emailVerificationDelete.run(emailKey);
        db.exec('COMMIT');
        return false;
      }
      if (Number(row.attempts) >= 5) {
        db.exec('COMMIT');
        return false;
      }
      if (row.code_hash !== codeHash) {
        statements.emailVerificationIncrement.run(emailKey);
        db.exec('COMMIT');
        return false;
      }
      statements.emailVerificationDelete.run(emailKey);
      db.exec('COMMIT');
      return true;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function deleteExpiredEmailVerifications() {
    statements.emailVerificationsDeleteExpired.run(Date.now());
  }

  function createOAuthFlow(stateHash, bindingHash, provider, codeVerifier, initiatingSessionHash, redirectUri, nextPath, expiresAt) {
    const now = Date.now();
    statements.oauthFlowInsert.run(
      stateHash, bindingHash, provider, codeVerifier || null, initiatingSessionHash || null,
      redirectUri, nextPath, now, expiresAt,
    );
  }

  function consumeOAuthFlow(stateHash, bindingHash, provider) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = statements.oauthFlowByState.get(stateHash);
      const matches = row && row.binding_hash === bindingHash && row.provider === provider;
      if (row && (matches || Number(row.expires_at) <= Date.now())) {
        statements.oauthFlowDelete.run(stateHash);
      }
      db.exec('COMMIT');
      if (!matches || Number(row.expires_at) <= Date.now()) return null;
      return {
        provider: row.provider,
        codeVerifier: row.code_verifier || '',
        initiatingSessionHash: row.initiating_session_hash || '',
        redirectUri: row.redirect_uri,
        nextPath: row.next_path,
      };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function deleteExpiredOAuthFlows() {
    statements.oauthFlowsDeleteExpired.run(Date.now());
  }

  function createSession(tokenHash, userId, csrfToken, expiresAt, allowLegacyImport) {
    statements.sessionInsert.run(tokenHash, userId, csrfToken, allowLegacyImport ? 1 : 0, Date.now(), expiresAt);
  }

  function findSession(tokenHash) {
    const row = statements.sessionByHash.get(tokenHash);
    if (!row) return null;
    if (Number(row.expires_at) <= Date.now()) {
      statements.sessionDelete.run(tokenHash);
      return null;
    }
    return {
      tokenHash: row.token_hash,
      csrfToken: row.csrf_token,
      allowLegacyImport: Boolean(row.allow_legacy_import),
      expiresAt: Number(row.expires_at),
      user: { id: Number(row.user_id), username: row.username },
    };
  }

  function deleteSession(tokenHash) {
    statements.sessionDelete.run(tokenHash);
  }

  function deleteExpiredSessions() {
    statements.sessionsDeleteExpired.run(Date.now());
  }

  function getState(userId) {
    const state = {};
    const revisions = {};
    const updatedAt = {};
    for (const row of statements.stateAll.all(userId)) {
      if (!STATE_NAMESPACES.has(row.namespace)) continue;
      try {
        state[row.namespace] = JSON.parse(row.value_json);
        revisions[row.namespace] = Number(row.revision);
        updatedAt[row.namespace] = Number(row.updated_at);
      } catch {}
    }
    return { state, revisions, updatedAt };
  }

  function putState(userId, namespace, value, expectedRevision) {
    assertNamespace(namespace);
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      const error = new Error('state value must be JSON serializable');
      error.code = 'INVALID_STATE';
      throw error;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const current = statements.stateOne.get(userId, namespace);
      const currentRevision = current ? Number(current.revision) : 0;
      if (currentRevision !== expectedRevision) {
        db.exec('ROLLBACK');
        return {
          conflict: true,
          revision: currentRevision,
          value: current ? JSON.parse(current.value_json) : null,
        };
      }

      const now = Date.now();
      const revision = currentRevision + 1;
      if (current) statements.stateUpdate.run(serialized, revision, now, userId, namespace);
      else statements.stateInsert.run(userId, namespace, serialized, now);
      db.exec('COMMIT');
      return { conflict: false, revision, updatedAt: now };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function claimCompanionOwner(userId) {
    const key = 'companion_owner_user_id';
    statements.metaInsert.run(key, String(userId));
    const row = statements.metaGet.get(key);
    return Boolean(row && row.value === String(userId));
  }

  function companionAvailableForUser(userId) {
    const row = statements.metaGet.get('companion_owner_user_id');
    return !row || row.value === String(userId);
  }

  function close() {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
    db.close();
  }

  return {
    databasePath,
    createUser,
    findUserByKey,
    findOrCreateFederatedUser,
    claimEmailVerification,
    releaseEmailVerification,
    consumeEmailVerification,
    deleteExpiredEmailVerifications,
    createOAuthFlow,
    consumeOAuthFlow,
    deleteExpiredOAuthFlows,
    createSession,
    findSession,
    deleteSession,
    deleteExpiredSessions,
    getState,
    putState,
    claimCompanionOwner,
    companionAvailableForUser,
    close,
  };
}

module.exports = { openStorage, STATE_NAMESPACES };
