import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// .env inlezen als die bestaat (geen dependency nodig).
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const regel of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = regel.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const waarde = m[2].replace(/^["'](.*)["']$/, '$1');
    if (process.env[m[1]] === undefined) process.env[m[1]] = waarde;
  }
}

function tokenOf(naam, fallbackBestand) {
  const uitEnv = (process.env[naam] || '').trim();
  if (uitEnv) return uitEnv;
  // Geen token ingesteld: genereer er één en bewaar hem, zodat de app na een
  // herstart dezelfde links houdt. Handig om lokaal te proberen.
  const pad = path.join(dataDir, fallbackBestand);
  if (fs.existsSync(pad)) return fs.readFileSync(pad, 'utf8').trim();
  const nieuw = randomBytes(18).toString('base64url');
  fs.writeFileSync(pad, nieuw, { mode: 0o600 });
  return nieuw;
}

export const dataDir = path.resolve(root, process.env.DATA_DIR || './data');
fs.mkdirSync(dataDir, { recursive: true });

export const config = {
  root,
  dataDir,
  poort: Number(process.env.PORT || 3000),
  dbPad: path.join(dataDir, 'schoonmaak.db'),
  beheerToken: tokenOf('BEHEER_TOKEN', '.beheer-token'),
  schoonmaakToken: tokenOf('SCHOONMAAK_TOKEN', '.schoonmaak-token'),
  pincode: (process.env.PINCODE || '').trim(),
  get pinAan() {
    return this.pincode.length > 0;
  },
  maxFotoBytes: 4 * 1024 * 1024,
};

export function rolVanToken(token) {
  if (!token) return null;
  if (veiligGelijk(token, config.beheerToken)) return 'beheerder';
  if (veiligGelijk(token, config.schoonmaakToken)) return 'schoonmaakster';
  return null;
}

// Vergelijken in constante tijd, zodat een token niet te raden is via de responstijd.
// Eerst hashen maakt beide kanten even lang; dat verklapt ook de lengte niet.
function veiligGelijk(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
