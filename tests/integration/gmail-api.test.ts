import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GmailConnections } from "../../src/gmail/connections.js";
import { GmailReader, OpenAiMailInterpreter } from "../../src/gmail/providers.js";

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
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]?.senderDomain).toBe("example.test");
});

it("does not classify unreadable HTML-only emails as a complete search", async () => {
  const reader = new GmailReader(async (input) => String(input).includes("format=full")
    ? Response.json({ threadId: "1", internalDate: Date.now(), payload: { mimeType: "text/html",
      headers: [{ name: "from", value: "a@example.test" }], body: { data: Buffer.from("<p>Interview</p>").toString("base64url") } } })
    : Response.json({ messages: [{ id: "a1" }] }));
  const result = await reader.search("token", "Company", "Engineer", "2026-09-01", new AbortController().signal);
  expect(result.complete).toBe(false);
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
  const good = { messageId: "1", relevant: true, summary: "申请已收到", evidenceQuote: "Application received", requiresAction: false };
  for (const items of [[{ ...good, evidenceQuote: "Interview tomorrow" }], [good, good], [{ ...good, summary: "a@example.test" }], []]) {
    const interpreter = new OpenAiMailInterpreter("test", "configured-model", async () => Response.json({ status: "completed",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ items }) }] }] }));
    await expect(interpreter.interpret("Company", "Engineer", [message], new AbortController().signal)).rejects.toThrow();
  }
});
