// UCI Ruhr-Park (Bochum) – Programm-Server
// Holt das komplette Kinoprogramm, parst es und liefert es als JSON.
// Keine externen Abhängigkeiten – nur Node (>=18) mit eingebautem fetch.

const http = require('http');
const fs = require('fs');
const path = require('path');

const SOURCE = 'https://www.uci-kinowelt.de/kinoprogramm/bochum-ruhr-park/46/poster';
const BASE = 'https://www.uci-kinowelt.de';
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const CACHE_MS = 10 * 60 * 1000; // 10 Minuten

let cache = { data: null, at: 0, error: null };

// --- HTML-Entities dekodieren (nur was auf der Seite vorkommt) ---
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  szlig: 'ß', eacute: 'é', egrave: 'è', agrave: 'à', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘',
};
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (NAMED[n] !== undefined ? NAMED[n] : m));
}
function clean(s) { return decodeEntities(s.replace(/\s+/g, ' ').trim()); }

// --- Versions-Flags (data-version) in lesbare Labels übersetzen ---
const VER = {
  '2d': '2D', '3d': '3D', isens: 'iSense', imax: 'IMAX',
  ov: 'OV', omu: 'OmU', omeu: 'OmeU', dbox: 'D-BOX', db: 'D-BOX',
  atmos: 'Dolby Atmos', vip: 'VIP', laser: 'Laser', hfr: 'HFR',
};
function decodeVersion(v) {
  const out = [];
  for (const tok of (v || '').split('|')) {
    const t = tok.toLowerCase().trim();
    if (!t || /^\d+$/.test(t)) continue; // reine ID-Nummern überspringen
    out.push(VER[t] || t.toUpperCase());
  }
  return out;
}

// --- das eigentliche Parsen der Übersichtsseite ---
function parseProgram(html) {
  const films = [];
  // Jeder Film beginnt an einem Element mit data-film-id
  const parts = html.split(/(?=<[^>]*data-film-id=")/);
  for (const p of parts) {
    const mt = p.match(/eventtitle">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!mt) continue;
    const href = mt[1];
    const title = clean(mt[2]);

    const rt = p.match(/<li>\s*(\d{2,3})\s*min\s*<\/li>/i);
    const runtime = rt ? Number(rt[1]) : null;

    // Bevorzugt die saubere .jpg-Fallback-URL aus src="" (nicht das srcset mit 1x/2x-Deskriptoren)
    const poster = (p.match(/src="([^"\s]*Poster[^"\s]*\.(?:jpg|jpeg|png))"/i) ||
                    p.match(/([^"'\s]*Poster[^"'\s]*\.(?:jpg|jpeg|png|webp))/i) || [])[1] || null;

    const age = (p.match(/FSK[_-]?(\d+)\.svg/i) || p.match(/age[_-]?(?:rating[_-]?)?(\d+)\.svg/i) || [])[1] || null;

    const shows = [];
    const re = /performanceId\/([^/]+)\/siteId\/(\d+)\/(\d+)"[^>]*?data-time="(\d\d:\d\d)"\s*data-date="(\d{8})"\s*data-version="([^"]*)"/g;
    let s;
    while ((s = re.exec(p)) !== null) {
      shows.push({
        perf: s[1],
        oid: s[3],
        time: s[4],
        date: s[5], // YYYYMMDD
        versions: decodeVersion(s[6]),
        bookingUrl: BASE + `/kino-buchung/performanceId/${s[1]}/siteId/${s[2]}/${s[3]}`,
      });
    }
    if (shows.length === 0) continue;

    films.push({
      title,
      detailUrl: BASE + href,
      runtime,
      poster: poster ? BASE + poster : null,
      age,
      shows,
    });
  }
  return films;
}

async function getProgram(force = false) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < CACHE_MS) return cache;
  const res = await fetch(SOURCE, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UCI-Ruhrpark-Viewer' },
  });
  if (!res.ok) throw new Error('UCI antwortete mit ' + res.status);
  const html = await res.text();
  const films = parseProgram(html);
  cache = {
    at: now,
    error: null,
    data: {
      cinema: 'UCI Ruhr-Park Bochum',
      source: SOURCE,
      fetchedAt: new Date(now).toISOString(),
      filmCount: films.length,
      showCount: films.reduce((a, f) => a + f.shows.length, 0),
      films,
    },
  };
  return cache;
}

// --- Mini-Webserver ---
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    // Poster-Proxy: umgeht Hotlink-Schutz, damit Bilder überall laden
    if (url.pathname === '/img') {
      const u = url.searchParams.get('u') || '';
      if (!/^https:\/\/www\.uci-kinowelt\.de\/[^"'<>]+\.(jpg|jpeg|png|webp)$/i.test(u)) {
        res.writeHead(400); res.end('bad url'); return;
      }
      const ir = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: BASE + '/' } });
      if (!ir.ok) { res.writeHead(ir.status); res.end(); return; }
      const buf = Buffer.from(await ir.arrayBuffer());
      res.writeHead(200, { 'Content-Type': ir.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
      res.end(buf);
      return;
    }
    if (url.pathname === '/api/program') {
      const force = url.searchParams.get('refresh') === '1';
      const c = await getProgram(force);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(c.data));
      return;
    }
    // statische Dateien
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(PUBLIC, path.normalize(file).replace(/^([/\\])+/, ''));
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  UCI Ruhr-Park Programm läuft auf:  http://localhost:${PORT}\n`);
  getProgram().then(c => console.log(`  Geladen: ${c.data.filmCount} Filme, ${c.data.showCount} Vorstellungen`))
    .catch(e => console.log('  Erst-Laden fehlgeschlagen:', e.message));
});
