// Startseite: Bücherregal mit Titelbildern, „Lesen“ und „Hören“.
'use strict';

(function () {
  const { t } = window.Stories;
  const shelf = document.getElementById('shelf');
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
    shelf.replaceChildren(...books.map(card));
    document.getElementById('bookCount').textContent = t('count', books.length);
  }

  Promise.all((window.BOOKS || []).map((id) => window.Stories.loadBook(id).catch(() => null)))
    .then((list) => { books = list.filter(Boolean); render(); });

  window.Stories.onLang(render);
  // Zurück aus dem Leser (bfcache): Fortschritt neu anzeigen
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
