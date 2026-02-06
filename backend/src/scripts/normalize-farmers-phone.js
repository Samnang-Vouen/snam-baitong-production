/**
 * Normalize farmers.phone_number: convert Khmer/Arabic-Indic digits to ASCII and strip spaces/hyphens/plus/dots.
 * Usage: node src/scripts/normalize-farmers-phone.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const db = require('../services/mysql');

const EN = '0123456789';
const KH = '០១២៣៤៥៦៧៨៩';
const AR = '٠١٢٣٤٥٦٧٨٩';
function toEnglishDigits(s) {
  const str = String(s || '');
  let out = '';
  for (const ch of str) {
    const khIdx = KH.indexOf(ch);
    if (khIdx >= 0) { out += EN[khIdx]; continue; }
    const arIdx = AR.indexOf(ch);
    if (arIdx >= 0) { out += EN[arIdx]; continue; }
    out += ch;
  }
  return out;
}
function normalizePhone(s) {
  const ascii = toEnglishDigits(String(s || '').trim());
  return ascii.replace(/[\s\-+\.]/g, '');
}

(async () => {
  try {
    const rows = await db.query('SELECT id, phone_number FROM farmers');
    let changed = 0;
    for (const r of rows) {
      const current = r.phone_number || '';
      const next = normalizePhone(current);
      if (next && next !== current) {
        await db.query('UPDATE farmers SET phone_number = ? WHERE id = ?', [next, r.id]);
        changed++;
        console.log(`Updated farmer ${r.id}: ${current} -> ${next}`);
      }
    }
    console.log(`Done. Updated ${changed} rows.`);
    process.exit(0);
  } catch (e) {
    console.error('Normalization failed:', e.message);
    process.exit(1);
  }
})();