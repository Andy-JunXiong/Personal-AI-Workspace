import { describe, expect, it } from "vitest";
import { renderReportMarkdown } from "../../src/web/report-markdown.js";

describe("inert report Markdown", () => {
  it("renders readable paragraphs, headings, emphasis, lists and code", () => {
    const html = renderReportMarkdown("## 早晨打开 PAW\n\n第一行\n第二行 **要核对**。\n\n1. 看邮件\n   再看保存结果\n2. 保留网页\n\n```html\n<script>bad()</script>\n```");
    expect(html).toContain("<h3>早晨打开 PAW</h3>");
    expect(html).toContain("<p>第一行 第二行 <strong>要核对</strong>。</p>");
    expect(html).toContain("<ol><li>看邮件 再看保存结果</li><li>保留网页</li></ol>");
    expect(html).toContain("<pre><code>&lt;script&gt;bad()&lt;/script&gt;</code></pre>");
  });
  it("renders comparison columns with accessible mobile labels", () => {
    const html = renderReportMarkdown("| 做法 | 近期 | 以后 |\n| --- | --- | --- |\n| 保留网页 | 继续导出 | 维护现有编辑器 |\n| 整体迁移 | 重做预览 | 依赖会话 UI |\n\n接着读。");
    expect(html).toContain('<th scope="col">近期</th>');
    expect(html).toContain('<td data-label="以后">维护现有编辑器</td>');
    expect(html).toContain("<p>接着读。</p>");
  });
  it("escapes raw HTML and attribute payloads without loading images", () => {
    const html = renderReportMarkdown('<img src=x onerror=bad()>\n\n**<svg onload=bad()>**\n\n![pixel](https://example.com/pixel)\n\n| "><script> | safe |\n| --- | --- |\n| a | b |');
    expect(html).not.toMatch(/<(?:img|svg|script)\b/u);
    expect(html).toContain("&lt;img src=x onerror=bad()&gt;");
    expect(html).toContain('data-label="&quot;&gt;&lt;script&gt;"');
  });
  it.each(["javascript:alert%281%29", "data:text/html,bad", "//evil.test", "https://user:pass@example.com", "file:///tmp/a"])("does not activate unsafe URL %s", (url) => {
    expect(renderReportMarkdown(`[link](${url})`)).not.toContain("<a ");
  });
  it("allows source links and preserves unsupported Markdown as escaped text", () => {
    const html = renderReportMarkdown('[source](https://example.com/?x=1&y=2) and [section](#evidence)\n\n<iframe src="x">');
    expect(html).toContain('href="https://example.com/?x=1&amp;y=2" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="#evidence"');
    expect(html).toContain('&lt;iframe src=&quot;x&quot;&gt;');
  });
  it("keeps malformed links and oversized table headers bounded", () => {
    expect(renderReportMarkdown("[".repeat(100_000))).not.toContain("<a ");
    const header = Array(20).fill("column").join("|");
    const rule = Array(20).fill("---").join("|");
    expect(renderReportMarkdown(`${header}\n${rule}\nvalue|value`)).not.toContain("<table>");
  });
});
