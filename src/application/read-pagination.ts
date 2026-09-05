import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { WorkspaceError } from "../domain/errors.js";

// Shared across request-scoped services; restarting the process invalidates
// cursors, not durable business state. No cursor data grants object access.
const cursorKey = randomBytes(32);
const cursorSchema = z.object({
  v: z.literal(1), binding: z.string().regex(/^[a-f0-9]{64}$/u),
  revision: z.string().regex(/^[a-f0-9]{64}$/u),
  offset: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expiresAt: z.number().int().positive(),
}).strict();

export class CursorError extends WorkspaceError {
  constructor(code: "INVALID_CURSOR" | "STALE_CURSOR") {
    super(code, "This result page is no longer valid; reload from the first page");
  }
}

export interface ReadPage<T> {
  items: T[];
  totalCount: number;
  nextCursor: string | null;
  asOf: string;
  coverage: { offset: number; returned: number; loaded: number; hasMore: boolean; complete: boolean };
}

const signature = (body: string): Buffer => createHmac("sha256", cursorKey).update(body).digest();

function decodeCursor(value: string, binding: string, now: number) {
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
    const [body, mac] = value.split(".") as [string, string];
    const supplied = Buffer.from(mac, "base64url");
    const expected = signature(body);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
    const decoded = cursorSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (decoded.binding !== binding || decoded.expiresAt <= now) throw new Error();
    return decoded;
  } catch { throw new CursorError("INVALID_CURSOR"); }
}

/** Call inside the query's SQLite read transaction. Stream the matching result
 * for a content revision and exact total, retaining at most pageSize items.
 * This is O(matching rows), not a claim of constant-cost database pagination. */
export function readPage<T>(rows: () => Iterable<T>, bindingInput: unknown,
  pageSize: number, cursor: string | undefined, now: number): ReadPage<T> {
  const binding = canonicalHash(bindingInput);
  const previous = cursor ? decodeCursor(cursor, binding, now) : undefined;
  const offset = previous?.offset ?? 0;
  const revisionHash = createHash("sha256");
  const items: T[] = [];
  let totalCount = 0;
  // Validate the cursor before opening a SQLite iterator. An unopened wrapper
  // generator cannot close an already-created underlying native iterator.
  for (const row of rows()) {
    revisionHash.update(canonicalJson(row)).update("\n");
    if (totalCount >= offset && items.length < pageSize) items.push(row);
    totalCount++;
  }
  const revision = revisionHash.digest("hex");
  if (previous && (previous.revision !== revision || offset >= totalCount)) {
    throw new CursorError("STALE_CURSOR");
  }
  const loaded = offset + items.length;
  const hasMore = loaded < totalCount;
  let nextCursor: string | null = null;
  if (hasMore) {
    const body = Buffer.from(JSON.stringify({ v: 1, binding, revision, offset: loaded,
      expiresAt: previous?.expiresAt ?? now + 900_000 })).toString("base64url");
    nextCursor = `${body}.${signature(body).toString("base64url")}`;
  }
  return { items, totalCount, nextCursor, asOf: new Date(now).toISOString(),
    coverage: { offset, returned: items.length, loaded, hasMore, complete: !hasMore } };
}
