/** Small, inert Markdown subset for imported reports. No HTML, images or embeds. */
const escape = (text: string) => text.replace(/[&<>"']/gu, (value) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[value]!));

function linkUrl(value: string): string | null {
  if (/^#[\p{L}\p{N}_.:-]+$/u.test(value)) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function inline(text: string, depth = 0): string {
  if (depth > 3) return escape(text);
  const tokens = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\[\]\n]{1,500})\]\(([^\s)]{1,2000})\)/gu;
  let result = "", offset = 0;
  for (const match of text.matchAll(tokens)) {
    result += escape(text.slice(offset, match.index));
    if (match[1]) result += `<code>${escape(match[1])}</code>`;
    else if (match[2]) result += `<strong>${inline(match[2], depth + 1)}</strong>`;
    else {
      const url = linkUrl(match[4]!);
      result += url ? `<a href="${escape(url)}"${url.startsWith("#") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${inline(match[3]!, depth + 1)}</a>` : escape(match[0]);
    }
    offset = match.index! + match[0].length;
  }
  return result + escape(text.slice(offset));
}

const cells = (line: string) => line.trim().replace(/^\||\|$/gu, "").split("|").map(cell => cell.trim());
const tableRule = (line: string) => line.includes("|") && cells(line).every(cell => /^:?-{3,}:?$/u.test(cell));
const listItem = (line: string) => /^(?:[-*+] |\d+[.)] )/u.test(line);

export function renderReportMarkdown(source: string): string {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor]!.trim();
    if (!line) { cursor++; continue; }
    if (line.startsWith("```")) {
      const code: string[] = [];
      cursor++;
      while (cursor < lines.length && !lines[cursor]!.trim().startsWith("```")) code.push(lines[cursor++]!);
      cursor++;
      output.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      const level = Math.min(heading[1]!.length + 1, 6);
      output.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      cursor++;
      continue;
    }
    if (line.includes("|") && cells(line).length <= 12 && tableRule(lines[cursor + 1] ?? "")) {
      const headings = cells(line);
      const rows: string[] = [];
      cursor += 2;
      while (cursor < lines.length && lines[cursor]!.trim() && lines[cursor]!.includes("|")) {
        const row = cells(lines[cursor++]!);
        rows.push(`<tr>${headings.map((title, index) => `<td data-label="${escape(title)}">${inline(row[index] ?? "")}</td>`).join("")}</tr>`);
      }
      output.push(`<div class="watch-comparison"><table><thead><tr>${headings.map(title => `<th scope="col">${inline(title)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
      continue;
    }
    if (listItem(line)) {
      const ordered = /^\d/u.test(line);
      const tag = ordered ? "ol" : "ul";
      const items: string[] = [];
      while (cursor < lines.length && listItem(lines[cursor]!.trim()) && /^\d/u.test(lines[cursor]!.trim()) === ordered) {
        let item = lines[cursor++]!.trim().replace(/^(?:[-*+] |\d+[.)] )/u, "");
        while (cursor < lines.length && /^\s+\S/u.test(lines[cursor]!) && !listItem(lines[cursor]!.trim())) item += ` ${lines[cursor++]!.trim()}`;
        items.push(`<li>${inline(item)}</li>`);
      }
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const paragraph = [line];
    cursor++;
    while (cursor < lines.length && lines[cursor]!.trim() && !/^(?:#{1,6}\s|```)/u.test(lines[cursor]!.trim()) && !listItem(lines[cursor]!.trim()) && !tableRule(lines[cursor + 1] ?? "")) paragraph.push(lines[cursor++]!.trim());
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return `<div class="watch-markdown">${output.join("\n")}</div>`;
}
