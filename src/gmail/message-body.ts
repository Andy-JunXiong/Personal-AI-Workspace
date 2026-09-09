import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { z } from "zod";
import { createHash } from "node:crypto";

const OUTPUT_LIMIT = 24_000;
const INPUT_LIMIT = 1_000_000;
const NODE_LIMIT = 20_000;
export type BodyIssue = "BODY_EMPTY" | "BODY_TOO_LONG" | "BODY_PART_MISSING"
  | "MIME_LIMIT" | "BODY_INPUT_LIMIT" | "BODY_ENCODING_INVALID"
  | "HTML_LIMIT" | "HTML_UNSUPPORTED_CONTENT";
export interface BodyDiagnostics {
  issues: BodyIssue[];
  htmlDetails: { reason: string; part: string; tag: string | null; count: number }[];
  sourceFormat: "TEXT" | "HTML" | "MIXED";
  selectedFormat: "TEXT" | "HTML" | "MIXED";
  imageCount: number;
  imagesWithoutAlt: number;
  decodedCharacters: number;
  extractedCharacters: number;
  returnedCharacters: number;
  outputLimit: number;
}

const partSchema = z.object({ mimeType: z.string().optional(), filename: z.string().optional(),
  headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  body: z.object({ data: z.string().optional(), attachmentId: z.string().optional() }).optional(),
  parts: z.array(z.unknown()).optional(),
});
const blocks = new Set(["address", "article", "blockquote", "br", "div", "dl", "dt", "dd", "fieldset",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
  "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "th", "tr", "ul"]);

/** Parse inertly: never render, execute scripts, load images or follow links. */
function htmlText(html: string, issues: Set<BodyIssue>, details: BodyDiagnostics["htmlDetails"], part: string) {
  const unsupported = (reason: string, tag: string | null = null) => {
    issues.add("HTML_UNSUPPORTED_CONTENT");
    const old = details.find(d => d.reason === reason && d.part === part && d.tag === tag);
    if (old) old.count++;
    else if (details.length < 32) details.push({ reason, part, tag, count: 1 });
  };
  const root = parse(html, { scriptingEnabled: false });
  const output: string[] = [];
  const stack: (DefaultTreeAdapterTypes.Node | string)[] = [root];
  let nodes = 0, hasText = false, imageCount = 0, imagesWithoutAlt = 0;
  while (stack.length) {
    const node = stack.pop()!;
    if (typeof node === "string") { output.push(node); continue; }
    if (++nodes > NODE_LIMIT) { issues.add("HTML_LIMIT"); break; }
    if (node.nodeName === "#text") {
      const value = (node as DefaultTreeAdapterTypes.TextNode).value;
      hasText ||= !!value.trim();
      output.push(value);
      continue;
    }
    if (node.nodeName === "#comment") {
      // Retain Outlook-only text as well as the normal branch; never execute conditions.
      const comment = (node as DefaultTreeAdapterTypes.CommentNode).data;
      if (/\[if\b/i.test(comment)) {
        // Downlevel-revealed opening markers contain no body; their content is
        // already ordinary sibling nodes in the parsed tree.
        if (/^\s*\[if[^\]]*\]>(?:<!-*)?\s*$/i.test(comment)) continue;
        // Some nested Outlook comments are split by HTML5 parsing. A fragment
        // consisting solely of closing tags cannot contain omitted body text.
        if (/^\s*\[if[^\]]*\]>\s*(?:<\/[a-z][a-z0-9:-]*\s*>\s*)+$/i.test(comment)) continue;
        const inner = comment.match(/^\s*\[if[^\]]*\]>?([\s\S]*?)<!?\[endif\]\s*$/i)?.[1];
        if (inner === undefined) unsupported("CONDITIONAL_COMMENT_UNPARSED");
        else stack.push(parse(inner, { scriptingEnabled: false }));
      }
      continue;
    }
    if ("tagName" in node) {
      if (["script", "style", "head"].includes(node.tagName)) continue;
      if (["iframe", "embed", "template", "param"].includes(node.tagName)) unsupported("EMBEDDED_ELEMENT", node.tagName);
      // Resource-free objects expose their fallback children as ordinary content.
      // Resource declarations (including legacy plugin forms) still require an
      // unsupported renderer; never certify their fallback as the complete object.
      if (node.tagName === "object" && node.attrs.some(a =>
        ["data", "type", "classid", "code", "codebase", "archive"].includes(a.name))) {
        unsupported("OBJECT_RESOURCE", node.tagName);
      }
      if (blocks.has(node.tagName)) {
        output.push("\n");
        if (node.tagName !== "br" && node.tagName !== "hr") stack.push("\n");
      }
      if (node.tagName === "a") {
        const href = node.attrs.find(a => a.name === "href")?.value;
        if (href) stack.push(` [${href}]`);
      }
      if (node.tagName === "img") {
        imageCount++;
        const alt = node.attrs.find(a => a.name === "alt")?.value;
        if (alt?.trim()) output.push(` [Image: ${alt}] `);
        else imagesWithoutAlt++;
      }
    }
    if ("childNodes" in node) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]!);
  }
  if (imageCount && !hasText) unsupported("IMAGE_ONLY");
  return { text: output.join("").replace(/[^\S\n]+/gu, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    imageCount, imagesWithoutAlt };
}

/** A bounded representation of non-attachment MIME bodies, never a semantic classification. */
export function extractMessageBody(payload: unknown, offset = 0) {
  const issues = new Set<BodyIssue>();
  const htmlDetails: BodyDiagnostics["htmlDetails"] = [];
  const formats = new Set<"TEXT" | "HTML">();
  let partsVisited = 0, decodedCharacters = 0;
  interface Representation { text: string; formats: ("TEXT" | "HTML")[]; imageCount: number; imagesWithoutAlt: number; }
  const empty = (): Representation => ({ text: "", formats: [], imageCount: 0, imagesWithoutAlt: 0 });
  function visit(value: unknown, depth: number, path: string): Representation {
    if (++partsVisited > 200 || depth > 20) { issues.add("MIME_LIMIT"); return empty(); }
    const p = partSchema.parse(value);
    const header = (name: string) => p.headers?.find(h => h.name.toLowerCase() === name)?.value ?? "";
    if (p.filename || /^attachment\b/i.test(header("content-disposition"))) return empty();
    const mime = p.mimeType?.toLowerCase();
    const own: Representation[] = [];
    if (mime === "text/plain" || mime === "text/html") {
      formats.add(mime === "text/plain" ? "TEXT" : "HTML");
      if (p.body?.data) {
        // Bound decoding/parsing before allocating the decoded body. No partial input is certified.
        if (p.body.data.length > Math.ceil(INPUT_LIMIT * 4 / 3) + 4) issues.add("BODY_INPUT_LIMIT");
        else {
          try {
            if (!/^[A-Za-z0-9_-]*={0,2}$/.test(p.body.data)) throw new Error("Invalid encoding");
            const charset = header("content-type").match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] ?? "utf-8";
            const decoded = new TextDecoder(charset, { fatal: true }).decode(Buffer.from(p.body.data, "base64url"));
            decodedCharacters += decoded.length;
            if (decodedCharacters > INPUT_LIMIT) issues.add("BODY_INPUT_LIMIT");
            else {
              own.push(mime === "text/html"
                ? { ...htmlText(decoded, issues, htmlDetails, path), formats: ["HTML"] }
                : { text: decoded, formats: ["TEXT"], imageCount: 0, imagesWithoutAlt: 0 });
            }
          } catch { issues.add("BODY_ENCODING_INVALID"); }
        }
      } else if (p.body?.attachmentId) issues.add("BODY_PART_MISSING");
    }
    const children = (p.parts ?? []).slice(0, 201).map((child, index) => visit(child, depth + 1, `${path}.${index}`));
    if ((p.parts?.length ?? 0) > 201) issues.add("MIME_LIMIT");
    // RFC 2046 5.1.4: alternatives are ordered by increasing fidelity. Select
    // the last readable supported representation, not unconditionally plain text.
    // Keep issues from all inspected parts: fallback must not hide unread content.
    const selected = mime === "multipart/alternative"
      ? [children.findLast(child => child.text.trim())].filter(c => c !== undefined)
      : children;
    const included = [...own, ...selected];
    return { text: included.map(child => child.text).filter(Boolean).join("\n"),
      formats: included.flatMap(child => child.formats),
      imageCount: included.reduce((sum, child) => sum + child.imageCount, 0),
      imagesWithoutAlt: included.reduce((sum, child) => sum + child.imagesWithoutAlt, 0) };
  }
  const selected = visit(payload, 0, "0"), body = selected.text;
  if (!body.trim()) issues.add("BODY_EMPTY");
  const sourceComplete = issues.size === 0;
  if (body.length > OUTPUT_LIMIT) issues.add("BODY_TOO_LONG");
  if (!Number.isInteger(offset) || offset < 0 || offset > body.length ||
    (offset > 0 && /[\uD800-\uDBFF]/u.test(body[offset - 1]!) && /[\uDC00-\uDFFF]/u.test(body[offset] ?? ""))) {
    throw new Error("Invalid body offset");
  }
  let end = Math.min(offset + OUTPUT_LIMIT, body.length);
  if (end < body.length && /[\uD800-\uDBFF]/u.test(body[end - 1]!) && /[\uDC00-\uDFFF]/u.test(body[end]!)) end--;
  const text = body.slice(offset, end);
  const bodyPage = { version: createHash("sha256").update(JSON.stringify(["mail-body-v4", body, [...issues]])).digest("hex"),
    offset, end, totalCharacters: body.length, nextOffset: end < body.length ? end : null, sourceComplete };
  const bodyDiagnostics: BodyDiagnostics = { issues: [...issues], htmlDetails, sourceFormat: formats.size > 1 ? "MIXED" : formats.has("HTML") ? "HTML" : "TEXT",
    selectedFormat: new Set(selected.formats).size > 1 ? "MIXED" : selected.formats.includes("HTML") ? "HTML" : "TEXT",
    imageCount: selected.imageCount, imagesWithoutAlt: selected.imagesWithoutAlt,
    decodedCharacters, extractedCharacters: body.length, returnedCharacters: text.length, outputLimit: OUTPUT_LIMIT };
  return { text, bodyFormat: "TEXT" as const, bodyComplete: offset === 0 && issues.size === 0, bodyDiagnostics, bodyPage };
}
