const bcrypt = require('bcryptjs');
const { User } = require('../models/User');
const { testConnection, syncDatabase } = require('../config/database');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { email: null, password: null, activate: false, mustChangePassword: false, noSync: false };

  for (const arg of args) {
    if (arg === '--activate') out.activate = true;
    else if (arg === '--must-change-password') out.mustChangePassword = true;
    else if (arg === '--no-sync') out.noSync = true;
    else if (!out.email) out.email = arg;
    else if (!out.password) out.password = arg;
  }

  return out;
}

async function main() {
  const { email, password, activate, mustChangePassword, noSync } = parseArgs(process.argv);

  if (!email || !password) {
    console.error('Usage: node src/scripts/reset-user-password.js <email> <newPassword> [--activate] [--must-change-password] [--no-sync]');
    process.exit(1);
  }

  const ok = await testConnection();
  if (!ok) process.exit(1);

  if (!noSync) {
    await syncDatabase({ alter: true });
  }

  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    console.error(`User not found: ${normalizedEmail}`);
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(String(password), salt);

  user.password_hash = password_hash;
  if (activate) user.is_active = true;
  user.must_change_password = Boolean(mustChangePassword);

  await user.save();

  console.log('✓ Password updated');
  console.log(`  email: ${user.email}`);
  console.log(`  id: ${user.id}`);
  console.log(`  role: ${user.role}`);
  console.log(`  is_active: ${user.is_active}`);
  console.log(`  must_change_password: ${user.must_change_password}`);
}

main().catch((err) => {
  console.error('✗ Reset password failed:', err.message);
  process.exit(1);
});
