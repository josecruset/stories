// Leser und Hörbuch-Player.
// Ansichten: 0 = Titelseite, 1 … n = Seiten der Geschichte, n + 1 = Ende.
// „Vorlesen“ spielt die Spur der Seite ab (books/<id>/audio/<lang>/NN.mp3), lässt den
// gerade gesprochenen Satz mitleuchten und blättert danach von selbst weiter.
// „Satz zurück“ (nur beim Vorlesen) wiederholt den aktuellen Satz bzw. springt einen Satz zurück.
// Blättern auch durch Wischen; die Seite folgt dabei dem Finger.
// Ein Tipp auf einen Satz liest nur diesen Satz vor. Vorgelesen wird nur mit echten
// Aufnahmen (audio.json) – ohne sie gibt es keine Vorlese-Knöpfe, keine Computerstimme.
// Interaktive Geschichten (book.interactive): Seiten haben eine id und entweder `next`,
// `choices` (Knöpfe, das Kind entscheidet) oder `end`. „Zurück“ geht den gegangenen Weg zurück;
// am Ende sieht man, wie viele Enden schon entdeckt sind (gemerkt im Lesefortschritt).
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
  let trail = [];         // interaktiv: bisher besuchte Ansichten (für „Zurück“)
  let ending = null;      // interaktiv: erreichtes Ende

  const last = () => book.pages.length + 1;
  const isPage = (v) => v >= 1 && v <= book.pages.length;
  const inter = () => !!(book && book.interactive);
  const viewOf = (id) => book.pages.findIndex((p) => p.id === id) + 1;

  // Nächste Ansicht nach v – bei interaktiven Geschichten null, solange eine Entscheidung fehlt
  function nextOf(v) {
    if (!inter()) return v < last() ? v + 1 : null;
    if (v === 0) return 1;
    if (!isPage(v)) return null;
    const p = book.pages[v - 1];
    if (p.end) return last();
    if (p.choices) return null;
    return p.next ? viewOf(p.next) || last() : last();
  }

  // Vorwärts (Knopf, Wischen, Vorlesen); bei interaktiven Geschichten wird der Weg gemerkt
  function forward(opts) {
    const n = nextOf(view);
    if (n == null || n === view) return;
    if (inter()) trail.push(view);
    go(n, opts);
  }

  function back(opts) {
    if (!inter()) { go(view - 1, opts); return; }
    if (view === 0) return;
    go(trail.length ? trail.pop() : 0, opts);
  }

  function choose(c) {
    const n = viewOf(c.to);
    if (!n) return;
    trail.push(view);
    go(n);
  }

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
    side.append(h);
    if (book.version === 'original') side.append(el('p', 'cover-tag', t('originalTag', book.origin && book.origin[S.lang])));
    side.append(el('p', 'cover-blurb', book.blurb[S.lang]));
    const actions = el('div', 'cover-actions');
    const read = el('button', 'btn btn-read big');
    read.type = 'button';
    read.innerHTML = '<span aria-hidden="true">📖</span> ';
    read.append(t('startRead'));
    read.onclick = () => { stop(); forward(); };
    const listen = el('button', 'btn btn-listen big' + (mode === 'listen' ? ' pulse' : ''));
    listen.type = 'button';
    listen.innerHTML = '<span aria-hidden="true">🎧</span> ';
    listen.append(t('startListen'));
    listen.onclick = () => { forward(); start(); };
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
    if (page.text[S.lang].join(' ').split(/\s+/).length > 48) wrap.classList.add('long');
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
    let box = null;
    if (inter()) {
      const inner = el('div', 'paper-inner');
      inner.append(p);
      if (page.choices) {
        wrap.classList.add('has-choices');
        box = el('div', 'choices'); // eigene Zeile unter Bild und Text, immer sichtbar
        page.choices.forEach((c, i) => {
          const b = el('button', 'choice');
          b.type = 'button';
          b.style.setProperty('--c', c.color || 'var(--accent)');
          b.append(el('span', 'choice-no', String(i + 1)), el('span', 'choice-icon', c.icon || ''), el('span', 'choice-label', c.label[S.lang]));
          b.querySelector('.choice-icon').setAttribute('aria-hidden', 'true');
          b.setAttribute('aria-label', `${i + 1}: ${c.label[S.lang]}`);
          b.addEventListener('click', (e) => { e.stopPropagation(); choose(c); });
          box.append(b);
        });
      }
      paper.append(inner);
    } else {
      paper.append(p, el('span', 'page-no', String(v)));
    }
    wrap.append(fig, paper);
    if (box) wrap.append(box);
    return wrap;
  }

  function renderEnd() {
    if (inter()) return renderInterEnd();
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

  // Ende einer interaktiven Geschichte: erreichtes Ende und alle bisher entdeckten Enden
  function renderInterEnd() {
    const wrap = el('section', 'end-view inter-end');
    const stars = el('div', 'end-stars');
    stars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) {
      const s = el('i');
      s.style.setProperty('--d', i);
      stars.append(s);
    }
    const all = book.endings || [];
    const found = S.progress(book.id).endings || [];
    const e = all.find((x) => x.id === ending);
    const big = el('div', 'ending-icon', e ? e.icon : '⭐');
    big.setAttribute('aria-hidden', 'true');
    const list = el('ul', 'ending-list');
    all.forEach((x) => {
      const got = found.includes(x.id);
      const li = el('li', 'ending' + (got ? ' found' : '') + (x.id === ending ? ' now' : ''));
      li.append(el('span', 'ending-chip-icon', got ? x.icon : '❓'), el('span', 'ending-chip-name', got ? x.title[S.lang] : '…'));
      list.append(li);
    });
    const actions = el('div', 'cover-actions');
    const again = el('button', 'btn btn-listen big');
    again.type = 'button';
    again.innerHTML = '<span aria-hidden="true">🔀</span> ';
    again.append(t('otherWay'));
    again.onclick = () => { trail = []; go(0); };
    const another = el('a', 'btn btn-read big');
    another.href = './#interaktiv';
    another.innerHTML = '<span aria-hidden="true">📚</span> ';
    another.append(t('another'));
    actions.append(again, another);
    const n = all.filter((x) => found.includes(x.id)).length;
    wrap.append(stars, big, el('h2', 'end-title', t('theEnd')), el('p', 'ending-name', e ? e.title[S.lang] : ''),
      el('p', 'end-text', n >= all.length ? t('allEndings') : t('endingsFound', n, all.length)), list, actions);
    return wrap;
  }

  // Untereinander-Layout (Hochformat): Passen Bild, Text und Knöpfe nicht auf den Bildschirm,
  // wird nur das Bild kleiner – Text und Entscheidungsknöpfe bleiben immer sichtbar.
  const wide = window.matchMedia('(min-aspect-ratio: 13/10) and (min-width: 700px)');
  function fitPage() {
    const pv = stage.firstElementChild;
    const img = pv && pv.classList.contains('page-view') && pv.querySelector('.page-art img');
    if (!img) return;
    img.style.width = '';
    if (wide.matches) return;
    const cs = getComputedStyle(stage);
    const room = stage.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    const over = pv.getBoundingClientRect().height - room; // Höhe, nicht Lage: die Seite ist zentriert
    if (over > 1) img.style.width = Math.max(150, img.getBoundingClientRect().width - over * 1.5) + 'px';
  }
  let fitTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitPage, 120); });
  if (document.fonts) document.fonts.ready.then(fitPage);

  function render(dir = 0) {
    const node = view === 0 ? renderCover() : view === last() ? renderEnd() : renderPage(view);
    if (dir) node.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
    stage.replaceChildren(node);
    fitPage();
    activeSentence = -1;
    updateChrome();
    preload(view + 1);
  }

  function updateChrome() {
    document.body.classList.toggle('no-audio', !hasAudio());
    document.body.dataset.view = view === 0 ? 'cover' : view === last() ? 'end' : 'page';
    document.body.classList.toggle('interactive', inter());
    $('prevBtn').disabled = view === 0;
    $('nextBtn').disabled = nextOf(view) == null;
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

  // fromSentence: ab welchem Satz vorgelesen wird (-1 = letzter Satz der Seite)
  function go(v, { keepPlaying = playing, fromSentence = 0 } = {}) {
    if (!book) return;
    v = Math.max(0, Math.min(last(), v));
    const dir = Math.sign(v - view);
    clearTimeout(turnTimer);
    halt();
    view = v;
    if (view === 0) trail = [];
    if (inter() && isPage(view) && book.pages[view - 1].end) {
      ending = book.pages[view - 1].end;
      const found = S.progress(book.id).endings || [];
      if (!found.includes(ending)) S.progress(book.id, { endings: [...found, ending] });
    }
    if (isPage(view) && !inter()) S.progress(book.id, { page: view });
    if (view === last()) { S.progress(book.id, { page: 0, done: true }); keepPlaying = false; }
    playing = keepPlaying;
    render(dir);
    if (playing) playView(fromSentence < 0 ? sentences(view).length - 1 : fromSentence);
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

  // Satz zurück: Ist der aktuelle Satz schon ein Stück gelaufen, beginnt er von vorn,
  // sonst kommt der vorige Satz – am Seitenanfang der letzte Satz der vorigen Seite.
  function sentenceBack() {
    const tr = track(view);
    if (!playing || !tr) return;
    const marks = tr.marks;
    let target;
    if (turnTimer && audio.ended) {
      target = marks.length - 1; // Seite fertig, wartet aufs Umblättern
    } else {
      const now = audio.currentTime;
      let cur = 0;
      marks.forEach((m, k) => { if (now >= m - 0.05) cur = k; });
      target = now - marks[cur] > 1.5 ? cur : cur - 1;
    }
    clearTimeout(turnTimer);
    turnTimer = 0;
    if (target < 0) {
      if (!inter() && isPage(view - 1) && track(view - 1)) { go(view - 1, { keepPlaying: true, fromSentence: -1 }); return; }
      target = 0;
    }
    halt();
    playView(target);
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
    on('nexttrack', () => forward());
    on('previoustrack', () => back());
    on('seekbackward', () => sentenceBack());
  }

  function finishedView() {
    highlight(-1);
    if (!playing) return;
    if (view === 0 || isPage(view)) {
      if (nextOf(view) == null) { // interaktiv: das Kind entscheidet – Knöpfe hüpfen kurz
        stage.querySelectorAll('.choice').forEach((b, i) => { b.style.setProperty('--i', i); b.classList.add('nudge'); });
        return;
      }
      turnTimer = setTimeout(() => { turnTimer = 0; forward({ keepPlaying: true }); }, view === 0 ? 500 : 1100);
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
    if (view === 0) forward({ keepPlaying: true }); else start();
  });
  $('backBtn').addEventListener('click', sentenceBack);
  $('prevBtn').addEventListener('click', () => back());
  $('nextBtn').addEventListener('click', () => forward());

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
    if (e.key === 'ArrowRight') forward();
    else if (e.key === 'ArrowLeft') back();
    else if (/^[1-3]$/.test(e.key) && inter()) stage.querySelectorAll('.choice')[Number(e.key) - 1]?.click();
    else if (e.key === 'ArrowUp' && playing) { e.preventDefault(); sentenceBack(); }
    else if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
  });

  // Wischen zum Blättern (Finger, Stift und Maus): Die Seite folgt der Bewegung; weit genug
  // oder schnell genug gewischt, wird umgeblättert, sonst springt sie zurück.
  // Senkrechte Bewegungen bleiben dem Scrollen (touch-action: pan-y in style.css).
  let drag = null;
  let swiped = false; // der Klick nach dem Wischen soll keinen Satz vorlesen
  stage.addEventListener('dragstart', (e) => e.preventDefault()); // Bilder nicht „ziehen“
  stage.addEventListener('pointerdown', (e) => {
    swiped = false;
    if (!book || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), active: false, node: stage.firstElementChild };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !drag.node) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // scrollt
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      drag.active = true;
      try { stage.setPointerCapture(e.pointerId); } catch { /* egal */ }
      drag.node.classList.remove('enter-next', 'enter-prev');
      drag.node.style.transition = 'none';
    }
    const blocked = (dx > 0 && view === 0) || (dx < 0 && nextOf(view) == null);
    const shift = blocked ? dx * 0.25 : dx;
    drag.node.style.transform = `translateX(${shift}px)`;
    drag.node.style.opacity = String(1 - Math.min(Math.abs(shift) / (stage.clientWidth * 1.5), 0.4));
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    swiped = true;
    const dx = e.clientX - d.x;
    const dir = dx < 0 ? 1 : -1;
    const far = Math.abs(dx) > Math.min(120, stage.clientWidth * 0.2);
    const fast = Math.abs(dx) > 30 && Math.abs(dx) / Math.max(1, Date.now() - d.t) > 0.45;
    const possible = dir > 0 ? nextOf(view) != null : view > 0;
    if (!cancelled && possible && (far || fast)) {
      if (dir > 0) forward(); else back();
    } else {
      d.node.style.transition = 'transform .25s ease, opacity .25s ease';
      d.node.style.transform = '';
      d.node.style.opacity = '';
    }
  }
  stage.addEventListener('pointerup', (e) => endDrag(e, false));
  stage.addEventListener('pointercancel', (e) => endDrag(e, true));

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
      view = !inter() && !p.done && isPage(p.page) && mode !== 'start' ? p.page : 0;
      render();
    }
  }).catch(() => {
    stage.replaceChildren(el('p', 'error', bookId ? t('loadError') : t('notFound')));
    $('controls').hidden = true;
  });
})();
