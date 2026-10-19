#!/usr/bin/env node
// Prüft alle Bücher (oder die angegebenen): book.json vollständig, Bilder vorhanden und sauber,
// Audio passend zum Text.   node tools/check-books.mjs [id …]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LANGS = ['de', 'es'];
const booksJs = readFileSync(join(ROOT, 'books.js'), 'utf8');
const listed = (booksJs.match(/BOOKS\s*=\s*\[([^\]]*)\]/) || [, ''])[1]
  .match(/'[^']+'/g)?.map((s) => s.slice(1, -1)) || [];
// Originalfassungen: window.ORIGINALS = { kindgerecht-id: 'original-id', … }
const originals = Object.fromEntries([...((booksJs.match(/ORIGINALS\s*=\s*\{([^}]*)\}/) || [, ''])[1]
  .matchAll(/'?([a-z0-9-]+)'?\s*:\s*'([a-z0-9-]+)'/g))].map((m) => [m[1], m[2]]));
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(join(ROOT, 'books'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

// Interaktive Geschichten: Seiten-IDs, Weiter/Knöpfe/Ende, Erreichbarkeit, keine Schleifen
const COLORS = /^#[0-9a-f]{6}$/i;
function checkInteractive(book, bad, warn) {
  const pages = book.pages || [];
  const byId = new Map();
  pages.forEach((p, i) => {
    if (!/^[a-z0-9-]+$/.test(p.id || '')) bad.push(`Seite ${i + 1}: id fehlt/ungültig`);
    else if (byId.has(p.id)) bad.push(`Seite ${i + 1}: id „${p.id}“ doppelt`);
    else byId.set(p.id, p);
  });
  const endings = new Map((book.endings || []).map((e) => [e.id, e]));
  if (endings.size < 2) bad.push('weniger als 2 Enden');
  for (const e of book.endings || []) {
    if (!e.icon) bad.push(`Ende ${e.id}: icon fehlt`);
    for (const l of LANGS) if (!e.title?.[l]) bad.push(`Ende ${e.id}: title.${l} fehlt`);
  }
  const used = new Set();
  for (const p of pages) {
    const kinds = ['next', 'choices', 'end'].filter((k) => p[k] != null);
    if (kinds.length !== 1) { bad.push(`Seite ${p.id}: genau eins von next/choices/end nötig (${kinds.join(', ') || 'keins'})`); continue; }
    if (p.next && !byId.has(p.next)) bad.push(`Seite ${p.id}: next „${p.next}“ gibt es nicht`);
    if (p.end) { if (!endings.has(p.end)) bad.push(`Seite ${p.id}: Ende „${p.end}“ nicht in endings`); used.add(p.end); }
    if (p.choices) {
      if (!Array.isArray(p.choices) || p.choices.length < 2 || p.choices.length > 3) bad.push(`Seite ${p.id}: 2–3 Knöpfe nötig`);
      const colors = new Set();
      for (const c of p.choices || []) {
        if (!byId.has(c.to)) bad.push(`Seite ${p.id}: Knopf zu „${c.to}“ – Seite fehlt`);
        if (!c.icon) bad.push(`Seite ${p.id}: Knopf ohne icon`);
        if (!COLORS.test(c.color || '')) bad.push(`Seite ${p.id}: Knopf-Farbe ungültig`);
        else if (colors.has(c.color.toLowerCase())) warn.push(`Seite ${p.id}: zwei Knöpfe mit gleicher Farbe`);
        else colors.add(c.color.toLowerCase());
        for (const l of LANGS) {
          const w = c.label?.[l];
          if (!w) bad.push(`Seite ${p.id}: Knopf-Wort ${l} fehlt`);
          else if (w.length > 10) warn.push(`Seite ${p.id}: Knopf-Wort „${w}“ ist lang`);
        }
      }
    }
  }
  for (const id of endings.keys()) if (!used.has(id)) bad.push(`Ende „${id}“ wird nie erreicht`);
  // Erreichbarkeit und Schleifen (Tiefensuche ab der ersten Seite)
  const seen = new Set();
  const onPath = new Set();
  let loops = 0;
  const walk = (id, depth) => {
    const p = byId.get(id);
    if (!p) return;
    if (onPath.has(id)) { loops++; return; }
    if (depth > 40) return;
    seen.add(id);
    onPath.add(id);
    const next = p.next ? [p.next] : p.choices ? p.choices.map((c) => c.to) : [];
    next.forEach((n) => walk(n, depth + 1));
    onPath.delete(id);
  };
  if (pages[0]) walk(pages[0].id, 0);
  if (loops) bad.push('Schleife im Ablauf');
  for (const p of pages) if (p.id && !seen.has(p.id)) bad.push(`Seite ${p.id} ist nicht erreichbar`);
}

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
          if (words > (book.version === 'original' ? 90 : 70)) warn.push(`Seite ${i + 1} ${l}: ${words} Wörter`);
        }
      }
    });
    if (book.interactive) checkInteractive(book, bad, warn);
    if (book.version === 'original') {
      if (!book.variantOf || !existsSync(join(ROOT, 'books', book.variantOf, 'book.json'))) bad.push(`variantOf „${book.variantOf}“ fehlt`);
      for (const l of LANGS) if (!book.differences?.[l]?.length) bad.push(`differences.${l} fehlt`);
    }
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
  if (book?.version === 'original') {
    if (originals[book.variantOf] !== id) warn.push(`nicht in ORIGINALS (books.js) eingetragen`);
  } else if (!listed.includes(id)) warn.push('nicht in books.js eingetragen');
  for (const [kid, orig] of Object.entries(originals)) {
    if (kid === id && !existsSync(join(ROOT, 'books', orig, 'book.json'))) bad.push(`Originalfassung „${orig}“ fehlt`);
  }
  problems += bad.length;
  const status = bad.length ? '✗' : '✓';
  console.log(`${status} ${id}${book ? ' – ' + book.title.de : ''}`);
  bad.forEach((m) => console.log('    FEHLER ' + m));
  warn.forEach((m) => console.log('    Hinweis ' + m));
}
process.exit(problems ? 1 : 0);
