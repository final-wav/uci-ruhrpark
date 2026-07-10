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

## Optional: globaler 403-Fallback (KV) – empfohlen

UCI blockt zeitweise die Cloudflare-IPs mit **403**. Der Worker cacht den
letzten guten Stand zwar, aber nur **pro Cloudflare-Standort**. Ein Nutzer,
dessen Netz über einen „kalten" Standort rausgeht, sieht im Blockmoment
trotzdem den Fehler. Mit einem **KV-Speicher** liegt der letzte gute Stand
**global** – dann liefert *jeder* Standort im Blockfall die letzte Version aus.

Der Code nutzt KV automatisch, sobald die Bindung `PROGRAM_KV` existiert –
ohne Bindung bleibt alles wie bisher.

### Variante A — Dashboard
1. **Workers & Pages → KV → Create namespace**, Name z.B. `uci-program`.
2. Beim Worker `uci-proxy`: **Settings → Variables and Secrets → KV Namespace
   Bindings → Add binding**.
3. **Variable name:** `PROGRAM_KV`, **KV namespace:** den eben erstellten wählen → **Deploy**.

### Variante B — Wrangler CLI
```bash
cd worker
wrangler kv namespace create PROGRAM_KV
```
Die ausgegebene `id` in [`wrangler.toml`](wrangler.toml) eintragen, den
`[[kv_namespaces]]`-Block einkommentieren, dann `wrangler deploy`.

### Prüfen
Wenn UCI blockt und KV greift, trägt die Antwort den Header `X-UCI-Stale: kv`
(lokaler Standort-Cache: `X-UCI-Stale: edge`).
