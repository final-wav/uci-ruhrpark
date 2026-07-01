# UCI-Programm-Proxy (Cloudflare Worker)

Holt das server-gerenderte Programm des UCI Ruhr-Park Bochum, parst es und
liefert es dem statischen Frontend mit CORS-Headern. Reicht außerdem die
Poster durch (Hotlink-Schutz). Ohne ihn könnte der Browser die UCI-Seite nicht
direkt lesen.

## Deploy

### Variante A — Dashboard (kein Tooling nötig)
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Namen vergeben (z.B. `uci-proxy`) → **Deploy**.
3. **Edit code** → den kompletten Inhalt von [`worker.js`](worker.js) einfügen → **Deploy**.
4. Die URL kopieren, z.B. `https://uci-proxy.deinname.workers.dev`.

### Variante B — Wrangler CLI
```bash
npm install -g wrangler
cd worker
wrangler login
wrangler deploy
```
Am Ende gibt Wrangler die Worker-URL aus.

## Danach
Die Worker-URL in **`../config.js`** eintragen:
```js
window.UCI_WORKER_BASE = "https://uci-proxy.deinname.workers.dev";
```
committen & pushen – fertig.

## Test
```
https://uci-proxy.deinname.workers.dev/program
```
Sollte JSON mit `films[]` liefern – mit `Access-Control-Allow-Origin: *`.
