/* Texto enriquecido liviano (negritas, cursivas, listas y subtítulos) guardado como texto plano con marcas simples:
   **negrita**, _cursiva_, "- " o "* " para viñetas, "1. " para numeradas y "## " para subtítulo.
   Nunca se interpreta HTML: la pantalla arma elementos de React y la impresión escapa todo el texto. */

const INLINE_BEFORE = /[\s(¿¡"'>]/;
const INLINE_AFTER = /[\s.,;:!?)"'…]/;

/** Parte una línea en trozos { t: "text" | "b" | "i", v } */
export function parseInline(s) {
  const text = String(s ?? "");
  const out = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const j = text.indexOf("**", i + 2);
      if (j > i + 2) { flush(); out.push({ t: "b", v: text.slice(i + 2, j) }); i = j + 2; continue; }
    }
    if (text[i] === "_" && (i === 0 || INLINE_BEFORE.test(text[i - 1]))) {
      const j = text.indexOf("_", i + 1);
      if (j > i + 1 && !/\s/.test(text[i + 1]) && !/\s/.test(text[j - 1]) && (j === text.length - 1 || INLINE_AFTER.test(text[j + 1]))) {
        flush(); out.push({ t: "i", v: text.slice(i + 1, j) }); i = j + 1; continue;
      }
    }
    buf += text[i];
    i += 1;
  }
  flush();
  return out;
}

/** Bloques: { type: "p", lines } | { type: "ul" | "ol", items } | { type: "h", text } */
export function parseBlocks(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let cur = null;
  const close = () => { cur = null; };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") { close(); continue; }
    let m;
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      if (!cur || cur.type !== "ul") { cur = { type: "ul", items: [] }; blocks.push(cur); }
      cur.items.push(m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      if (!cur || cur.type !== "ol") { cur = { type: "ol", items: [] }; blocks.push(cur); }
      cur.items.push(m[1]);
    } else if ((m = /^\s*#{1,3}\s+(.*)$/.exec(line))) {
      blocks.push({ type: "h", text: m[1] });
      close();
    } else {
      if (!cur || cur.type !== "p") { cur = { type: "p", lines: [] }; blocks.push(cur); }
      cur.lines.push(line.trim());
    }
  }
  return blocks;
}

export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const inlineHtml = (s) => parseInline(s).map((n) => (n.t === "b" ? `<strong>${escapeHtml(n.v)}</strong>` : n.t === "i" ? `<em>${escapeHtml(n.v)}</em>` : escapeHtml(n.v))).join("");

/** HTML seguro (todo el texto va escapado) para imprimir o exportar a PDF. */
export function toHtml(src) {
  return parseBlocks(src).map((b) => {
    if (b.type === "ul") return `<ul>${b.items.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ul>`;
    if (b.type === "ol") return `<ol>${b.items.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ol>`;
    if (b.type === "h") return `<h4>${inlineHtml(b.text)}</h4>`;
    return `<p>${b.lines.map(inlineHtml).join("<br/>")}</p>`;
  }).join("");
}

/** Texto sin marcas (para buscar, comparar y mostrar resúmenes cortos). */
export function toPlain(src) {
  return parseBlocks(src).map((b) => {
    if (b.type === "ul" || b.type === "ol") return b.items.map((x) => parseInline(x).map((n) => n.v).join("")).join("\n");
    if (b.type === "h") return parseInline(b.text).map((n) => n.v).join("");
    return b.lines.map((l) => parseInline(l).map((n) => n.v).join("")).join("\n");
  }).join("\n");
}

export const isBlank = (src) => String(src ?? "").trim() === "";

/** Recorta un texto enriquecido a n caracteres (sin marcas) */
export function excerpt(src, n = 140) {
  const p = toPlain(src).replace(/\s+/g, " ").trim();
  return p.length > n ? `${p.slice(0, n - 1).trimEnd()}…` : p;
}

/**
 * Aplica un formato al texto seleccionado de un campo: "bold", "italic" (envuelven la selección; si ya la envuelven, la
 * desenvuelven) o "ul", "ol", "h" (cambian el prefijo de las líneas tocadas; si todas ya lo tienen, lo quitan).
 * Devuelve { value, start, end } con la nueva selección.
 */
export function applyFormat(value, start, end, kind) {
  const v = String(value ?? "");
  const a = Math.max(0, Math.min(start, v.length)), b = Math.max(a, Math.min(end, v.length));
  if (kind === "bold" || kind === "italic") {
    const mark = kind === "bold" ? "**" : "_";
    const sel = v.slice(a, b);
    if (sel.length >= mark.length * 2 && sel.startsWith(mark) && sel.endsWith(mark)) {
      const inner = sel.slice(mark.length, sel.length - mark.length);
      return { value: v.slice(0, a) + inner + v.slice(b), start: a, end: a + inner.length };
    }
    const wrapped = v.slice(Math.max(0, a - mark.length), a) === mark && v.slice(b, b + mark.length) === mark;
    if (wrapped && sel) return { value: v.slice(0, a - mark.length) + sel + v.slice(b + mark.length), start: a - mark.length, end: b - mark.length };
    const ph = sel || (kind === "bold" ? "texto en negrita" : "texto en cursiva");
    return { value: v.slice(0, a) + mark + ph + mark + v.slice(b), start: a + mark.length, end: a + mark.length + ph.length };
  }
  const ls = v.lastIndexOf("\n", a - 1) + 1;
  let le = v.indexOf("\n", b);
  if (le === -1) le = v.length;
  const lines = v.slice(ls, le).split("\n");
  const has = (l) => (kind === "ul" ? /^\s*[-*•]\s/.test(l) : kind === "ol" ? /^\s*\d+[.)]\s/.test(l) : /^\s*#{1,3}\s/.test(l));
  const strip = (l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|#{1,3})\s+/, "");
  const todas = lines.filter((l) => l.trim() !== "").every(has) && lines.some((l) => l.trim() !== "");
  let n = 0;
  const out = lines.map((l) => {
    if (l.trim() === "") return l;
    if (todas) return strip(l);
    n += 1;
    return (kind === "ul" ? "- " : kind === "ol" ? `${n}. ` : "## ") + strip(l);
  }).join("\n");
  return { value: v.slice(0, ls) + out + v.slice(le), start: ls, end: ls + out.length };
}
