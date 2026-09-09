import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GmailConnections } from "../../src/gmail/connections.js";
import { GmailReader, OpenAiMailInterpreter, isApplicationEvidence } from "../../src/gmail/providers.js";

const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
it("encrypts two account credentials, rejects duplicate accounts and detects modified ciphertext", () => {
  const dir = mkdtempSync(join(tmpdir(), "paw-gmail-test-")); directories.push(dir);
  const store = new GmailConnections(dir, Buffer.alloc(32, 4));
  const owner = { workspaceId: "w", principalId: "p" };
  const connection = { subject: "one", email: "one@example.test", refreshToken: "private-refresh-token" };
  store.put(owner, 1, connection);
  expect(() => store.put(owner, 2, connection)).toThrow();
  store.put(owner, 2, { ...connection, subject: "two", email: "two@example.test" });
  expect(store.get(owner, 1)).toEqual(connection);
  expect(store.get({ ...owner, principalId: "other" }, 1)).toBeNull();
  expect(() => store.get(owner, 3)).toThrow();
  const path = join(dir, readdirSync(dir).find(f => f.endsWith('.1.json.enc'))!);
  const data = readFileSync(path);
  expect(data.toString()).not.toContain(connection.refreshToken);
  data[30] = data[30]! ^ 1; writeFileSync(path, data);
  expect(() => store.get(owner, 1)).toThrow();
  store.remove(owner, 1); expect(store.get(owner, 1)).toBeNull();
  expect(store.get(owner, 2)?.subject).toBe("two");
});

it("reads Gmail pagination, deduplicates IDs, and reports an incomplete capped search", async () => {
  const listed: URL[] = [];
  const reader = new GmailReader(async (input, init) => {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    const url = new URL(String(input));
    if (url.pathname.endsWith("/messages")) {
      listed.push(url);
      return Response.json({ messages: [{ id: "a1" }], nextPageToken: `page${listed.length}` });
    }
    return Response.json({ threadId: "t1", internalDate: Date.parse("2026-09-07T00:00:00Z"),
      payload: { mimeType: "text/plain", headers: [{ name: "From", value: "Recruiter <person@example.test>" }],
        body: { data: Buffer.from("Real text").toString("base64url") } } });
  });
  const result = await reader.search("test-token", "Company", 'Engineer" OR in:anywhere', "2026-09-01", new AbortController().signal);
  expect(listed).toHaveLength(4);
  expect(listed[1]?.searchParams.get("pageToken")).toBe("page1");
  expect(listed[0]?.searchParams.get("q")).not.toContain("in:anywhere");
  expect(result.complete).toBe(false);
  expect(result.issues).toEqual(["PAGE_LIMIT"]);
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]?.senderDomain).toBe("example.test");
});

it("uses only Gmail metadata for keyword hits, including HTML mail without a text body", async () => {
  const reader = new GmailReader(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/messages')) return Response.json({ messages: [{ id: "a1" }] });
    expect(url.searchParams.get('format')).toBe('metadata');
    expect(url.searchParams.getAll('metadataHeaders')).toEqual(['Subject', 'From']);
    expect(url.searchParams.get('fields')).not.toContain('body');
    return Response.json({ threadId: "1", internalDate: Date.now(), snippet: "Interview invitation",
      payload: { headers: [{ name: "from", value: "a@example.test" }, { name: "Subject", value: "Company Engineer" }] } });
  });
  const result = await reader.search("token", "Company", "Engineer", "2026-09-01", new AbortController().signal);
  expect(result.complete).toBe(true);
  expect(result.issues).toEqual([]);
  expect(result.messages[0]?.text).toBe("Company Engineer\nInterview invitation");
});

it("bounds incremental application searches and filters exact timestamp boundaries",async()=>{
  const range={searchedFrom:"2026-09-07T00:00:00.500Z",coveredThrough:"2026-09-08T00:00:00.500Z"};
  const times:Record<string,number>={aa:Date.parse(range.searchedFrom)-1,bb:Date.parse(range.searchedFrom),
    cc:Date.parse(range.coveredThrough)-1,dd:Date.parse(range.coveredThrough)};
  let query="";
  const reader=new GmailReader(async input=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith("/messages")) {query=url.searchParams.get("q")!;return Response.json({messages:Object.keys(times).map(id=>({id}))});}
    const id=url.pathname.split("/").at(-1)!;
    return Response.json({threadId:"thread",internalDate:times[id],payload:{mimeType:"text/plain",
      headers:[{name:"From",value:"source@example.test"}],body:{data:Buffer.from("Application received").toString("base64url")}}});
  });
  const result=await reader.search("token","Company","Role","2025-01-01",new AbortController().signal,range);
  expect(result.messages.map(m=>m.id)).toEqual(["bb","cc"]);
  expect(query).toContain(`before:${Math.ceil(Date.parse(range.coveredThrough)/1000)+1}`);
  expect(result.complete).toBe(true);
  await expect(reader.search("token","Company","Role","2025-01-01",new AbortController().signal,
    {...range,searchedFrom:"2026-08-01T00:00:00Z"})).rejects.toThrow("seven days");
});

it("rejects model output with invented evidence, duplicate IDs, or leaked addresses", async () => {
  const message = { id: "1", threadId: "t", receivedAt: "2026-09-07T00:00:00Z", senderDomain: "example.test", subject: "Job", text: "Application received" };
  const good = { messageId: "1", relevant: true, category: "APPLICATION_CONFIRMATION", summary: "申请已收到", evidenceQuote: "Application received", requiresAction: false };
  for (const items of [[{ ...good, evidenceQuote: "Interview tomorrow" }], [good, good], [{ ...good, summary: "a@example.test" }], []]) {
    const interpreter = new OpenAiMailInterpreter("test", "configured-model", async () => Response.json({ status: "completed",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ items }) }] }] }));
    await expect(interpreter.interpret("Company", "Engineer", [message], new AbortController().signal)).rejects.toThrow();
  }
});

it("does not read overlong bodies and keeps snippet retrieval within the exact interval", async () => {
  const range = { searchedFrom: "2026-09-07T00:00:00Z", coveredThrough: "2026-09-08T00:00:00Z" };
  for (const inRange of [false, true]) {
    const reader = new GmailReader(async input => String(input).includes("format=metadata")
      ? Response.json({ threadId: "t", snippet: "Application received", internalDate: Date.parse(inRange ? "2026-09-07T12:00:00Z" : range.coveredThrough),
        payload: { mimeType: "text/plain", headers: [{ name: "From", value: "a@example.test" }],
          body: { data: Buffer.from("x".repeat(12001)).toString("base64url") } } })
      : Response.json({ messages: [{ id: "aa" }] }));
    const result = await reader.search("token", "Company", "Role", range.searchedFrom, new AbortController().signal, range);
    expect(result.messages).toHaveLength(inRange ? 1 : 0);
    if (inRange) expect(result.messages[0]?.text).toBe("Application received");
    expect(result.complete).toBe(true);
    expect(result.issues).toEqual([]);
  }
});

it.each([[401, "GMAIL_ACCESS_DENIED"], [403, "GMAIL_ACCESS_DENIED"], [429, "GMAIL_RATE_LIMITED"], [503, "GMAIL_REQUEST_FAILED"]])(
  "categorizes Gmail HTTP %s without exposing response contents", async (status, code) => {
    const reader = new GmailReader(async () => new Response("private provider response", { status: Number(status) }));
    await expect(reader.search("token", "Company", "Role", "2026-09-01", new AbortController().signal))
      .rejects.toMatchObject({ code });
  });

it("categorizes invalid Gmail data instead of treating it as an empty mailbox", async () => {
  for (const data of [null, { messages: [{ id: "invalid/id" }] }, { messages: "wrong type" }]) {
    const reader = new GmailReader(async () => Response.json(data));
    await expect(reader.search("token", "Company", "Role", "2026-09-01", new AbortController().signal))
      .rejects.toMatchObject({ code: "GMAIL_RESPONSE_INVALID" });
  }
});

it("requests required categories and only admits applicant-specific evidence categories", async () => {
  const message = { id: "aa", threadId: "t", receivedAt: "2026-09-07T00:00:00Z", senderDomain: "example.test", subject: "Job", text: "Application received" };
  for (const category of ["APPLICATION_CONFIRMATION", "INTERVIEW", "REJECTION", "OFFER", "JOB_ADVERTISEMENT", "UNRELATED", "UNCERTAIN"]) {
    const interpreter = new OpenAiMailInterpreter("test", "configured-model", async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      expect(request.store).toBe(false);
      expect(request.text.format.strict).toBe(true);
      expect(request.text.format.schema.properties.items.items.required).toContain("category");
      expect(request.instructions).toContain("even for the exact company and role");
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ items: [
        { messageId: "aa", category, relevant: true, summary: "申请已收到", evidenceQuote: message.text, requiresAction: false },
      ] }) }] }] });
    });
    const result = await interpreter.interpret("Company", "Role", [message], new AbortController().signal);
    expect(isApplicationEvidence(result.items[0]!)).toBe(!["JOB_ADVERTISEMENT", "UNRELATED", "UNCERTAIN"].includes(category));
  }
});

it("distinguishes model refusal, incomplete output, malformed responses and rate limits", async () => {
  const cases = [
    { response: () => Response.json({ status: "completed", output: [{ content: [{ type: "refusal", refusal: "private text" }] }] }), code: "MODEL_REFUSED" },
    { response: () => Response.json({ status: "incomplete" }), code: "MODEL_INCOMPLETE" },
    { response: () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "not json" }] }] }), code: "MODEL_RESPONSE_INVALID" },
    { response: () => new Response("private text", { status: 429 }), code: "MODEL_RATE_LIMITED" },
    { response: () => new Response("private text", { status: 503 }), code: "MODEL_REQUEST_FAILED" },
  ];
  for (const test of cases) {
    const interpreter = new OpenAiMailInterpreter("test", "configured-model", async () => test.response());
    await expect(interpreter.interpret("Company", "Role", [], new AbortController().signal)).rejects.toMatchObject({ code: test.code });
  }
});
