# stories

Illustrierte Bücher und Hörbücher für Kinder unter **https://stories.cruset.com** –
das Gegenstück zu games.cruset.com. Reines HTML5, kein Build-Schritt.

## Aufbau

```
index.html              Bücherei (Startseite, Deutsch / Spanisch)
read.html               Leser und Hörbuch-Player: read.html?b=<id>[&mode=read|listen|start]
books.js                Bücherregal – Reihenfolge der Bücher auf der Startseite
assets/                 Styles, Skripte (common.js, library.js, reader.js), Icons
books/<id>/book.json    Titel, Kurztext, Alter, Seiten mit Text (de/es, Satz für Satz)
books/<id>/img/         cover.svg (3:4) und p01.svg … (3:2), eine Illustration pro Seite
books/<id>/audio/       Hörbuch-Spuren: <lang>/00.mp3 (Titel), 01.mp3 … (Seiten)
books/<id>/audio.json   Länge und Startzeit jedes Satzes pro Spur (für das Mitleuchten)
tools/make-audio.mjs    spricht die Bücher mit OpenAI TTS ein (nicht Teil der Webseite)
sw.js                   Service Worker: online immer aktuell, offline die letzte Version
```

Im Leser:
- **Selbst lesen:** blättern mit Pfeilen, Wischen oder Pfeiltasten. Ein Tipp auf einen Satz liest
  genau diesen Satz vor.
- **Vorlesen lassen:** spielt Seite für Seite ab, der gesprochene Satz leuchtet mit, danach wird
  automatisch umgeblättert. Pause mit dem großen Knopf oder der Leertaste.
- Die Sprache (DE/ES) lässt sich jederzeit umschalten; sie wird unter `stories.lang` gespeichert,
  `?lang=es` bzw. `?lang=de` setzt sie per Link. Der Lesefortschritt liegt unter `stories.progress`.
- Vorgelesen wird nur mit echten Aufnahmen. Fehlt `audio.json` (oder die Sprache darin), zeigt der
  Leser keine Vorlese-Knöpfe – es gibt bewusst keine Computerstimme als Ersatz.

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
5. Die `id` in `books.js` eintragen.

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
