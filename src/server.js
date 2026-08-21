import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config, rolVanToken } from './config.js';
import { routes, fotoOpslaan, fotoHalen, HttpFout } from './api.js';
import { seedIndienLeeg } from './seed.js';
import { huidigeWeek } from './util/week.js';
import { weken } from './repo.js';

const publiekeMap = path.join(config.root, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

/* ----------------------------------------------------------------- routing */

const gecompileerdeRoutes = Object.entries(routes).map(([sleutel, handler]) => {
  const [methode, pad] = sleutel.split(' ');
  const delen = pad.split('/').filter(Boolean);
  return { methode, delen, handler, sleutel };
});

function zoekRoute(methode, pad) {
  const delen = pad.split('/').filter(Boolean);
  for (const route of gecompileerdeRoutes) {
    if (route.methode !== methode || route.delen.length !== delen.length) continue;
    const params = {};
    let past = true;
    for (let i = 0; i < delen.length; i++) {
      const verwacht = route.delen[i];
      if (verwacht.startsWith(':')) params[verwacht.slice(1)] = decodeURIComponent(delen[i]);
      else if (verwacht !== delen[i]) { past = false; break; }
    }
    if (past) return { handler: route.handler, params };
  }
  return null;
}

/* ------------------------------------------------------------------ helpers */

function stuurJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function stuurTekst(res, status, tekst, extra = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...extra });
  res.end(tekst);
}

async function leesBody(req, maxBytes) {
  const stukken = [];
  let totaal = 0;
  for await (const stuk of req) {
    totaal += stuk.length;
    if (totaal > maxBytes) {
      req.destroy();
      throw new HttpFout(413, 'Verzoek te groot.');
    }
    stukken.push(stuk);
  }
  return Buffer.concat(stukken);
}

const bestandsCache = new Map();

function stuurBestand(req, res, bestandspad, status = 200) {
  let info = bestandsCache.get(bestandspad);
  const stat = fs.statSync(bestandspad);
  if (!info || info.mtime !== stat.mtimeMs) {
    const inhoud = fs.readFileSync(bestandspad);
    info = {
      inhoud,
      mtime: stat.mtimeMs,
      etag: `"${createHash('sha1').update(inhoud).digest('base64url')}"`,
    };
    bestandsCache.set(bestandspad, info);
  }
  if (req.headers['if-none-match'] === info.etag) {
    res.writeHead(304, { etag: info.etag });
    return res.end();
  }
  res.writeHead(status, {
    'content-type': MIME[path.extname(bestandspad)] || 'application/octet-stream',
    'content-length': info.inhoud.length,
    etag: info.etag,
    'cache-control': 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : info.inhoud);
}

function tokenUitVerzoek(req, url) {
  return req.headers['x-schoonmaak-token']
    || url.searchParams.get('token')
    || url.searchParams.get('t')
    || null;
}

function pinInOrde(req, url) {
  if (!config.pinAan) return true;
  const gegeven = req.headers['x-pincode'] || url.searchParams.get('pin') || '';
  return gegeven === config.pincode;
}

/* ------------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pad = url.pathname.replace(/\/+$/, '') || '/';

    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');

    /* --- API --- */
    if (pad.startsWith('/api/')) {
      const rol = rolVanToken(tokenUitVerzoek(req, url));
      if (!rol) return stuurJson(res, 401, { fout: 'Geen toegang. Controleer je link.' });

      const isStart = pad === '/api/start';
      const pinOk = pinInOrde(req, url);
      if (!pinOk && !isStart) return stuurJson(res, 401, { fout: 'Pincode nodig.', pinNodig: true });

      const ctx = { rol };

      // Foto uploaden gaat als losse binaire POST (geen multipart nodig).
      if (pad === '/api/fotos' && req.method === 'POST') {
        if (rol !== 'beheerder') return stuurJson(res, 403, { fout: 'Alleen de beheerder mag dit.' });
        const mime = (req.headers['content-type'] || '').split(';')[0].trim();
        const buffer = await leesBody(req, config.maxFotoBytes + 1024);
        return stuurJson(res, 201, { foto: fotoOpslaan(buffer, mime) });
      }

      const gevonden = zoekRoute(req.method, pad);
      if (!gevonden) return stuurJson(res, 404, { fout: 'Onbekend verzoek.' });

      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const rauw = await leesBody(req, 256 * 1024);
        if (rauw.length) {
          try {
            body = JSON.parse(rauw.toString('utf8'));
          } catch {
            return stuurJson(res, 400, { fout: 'Ongeldige gegevens.' });
          }
        }
      }

      const query = Object.fromEntries(url.searchParams);
      const resultaat = await gevonden.handler({ ctx, params: gevonden.params, body, query });
      if (isStart) {
        resultaat.pinAan = config.pinAan;
        resultaat.pinNodig = config.pinAan && !pinOk;
      }
      return stuurJson(res, 200, resultaat);
    }

    /* --- foto's --- */
    if (pad.startsWith('/fotos/')) {
      if (!rolVanToken(tokenUitVerzoek(req, url))) return stuurTekst(res, 401, 'Geen toegang.');
      const id = Number(pad.slice('/fotos/'.length));
      const foto = Number.isInteger(id) ? fotoHalen(id) : null;
      if (!foto) return stuurTekst(res, 404, 'Foto niet gevonden.');
      const etag = `"foto-${foto.id}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { etag });
        return res.end();
      }
      res.writeHead(200, {
        'content-type': foto.mime,
        'content-length': foto.bytes,
        etag,
        'cache-control': 'private, max-age=31536000, immutable',
      });
      return res.end(foto.data);
    }

    /* --- weergaven achter een token in het pad --- */
    const weergave = pad.match(/^\/(beheer|schoonmaak)\/([^/]+)$/);
    if (weergave) {
      const rol = rolVanToken(decodeURIComponent(weergave[2]));
      const verwacht = weergave[1] === 'beheer' ? 'beheerder' : 'schoonmaakster';
      if (rol !== verwacht) return stuurBestand(req, res, path.join(publiekeMap, 'geen-toegang.html'), 403);
      return stuurBestand(req, res, path.join(publiekeMap, `${weergave[1]}.html`));
    }

    /* --- statische bestanden --- */
    if (pad === '/') return stuurBestand(req, res, path.join(publiekeMap, 'index.html'));

    const veiligPad = path.normalize(path.join(publiekeMap, pad));
    if (veiligPad.startsWith(publiekeMap) && fs.existsSync(veiligPad) && fs.statSync(veiligPad).isFile()) {
      return stuurBestand(req, res, veiligPad);
    }

    return stuurBestand(req, res, path.join(publiekeMap, 'geen-toegang.html'), 404);
  } catch (fout) {
    if (fout instanceof HttpFout) return stuurJson(res, fout.status, { fout: fout.message });
    console.error('Onverwachte fout:', fout);
    if (!res.headersSent) return stuurJson(res, 500, { fout: 'Er ging iets mis op de server.' });
    res.end();
  }
});

/* ------------------------------------------------------------------- opstart */

seedIndienLeeg();
// Zorg dat de huidige week altijd bestaat, zodat de schoonmaakweergave nooit leeg valt.
const hw = huidigeWeek();
weken.haalOfMaak(hw.jaar, hw.weeknummer);

server.listen(config.poort, () => {
  const basis = process.env.PUBLIEKE_URL || `http://localhost:${config.poort}`;
  console.log('\n  Schoonmaak-app draait\n');
  console.log(`  Beheer:      ${basis}/beheer/${config.beheerToken}`);
  console.log(`  Schoonmaak:  ${basis}/schoonmaak/${config.schoonmaakToken}`);
  console.log(`  Pincode:     ${config.pinAan ? 'aan' : 'uit'}`);
  console.log(`  Database:    ${config.dbPad}\n`);
});

export { server };
