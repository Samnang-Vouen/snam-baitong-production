const bcrypt = require('bcryptjs');
const { query, getConnection } = require('./mysql');
const { User } = require('../models/User');
const { generateTemporaryPassword } = require('../utils/password');

const ROLES = {
  ADMIN: 'admin',
  MINISTRY: 'ministry',
};

async function initSchema() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','ministry') NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Best-effort schema alignment for legacy databases
    const safeExec = async (sql) => {
      try { await conn.query(sql); } catch (err) {
        const msg = String(err && err.message || '');
        // Ignore duplicate/exists errors
        if (msg.includes('Duplicate column') || msg.includes('already exists') || msg.includes('checks for existence') || msg.includes('Duplicate key name')) return;
        // Ignore syntax issues on old MySQL when IF NOT EXISTS isn't supported
        if (msg.includes('IF NOT EXISTS')) return;
        // Ignore enum alter failures (legacy variants)
        if (msg.includes('ENUM')) return;
        // Otherwise rethrow
        throw err;
      }
    };

    // Add columns if missing (covers legacy installs)
    await safeExec(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE`);
    await safeExec(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL`);
    await safeExec(`ALTER TABLE users ADD COLUMN role ENUM('admin','ministry') NOT NULL`);
    await safeExec(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`);
    await safeExec(`ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0`);
    await safeExec(`ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await safeExec(`ALTER TABLE users ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // Ensure unique index on email
    const [idxRows] = await conn.query(
      `SELECT 1 FROM information_schema.statistics 
       WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_email' 
       LIMIT 1`
    );
    const hasEmailIdx = Array.isArray(idxRows) && idxRows.length > 0;
    if (!hasEmailIdx) {
      await safeExec(`CREATE UNIQUE INDEX idx_users_email ON users(email)`);
    }

    // JWT blacklist table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS jwt_blacklist (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        jti VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires_at (expires_at),
        CONSTRAINT fk_jwt_blacklist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function getById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listUsers() {
  return query('SELECT id, email, role, is_active, must_change_password, created_at, updated_at FROM users ORDER BY id DESC');
}

async function createUser({ email, password, role }) {
  // Validate required fields
  if (!email || !role) {
    const err = new Error('Missing required fields: email and role are required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const err = new Error('Invalid email format');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  
  // Validate role
  if (![ROLES.ADMIN, ROLES.MINISTRY].includes(role)) {
    const err = new Error('Invalid role. Must be either "admin" or "ministry"');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  
  // Check for duplicate email
  const existing = await getByEmail(email);
  if (existing) {
    const err = new Error('Email already in use');
    err.code = 'CONFLICT';
    throw err;
  }
  
  // Generate temporary password if not provided
  const temporaryPassword = password || generateTemporaryPassword();
  const password_hash = await bcrypt.hash(temporaryPassword, 10);
  
  // Insert user with explicit defaults to avoid legacy NO DEFAULT errors
  const result = await query(
    'INSERT INTO users (email, password_hash, role, is_active, must_change_password, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())',
    [email, password_hash, role, 1, 1]
  );
  
  // Return user data including temporary password (only in response)
  return { 
    id: result.insertId, 
    email, 
    role,
    temporaryPassword,
    must_change_password: true
  };
}

async function updateUser(id, updates) {
  const allowed = ['email', 'password', 'role', 'is_active', 'must_change_password'];
  const fields = [];
  const values = [];
  
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'password') {
        fields.push('password_hash = ?');
        values.push(await bcrypt.hash(updates[key], 10));
      } else {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
  }
  
  if (fields.length === 0) {
    const err = new Error('No valid fields to update');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  
  values.push(id);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return getById(id);
}

async function deleteUser(id) {
  await query('DELETE FROM users WHERE id = ?', [id]);
}

async function ensureInitialAdminFromEnv() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  const existing = await getByEmail(adminEmail);
  if (existing) return false;
  await createUser({ email: adminEmail, password: adminPassword, role: ROLES.ADMIN });
  return true;
}

/**
 * Find user using Sequelize (alternative method)
 */
async function findUserByEmail(email) {
  try {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

/**
 * Verify credentials using Sequelize model
 */
async function verifyCredentials(email, password) {
  try {
    const user = await findUserByEmail(email);
    if (!user) return null;
    const isValid = await user.verifyPassword(password);
    return isValid ? user : null;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
}

module.exports = {
  ROLES,
  initSchema,
  getByEmail,
  getById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  ensureInitialAdminFromEnv,
  findUserByEmail,
  verifyCredentials,
};
