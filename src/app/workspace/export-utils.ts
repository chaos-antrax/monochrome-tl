import type { Chapter, Novel } from "./types";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "novel";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getChapterText(chapter: Chapter) {
  return chapter.translations.find((version) => version.version === chapter.currentVersion)?.text ?? "[Untranslated]";
}

function renderParagraphs(value: string) {
  const blocks = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.length ? blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`).join("") : "<p>[No content]</p>";
}

function chapterFileName(index: number) {
  return `chapters/chapter-${String(index + 1).padStart(3, "0")}.xhtml`;
}

export function exportFileName(title: string, extension: string) {
  return `${slug(title)}.${extension}`;
}

export function buildExport(novel: Novel) {
  const lines = [novel.title, "", novel.descriptionTranslated ?? novel.description, ""];
  novel.chapters.forEach((chapter) => {
    lines.push(chapter.title, "", getChapterText(chapter), "");
  });
  return lines.join("\n");
}

export function buildHtmlExport(novel: Novel) {
  const description = novel.descriptionTranslated ?? novel.description;
  const toc = novel.chapters.map((chapter, index) => `<li><a href="#chapter-${index + 1}"><span>${escapeHtml(chapter.title)}</span><small>${escapeHtml(chapter.volume)} / Chapter ${chapter.order}</small></a></li>`).join("");
  const chapterHtml = novel.chapters.map((chapter, index) => `<section id="chapter-${index + 1}" class="chapter"><div class="chapter-kicker">${escapeHtml(chapter.volume)} / Chapter ${chapter.order}</div><h2>${escapeHtml(chapter.title)}</h2><div class="prose">${renderParagraphs(getChapterText(chapter))}</div></section>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(novel.title)}</title><style>${bookCss()}</style></head><body><main class="book"><section class="cover"><p class="eyebrow">Monochrome Translations</p><h1>${escapeHtml(novel.title)}</h1><p class="meta">${novel.chapters.length} chapters / ${novel.chapters.filter((chapter) => chapter.status === "translated").length} translated</p></section><section class="intro"><p class="eyebrow">Description</p><div class="prose description">${renderParagraphs(description)}</div></section><section class="toc"><p class="eyebrow">Contents</p><h2>Chapters</h2><ol>${toc || "<li>No chapters available</li>"}</ol></section>${chapterHtml}</main></body></html>`;
}

function bookCss() {
  return `@page{size:auto;margin:18mm 16mm}*{box-sizing:border-box}html{background:#f6f5f1}body{margin:0;background:#f6f5f1;color:#151515;font-family:Georgia,"Times New Roman",serif}.book{max-width:820px;margin:0 auto;padding:48px 28px}.cover,.intro,.toc,.chapter{background:#fff;border:1px solid #dedbd2;border-radius:10px;padding:42px;margin:0 0 28px;box-shadow:0 24px 80px rgba(0,0,0,.08)}.cover{min-height:62vh;display:flex;flex-direction:column;justify-content:center}.eyebrow{margin:0 0 18px;color:#6f6b63;font:700 11px/1.4 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase}h1,h2{margin:0;color:#111;font-weight:600;line-height:1.08}h1{font-size:54px;letter-spacing:0}h2{font-size:34px}.meta{margin-top:24px;color:#6f6b63;font:500 14px/1.6 Arial,sans-serif}.prose{margin-top:24px;font-size:18px;line-height:1.82}.prose p{margin:0 0 1.05em}.description{font-size:17px;color:#2d2b28}.toc ol{margin:22px 0 0;padding:0;list-style:none}.toc li{border-top:1px solid #e8e4da}.toc a{display:flex;justify-content:space-between;gap:24px;padding:13px 0;color:#151515;text-decoration:none}.toc small{flex:0 0 auto;color:#7a756b;font:500 12px/1.5 Arial,sans-serif}.chapter{break-before:page;page-break-before:always}.chapter-kicker{margin-bottom:12px;color:#777166;font:700 11px/1.5 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}@media print{html,body{background:#fff}.book{max-width:none;padding:0}.cover,.intro,.toc,.chapter{border:0;border-radius:0;box-shadow:none;padding:0;margin:0 0 20mm}.cover{min-height:240mm;break-after:page;page-break-after:always}.intro,.toc{break-after:page;page-break-after:always}.chapter{break-before:page;page-break-before:always}.prose{font-size:12pt;line-height:1.72}h1{font-size:34pt}h2{font-size:22pt}.toc a{color:#111}}`;
}

function textFile(content: string) {
  return new TextEncoder().encode(content);
}

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function writeUint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function writeUint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let current = index;
  for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const nowDate = new Date();
  const dosTime = (nowDate.getHours() << 11) | (nowDate.getMinutes() << 5) | Math.floor(nowDate.getSeconds() / 2);
  const dosDate = ((nowDate.getFullYear() - 1980) << 9) | ((nowDate.getMonth() + 1) << 5) | nowDate.getDate();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = textFile(file.name);
    const content = textFile(file.content);
    const checksum = crc32(content);
    const localHeader = concatBytes([
      writeUint32(0x04034b50), writeUint16(20), writeUint16(0), writeUint16(0), writeUint16(dosTime), writeUint16(dosDate), writeUint32(checksum), writeUint32(content.length), writeUint32(content.length), writeUint16(name.length), writeUint16(0), name,
    ]);
    localParts.push(localHeader, content);
    centralParts.push(concatBytes([
      writeUint32(0x02014b50), writeUint16(20), writeUint16(20), writeUint16(0), writeUint16(0), writeUint16(dosTime), writeUint16(dosDate), writeUint32(checksum), writeUint32(content.length), writeUint32(content.length), writeUint16(name.length), writeUint16(0), writeUint16(0), writeUint16(0), writeUint16(0), writeUint32(0), writeUint32(offset), name,
    ]));
    offset += localHeader.length + content.length;
  });

  const central = concatBytes(centralParts);
  const end = concatBytes([writeUint32(0x06054b50), writeUint16(0), writeUint16(0), writeUint16(files.length), writeUint16(files.length), writeUint32(central.length), writeUint32(offset), writeUint16(0)]);
  return new Blob([concatBytes([...localParts, central, end])], { type: "application/epub+zip" });
}

function xhtmlDocument(title: string, body: string, bodyClass = "") {
  const className = bodyClass ? ` class="${bodyClass}"` : "";
  return `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body${className}>${body}</body></html>`;
}

export function buildEpubExport(novel: Novel) {
  const chapterFiles = novel.chapters.map((chapter, index) => {
    const filename = chapterFileName(index);
    const body = `<section class="chapter"><p class="kicker">${escapeHtml(chapter.volume)} / Chapter ${chapter.order}</p><h1>${escapeHtml(chapter.title)}</h1><div class="prose">${renderParagraphs(getChapterText(chapter))}</div></section>`;
    return { chapter, filename, content: xhtmlDocument(chapter.title, body, "chapter-page") };
  });
  const manifestChapters = chapterFiles.map((file, index) => `<item id="chapter-${index + 1}" href="${file.filename}" media-type="application/xhtml+xml" />`).join("");
  const spine = chapterFiles.map((_, index) => `<itemref idref="chapter-${index + 1}" />`).join("");
  const navItems = chapterFiles.map((file) => `<li><a href="${file.filename}">${escapeHtml(file.chapter.title)}</a></li>`).join("");
  const cover = xhtmlDocument(novel.title, `<section class="cover"><p class="eyebrow">Monochrome Translations</p><h1>${escapeHtml(novel.title)}</h1><p class="meta">${novel.chapters.length} chapters</p></section>`, "cover-page");
  const intro = xhtmlDocument("Description", `<section class="intro"><p class="eyebrow">Description</p><div class="prose">${renderParagraphs(novel.descriptionTranslated ?? novel.description)}</div></section>`, "intro-page");
  const nav = xhtmlDocument("Contents", `<nav epub:type="toc" id="toc"><p class="eyebrow">Contents</p><h1>Chapters</h1><ol><li><a href="intro.xhtml">Description</a></li>${navItems}</ol></nav>`, "toc-page");
  const opf = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${novel.id}</dc:identifier><dc:title>${escapeHtml(novel.title)}</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" /><item id="style" href="styles.css" media-type="text/css" /><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" /><item id="intro" href="intro.xhtml" media-type="application/xhtml+xml" />${manifestChapters}</manifest><spine><itemref idref="cover" /><itemref idref="intro" />${spine}</spine></package>`;
  const styles = `body{margin:0;padding:2em;color:#151515;font-family:serif;line-height:1.75}section{max-width:42em;margin:0 auto}.cover{min-height:80vh;display:block;padding-top:22vh}.eyebrow,.kicker{margin:0 0 1.2em;color:#68645d;font-family:sans-serif;font-size:.75em;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.meta{margin-top:1.5em;color:#68645d;font-family:sans-serif;font-size:.9em}h1{margin:0 0 .8em;font-size:2em;line-height:1.15;font-weight:600}.prose p{margin:0 0 1em}nav ol{margin:1.5em 0 0;padding-left:1.4em}nav li{margin:.55em 0}a{color:#151515;text-decoration:none}`;

  return zipStore([
    { name: "mimetype", content: "application/epub+zip" },
    { name: "META-INF/container.xml", content: `<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" /></rootfiles></container>` },
    { name: "OEBPS/content.opf", content: opf },
    { name: "OEBPS/nav.xhtml", content: nav },
    { name: "OEBPS/cover.xhtml", content: cover },
    { name: "OEBPS/intro.xhtml", content: intro },
    { name: "OEBPS/styles.css", content: styles },
    ...chapterFiles.map((file) => ({ name: `OEBPS/${file.filename}`, content: file.content })),
  ]);
}

export function downloadFile(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, mimeType: string, content: string) {
  downloadFile(filename, new Blob([content], { type: mimeType }));
}

export function printHtml(content: string) {
  const frame = document.createElement("iframe");
  frame.title = "Print manuscript";
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "816px";
  frame.style.height = "1056px";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.onload = () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      frame.remove();
      return;
    }
    printWindow.onafterprint = () => frame.remove();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 120);
    window.setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
  frame.srcdoc = content;
}
