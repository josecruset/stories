// Startseite: Kategorien oben (Märchen / Neue Geschichten / Interaktiv), darunter das Regal der gewählten
// Kategorie mit Titelbildern, „Lesen“ und „Hören“. Die Wahl steht im Link (#maerchen) und
// wird auf dem Gerät gemerkt.
'use strict';

(function () {
  const { t } = window.Stories;
  const S = window.Stories;
  const shelf = document.getElementById('shelf');
  const tabs = document.getElementById('shelfTabs');
  const SHELVES = [ // Reihenfolge der Kategorien
    { id: 'maerchen', icon: '🏰' },
    { id: 'geschichten', icon: '🌈' },
    { id: 'interaktiv', icon: '🔀' },
  ];
  const shelfOf = (b) => b.shelf || 'geschichten';
  let books = [];
  let current = initialShelf();

  function initialShelf() {
    const fromHash = location.hash.slice(1);
    if (SHELVES.some((s) => s.id === fromHash)) return fromHash;
    const saved = S.store('stories.shelf');
    return SHELVES.some((s) => s.id === saved) ? saved : SHELVES[0].id;
  }

  function select(id, focus = false) {
    if (!SHELVES.some((s) => s.id === id)) return;
    current = id;
    S.store('stories.shelf', id);
    history.replaceState(null, '', '#' + id);
    render();
    if (focus) tabs.querySelector(`[data-shelf="${id}"]`)?.focus();
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(book) {
    const lang = window.Stories.lang;
    const p = window.Stories.progress(book.id);
    const pages = book.pages.length;
    const href = (mode) => `read.html?b=${encodeURIComponent(book.id)}${mode ? '&mode=' + mode : ''}`;

    const art = el('article', 'book');
    art.style.setProperty('--accent', book.accent || '#ffb547');

    const cover = el('a', 'book-cover');
    cover.href = href();
    const img = el('img');
    img.src = book.base + 'img/cover.svg';
    img.alt = '';
    img.loading = 'lazy';
    cover.append(img, el('span', 'book-title', book.title[lang]));
    if (book.version === 'original') cover.append(el('span', 'badge orig', t('originalBadge')));
    const nEnd = (book.endings || []).length;
    const found = (p.endings || []).filter((id) => (book.endings || []).some((e) => e.id === id)).length;
    if (book.interactive) {
      if (found) cover.append(el('span', 'badge' + (found >= nEnd ? ' done' : ''), t('endingsBadge', found, nEnd)));
      else cover.append(el('span', 'badge decide', '🔀 ' + t('youDecide')));
    } else if (p.done) cover.append(el('span', 'badge done', '✓ ' + t('finished')));
    else if (p.page > 0 && p.page <= pages) cover.append(el('span', 'badge', t('continueAt', p.page)));

    const body = el('div', 'book-body');
    body.append(el('p', 'book-blurb', book.blurb[lang]));
    const meta = el('p', 'book-meta');
    const bits = [t('age', book.age), book.interactive ? '🔀 ' + t('endings', nEnd) : t('pages', pages)];
    if (book.origin) body.insertBefore(el('p', 'book-origin', book.origin[lang]), body.firstChild);
    const mins = window.Stories.minutes(book, lang);
    if (mins) bits.push('🎧 ' + t('minutes', mins));
    meta.textContent = bits.join(' · ');
    body.append(meta);

    const actions = el('div', 'book-actions');
    const read = el('a', 'btn btn-read');
    read.href = href('read');
    read.innerHTML = '<span aria-hidden="true">📖</span> ';
    read.append(t('read'));
    const listen = el('a', 'btn btn-listen');
    listen.href = href('listen');
    listen.innerHTML = '<span aria-hidden="true">🎧</span> ';
    listen.append(t('listen'));
    actions.append(read);
    if (mins) actions.append(listen); // nur mit echten Aufnahmen
    body.append(actions);

    art.append(cover, body);
    return art;
  }

  function renderTabs() {
    tabs.setAttribute('aria-label', t('categories'));
    tabs.replaceChildren(...SHELVES.map(({ id, icon }) => {
      const b = el('button', 'shelf-tab');
      b.type = 'button';
      b.id = 'tab-' + id;
      b.dataset.shelf = id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(id === current));
      b.setAttribute('aria-controls', 'shelf');
      b.tabIndex = id === current ? 0 : -1;
      const n = books.filter((x) => shelfOf(x) === id).length;
      // volle Bezeichnung, auf schmalen Bildschirmen die Kurzform
      b.append(el('span', 'shelf-tab-icon', icon), el('span', 'shelf-tab-name', t('shelf_' + id)),
        el('span', 'shelf-tab-short', t('short_' + id)));
      b.setAttribute('aria-label', t('shelf_' + id));
      if (n) b.append(el('span', 'shelf-tab-count', String(n)));
      b.querySelector('.shelf-tab-icon').setAttribute('aria-hidden', 'true');
      return b;
    }));
  }

  // Überschrift passend zur Kategorie (ohne eigene Überschrift: die allgemeine)
  function renderHero() {
    const key = 'heroTitle_' + current;
    const title = t(key);
    document.getElementById('heroTitle').textContent = title === key ? t('heroTitle') : title;
  }

  function render() {
    renderTabs();
    renderHero();
    shelf.setAttribute('aria-labelledby', 'tab-' + current);
    shelf.replaceChildren(...books.filter((b) => shelfOf(b) === current).map(card));
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shelf]');
    if (b) select(b.dataset.shelf);
  });
  // Pfeiltasten zwischen den Kategorien (Tab-Leiste)
  tabs.addEventListener('keydown', (e) => {
    const i = SHELVES.findIndex((s) => s.id === current);
    if (e.key === 'ArrowRight') select(SHELVES[(i + 1) % SHELVES.length].id, true);
    else if (e.key === 'ArrowLeft') select(SHELVES[(i - 1 + SHELVES.length) % SHELVES.length].id, true);
  });
  window.addEventListener('hashchange', () => select(initialShelf()));

  // Märchen in der von den Eltern gewählten Fassung (kindgerecht oder Original)
  Promise.all((window.BOOKS || []).map((id) => S.loadBook(S.variantId(id)).catch(() => S.loadBook(id)).catch(() => null)))
    .then((list) => { books = list.filter(Boolean); render(); });

  window.Stories.onLang(render);
  // Zurück aus dem Leser (bfcache): Fortschritt neu anzeigen
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
