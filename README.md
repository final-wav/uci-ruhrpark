# UCI Ruhr-Park Bochum – Programm & Marathon-Planer

Eine übersichtliche Web-App für das komplette Kinoprogramm des **UCI Ruhr-Park Bochum** –
mit **automatisch berechneten Endzeiten** und einem **Marathon-Planer**, um mehrere Filme
am Stück zu planen (ideal für Vielseher / Ultimate-Karte).

Das gesamte Tagesprogramm auf einen Blick, ohne sich durch Einzelseiten zu klicken.

## Funktionen

- **Programm-Ansicht** – pro Film Poster, Altersfreigabe (FSK), Laufzeit und alle
  Vorstellungen als Kacheln. Jede Kachel zeigt **Start → berechnete Endzeit** und die
  Version (2D / 3D / iSense / IMAX / OV …). Ein Klick öffnet direkt die UCI-Buchung.
- **Endzeit-Berechnung** – `Endzeit = Startzeit + Werbepuffer + Filmlänge`.
  Der Werbepuffer (Trailer/Werbung vor dem Film) ist einstellbar, Standard **25 Min**.
- **Marathon-Planer** – Startfilm wählen; die Liste zeigt danach nur noch Filme, die
  zeitlich passen (inkl. einstellbarer Saalwechsel-Pause). Optionaler **Auto-Vorschlag**
  füllt eine komplette Kette (klar als „Vorschlag" markiert). Jeder Film ist **tauschbar**
  (⇄) oder entfernbar (✕). Zeigt Gesamtdauer, Pausen und Endzeit über Mitternacht hinaus.
- **Tickets & Teilen** – „Fertig" öffnet eine Übersicht mit einem **Ticket-Link pro Film**.
  Der Plan lässt sich als **Link teilen** (rekonstruiert sich beim Öffnen vollständig) oder
  als Text kopieren – praktisch für Gruppen.
- **Laufzeiten von IMDb/Wikidata** – für Filme, bei denen UCI noch keine Länge angibt,
  wird die Laufzeit über IMDb + Wikidata ergänzt und dezent mit „IMDb" gekennzeichnet.
- **Tagauswahl** (mehrere Wochen im Voraus) und **Versionsfilter** (2D/3D/OV/…).
- **Aktualisieren** holt frische Daten (sonst am Edge ~10 Min zwischengespeichert).

## Wie es funktioniert

UCI bietet keine öffentliche API, und die Website blockt direkte Browser-Zugriffe
(CORS + Hotlink-Schutz für Poster). Deshalb:

```
index.html + config.js   Statisches Frontend (Vanilla JS, kein Build-Tool).
        │                 Läuft auf jedem statischen Host (z. B. GitHub Pages).
        │  fetch /program, /img
        ▼
worker/worker.js         Cloudflare Worker: holt & parst das UCI-Programm, reicht
                         Poster durch, ergänzt fehlende Laufzeiten, setzt CORS-Header.

server.js                Identische Logik als kleiner Node-Server – nur für die lokale
                         Entwicklung. Auf localhost nutzt das Frontend automatisch ihn.
```

Das Frontend erkennt selbst: auf **localhost** spricht es `server.js` an, sonst den
**Cloudflare Worker** aus `config.js`.

## Setup (Hosting)

1. **Cloudflare Worker deployen** – Anleitung in [`worker/README.md`](worker/README.md).
   Ergibt eine URL wie `https://uci-proxy.<name>.workers.dev`.
2. Diese URL in **`config.js`** eintragen:
   ```js
   window.UCI_WORKER_BASE = "https://uci-proxy.<name>.workers.dev";
   ```
3. `index.html`, `config.js` und der Rest des Repos auf einem statischen Host
   (z. B. **GitHub Pages**) veröffentlichen. Die Daten liefert der Worker.

Sowohl GitHub Pages als auch der Cloudflare-Worker-Free-Tier sind kostenlos.

## Lokal starten

```bash
node server.js
```
→ **http://localhost:8787** – nur Node ≥ 18 nötig, keine Abhängigkeiten.
`config.js` wird lokal ignoriert (der Node-Server übernimmt Daten + Poster).

## Anderes UCI-Kino

Die Struktur ist bei allen UCI-Häusern gleich: In `worker/worker.js` **und** `server.js`
die `SOURCE`-URL und die `siteId` auf ein anderes Kino ändern. (Der Parser ist in beiden
Dateien absichtlich identisch – bei UCI-Markup-Änderungen also beide anpassen.)

## Bekannte Grenze

Manche Vorpremieren weit in der Zukunft haben noch **keine veröffentlichte Laufzeit**
(weder bei UCI noch bei IMDb/Wikidata). Dort steht „Länge unbekannt"; solche Filme lassen
sich nicht sicher in eine Marathon-Kette einplanen, bis die Länge verfügbar ist.

## Hinweis

Inoffizielles Fan-Projekt, nicht mit UCI Kinowelt verbunden. Alle Programmdaten und Poster
stammen von uci-kinowelt.de; Laufzeit-Ergänzungen von IMDb und Wikidata.
