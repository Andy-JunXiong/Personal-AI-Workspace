import { expect, it } from "vitest";
import { extractMessageBody } from "../../src/gmail/message-body.js";

const part = (text: string, mimeType = "text/html") => ({ mimeType, body: { data: Buffer.from(text).toString("base64url") } });

it("returns contiguous versioned body parts without splitting surrogate pairs or certifying a standalone tail", () => {
  const body="x".repeat(23999)+"😀"+"y".repeat(3336);
  const first=extractMessageBody(part(body,"text/plain"));
  expect(first.bodyComplete).toBe(false);
  expect(first.bodyPage).toMatchObject({offset:0,end:23999,nextOffset:23999,totalCharacters:27337,sourceComplete:true});
  const tail=extractMessageBody(part(body,"text/plain"),first.bodyPage.nextOffset!);
  expect(tail.bodyComplete).toBe(false);
  expect(tail.bodyPage).toMatchObject({offset:23999,end:27337,nextOffset:null,version:first.bodyPage.version});
  expect(first.text+tail.text).toBe(body);
  expect(extractMessageBody(part(body+"changed","text/plain")).bodyPage.version).not.toBe(first.bodyPage.version);
  expect(()=>extractMessageBody(part(body,"text/plain"),24000)).toThrow(/offset/);
  expect(()=>extractMessageBody(part(body,"text/plain"),30000)).toThrow(/offset/);
});

it("identifies unsupported HTML without retaining original content and permits closing-only Outlook fragments", () => {
  const closing=extractMessageBody(part('<p>Complete evidence</p><!--[if gte mso 9]>\n</v:textbox>\n</v:rect>\n-->'));
  expect(closing.bodyComplete).toBe(true);
  const bad=extractMessageBody(part('<!--[if mso]>private hidden instructions --><iframe src="https://private.test"></iframe><object data="private">fallback</object>'));
  expect(bad.bodyPage.sourceComplete).toBe(false);
  expect(bad.bodyDiagnostics.htmlDetails).toEqual(expect.arrayContaining([
    {reason:"CONDITIONAL_COMMENT_UNPARSED",part:"0",tag:null,count:1},
    {reason:"EMBEDDED_ELEMENT",part:"0",tag:"iframe",count:1},
    {reason:"OBJECT_RESOURCE",part:"0",tag:"object",count:1},
  ]));
  expect(JSON.stringify(bad.bodyDiagnostics.htmlDetails)).not.toContain("private");
  expect(extractMessageBody(part('<!--[if mso]></v:rect>Unread text -->')).bodyDiagnostics.htmlDetails[0]?.reason).toBe("CONDITIONAL_COMMENT_UNPARSED");
});

it("extracts long layout HTML while preserving final evidence, entities, tables and link targets", () => {
  const html = `<html><head><style>${".layout { color:red; }".repeat(3000)}</style></head><body>
    <p>Application &amp; interview</p><table><tr><td>Date</td><td>9 September</td></tr></table>
    <a href="https://example.test/respond?a=1&amp;b=2">Respond</a><p>Final decision: offer.</p></body></html>`;
  const result = extractMessageBody(part(html));
  expect(html.length).toBeGreaterThan(24000);
  expect(result).toMatchObject({ bodyFormat: "TEXT", bodyComplete: true, bodyDiagnostics: { sourceFormat: "HTML", issues: [] } });
  expect(result.text).toContain("Application & interview");
  expect(result.text).toMatch(/Date\s+9 September/);
  expect(result.text).toContain("Respond [https://example.test/respond?a=1&b=2]");
  expect(result.text).toContain("Final decision: offer.");
  expect(result.text).not.toContain(".layout");
  expect(result.bodyDiagnostics.extractedCharacters).toBeLessThan(300);
});

it("keeps genuinely long text incomplete with distinct length diagnostics", () => {
  for (const mime of ["text/plain", "text/html"]) {
    const result = extractMessageBody(part("x".repeat(24001), mime));
    expect(result.bodyComplete).toBe(false);
    expect(result.text).toHaveLength(24000);
    expect(result.bodyDiagnostics).toMatchObject({ issues: ["BODY_TOO_LONG"], extractedCharacters: 24001, returnedCharacters: 24000 });
  }
  expect(extractMessageBody(part("x".repeat(24000), "text/plain")).bodyComplete).toBe(true);
});

it("keeps separate mixed text/HTML content and selects alternatives without duplicating them", () => {
  const result = extractMessageBody({ mimeType: "multipart/mixed", parts: [
    { mimeType: "multipart/alternative", parts: [part("Applied", "text/plain"), part("<p>Applied HTML copy</p>")] },
    part("<p>Separate interview instructions</p>"),
    { ...part("attachment secret", "text/plain"), filename: "secret.txt" },
    { ...part("unnamed attachment", "text/plain"), headers: [{ name: "Content-Disposition", value: "attachment" }] },
  ] });
  expect(result.bodyComplete).toBe(true);
  expect(result.text).toBe("Applied HTML copy\nSeparate interview instructions");
  expect(result.bodyDiagnostics.sourceFormat).toBe("MIXED");
});

it("uses the richer final MIME alternative and exposes unread images without certifying classification", () => {
  const result = extractMessageBody({ mimeType: "multipart/alternative", parts: [
    part("Brand\nbody { margin: 0; }\nNeed Help?", "text/plain"),
    part('<head><style>body { margin: 0; }</style></head><body><p>New bag collection</p>'
      + '<a href="https://example.test/bags"><img width="600" height="795" alt=""></a>'
      + '<img alt="Collection overview"><footer>Need Help?</footer></body>'),
  ] });
  expect(result.text).toContain("New bag collection");
  expect(result.text).toContain("[https://example.test/bags]");
  expect(result.text).not.toContain("margin");
  expect(result.bodyDiagnostics).toMatchObject({ selectedFormat: "HTML", imageCount: 2, imagesWithoutAlt: 1 });
  // Text completeness is not image OCR or a decision that this source can be acked.
  expect(result.bodyComplete).toBe(true);
});

it("honors alternative ordering and keeps missing or unsupported alternatives visible", () => {
  const reversed = extractMessageBody({ mimeType: "multipart/alternative", parts: [
    part("<p>HTML copy</p>"), part("Preferred final plain copy", "text/plain"),
  ] });
  expect(reversed).toMatchObject({ text: "Preferred final plain copy", bodyDiagnostics: { selectedFormat: "TEXT" } });
  const missing = extractMessageBody({ mimeType: "multipart/alternative", parts: [
    part("Fallback", "text/plain"), { mimeType: "text/html", body: { attachmentId: "missing-body" } },
  ] });
  expect(missing).toMatchObject({ text: "Fallback", bodyComplete: false });
  expect(missing.bodyDiagnostics.issues).toContain("BODY_PART_MISSING");
  const unsupported = extractMessageBody({ mimeType: "multipart/alternative", parts: [
    part("Fallback", "text/plain"), part('<iframe src="https://example.test"></iframe>'),
  ] });
  expect(unsupported.bodyComplete).toBe(false);
});

it("retains resource-free object fallback text including malformed and nested wrappers", () => {
  const result = extractMessageBody(part('<p>Notice</p><object style="display:none"><p>Hidden fallback</p></object>'
    + '<object style"display:none;"><object>Nested fallback &amp; final evidence</object></object>'));
  expect(result.bodyComplete).toBe(true);
  expect(result.text).toContain("Hidden fallback");
  expect(result.text).toContain("Nested fallback & final evidence");
  for (const declaration of ['data="https://example.test/doc"', 'data=""', 'type="application/pdf"',
    'classid="legacy"', 'code="legacy"', 'codebase="https://example.test"', 'archive="legacy.jar"']) {
    expect(extractMessageBody(part(`<object ${declaration}>Fallback</object>`)).bodyDiagnostics.issues)
      .toContain("HTML_UNSUPPORTED_CONTENT");
  }
  expect(extractMessageBody(part('<object><param name="movie" value="clip">Fallback</object>')).bodyComplete).toBe(false);
  expect(extractMessageBody(part('<object><iframe src="https://example.test"></iframe>Fallback</object>')).bodyComplete).toBe(false);
});

it("distinguishes missing external body parts, empty bodies and invalid encodings without reading attachments", () => {
  const missing = extractMessageBody({ mimeType: "multipart/mixed", parts: [part("Readable"),
    { mimeType: "text/html", body: { attachmentId: "external-body" } }] });
  expect(missing).toMatchObject({ bodyComplete: false, bodyDiagnostics: { issues: ["BODY_PART_MISSING"] } });
  expect(extractMessageBody(part("<style>body{color:red}</style>"))).toMatchObject({ bodyComplete: false, bodyDiagnostics: { issues: ["BODY_EMPTY"] } });
  expect(extractMessageBody({ mimeType: "text/plain", body: { data: "%%%" } }).bodyDiagnostics.issues).toContain("BODY_ENCODING_INVALID");
  expect(extractMessageBody({ mimeType: "text/plain", body: { data: Buffer.from([0xff]).toString("base64url") } }).bodyDiagnostics.issues).toContain("BODY_ENCODING_INVALID");
});

it("decodes declared charsets rather than silently replacing non-UTF8 evidence", () => {
  const result = extractMessageBody({ mimeType: "text/plain", headers: [{ name: "Content-Type", value: 'text/plain; charset="windows-1252"' }],
    body: { data: Buffer.from([0x43, 0x61, 0x66, 0xe9]).toString("base64url") } });
  expect(result).toMatchObject({ text: "Café", bodyComplete: true });
});

it("retains hidden text and conditional branches, decodes HTML5 entities and never executes HTML", () => {
  const result = extractMessageBody(part(`<p style="display:none">Action required &NotEqualTilde; &#x1F600;</p>
    <!--[if mso]><p>Outlook-only deadline</p><![endif]--><script>fetch('secret')</script>
    <p>Normal instructions<br>Next step</p>`));
  expect(result.bodyComplete).toBe(true);
  expect(result.text).toContain("Action required ≂̸ 😀");
  expect(result.text).toContain("Outlook-only deadline");
  expect(result.text).toContain("Normal instructions\nNext step");
  expect(result.text).not.toContain("fetch");
  expect(extractMessageBody(part('<img src="https://example.test/private" alt="See offer">')).bodyComplete).toBe(false);
  expect(extractMessageBody(part('<p>Read me</p><iframe src="https://example.test/private"></iframe>')).bodyDiagnostics.issues).toContain("HTML_UNSUPPORTED_CONTENT");
});

it("marks input, MIME traversal and HTML traversal limits incomplete", () => {
  expect(extractMessageBody(part("x".repeat(1_000_001))).bodyDiagnostics.issues).toContain("BODY_INPUT_LIMIT");
  let nested: unknown = part("Deep evidence");
  for (let i = 0; i < 22; i++) nested = { mimeType: "multipart/mixed", parts: [nested] };
  expect(extractMessageBody(nested).bodyDiagnostics.issues).toContain("MIME_LIMIT");
  expect(extractMessageBody({ parts: Array.from({ length: 202 }, () => part("x")) }).bodyDiagnostics.issues).toContain("MIME_LIMIT");
  expect(extractMessageBody(part("<span>x</span>".repeat(11000))).bodyDiagnostics.issues).toContain("HTML_LIMIT");
});

it("retains content between revealed Outlook boundary comments without treating markers as missing bodies", () => {
  const result=extractMessageBody(part('<!--[if !mso]><!--><p>Visible deadline: Friday.</p><!--<![endif]-->'
    + '<!--[if mso]><p>Outlook deadline: Friday.</p><![endif]-->'));
  expect(result.bodyComplete).toBe(true);
  expect(result.text).toContain("Visible deadline: Friday.");
  expect(result.text).toContain("Outlook deadline: Friday.");
  expect(extractMessageBody(part('<!-- [if mso]>unclosed hidden evidence --><p>Normal text</p>')).bodyDiagnostics.issues)
    .toContain("HTML_UNSUPPORTED_CONTENT");
});
