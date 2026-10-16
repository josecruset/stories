// Leser und Hörbuch-Player.
// Ansichten: 0 = Titelseite, 1 … n = Seiten der Geschichte, n + 1 = Ende.
// „Vorlesen“ spielt die Spur der Seite ab (books/<id>/audio/<lang>/NN.mp3), lässt den
// gerade gesprochenen Satz mitleuchten und blättert danach von selbst weiter.
// Ein Tipp auf einen Satz liest nur diesen Satz vor. Vorgelesen wird nur mit echten
// Aufnahmen (audio.json) – ohne sie gibt es keine Vorlese-Knöpfe, keine Computerstimme.
'use strict';

(function () {
  const S = window.Stories;
  const { t } = S;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const audio = $('audio');
  const playBtn = $('playBtn');
  const params = new URLSearchParams(location.search);
  const bookId = params.get('b') || '';
  const mode = params.get('mode');

  let book = null;
  let view = 0;           // aktuelle Ansicht
  let playing = false;    // Vorlese-Modus: Seite für Seite weiter
  let segmentEnd = null;  // beim Antippen eines Satzes: hier anhalten
  let turnTimer = 0;
  let activeSentence = -1;

  const last = () => book.pages.length + 1;
  const isPage = (v) => v >= 1 && v <= book.pages.length;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function sentences(v) {
    if (v === 0) return [book.title[S.lang]];
    return isPage(v) ? book.pages[v - 1].text[S.lang] : [];
  }

  const hasAudio = () => !!(book && book.audio && book.audio[S.lang] && book.audio[S.lang].length);

  function track(v) {
    const list = book.audio && book.audio[S.lang];
    return list && list[v] ? list[v] : null;
  }

  // ---------- Darstellung ----------

  function renderCover() {
    const wrap = el('section', 'cover-view');
    const fig = el('figure', 'cover-art');
    const img = el('img');
    img.src = book.base + 'img/cover.svg';
    img.alt = t('cover');
    fig.append(img);
    const side = el('div', 'cover-side');
    const h = el('h2', 'cover-title');
    h.append(sentenceSpan(book.title[S.lang], 0));
    side.append(h, el('p', 'cover-blurb', book.blurb[S.lang]));
    const actions = el('div', 'cover-actions');
    const read = el('button', 'btn btn-read big');
    read.type = 'button';
    read.innerHTML = '<span aria-hidden="true">📖</span> ';
    read.append(t('startRead'));
    read.onclick = () => { stop(); go(1); };
    const listen = el('button', 'btn btn-listen big' + (mode === 'listen' ? ' pulse' : ''));
    listen.type = 'button';
    listen.innerHTML = '<span aria-hidden="true">🎧</span> ';
    listen.append(t('startListen'));
    listen.onclick = () => { go(1); start(); };
    actions.append(read);
    if (hasAudio()) actions.append(listen);
    side.append(actions);
    wrap.append(fig, side);
    return wrap;
  }

  function sentenceSpan(text, i) {
    const s = el('span', 'sentence', text);
    s.dataset.i = i;
    return s;
  }

  function renderPage(v) {
    const page = book.pages[v - 1];
    const wrap = el('section', 'page-view');
    const fig = el('figure', 'page-art');
    const img = el('img');
    img.src = book.base + 'img/' + page.image;
    img.alt = '';
    fig.append(img);
    const paper = el('div', 'paper');
    const p = el('p', 'story-text');
    page.text[S.lang].forEach((txt, i) => {
      if (i) p.append(' ');
      p.append(sentenceSpan(txt, i));
    });
    paper.append(p, el('span', 'page-no', String(v)));
    wrap.append(fig, paper);
    return wrap;
  }

  function renderEnd() {
    const wrap = el('section', 'end-view');
    const stars = el('div', 'end-stars');
    stars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) {
      const s = el('i');
      s.style.setProperty('--d', i);
      stars.append(s);
    }
    const img = el('img', 'end-cover');
    img.src = book.base + 'img/cover.svg';
    img.alt = '';
    const actions = el('div', 'cover-actions');
    const again = el('button', 'btn btn-listen big');
    again.type = 'button';
    again.innerHTML = '<span aria-hidden="true">🔁</span> ';
    again.append(t('again'));
    again.onclick = () => go(0);
    const another = el('a', 'btn btn-read big');
    another.href = './';
    another.innerHTML = '<span aria-hidden="true">📚</span> ';
    another.append(t('another'));
    actions.append(again, another);
    wrap.append(stars, img, el('h2', 'end-title', t('theEnd')), el('p', 'end-text', t('endText')), actions);
    return wrap;
  }

  function render(dir = 0) {
    const node = view === 0 ? renderCover() : view === last() ? renderEnd() : renderPage(view);
    if (dir) node.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
    stage.replaceChildren(node);
    activeSentence = -1;
    updateChrome();
    preload(view + 1);
  }

  function updateChrome() {
    document.body.classList.toggle('no-audio', !hasAudio());
    document.body.dataset.view = view === 0 ? 'cover' : view === last() ? 'end' : 'page';
    $('prevBtn').disabled = view === 0;
    $('nextBtn').disabled = view === last();
    const dots = $('dots');
    if (dots.children.length !== last() + 1) {
      dots.replaceChildren(...Array.from({ length: last() + 1 }, () => el('i')));
    }
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i <= view));
    $('pageLabel').textContent = isPage(view) ? t('pageOf', view, book.pages.length) : '';
    document.body.classList.toggle('playing', playing);
    playBtn.setAttribute('aria-label', playing ? t('pause') : t('play'));
    playBtn.title = playBtn.getAttribute('aria-label');
    playBtn.disabled = view === last();
  }

  function preload(v) {
    if (!book || !isPage(v)) return;
    const img = new Image();
    img.src = book.base + 'img/' + book.pages[v - 1].image;
  }

  function highlight(i) {
    if (i === activeSentence) return;
    activeSentence = i;
    stage.querySelectorAll('.sentence').forEach((s) => s.classList.toggle('active', Number(s.dataset.i) === i));
  }

  // ---------- Blättern ----------

  function go(v, { keepPlaying = playing } = {}) {
    if (!book) return;
    v = Math.max(0, Math.min(last(), v));
    const dir = Math.sign(v - view);
    clearTimeout(turnTimer);
    halt();
    view = v;
    if (isPage(view)) S.progress(book.id, { page: view });
    if (view === last()) { S.progress(book.id, { page: 0, done: true }); keepPlaying = false; }
    playing = keepPlaying;
    render(dir);
    if (playing) playView(0);
  }

  // ---------- Vorlesen ----------

  function start() {
    playing = true;
    updateChrome();
    playView(0);
  }

  function stop() {
    playing = false;
    clearTimeout(turnTimer);
    halt();
    highlight(-1);
    updateChrome();
  }

  // Ton anhalten, ohne den Modus zu ändern
  function halt() {
    segmentEnd = null;
    audio.pause();
  }

  function playView(fromSentence, onlyOne = false) {
    const tr = track(view);
    if (tr) {
      const marks = tr.marks;
      const url = book.base + tr.src;
      if (!audio.src.endsWith(tr.src)) audio.src = url;
      const seek = () => { audio.currentTime = marks[fromSentence] || 0; };
      segmentEnd = onlyOne ? (marks[fromSentence + 1] ?? tr.dur) - 0.15 : null;
      if (audio.readyState >= 1) seek(); else audio.addEventListener('loadedmetadata', seek, { once: true });
      mediaInfo();
      audio.play().catch(() => { playing = false; segmentEnd = null; updateChrome(); });
    } else {
      playing = false;
      updateChrome();
    }
  }

  // Sperrbildschirm / Kopfhörer-Tasten: Titel, Seite und Bedienung
  function mediaInfo() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: book.title[S.lang],
      artist: isPage(view) ? t('pageOf', view, book.pages.length) : t('siteTitle'),
      artwork: [{ src: new URL(book.base + 'img/cover.svg', location.href).href, sizes: '600x800', type: 'image/svg+xml' }],
    });
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const on = (a, fn) => { try { ms.setActionHandler(a, fn); } catch { /* nicht unterstützt */ } };
    on('play', () => { if (!playing) playBtn.click(); });
    on('pause', () => { if (playing) stop(); });
    on('nexttrack', () => go(view + 1));
    on('previoustrack', () => go(view - 1));
  }

  function finishedView() {
    highlight(-1);
    if (!playing) return;
    if (view === 0 || isPage(view)) {
      turnTimer = setTimeout(() => go(view + 1, { keepPlaying: true }), view === 0 ? 500 : 1100);
    }
  }

  audio.addEventListener('timeupdate', () => {
    const tr = track(view);
    if (!tr) return;
    const now = audio.currentTime;
    if (segmentEnd != null && now >= segmentEnd) {
      audio.pause();
      segmentEnd = null;
      highlight(-1);
      return;
    }
    let i = -1;
    tr.marks.forEach((m, k) => { if (now >= m - 0.05) i = k; });
    highlight(i);
  });
  audio.addEventListener('ended', () => { segmentEnd = null; finishedView(); });

  // ---------- Bedienung ----------

  playBtn.addEventListener('click', () => {
    if (playing) { stop(); return; }
    if (view === last()) return;
    if (view === 0) go(1, { keepPlaying: true }); else start();
  });
  $('prevBtn').addEventListener('click', () => go(view - 1));
  $('nextBtn').addEventListener('click', () => go(view + 1));

  // Satz antippen: diesen Satz vorlesen (im Vorlese-Modus ab hier weiterlesen)
  stage.addEventListener('click', (e) => {
    const s = e.target.closest('.sentence');
    if (swiped || !s || !hasAudio() || e.target.closest('button, a')) return;
    clearTimeout(turnTimer);
    halt();
    playView(Number(s.dataset.i), !playing);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') go(view + 1);
    else if (e.key === 'ArrowLeft') go(view - 1);
    else if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
  });

  // Wischen zum Blättern
  let touch = null;
  let swiped = false; // der Klick nach dem Wischen soll keinen Satz vorlesen
  stage.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, t: Date.now() }; swiped = false; });
  stage.addEventListener('pointerup', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - touch.t < 800) {
      swiped = true;
      go(view + (dx < 0 ? 1 : -1));
    }
    touch = null;
  });

  // Sprache wechseln: Text neu zeichnen, beim Vorlesen in der neuen Sprache weiter
  S.onLang(() => {
    if (!book) return;
    document.title = book.title[S.lang];
    $('bookTitle').textContent = book.title[S.lang];
    const was = playing;
    halt();
    audio.removeAttribute('src');
    render();
    if (was) playView(0);
  });

  // ---------- Start ----------

  S.loadBook(bookId).then((b) => {
    book = b;
    document.title = book.title[S.lang];
    $('bookTitle').textContent = book.title[S.lang];
    document.body.style.setProperty('--accent', book.accent || '#ffb547');
    const p = S.progress(book.id);
    if (mode === 'listen') {
      view = 0;
      render();
      start(); // klappt nur, wenn der Browser Ton ohne Antippen erlaubt; sonst blinkt der Knopf
    } else {
      view = !p.done && isPage(p.page) && mode !== 'start' ? p.page : 0;
      render();
    }
  }).catch(() => {
    stage.replaceChildren(el('p', 'error', bookId ? t('loadError') : t('notFound')));
    $('controls').hidden = true;
  });
})();
