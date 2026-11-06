/* Draait alle browsertests in deze map, en meldt aan het eind wat er misging.
   Vereist een draaiende dev-server (`npm run dev`) en Playwright. */

import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const suites = (await readdir(hier))
  .filter((naam) => naam.endsWith('.mjs') && naam !== 'draaien.mjs' && naam !== 'helpers.mjs')
  .sort();

const mislukt = [];
for (const suite of suites) {
  const code = await new Promise((klaar) => {
    spawn(process.execPath, [join(hier, suite)], { stdio: 'inherit' }).on('close', klaar);
  });
  if (code !== 0) mislukt.push(suite);
}

console.log(mislukt.length
  ? `\n${mislukt.length} van de ${suites.length} mislukt: ${mislukt.join(', ')}`
  : `\nAlle ${suites.length} browsertests geslaagd`);
process.exit(mislukt.length ? 1 : 0);
