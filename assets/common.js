// Gemeinsames für Startseite und Leser: Sprache, Texte, Lesefortschritt, Bücher laden.
'use strict';

(function () {
  const LANGS = ['de', 'es'];

  const STR = {
    de: {
      siteTitle: 'Geschichten für Kinder',
      heroTitle: 'Bücher zum Lesen und Zuhören',
      heroTitle_maerchen: 'Märchen zum Lesen und Zuhören',
      heroTitle_interaktiv: 'Mitmachbücher zum Lesen und Zuhören',
      heroText: 'Such dir eine Geschichte aus: Lies sie selbst oder lass sie dir vorlesen – mit Bildern auf jeder Seite.',
      shelf_maerchen: 'Märchen',
      shelf_geschichten: 'Neue Geschichten',
      shelf_interaktiv: 'Interaktive Geschichten',
      endings: (n) => `${n} Enden`,
      endingsBadge: (f, n) => `⭐ ${f} von ${n} Enden`,
      endingsFound: (f, n) => `Du hast ${f} von ${n} Enden entdeckt. Wie geht es wohl anders aus?`,
      allEndings: 'Super! Du hast alle Enden entdeckt! 🎉',
      otherWay: 'Anders entscheiden',
      youDecide: 'Du entscheidest!',
      short_maerchen: 'Märchen',
      short_geschichten: 'Neu',
      short_interaktiv: 'Interaktiv',
      categories: 'Kategorien',
      count: (n) => (n === 1 ? '1 Geschichte' : `${n} Geschichten`),
      footer: 'Märchen und neue Geschichten – liebevoll gemalt und vorgelesen. Viel Spaß!',
      games: '🎮 Spiele für Kinder',
      madeBy: 'Gemacht von',
      parentsLink: '👪 Für Eltern: Märchen-Fassungen',
      originalBadge: '📜 Original',
      originalTag: (o) => `📜 Originalfassung${o ? ' – ' + o : ''}`,
      parentsTitle: 'Für Eltern',
      parentsGate: 'Dieser Bereich ist für Eltern. Bitte rechne:',
      parentsGateWrong: 'Das stimmt leider nicht – bitte noch einmal.',
      parentsGo: 'Weiter',
      parentsIntro: 'Die Märchen gibt es in zwei Fassungen. Die Originalfassung erzählt das Märchen so, wie es aufgeschrieben wurde (Brüder Grimm, Andersen, Perrault, spanische Überlieferung …) – mit allen harten Stellen: Gewalt, Strafen und Tod. Die kindgerechte Fassung erzählt dieselbe Geschichte nach, aber entschärft. Ohne Einstellung sehen Kinder die kindgerechte Fassung.',
      parentsAll: 'Fassung für alle Märchen',
      verKind: 'Kindgerecht',
      verOrig: 'Original',
      verDefault: 'Wie oben',
      parentsEach: 'Einzelne Märchen',
      parentsEachHint: 'Hier können Sie für jedes Märchen eine eigene Wahl treffen und nachlesen, was die kindgerechte Fassung ändert.',
      whatDiffers: 'Was ist in der kindgerechten Fassung anders?',
      sameAsOriginal: 'Ohne eigene Originalfassung, weil die Erzählung schon dem Original entspricht:',
      saved: 'Gespeichert ✓',
      backToLibrary: '← Zur Bücherei',
      read: 'Lesen',
      listen: 'Hören',
      age: (n) => `ab ${n} Jahren`,
      pages: (n) => `${n} Seiten`,
      minutes: (m) => `${m} Min.`,
      continueAt: (p) => `Weiter auf Seite ${p}`,
      finished: 'Gelesen',
      home: 'Zur Bücherei',
      startRead: 'Selbst lesen',
      startListen: 'Vorlesen lassen',
      play: 'Vorlesen',
      pause: 'Pause',
      sentenceBack: 'Satz zurück',
      prev: 'Zurück',
      next: 'Weiter',
      pageOf: (p, n) => `Seite ${p} von ${n}`,
      theEnd: 'Ende',
      endText: 'Toll gemacht! Möchtest du die Geschichte noch einmal hören oder eine neue aussuchen?',
      again: 'Noch einmal',
      another: 'Neue Geschichte',
      tapHint: 'Tipp auf einen Satz, dann hörst du ihn.',
      notFound: 'Diese Geschichte gibt es leider nicht.',
      loadError: 'Die Geschichte konnte nicht geladen werden.',
      cover: 'Titelbild',
      autoTurn: 'Automatisch umblättern',
    },
    es: {
      siteTitle: 'Cuentos para niños',
      heroTitle: 'Libros para leer y escuchar',
      heroTitle_maerchen: 'Cuentos de hadas para leer y escuchar',
      heroTitle_interaktiv: 'Libros interactivos para leer y escuchar',
      heroText: 'Elige un cuento: léelo tú mismo o deja que te lo lean, con dibujos en cada página.',
      shelf_maerchen: 'Cuentos clásicos',
      shelf_geschichten: 'Cuentos nuevos',
      shelf_interaktiv: 'Cuentos interactivos',
      endings: (n) => `${n} finales`,
      endingsBadge: (f, n) => `⭐ ${f} de ${n} finales`,
      endingsFound: (f, n) => `Has descubierto ${f} de ${n} finales. ¿Cómo acabará si eliges otra cosa?`,
      allEndings: '¡Genial! ¡Has descubierto todos los finales! 🎉',
      otherWay: 'Elegir otro camino',
      youDecide: '¡Tú decides!',
      short_maerchen: 'Clásicos',
      short_geschichten: 'Nuevos',
      short_interaktiv: 'Interactivos',
      categories: 'Categorías',
      count: (n) => (n === 1 ? '1 cuento' : `${n} cuentos`),
      footer: 'Cuentos clásicos y nuevos, con dibujos y para escuchar. ¡Que los disfrutes!',
      games: '🎮 Juegos para niños',
      madeBy: 'Hecho por',
      parentsLink: '👪 Para padres: versiones de los cuentos',
      originalBadge: '📜 Original',
      originalTag: (o) => `📜 Versión original${o ? ' – ' + o : ''}`,
      parentsTitle: 'Para padres',
      parentsGate: 'Esta zona es para madres y padres. Resuelve la cuenta:',
      parentsGateWrong: 'No es correcto. Inténtalo de nuevo.',
      parentsGo: 'Continuar',
      parentsIntro: 'Los cuentos clásicos están en dos versiones. La versión original cuenta el cuento tal y como se escribió (hermanos Grimm, Andersen, Perrault, tradición popular española…), con todos sus momentos duros: violencia, castigos y muerte. La versión infantil cuenta la misma historia, pero suavizada. Si no se elige nada, los niños ven la versión infantil.',
      parentsAll: 'Versión para todos los cuentos',
      verKind: 'Infantil',
      verOrig: 'Original',
      verDefault: 'Como arriba',
      parentsEach: 'Cada cuento',
      parentsEachHint: 'Aquí puede elegir la versión de cada cuento por separado y leer qué cambia la versión infantil.',
      whatDiffers: '¿Qué cambia en la versión infantil?',
      sameAsOriginal: 'Sin versión original aparte, porque el cuento ya coincide con el original:',
      saved: 'Guardado ✓',
      backToLibrary: '← A la biblioteca',
      read: 'Leer',
      listen: 'Escuchar',
      age: (n) => `desde ${n} años`,
      pages: (n) => `${n} páginas`,
      minutes: (m) => `${m} min`,
      continueAt: (p) => `Seguir en la página ${p}`,
      finished: 'Leído',
      home: 'A la biblioteca',
      startRead: 'Leer yo',
      startListen: 'Que me lo lean',
      play: 'Leer en voz alta',
      pause: 'Pausa',
      sentenceBack: 'Frase anterior',
      prev: 'Atrás',
      next: 'Siguiente',
      pageOf: (p, n) => `Página ${p} de ${n}`,
      theEnd: 'Fin',
      endText: '¡Muy bien! ¿Quieres escuchar el cuento otra vez o elegir uno nuevo?',
      again: 'Otra vez',
      another: 'Otro cuento',
      tapHint: 'Toca una frase y la escucharás.',
      notFound: 'Este cuento no existe.',
      loadError: 'No se ha podido cargar el cuento.',
      cover: 'Portada',
      autoTurn: 'Pasar página solo',
    },
  };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* privater Modus: dann eben ohne Speichern */ }
    return null;
  }

  function initialLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) { store('stories.lang', q); return q; }
    const saved = store('stories.lang');
    if (LANGS.includes(saved)) return saved;
    return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'de';
  }

  let lang = initialLang();
  const listeners = [];

  function t(key, ...args) {
    const v = STR[lang][key] ?? STR.de[key] ?? key;
    return typeof v === 'function' ? v(...args) : v;
  }

  function applyStatic() {
    document.documentElement.lang = lang;
    if (document.body.classList.contains('library')) document.title = t('siteTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); el.title = t(el.dataset.i18nLabel); });
    document.querySelectorAll('.lang-switch [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    store('stories.lang', lang);
    applyStatic();
    listeners.forEach((fn) => fn(lang));
  }

  // Lesefortschritt pro Buch: { page, done }
  function progress(id, value) {
    const all = store('stories.progress') || {};
    if (value === undefined) return all[id] || {};
    all[id] = { ...all[id], ...value };
    store('stories.progress', all);
    return all[id];
  }

  // Märchen-Fassung: Originalfassungen stehen in window.ORIGINALS (books.js) als { id: 'id-original' }.
  // Ohne Einstellung gilt die kindgerechte Fassung; Eltern wählen auf eltern.html für alle oder einzeln.
  const DEFAULT_VERSION = 'kindgerecht';
  function settings(value) {
    const s = store('stories.settings') || {};
    if (value === undefined) return { version: s.version || DEFAULT_VERSION, perBook: s.perBook || {} };
    store('stories.settings', value);
    return value;
  }
  function versionFor(id) {
    if (!(window.ORIGINALS || {})[id]) return null;
    const s = settings();
    return s.perBook[id] || s.version;
  }
  const variantId = (id) => (versionFor(id) === 'original' ? window.ORIGINALS[id] : id);

  const cache = {};
  function loadBook(id) {
    if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error('bad id'));
    if (!cache[id]) {
      const base = `books/${id}/`;
      const json = (f) => fetch(base + f).then((r) => (r.ok ? r.json() : null));
      cache[id] = Promise.all([json('book.json'), json('audio.json').catch(() => null)]).then(([book, audio]) => {
        if (!book) throw new Error('not found');
        return { ...book, base, audio: audio || null };
      });
    }
    return cache[id];
  }

  // Gesamtlänge der Hörbuch-Spuren in Minuten (aufgerundet)
  // Hördauer in Minuten; bei interaktiven Geschichten der längste Weg (Titel + Seiten bis zu einem Ende)
  function minutes(book, l) {
    const tracks = book.audio && book.audio[l];
    if (!tracks) return 0;
    let secs = tracks.reduce((s, x) => s + x.dur, 0);
    if (book.interactive && book.pages.length) {
      const index = new Map(book.pages.map((p, i) => [p.id, i]));
      const longest = (id, depth) => {
        const i = index.get(id);
        if (i == null || depth > 50) return 0;
        const p = book.pages[i];
        const next = p.next ? [p.next] : p.choices ? p.choices.map((c) => c.to) : [];
        return (tracks[i + 1]?.dur || 0) + Math.max(0, ...next.map((n) => longest(n, depth + 1)));
      };
      secs = (tracks[0]?.dur || 0) + longest(book.pages[0].id, 0);
    }
    return Math.max(1, Math.round(secs / 60));
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.lang-switch [data-lang]');
    if (b) setLang(b.dataset.lang);
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  window.Stories = {
    get lang() { return lang; }, t, setLang, applyStatic, onLang: (fn) => listeners.push(fn),
    progress, loadBook, minutes, store, settings, versionFor, variantId,
  };
  applyStatic();
})();
