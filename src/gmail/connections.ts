import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { IdentityContext } from "../domain/types.js";

const connectionSchema = z.object({ refreshToken: z.string().min(1), subject: z.string().min(1), email: z.email() }).strict();
export type GmailConnection = z.infer<typeof connectionSchema>;

export class GmailConnections {
  constructor(private readonly directory: string, private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("Invalid encryption key");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  private owner(identity: IdentityContext) { return `${identity.workspaceId}:${identity.principalId}`; }
  private path(identity: IdentityContext, slot: number) {
    if (slot !== 1 && slot !== 2) throw new Error("Invalid mailbox slot");
    return join(this.directory, createHash("sha256").update(this.owner(identity)).digest("hex") + `.${slot}.json.enc`);
  }
  get(identity: IdentityContext, slot: number): GmailConnection | null {
    let data: Buffer;
    try { data = readFileSync(this.path(identity, slot)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    const decipher = createDecipheriv("aes-256-gcm", this.key, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(`${this.owner(identity)}:${slot}`));
    decipher.setAuthTag(data.subarray(12, 28));
    const text = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
    return connectionSchema.parse(JSON.parse(text));
  }
  put(identity: IdentityContext, slot: number, connection: GmailConnection) {
    const value = connectionSchema.parse(connection);
    const other = this.get(identity, slot === 1 ? 2 : 1);
    if (other?.subject === value.subject) throw new Error("This mailbox is already connected in the other slot");
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(`${this.owner(identity)}:${slot}`));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    const target = this.path(identity, slot), temporary = target + "." + randomBytes(8).toString("hex");
    writeFileSync(temporary, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600, flag: "wx" });
    try { renameSync(temporary, target); }
    finally { try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  }
  remove(identity: IdentityContext, slot: number) {
    try { unlinkSync(this.path(identity, slot)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}
