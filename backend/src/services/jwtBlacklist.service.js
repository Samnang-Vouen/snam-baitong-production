const { query } = require('./mysql');

async function blacklistToken({ jti, userId, expiresAt }) {
  await query(
    'INSERT IGNORE INTO jwt_blacklist (jti, user_id, expires_at) VALUES (?,?,?)',
    [jti, userId || null, expiresAt]
  );
}

async function isBlacklisted(jti) {
  const rows = await query('SELECT id FROM jwt_blacklist WHERE jti = ? LIMIT 1', [jti]);
  return rows.length > 0;
}

async function isTokenBlacklisted(jti) {
  return isBlacklisted(jti);
}

module.exports = { blacklistToken, isBlacklisted, isTokenBlacklisted };
