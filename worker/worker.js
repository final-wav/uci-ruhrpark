/**
 * UCI Ruhr-Park Bochum — Programm-Proxy (Cloudflare Worker)
 *
 * Die UCI-Seite hat keine API und schickt keine CORS-Header, außerdem sind
 * Poster hotlink-geschützt. Dieser Worker holt das server-gerenderte Programm,
 * parst es und liefert es dem statischen Frontend (GitHub Pages / Cloudflare) mit
 * CORS-Headern. Kein App-Server – nur Holen, Parsen, Durchreichen.
 *
 * Endpunkte:
 *   GET /program      → komplettes Programm als JSON
 *   GET /img?u=<url>  → Poster-Bild durchgereicht
 */

const SOURCE = 'https://www.uci-kinowelt.de/kinoprogramm/bochum-ruhr-park/46/poster';
const BASE = 'https://www.uci-kinowelt.de';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UCI-Ruhrpark-Viewer';

// --- HTML-Entities dekodieren ---
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
    if (!t || /^\d+$/.test(t)) continue;
    out.push(VER[t] || t.toUpperCase());
  }
  return out;
}

// --- Übersichtsseite parsen ---
function parseProgram(html) {
  const films = [];
  const parts = html.split(/(?=<[^>]*data-film-id=")/);
  for (const p of parts) {
    const mt = p.match(/eventtitle">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!mt) continue;
    const href = mt[1];
    const title = clean(mt[2]);

    const rt = p.match(/<li>\s*(\d{2,3})\s*min\s*<\/li>/i);
    const runtime = rt ? Number(rt[1]) : null;

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
        date: s[5],
        versions: decodeVersion(s[6]),
        bookingUrl: BASE + `/kino-buchung/performanceId/${s[1]}/siteId/${s[2]}/${s[3]}`,
      });
    }
    if (shows.length === 0) continue;

    films.push({
      title,
      detailUrl: BASE + href,
      runtime,
      runtimeSource: runtime != null ? 'uci' : null,
      poster: poster ? BASE + poster : null,
      age,
      shows,
    });
  }
  return films;
}

// ── Laufzeit-Anreicherung für Filme ohne Länge (UCI liefert sie nicht) ──
// Weg: Titel → IMDb-ID (Suggestion-API) → Laufzeit (Wikidata P2047). Beides keyless.
function cleanTitle(t) {
  let q = t.toLowerCase().replace(/\(.*?\)/g, '');
  q = q.replace(/\s*[-–:]\s*(live action|extended version|director.?s cut|the imax experience|ov|omu|re-?release).*$/, '');
  q = q.replace(/\b(live action|extended version|3d|imax|ov|omu)\b/g, '');
  return q.replace(/\s+/g, ' ').trim();
}
async function imdbId(title) {
  const q = cleanTitle(title);
  if (!q) return null;
  const r = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(q)}.json?includeVideos=0`,
    { headers: { 'User-Agent': UA }, cf: { cacheTtl: 86400, cacheEverything: true }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const d = await r.json();
  const recent = [2024, 2025, 2026, 2027];
  const cs = (d.d || []).filter(x => String(x.id || '').startsWith('tt') && ['feature', 'TV movie', 'video', undefined, null].includes(x.q));
  if (!cs.length) return null;
  cs.sort((a, b) => (recent.includes(a.y) ? 0 : 1) - (recent.includes(b.y) ? 0 : 1) || (a.rank || 1e9) - (b.rank || 1e9));
  return cs[0].id;
}
async function wikidataRuntime(ttid) {
  const sparql = `SELECT ?dur WHERE { ?i wdt:P345 "${ttid}". ?i wdt:P2047 ?dur. } LIMIT 1`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
    { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, cf: { cacheTtl: 86400, cacheEverything: true }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const d = await r.json();
  const b = d.results && d.results.bindings;
  if (!b || !b.length) return null;
  const v = Math.round(parseFloat(b[0].dur.value));
  return v > 0 && v < 400 ? v : null;
}
async function enrichRuntimes(films) {
  const need = films.filter(f => f.runtime == null);
  await Promise.allSettled(need.map(async f => {
    try {
      const id = await imdbId(f.title);
      if (!id) return;
      const rt = await wikidataRuntime(id);
      if (rt) { f.runtime = rt; f.runtimeSource = 'imdb'; }
    } catch { /* still. leer lassen -> "Länge unbekannt" */ }
  }));
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: cors() });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Poster-Proxy
    if (path === '/img') {
      const u = url.searchParams.get('u') || '';
      if (!/^https:\/\/www\.uci-kinowelt\.de\/[^"'<>\s]+\.(jpg|jpeg|png|webp)$/i.test(u)) {
        return new Response('bad url', { status: 400, headers: cors() });
      }
      const ir = await fetch(u, {
        headers: { 'User-Agent': UA, Referer: BASE + '/' },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (!ir.ok) return new Response(null, { status: ir.status, headers: cors() });
      return new Response(ir.body, {
        status: 200,
        headers: {
          ...cors(),
          'Content-Type': ir.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Programm
    if (path === '/program' || path === '/') {
      try {
        const res = await fetch(SOURCE, {
          headers: { 'User-Agent': UA },
          cf: { cacheTtl: 600, cacheEverything: true },
        });
        if (!res.ok) throw new Error('UCI antwortete mit ' + res.status);
        const html = await res.text();
        const films = parseProgram(html);
        await enrichRuntimes(films);
        const body = {
          cinema: 'UCI Ruhr-Park Bochum',
          source: SOURCE,
          fetchedAt: new Date().toISOString(),
          filmCount: films.length,
          showCount: films.reduce((a, f) => a + f.shows.length, 0),
          films,
        };
        return new Response(JSON.stringify(body), {
          headers: { ...cors(), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
          status: 502, headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'not found', path }), {
      status: 404, headers: { ...cors(), 'Content-Type': 'application/json' },
    });
  },
};
