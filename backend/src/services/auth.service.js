const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getByEmail } = require('./user.service');
const { blacklistToken } = require('./jwtBlacklist.service');

function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('Missing JWT_SECRET');
    err.code = 'ENV_VALIDATION_ERROR';
    throw err;
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  return { secret, expiresIn };
}

async function login(email, password) {
  const user = await getByEmail(email);
  if (!user || !user.is_active) {
    const err = new Error('Invalid credentials');
    err.code = 'AUTH_FAILED';
    throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.code = 'AUTH_FAILED';
    throw err;
  }

  const jti = uuidv4().replace(/-/g, '');
  const { secret, expiresIn } = getJwtConfig();
  const token = jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, jti },
    secret,
    { expiresIn }
  );
  return {
    token,
    user: { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      mustChangePassword: user.must_change_password || false
    },
  };
}

async function logout(decodedToken) {
  // decodedToken contains iat, exp, jti, sub etc.
  const expiresAt = new Date(decodedToken.exp * 1000);
  await blacklistToken({ jti: decodedToken.jti, userId: Number(decodedToken.sub), expiresAt });
}

module.exports = { getJwtConfig, login, logout };
