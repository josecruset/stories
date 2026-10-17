// Bücherregal des Portals – Reihenfolge wie auf der Startseite.
// Das Regal (Märchen / neue Geschichten) steht als "shelf" in der book.json des Buches.
// Neues Buch: Ordner books/<id>/ mit book.json und img/ anlegen (siehe README),
// Audio mit `node tools/make-audio.mjs <id>` erzeugen, mit `node tools/check-books.mjs` prüfen
// und die id hier eintragen.
window.BOOKS = [
  // Märchen
  'rotkaeppchen', 'haensel-gretel', 'schneewittchen', 'aschenputtel', 'dornroeschen',
  'drei-schweinchen', 'froschkoenig', 'stadtmusikanten', 'geisslein', 'rumpelstilzchen',
  'gestiefelter-kater', 'haessliches-entlein', 'goldloeckchen', 'rapunzel', 'frau-holle',
  'raton-perez', 'ratita', 'garbancito', 'rattenfaenger', 'sterntaler',
  // Neue Geschichten (ab 3–4, dann ab 6–7)
  'luna', 'pip', 'bruno', 'roboter-bolt', 'leuchtturm',
  // Interaktive Geschichten (ab 4, dann ab 6–7)
  'luzi', 'ole', 'drachenei', 'zeitmaschine', 'detektivin-mila',
];
