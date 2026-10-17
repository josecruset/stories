// Startseite: Bücherregal mit Titelbildern, „Lesen“ und „Hören“.
'use strict';

(function () {
  const { t } = window.Stories;
  const shelves = document.getElementById('shelves');
  const SHELVES = ['maerchen', 'geschichten']; // Reihenfolge der Regale
  let books = [];

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
    if (p.done) cover.append(el('span', 'badge done', '✓ ' + t('finished')));
    else if (p.page > 0 && p.page <= pages) cover.append(el('span', 'badge', t('continueAt', p.page)));

    const body = el('div', 'book-body');
    body.append(el('p', 'book-blurb', book.blurb[lang]));
    const meta = el('p', 'book-meta');
    const bits = [t('age', book.age), t('pages', pages)];
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

  function render() {
    const sections = SHELVES.map((id) => {
      const list = books.filter((b) => (b.shelf || 'geschichten') === id);
      if (!list.length) return null;
      const sec = el('section', 'shelf-section');
      sec.setAttribute('aria-labelledby', 'shelf-' + id);
      const head = el('div', 'section-head');
      const h = el('h2', null, t('shelf_' + id));
      h.id = 'shelf-' + id;
      head.append(h, el('span', 'count', t('count', list.length)));
      const grid = el('div', 'shelf');
      grid.append(...list.map(card));
      sec.append(head, grid);
      return sec;
    }).filter(Boolean);
    shelves.replaceChildren(...sections);
  }

  Promise.all((window.BOOKS || []).map((id) => window.Stories.loadBook(id).catch(() => null)))
    .then((list) => { books = list.filter(Boolean); render(); });

  window.Stories.onLang(render);
  // Zurück aus dem Leser (bfcache): Fortschritt neu anzeigen
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
