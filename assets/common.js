// Gemeinsames für Startseite und Leser: Sprache, Texte, Lesefortschritt, Bücher laden.
'use strict';

(function () {
  const LANGS = ['de', 'es'];

  const STR = {
    de: {
      siteTitle: 'Geschichten für Kinder',
      heroTitle: 'Bücher zum Lesen und Zuhören',
      heroText: 'Such dir eine Geschichte aus: Lies sie selbst oder lass sie dir vorlesen – mit Bildern auf jeder Seite.',
      shelf_maerchen: 'Märchen',
      shelf_geschichten: 'Neue Geschichten',
      categories: 'Kategorien',
      count: (n) => (n === 1 ? '1 Geschichte' : `${n} Geschichten`),
      footer: 'Märchen und neue Geschichten – liebevoll gemalt und vorgelesen. Viel Spaß!',
      games: '🎮 Spiele für Kinder',
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
      heroText: 'Elige un cuento: léelo tú mismo o deja que te lo lean, con dibujos en cada página.',
      shelf_maerchen: 'Cuentos clásicos',
      shelf_geschichten: 'Cuentos nuevos',
      categories: 'Categorías',
      count: (n) => (n === 1 ? '1 cuento' : `${n} cuentos`),
      footer: 'Cuentos clásicos y nuevos, con dibujos y para escuchar. ¡Que los disfrutes!',
      games: '🎮 Juegos para niños',
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
  function minutes(book, l) {
    const tracks = book.audio && book.audio[l];
    if (!tracks) return 0;
    return Math.max(1, Math.round(tracks.reduce((s, x) => s + x.dur, 0) / 60));
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
    progress, loadBook, minutes, store,
  };
  applyStatic();
})();
