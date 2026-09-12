import { expect, it } from "vitest";
import { gmailAccountKey, gmailSourceId } from "../../src/gmail/source-identity.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GmailMcpReader } from "../../src/gmail/mcp-reader.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";

const owner = { workspaceId: "w", principalId: "p" };
const range = { mailbox: "mailbox-1" as const, searchedFrom: "2026-01-01T00:00:00.500Z", coveredThrough: "2026-01-02T00:00:00.500Z" };
const store = { get: (identity: typeof owner, slot: number) => identity.workspaceId === owner.workspaceId && identity.principalId === owner.principalId
  ? { email: `box${slot}@example.test`, subject: `s${slot}`, refreshToken: `secret${slot}` } : null };
const auth = { access: async () => "secret-access" };

it("checks both live identities without returning credentials and isolates owners", async () => {
  let calls = 0;
  const reader = new GmailMcpReader(store, auth, async () => Response.json({ emailAddress: `box${++calls}@example.test` }));
  const result = await reader.accounts(owner);
  expect(result.mailboxes.map(m => m.status)).toEqual(["AVAILABLE", "AVAILABLE"]);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect((await reader.accounts({ ...owner, principalId: "other" })).mailboxes.every(m => m.status === "UNAVAILABLE")).toBe(true);
  expect(calls).toBe(2);
  const mismatch = new GmailMcpReader(store, auth, async () => Response.json({ emailAddress: "wrong@example.test" }));
  expect((await mismatch.accounts(owner)).mailboxes.every(m => m.status === "UNAVAILABLE")).toBe(true);
});

it("pages bounded full-mailbox discovery without dropping precision boundaries or making writes", async () => {
  const urls: URL[] = [];
  const reader = new GmailMcpReader(store, auth, async (input, init) => {
    expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error");
    const url = new URL(String(input)); urls.push(url);
    return Response.json({ messages: [{ id: "ab12", threadId: "thread" }], ...(urls.length === 1 ? { nextPageToken: "page2" } : {}) });
  });
  expect(await reader.list(owner, range)).toMatchObject({ listingComplete: false, nextPageToken: "page2" });
  expect(await reader.list(owner, { ...range, pageToken: "page2" })).toMatchObject({ listingComplete: true, nextPageToken: null });
  expect(urls[0]?.searchParams.get("includeSpamTrash")).toBe("true");
  expect(urls[0]?.searchParams.get("q")).toBe(`after:${Math.floor(Date.parse(range.searchedFrom) / 1000) - 1} before:${Math.ceil(Date.parse(range.coveredThrough) / 1000) + 1}`);
  expect(urls[1]?.searchParams.get("pageToken")).toBe("page2");
  await expect(reader.list(owner, { ...range, coveredThrough: range.searchedFrom })).rejects.toThrow();
  await expect(reader.list(owner, { ...range, coveredThrough: "2026-03-01T00:00:00Z" })).rejects.toThrow();
  await expect(reader.list({ ...owner, workspaceId: "other" }, range)).rejects.toThrow();
  expect(urls).toHaveLength(2);
});

it("returns evidence provenance and explicit incomplete-body flags, skips attachments", async () => {
  let body = "<p>Application received</p>";
  const reader = new GmailMcpReader(store, auth, async () => Response.json({ id: "ab12", threadId: "thread", internalDate: "1767225600500",
    payload: { headers: [{ name: "From", value: "Recruiter <person@example.test>" }], parts: [
      { mimeType: "text/html", body: { data: Buffer.from(body).toString("base64url") } },
      { filename: "private.txt", mimeType: "text/plain", body: { data: Buffer.from("attachment secret").toString("base64url") } },
    ] } }));
  const read = () => reader.read(owner, { mailbox: "mailbox-1", messageId: "ab12" });
  expect(await read()).toMatchObject({ bodyFormat: "TEXT", bodyComplete: true, externalId: gmailSourceId(gmailAccountKey("s1"),"ab12"), senderDomain: "example.test", receivedAt: "2026-01-01T00:00:00.500Z", text: "Application received", bodyDiagnostics: { sourceFormat: "HTML", issues: [] } });
  body = "x".repeat(24001);
  const truncated = await read(); expect(truncated.bodyComplete).toBe(false); expect(truncated.text).toHaveLength(24000);
  body = ""; expect((await read()).bodyComplete).toBe(false);
  await expect(reader.read(owner, { mailbox: "mailbox-1", messageId: "../profile" })).rejects.toThrow();
});

it("does not leak upstream credential errors", async () => {
  const reader = new GmailMcpReader(store, { access: async () => { throw new Error("secret-refresh-token"); } });
  await expect(reader.list(owner, range)).rejects.toThrow("Gmail read failed");
  expect(JSON.stringify(await reader.accounts(owner))).not.toContain("secret-refresh-token");
});

it("exposes and invokes all three tools over MCP without database writes", async () => {
  const workspace = createTestWorkspace();
  const identity = workspace.service.resolveIdentity();
  const reader = new GmailMcpReader({ get: (actual, slot) => {
    expect(actual).toEqual(identity); return store.get(owner, slot);
  } }, auth, async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("profile")) return Response.json({ emailAddress: "box1@example.test" });
    if (url.pathname.endsWith("messages")) return Response.json({ messages: [{ id: "ab12", threadId: "thread" }] });
    return Response.json({ id: "ab12", threadId: "thread", internalDate: "1767225600500", payload: { mimeType: "text/plain", body: { data: Buffer.from("Applied").toString("base64url") } } });
  });
  const server = createWorkspaceMcpServer(workspace.service, undefined, reader);
  const client = new Client({ name: "mail-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const before = workspace.database.prepare("SELECT total_changes() AS n").get();
    expect((await client.listTools()).tools).toHaveLength(40);
    for (const [name, args] of [["workspace_get_mail_accounts", {}], ["workspace_list_mail_messages", range], ["workspace_read_mail_message", { mailbox: "mailbox-1", messageId: "ab12" }]] as const) {
      expect((await client.callTool({ name, arguments: args })).isError).not.toBe(true);
    }
    expect(workspace.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  } finally { await client.close(); await server.close(); workspace.cleanup(); }
});
