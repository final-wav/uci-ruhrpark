# UCI Ruhr-Park Bochum – Programm & Marathon-Planer

Übersichtliche Ansicht des kompletten Kinoprogramms vom **UCI Ruhr-Park Bochum** mit
**berechneten Endzeiten** und einem **Marathon-Planer** für mehrere Filme am Stück
(gedacht für die Ultimate-Karte).

## Starten

```
cd uci-ruhrpark
node server.js
```

Dann im Browser öffnen: **http://localhost:8787**

Läuft ohne jede Installation (nur Node ≥ 18 nötig, keine npm-Pakete).

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
- **↻ Aktualisieren** holt frische Daten (sonst 10 Min gecacht).

## Wie es an die Daten kommt

UCI hat keine offizielle API, aber die Seite
`uci-kinowelt.de/kinoprogramm/bochum-ruhr-park/46/poster` ist server-gerendert –
ein einziger Request enthält das komplette Programm. `server.js` holt und parst es
(Titel, Länge, FSK, Poster, Datum, Uhrzeit, Version, Buchungslink) und liefert es als
JSON unter `/api/program`. Poster laufen über einen kleinen Proxy (`/img`), um den
Hotlink-Schutz zu umgehen.

## Bekannte Grenze

Ein paar Vorpremieren weit in der Zukunft (z. B. *Backrooms*, *Die Odyssee*) haben
noch **keine Laufzeit** veröffentlicht – dort steht „Länge unbekannt" und sie werden
im Auto-Marathon übersprungen, bis die Länge bekannt ist.

## Anderes Kino?

In `server.js` die `SOURCE`-URL und die `siteId` (im Poster-Proxy-Check) auf ein
anderes UCI-Haus ändern – die Struktur ist bei allen UCI-Kinos gleich.
