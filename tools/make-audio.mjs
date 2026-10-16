#!/usr/bin/env node
// Erzeugt die Hörbuch-Spuren mit einer natürlichen Erzählstimme (OpenAI Text-to-Speech).
//
//   OPENAI_API_KEY=… node tools/make-audio.mjs            alle Bücher
//   OPENAI_API_KEY=… node tools/make-audio.mjs luna pip   nur diese Bücher
//   … --force                                             auch unveränderte Seiten neu einsprechen
//
// Der Key kann auch in einer Datei .env im Repo liegen (OPENAI_API_KEY=…, ist in .gitignore).
//
// Jede Seite wird am Stück eingesprochen, damit sie flüssig klingt. Danach transkribiert Whisper
// die Aufnahme mit Wort-Zeitstempeln; daraus ergibt sich, wann welcher Satz beginnt
// (für das Mitleuchten im Leser). Braucht ffmpeg.
//
// Ergebnis pro Buch:
//   books/<id>/audio/<lang>/00.mp3   Titel (Deckblatt)
//   books/<id>/audio/<lang>/01.mp3 … eine Spur pro Seite
//   books/<id>/audio.json            je Spur: src, dur (Sekunden), marks (Startsekunde je Satz), hash
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'marin';
const FALLBACK_VOICE = 'coral';

// Regieanweisung für die Stimme – in der Sprache der Geschichte
const STYLE = {
  de: 'Du liest einem Kind im Kindergartenalter eine Bilderbuchseite vor. Sprich natürliches, '
    + 'akzentfreies Hochdeutsch mit warmer, freundlicher und lebendiger Stimme, ruhig und eher langsam, '
    + 'mit kleinen Pausen zwischen den Sätzen. Betone wie eine erfahrene Vorleserin: Geräusche wie '
    + '„Plumps!“ oder „Plitsch, platsch“ spielerisch, wörtliche Rede mit passendem Gefühl, aber ohne zu übertreiben.',
  es: 'Le estás leyendo una página de un cuento ilustrado a un niño pequeño. Habla en español de España, '
    + 'con acento castellano natural y una voz cálida, cariñosa y expresiva, tranquila y más bien despacio, '
    + 'con pequeñas pausas entre frases. Entona como una buena cuentacuentos: los sonidos como «¡Plof!» '
    + 'o «plic, plac» de forma juguetona, los diálogos con la emoción adecuada, sin exagerar.',
};
const TITLE_STYLE = {
  de: ' Dies ist nur der Titel des Buches: sprich ihn einladend und ein wenig feierlich.',
  es: ' Esto es solo el título del libro: dilo de forma acogedora y un poco solemne.',
};

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const env = join(ROOT, '.env');
  if (existsSync(env)) {
    const m = readFileSync(env, 'utf8').match(/^OPENAI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  console.error('OPENAI_API_KEY fehlt (Umgebungsvariable oder .env im Repo).');
  process.exit(1);
}
const KEY = apiKey();

async function api(path, init, tries = 4) {
  for (let i = 1; ; i++) {
    const res = await fetch('https://api.openai.com/v1/' + path, {
      ...init, headers: { Authorization: `Bearer ${KEY}`, ...(init.headers || {}) },
    });
    if (res.ok) return res;
    const body = await res.text();
    if (i >= tries || ![408, 429, 500, 502, 503, 504].includes(res.status)) {
      const err = new Error(`${path}: HTTP ${res.status} ${body.slice(0, 300)}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 2000 * i));
  }
}

let voice = VOICE;
async function speak(text, lang, isTitle) {
  const req = (v) => api('audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, voice: v, input: text, response_format: 'mp3',
      instructions: STYLE[lang] + (isTitle ? TITLE_STYLE[lang] : ''),
    }),
  });
  try {
    return Buffer.from(await (await req(voice)).arrayBuffer());
  } catch (e) {
    if (voice !== FALLBACK_VOICE && e.status === 400 && /voice/i.test(e.body || '')) {
      console.warn(`Stimme ${voice} nicht verfügbar, nehme ${FALLBACK_VOICE}.`);
      voice = FALLBACK_VOICE;
      return Buffer.from(await (await req(voice)).arrayBuffer());
    }
    throw e;
  }
}

async function words(file, lang) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), 'page.mp3');
  form.append('model', 'whisper-1');
  form.append('language', lang);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const json = await (await api('audio/transcriptions', { method: 'POST', body: form })).json();
  return json.words || [];
}

const norm = (w) => w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '');
const tokens = (s) => s.split(/[\s—–-]+/).map(norm).filter(Boolean);

// Startzeit jedes Satzes: Wörter des Textes mit den transkribierten Wörtern abgleichen (LCS)
function sentenceMarks(sentences, heard, dur) {
  const script = [];
  const firstOf = [];
  sentences.forEach((s) => { firstOf.push(script.length); script.push(...tokens(s)); });
  const h = heard.map((w) => ({ w: norm(w.word), t: w.start })).filter((x) => x.w);
  const n = script.length;
  const m = h.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = script[i] === h[j].w ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const at = new Array(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (script[i] === h[j].w) { at[i] = h[j].t; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const marks = firstOf.map((first, k) => {
    const end = k + 1 < firstOf.length ? firstOf[k + 1] : n;
    for (let i = first; i < end; i++) if (at[i] != null) return at[i];
    return null;
  });
  // Lücken schätzen: gleichmäßig zwischen den Nachbarn
  marks.forEach((v, k) => {
    if (v != null) return;
    const prev = k ? marks[k - 1] : 0;
    let next = dur;
    for (let x = k + 1; x < marks.length; x++) if (marks[x] != null) { next = marks[x]; break; }
    marks[k] = prev + (next - prev) / 2;
  });
  marks[0] = 0;
  return marks.map((v, k) => (k ? Math.max(0, Math.round((v - 0.12) * 100) / 100) : 0));
}

function duration(file) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
}

async function makeTrack({ dir, lang, n, sentences, isTitle }) {
  const name = String(n).padStart(2, '0') + '.mp3';
  const out = join(dir, 'audio', lang, name);
  const tmp = mkdtempSync(join(tmpdir(), 'stories-'));
  try {
    const raw = join(tmp, 'raw.mp3');
    writeFileSync(raw, await speak(sentences.join(' '), lang, isTitle));
    // Lautstärke angleichen, kurze Stille vorne und hinten, mono 64 kbit/s
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw,
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-1.5:LRA=11,adelay=350,apad=pad_dur=0.6',
      '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', out]);
    const dur = Math.round(duration(out) * 100) / 100;
    const marks = sentences.length > 1 ? sentenceMarks(sentences, await words(out, lang), dur) : [0];
    return { src: `audio/${lang}/${name}`, dur, marks };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Mehrere Anfragen gleichzeitig, aber nicht zu viele
async function pool(jobs, size) {
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < jobs.length) { const i = next++; results[i] = await jobs[i](); }
  }));
  return results;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));
const ids = wanted.length ? wanted : readdirSync(join(ROOT, 'books'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const id of ids) {
  const dir = join(ROOT, 'books', id);
  const book = JSON.parse(readFileSync(join(dir, 'book.json'), 'utf8'));
  const jsonFile = join(dir, 'audio.json');
  const old = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, 'utf8')) : {};
  const result = {};
  for (const lang of Object.keys(STYLE)) {
    mkdirSync(join(dir, 'audio', lang), { recursive: true });
    const tracks = [[book.title[lang]], ...book.pages.map((p) => p.text[lang])];
    const jobs = tracks.map((sentences, n) => async () => {
      const hash = createHash('sha1').update(JSON.stringify([MODEL, STYLE[lang], sentences])).digest('hex').slice(0, 12);
      const prev = old[lang] && old[lang][n];
      if (!force && prev && prev.hash === hash && existsSync(join(dir, prev.src))) return prev;
      const tr = await makeTrack({ dir, lang, n, sentences, isTitle: n === 0 });
      process.stdout.write(`  ${id} ${lang} ${tr.src} ${tr.dur}s [${tr.marks.join(', ')}]\n`);
      return { ...tr, hash };
    });
    result[lang] = await pool(jobs, 4);
    const total = result[lang].reduce((s, t) => s + t.dur, 0);
    console.log(`${id} ${lang}: ${tracks.length} Spuren, ${Math.round(total)} s`);
    writeFileSync(jsonFile, JSON.stringify({ ...old, ...result }, null, 1) + '\n');
  }
}
