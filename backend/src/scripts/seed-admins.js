const bcrypt = require('bcryptjs');
const { User, ROLES } = require('../models/User');

function loadPredefinedAdminsFromEnv() {
  const raw = String(process.env.SEED_ADMINS_JSON || '').trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('SEED_ADMINS_JSON must be valid JSON (array of {email,password[,role]})');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('SEED_ADMINS_JSON must be a JSON array');
  }
  return parsed
    .map((a) => ({
      email: String(a.email || '').trim().toLowerCase(),
      password: String(a.password || ''),
      role: a.role || ROLES.ADMIN,
    }))
    .filter((a) => a.email && a.password);
}

/**
 * Predefined Admin Accounts Seeder
 *
 * SECURITY: Admin credentials must be supplied via environment variables.
 * Example:
 *   SEED_ADMINS_JSON='[{"email":"admin@example.com","password":"change-me"}]'
 */
const PREDEFINED_ADMINS = loadPredefinedAdminsFromEnv();

/**
 * Seed a single admin account
 * @param {Object} adminData - Admin account data
 * @returns {Promise<Object>} Result object with success status and message
 */
async function seedAdmin(adminData) {
  const { email, password, role } = adminData;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return {
        success: false,
        email,
        message: 'Already exists (skipped)',
        action: 'skipped',
      };
    }

    // Hash password manually before creating user
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create new admin user with hashed password
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash,
      role,
      is_active: true,
    });

    return {
      success: true,
      email,
      id: user.id,
      message: 'Created successfully',
      action: 'created',
    };
  } catch (error) {
    return {
      success: false,
      email,
      message: `Error: ${error.message}`,
      action: 'failed',
      error: error.message,
    };
  }
}

/**
 * Seed all predefined admin accounts
 * @returns {Promise<Object>} Summary of seeding operation
 */
async function seedPredefinedAdmins() {
  if (!PREDEFINED_ADMINS.length) {
    return { total: 0, created: 0, skipped: 0, failed: 0, details: [] };
  }
  console.log('\n========================================');
  console.log('🌱 Seeding Predefined Admin Accounts');
  console.log('========================================\n');

  const results = {
    total: PREDEFINED_ADMINS.length,
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // Seed each admin account
  for (const adminData of PREDEFINED_ADMINS) {
    const result = await seedAdmin(adminData);
    results.details.push(result);

    // Update counters
    if (result.action === 'created') {
      results.created++;
      console.log(`✓ ${result.email} - ${result.message} (ID: ${result.id})`);
    } else if (result.action === 'skipped') {
      results.skipped++;
      console.log(`ℹ ${result.email} - ${result.message}`);
    } else if (result.action === 'failed') {
      results.failed++;
      console.log(`✗ ${result.email} - ${result.message}`);
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('📊 Seeding Summary');
  console.log('========================================');
  console.log(`Total accounts:   ${results.total}`);
  console.log(`Created:          ${results.created}`);
  console.log(`Skipped:          ${results.skipped}`);
  console.log(`Failed:           ${results.failed}`);
  console.log('========================================\n');

  // Print security reminder if any accounts were created
  if (results.created > 0) {
    console.log('⚠️  SECURITY REMINDER:');
    console.log('Please change these default passwords immediately after first login!');
    console.log('');
  }

  return results;
}

/**
 * Standalone execution
 * Run this script directly: node src/scripts/seed-admins.js
 */
if (require.main === module) {
  const { testConnection, syncDatabase } = require('../config/database');

  (async () => {
    try {
      // Connect to database
      await testConnection();

      // Sync models
      await syncDatabase({ alter: true });

      // Seed admins
      const results = await seedPredefinedAdmins();

      // Exit with appropriate code
      const exitCode = results.failed > 0 ? 1 : 0;
      process.exit(exitCode);
    } catch (error) {
      console.error('\n✗ Seeding failed:', error.message);
      console.error(error);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedPredefinedAdmins,
  PREDEFINED_ADMINS,
};
