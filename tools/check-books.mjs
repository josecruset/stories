#!/usr/bin/env node
// Prüft alle Bücher (oder die angegebenen): book.json vollständig, Bilder vorhanden und sauber,
// Audio passend zum Text.   node tools/check-books.mjs [id …]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LANGS = ['de', 'es'];
const listed = (readFileSync(join(ROOT, 'books.js'), 'utf8').match(/BOOKS\s*=\s*\[([^\]]*)\]/) || [, ''])[1]
  .match(/'[^']+'/g)?.map((s) => s.slice(1, -1)) || [];
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(join(ROOT, 'books'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

let problems = 0;
for (const id of ids) {
  const dir = join(ROOT, 'books', id);
  const bad = [];
  const warn = [];
  let book;
  try { book = JSON.parse(readFileSync(join(dir, 'book.json'), 'utf8')); } catch (e) { bad.push('book.json: ' + e.message); }
  if (book) {
    if (book.id !== id) bad.push(`id "${book.id}" ≠ Ordner`);
    for (const f of ['title', 'blurb']) for (const l of LANGS) if (!book[f]?.[l]) bad.push(`${f}.${l} fehlt`);
    if (!/^#[0-9a-f]{6}$/i.test(book.accent || '')) bad.push('accent fehlt/ungültig');
    if (!Number.isInteger(book.age)) bad.push('age fehlt');
    if (!Array.isArray(book.pages) || !book.pages.length) bad.push('keine Seiten');
    const images = ['cover.svg'];
    (book.pages || []).forEach((p, i) => {
      images.push(p.image);
      for (const l of LANGS) {
        const t = p.text?.[l];
        if (!Array.isArray(t) || !t.length || t.some((s) => typeof s !== 'string' || !s.trim())) bad.push(`Seite ${i + 1} ${l}: Text fehlt`);
        else {
          const words = t.join(' ').split(/\s+/).length;
          if (words > 70) warn.push(`Seite ${i + 1} ${l}: ${words} Wörter`);
        }
      }
    });
    for (const img of images) {
      const f = join(dir, 'img', img || '');
      if (!img || !existsSync(f)) { bad.push(`Bild fehlt: ${img}`); continue; }
      if (!img.endsWith('.svg')) continue;
      const svg = readFileSync(f, 'utf8');
      const kb = statSync(f).size / 1024;
      if (kb > 60) warn.push(`${img}: ${Math.round(kb)} KB`);
      if (/<text[\s>]|<image[\s>]|<script|<foreignObject|@import|url\(\s*['"]?(?!#)/i.test(svg)) bad.push(`${img}: verbotenes Element/externe Referenz`);
      if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) bad.push(`${img}: externer Link`);
      const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1].trim().split(/[\s,]+/).map(Number);
      const want = img === 'cover.svg' ? [600, 800] : [1200, 800];
      if (!vb || vb[2] !== want[0] || vb[3] !== want[1]) bad.push(`${img}: viewBox ${vb?.join(' ')} statt 0 0 ${want.join(' ')}`);
    }
    const audioFile = join(dir, 'audio.json');
    if (!existsSync(audioFile)) warn.push('kein Audio');
    else {
      const audio = JSON.parse(readFileSync(audioFile, 'utf8'));
      for (const l of LANGS) {
        const tracks = audio[l] || [];
        if (tracks.length !== book.pages.length + 1) bad.push(`Audio ${l}: ${tracks.length} Spuren statt ${book.pages.length + 1}`);
        tracks.forEach((tr, n) => {
          const want = n === 0 ? 1 : book.pages[n - 1]?.text[l].length;
          if (tr.marks.length !== want) bad.push(`Audio ${l} ${n}: ${tr.marks.length} Marken statt ${want} (Text geändert? neu einsprechen)`);
          if (!existsSync(join(dir, tr.src))) bad.push(`Audio fehlt: ${tr.src}`);
        });
      }
    }
  }
  if (!listed.includes(id)) warn.push('nicht in books.js eingetragen');
  problems += bad.length;
  const status = bad.length ? '✗' : '✓';
  console.log(`${status} ${id}${book ? ' – ' + book.title.de : ''}`);
  bad.forEach((m) => console.log('    FEHLER ' + m));
  warn.forEach((m) => console.log('    Hinweis ' + m));
}
process.exit(problems ? 1 : 0);
