// Eltern-Seite: Märchen-Fassung wählen (kindgerecht oder Original) – für alle Märchen und einzeln –
// und nachlesen, was die kindgerechte Fassung gegenüber dem Original ändert (Feld `differences`
// in books/<id>-original/book.json). Gespeichert wird auf dem Gerät (stories.settings).
'use strict';

(function () {
  const S = window.Stories;
  const { t } = S;
  const $ = (id) => document.getElementById(id);
  const ORIGINALS = window.ORIGINALS || {};
  let tales = []; // [{ id, kind, orig }]
  let same = [];  // Märchen ohne eigene Originalfassung

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- Eltern-Hürde (eine Rechenaufgabe, gilt bis der Tab geschlossen wird) ----------
  let task = null;
  function newTask() {
    const a = 6 + Math.floor(Math.random() * 4);
    const b = 6 + Math.floor(Math.random() * 4);
    task = { a, b };
    $('gateTask').textContent = `${a} × ${b} = ?`;
  }
  function unlocked() {
    try { return sessionStorage.getItem('stories.parent') === '1'; } catch { return false; }
  }
  function unlock() {
    try { sessionStorage.setItem('stories.parent', '1'); } catch { /* egal */ }
    $('gate').hidden = true;
    $('settings').hidden = false;
    render();
  }
  $('gate').addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number($('gateAnswer').value) === task.a * task.b) { unlock(); return; }
    $('gateError').hidden = false;
    $('gateAnswer').value = '';
    newTask();
  });

  // ---------- Einstellungen ----------
  let toastTimer = 0;
  function save(next) {
    S.settings(next);
    const toast = $('toast');
    toast.textContent = t('saved');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
    render();
  }

  function seg(options, value, onPick, label) {
    const box = el('div', 'seg');
    box.setAttribute('role', 'radiogroup');
    if (label) box.setAttribute('aria-label', label);
    options.forEach(([v, text]) => {
      const b = el('button', 'seg-btn' + (v === value ? ' on' : ''), text);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(v === value));
      b.addEventListener('click', () => onPick(v));
      box.append(b);
    });
    return box;
  }

  function render() {
    document.title = `${t('parentsTitle')} – ${t('siteTitle')}`;
    if ($('settings').hidden) return;
    const s = S.settings();
    const lang = S.lang;
    $('globalVersion').replaceWith(Object.assign(
      seg([['kindgerecht', '🧸 ' + t('verKind')], ['original', '📜 ' + t('verOrig')]], s.version,
        (v) => save({ ...s, version: v }), t('parentsAll')),
      { id: 'globalVersion' },
    ));

    $('taleList').replaceChildren(...tales.map(({ id, kind, orig }) => {
      const row = el('article', 'tale');
      const img = el('img', 'tale-cover');
      img.src = kind.base + 'img/cover.svg';
      img.alt = '';
      img.loading = 'lazy';
      const body = el('div', 'tale-body');
      const head = el('div', 'tale-head');
      const title = el('div');
      title.append(el('h3', null, kind.title[lang]), el('p', 'tale-origin', (orig.origin || kind.origin || {})[lang] || ''));
      const per = s.perBook[id] || '';
      const pick = seg([['', t('verDefault')], ['kindgerecht', t('verKind')], ['original', t('verOrig')]], per, (v) => {
        const perBook = { ...s.perBook };
        if (v) perBook[id] = v; else delete perBook[id];
        save({ ...s, perBook });
      }, kind.title[lang]);
      pick.classList.add('small');
      head.append(title, pick);
      body.append(head);
      const diffs = (orig.differences || {})[lang] || [];
      if (diffs.length) {
        const det = el('details', 'tale-diff');
        det.append(el('summary', null, t('whatDiffers')));
        const ul = el('ul');
        diffs.forEach((d) => ul.append(el('li', null, d)));
        det.append(ul);
        body.append(det);
      }
      row.append(img, body);
      return row;
    }));

    $('sameList').textContent = same.length ? `${t('sameAsOriginal')} ${same.map((b) => b.title[lang]).join(', ')}.` : '';
  }

  // ---------- Daten laden ----------
  const fairy = (window.BOOKS || []);
  Promise.all(fairy.map((id) => S.loadBook(id).catch(() => null))).then((books) => {
    const list = books.filter((b) => b && b.shelf === 'maerchen');
    same = list.filter((b) => !ORIGINALS[b.id]);
    return Promise.all(list.filter((b) => ORIGINALS[b.id]).map((kind) =>
      S.loadBook(ORIGINALS[kind.id]).then((orig) => ({ id: kind.id, kind, orig })).catch(() => null)));
  }).then((list) => {
    tales = list.filter(Boolean);
    render();
  });

  S.onLang(render);
  if (unlocked()) unlock();
  else { $('gate').hidden = false; newTask(); }
})();
