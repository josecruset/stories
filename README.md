# stories

Illustrierte Bücher und Hörbücher für Kinder unter **https://stories.cruset.com** –
das Gegenstück zu games.cruset.com. Reines HTML5, kein Build-Schritt.

## Aufbau

```
index.html              Bücherei (Startseite, Deutsch / Spanisch) mit Kategorien oben
eltern.html             Für Eltern: Märchen-Fassung wählen (kindgerecht / Original), Unterschiede
read.html               Leser und Hörbuch-Player: read.html?b=<id>[&mode=read|listen|start]
books.js                Bücherregal – Reihenfolge der Bücher; ORIGINALS ordnet Märchen ihre Originalfassung zu
assets/                 Styles, Skripte (common.js, library.js, reader.js), Icons
books/<id>/book.json    Titel, Kurztext, Alter, Regal, Herkunft, Seiten mit Text (de/es, Satz für Satz)
books/<id>/img/         cover.svg (3:4) und p01.svg … (3:2), eine Illustration pro Seite
books/<id>/audio/       Hörbuch-Spuren: <lang>/00.mp3 (Titel), 01.mp3 … (Seiten)
books/<id>/audio.json   Länge und Startzeit jedes Satzes pro Spur (für das Mitleuchten)
tools/make-audio.mjs    spricht die Bücher mit OpenAI TTS ein (nicht Teil der Webseite)
tools/check-books.mjs   prüft alle Bücher: Aufbau, Bilder, Audio passend zum Text
sw.js                   Service Worker: online immer aktuell, offline die letzte Version
```

Auf der Startseite wählt man oben die Kategorie (Märchen / Neue Geschichten). Die Wahl wird auf
dem Gerät gemerkt und steht im Link: `/#maerchen`, `/#geschichten`.

Im Leser:
- **Blättern:** mit den Pfeilknöpfen, den Pfeiltasten oder durch Wischen (die Seite folgt dem
  Finger; weit oder schnell genug gewischt, wird umgeblättert).
- **Selbst lesen:** Ein Tipp auf einen Satz liest genau diesen Satz vor.
- **Vorlesen lassen:** spielt Seite für Seite ab, der gesprochene Satz leuchtet mit, danach wird
  automatisch umgeblättert. Pause mit dem großen Knopf oder der Leertaste.
- **Satz zurück** (Knopf links neben Pause, nur beim Vorlesen; Taste ↑): wiederholt den laufenden
  Satz bzw. springt – kurz nach Satzbeginn – einen Satz zurück, am Seitenanfang auf den letzten
  Satz der vorigen Seite.
- Die Sprache (DE/ES) lässt sich jederzeit umschalten; sie wird unter `stories.lang` gespeichert,
  `?lang=es` bzw. `?lang=de` setzt sie per Link. Der Lesefortschritt liegt unter `stories.progress`.
- Vorgelesen wird nur mit echten Aufnahmen. Fehlt `audio.json` (oder die Sprache darin), zeigt der
  Leser keine Vorlese-Knöpfe – es gibt bewusst keine Computerstimme als Ersatz.

## Bücher

Die Startseite zeigt zwei Regale (Feld `shelf` in `book.json`):

- **Märchen** (`"shelf": "maerchen"`): 20 klassische Märchen, jeweils in zwei Fassungen (siehe
  „Märchen-Fassungen“): kindgerecht nacherzählt und entschärft, und – außer Goldlöckchen, dessen
  Erzählung schon dem Original entspricht – als Originalfassung. Grimm: Rotkäppchen, Hänsel und Gretel, Schneewittchen,
  Aschenputtel, Dornröschen, Froschkönig, Bremer Stadtmusikanten, Wolf und sieben Geißlein,
  Rumpelstilzchen, Rapunzel, Frau Holle, Sterntaler. Außerdem: Die drei kleinen Schweinchen,
  Goldlöckchen (englisch), Der gestiefelte Kater (Perrault), Das hässliche Entlein (Andersen),
  Der Rattenfänger von Hameln (Sage) sowie aus Spanien El Ratoncito Pérez (Coloma),
  La ratita presumida und Garbancito.
- **Neue Geschichten** (ohne `shelf`): Luna, Pip, Bruno (ab 3–4); Emma und der Roboter Bolt,
  Juli und der Leuchtturm (ab 6–7, 12 Seiten, längere Texte).
- **Interaktive Geschichten** (`"shelf": "interaktiv"`, `"interactive": true`): Luzi, Ole (ab 4); Nils und das Drachenei, Opa Kunos Zeitmaschine,
  Detektivin Mila (ab 6–7, 23–26 Seiten, 3 Entscheidungen pro Weg, 5 Enden) – das Kind
  entscheidet an mehreren Stellen über große Knöpfe (Symbol, Farbe, Nummer, ein Wort), wie es weitergeht.

`origin` nennt die Quelle (wird auf der Karte angezeigt).

## Märchen-Fassungen

- **Kindgerecht** (`books/<id>/`, 10 Seiten): entschärft – niemand wird gefressen oder grausam
  bestraft. **Standard**, solange Eltern nichts anderes einstellen.
- **Original** (`books/<id>-original/`, 9–25 Seiten): so wie das Märchen aufgeschrieben wurde
  (Grimm 1857 bzw. Deutsche Sagen 1816, Andersen 1843, Perrault 1697, Jacobs 1890, Coloma 1894,
  spanische Überlieferung), mit allen harten Stellen; Bilder zeigen sie im Bilderbuch-Stil, nicht
  blutrünstig. `book.json` hat zusätzlich `variantOf`, `"version": "original"` und `differences`
  (je Sprache eine Liste für Eltern: was die kindgerechte Fassung ändert).
- Zuordnung in `books.js`: `window.ORIGINALS = { '<id>': '<id>-original', … }`.
- **Eltern-Seite** `eltern.html` (Link unten auf der Startseite): kleine Rechenaufgabe als Hürde,
  dann Wahl für alle Märchen und für jedes einzeln, mit den Unterschieden zum Aufklappen.
  Gespeichert auf dem Gerät unter `stories.settings` (`version`, `perBook`).
- Bücherei und Leser zeigen bei Originalfassungen „📜 Original“; der Lesefortschritt wird je
  Fassung getrennt gemerkt.
- Die Originaltexte wurden aus Kenntnis der Quellen wiedergegeben, nicht gegen gedruckte Ausgaben
  abgeglichen; einzelne Formulierungen können vom Druck abweichen.

## Interaktive Geschichten

Gleiches Format wie die anderen Bücher, zusätzlich `"interactive": true`, eine Liste `endings`
(`id`, `icon`, `title`) und pro Seite eine `id` und genau eins von:

- `"next": "<seiten-id>"` – weiter zur nächsten Seite,
- `"choices": [{ "icon": "🌙", "color": "#ffb547", "label": { "de": "Mond", "es": "Luna" }, "to": "<seiten-id>" }, …]`
  – 2 bis 3 Knöpfe; die Nummer zeigt der Leser selbst an; die Frage steht als letzter Satz im Text,
- `"end": "<ende-id>"` – danach kommt die Ende-Seite mit allen entdeckten Enden.

Die erste Seite ist der Anfang. „Zurück“ geht den gegangenen Weg zurück, beim Vorlesen wartet der
Leser an Entscheidungen, bis ein Knopf gedrückt wird (Tasten 1–3 gehen auch). Entdeckte Enden stehen im
Lesefortschritt (`endings`) und auf der Karte („⭐ 2 von 3 Enden“). `tools/check-books.mjs` prüft
zusätzlich, dass alle Seiten erreichbar sind, jeder Weg endet und es keine Schleifen gibt.
`tools/make-audio.mjs` spricht interaktive Bücher genauso ein (eine Spur pro Seite in der Reihenfolge
von `pages`).

Lange Seiten (mehr als 48 Wörter) bekommen eine etwas kleinere Schrift. Im Hochformat verkleinert
der Leser bei Bedarf nur das Bild, damit Text und Entscheidungsknöpfe immer ganz sichtbar sind.

## Neues Buch hinzufügen

1. Ordner `books/<id>/` anlegen (`id` nur aus `a-z`, `0-9`, `-`).
2. `book.json` nach dem Vorbild der vorhandenen Bücher schreiben. Den Text jeder Seite als Liste
   von Sätzen angeben – jeder Satz wird einzeln hervorgehoben und lässt sich einzeln antippen.
3. Bilder als `img/cover.svg` (Hochformat 600×800, ohne Titel – den blendet die Seite ein) und
   `img/p01.svg` … (Querformat 1200×800) ablegen. PNG/JPG/WebP gehen auch, dann den Dateinamen
   in `book.json` (`image`) anpassen.
4. Audio erzeugen: `OPENAI_API_KEY=… node tools/make-audio.mjs <id>` (braucht `ffmpeg`; der Key
   kann auch als `OPENAI_API_KEY=…` in einer Datei `.env` im Repo liegen, sie ist in `.gitignore`).
   Jede Seite wird mit `gpt-4o-mini-tts` (Stimme `marin`) am Stück eingesprochen, damit sie flüssig
   klingt – als warme Vorleserin, Deutsch bzw. Spanisch aus Spanien. Danach ermittelt Whisper per
   Wort-Zeitstempel, wann welcher Satz beginnt. Stimme und Regieanweisung stehen oben im Skript.
   Unveränderte Seiten werden beim nächsten Lauf übersprungen (`--force` spricht alles neu ein).
   Die Sprachausgabe lässt gelegentlich einen Satz weg (oft die Frage am Seitenende). Deshalb prüft
   das Skript jede neue Aufnahme per Transkription und spricht die Seite bei fehlenden Sätzen bis zu
   viermal neu ein. `--verify` prüft zusätzlich alle vorhandenen Aufnahmen und repariert nur die
   fehlerhaften.
5. Die `id` in `books.js` eintragen und `node tools/check-books.mjs` laufen lassen.

**Eigene Aufnahmen** (z. B. selbst vorgelesen): MP3s in `audio/<lang>/` ersetzen und in
`audio.json` `dur` (Länge in Sekunden) und `marks` (Startsekunde jedes Satzes) anpassen.

## Lokal testen

```
python3 -m http.server 8644
```

Dann http://localhost:8644 öffnen. Hinweis: Pythons Server kann keine Range-Anfragen, deshalb
springt das Antippen eines Satzes lokal manchmal an den Seitenanfang; auf dem Server (nginx) klappt es.

## Deployment

Jeder Push auf `main` wird per GitHub Actions automatisch ausgeliefert
(`.github/workflows/deploy.yml`, auch manuell über „Run workflow“).

- Server: staging (207.180.217.99), Ordner `/root/stories/`:
  - `docker-compose.yml` – Container `stories` (nginx:1.27-alpine) im Netz `traefik_network`,
    Traefik-Router für `stories.cruset.com` mit Let's-Encrypt-Zertifikat und `security-headers@file`.
  - `nginx.conf` – liefert `html/` aus, sperrt versteckte Dateien und `/tools/`.
  - `deploy.sh` – holt `main` aus GitHub (`repo.git`, öffentliches Repo) nach `html/`.
  - `keys/github_actions` – Schlüssel der GitHub Action; in `/root/.ssh/authorized_keys` darf er
    nur `deploy.sh` ausführen.
- Secrets im Repo: `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`.
- Bei größeren Änderungen an Startseite oder Leser die Cache-Version in `sw.js` hochzählen.

Container neu starten: `ssh staging "cd /root/stories && docker compose up -d"`
