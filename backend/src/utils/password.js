const crypto = require('crypto');

/**
 * Generate a secure temporary password
 * Format: [4 uppercase][4 digits][4 lowercase]
 * Example: ABCD1234efgh
 */
function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // removed I, O to avoid confusion
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // removed i, l, o to avoid confusion
  const numbers = '23456789'; // removed 0, 1 to avoid confusion
  
  let password = '';
  
  // 4 uppercase letters
  for (let i = 0; i < 4; i++) {
    password += uppercase[crypto.randomInt(0, uppercase.length)];
  }
  
  // 4 numbers
  for (let i = 0; i < 4; i++) {
    password += numbers[crypto.randomInt(0, numbers.length)];
  }
  
  // 4 lowercase letters
  for (let i = 0; i < 4; i++) {
    password += lowercase[crypto.randomInt(0, lowercase.length)];
  }
  
  return password;
}

module.exports = {
  generateTemporaryPassword,
};
