# UCI Ruhr-Park Bochum – Programm & Marathon-Planer

Übersichtliche Ansicht des kompletten Kinoprogramms vom **UCI Ruhr-Park Bochum** mit
**berechneten Endzeiten** und einem **Marathon-Planer** für mehrere Filme am Stück
(gedacht für die Ultimate-Karte).

## Architektur

Gleiches Muster wie *vrr-abfahrtsmonitor*: **statisches Frontend + Cloudflare Worker**.

```
index.html + config.js   ← reines Frontend (Vanilla JS), läuft auf GitHub Pages / Cloudflare
        │
        │  fetch  /program , /img
        ▼
worker/worker.js         ← Cloudflare Worker: holt & parst das UCI-Programm, proxied Poster,
                           setzt CORS-Header (UCI selbst blockt Browser-Fetches + Hotlinking)

server.js                ← nur für LOKALE Entwicklung (Node), ersetzt den Worker auf localhost
```

Das Frontend erkennt automatisch: auf **localhost** spricht es `server.js` an, sonst den
**Worker** aus `config.js`.

## Produktiv nutzen (GitHub Pages / Cloudflare)

1. **Worker deployen** – Anleitung in [`worker/README.md`](worker/README.md).
   Ergibt eine URL wie `https://uci-proxy.deinname.workers.dev`.
2. Diese URL in **`config.js`** eintragen:
   ```js
   window.UCI_WORKER_BASE = "https://uci-proxy.deinname.workers.dev";
   ```
3. Committen & pushen. Pages/Cloudflare liefert `index.html` aus, die Daten kommen vom Worker.

Privates Repo + Hosting über Cloudflare ist kostenlos – der „GitHub Pro"-Hinweis gilt nur
für reines GitHub Pages aus privaten Repos.

## Lokal entwickeln / testen

```
node server.js
```
→ **http://localhost:8787** (nur Node ≥ 18 nötig, keine npm-Pakete). `config.js` wird
lokal ignoriert.

## Was es kann

- **Programm-Ansicht:** pro Film Poster, FSK, Länge und alle Vorstellungen als Kacheln.
  Jede Kachel zeigt **Start → berechnete Endzeit** und die Version (2D/3D/iSense/IMAX/OV…).
  Klick auf eine Kachel öffnet direkt die UCI-Buchungsseite.
- **Endzeit-Berechnung:** `Endzeit = Start + Werbepuffer + Filmlänge`.
  Werbepuffer oben einstellbar (Standard **25 Min** für Trailer/Werbung vor dem Film).
- **Marathon-Planer:** Startfilm wählen → es werden automatisch alle Filme angehängt,
  die du danach ohne Kollision noch schaffst (inkl. Saalwechsel-Pause, Standard 15 Min).
  Zeigt Gesamtdauer, Pausen und Endzeit über Mitternacht hinaus.
- **Tagauswahl** (mehrere Wochen im Voraus) und **Versionsfilter**.
- **↻ Aktualisieren** holt frische Daten (Worker cacht sonst ~10 Min am Edge).

## Bekannte Grenze

Ein paar Vorpremieren weit in der Zukunft (z. B. *Backrooms*, *Die Odyssee*) haben
noch **keine Laufzeit** veröffentlicht – dort steht „Länge unbekannt" und sie werden
im Auto-Marathon übersprungen, bis die Länge bekannt ist.

## Anderes Kino?

`SOURCE`-URL und `siteId` in `worker/worker.js` **und** `server.js` auf ein anderes
UCI-Haus ändern – die Struktur ist bei allen UCI-Kinos gleich. (Der Parser ist bewusst
in beiden Dateien identisch gehalten; bei Markup-Änderungen beide anpassen.)
