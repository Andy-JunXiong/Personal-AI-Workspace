import { createHash } from "node:crypto";

// Keep the already-deployed website identity format. A mailbox slot is only a
// display/connection alias and must never identify the owner of a message.
export function gmailAccountKey(subject: string): string {
  if (!subject.trim()) throw new Error("Missing Gmail account identity");
  return createHash("sha256").update(subject).digest("hex").slice(0, 24);
}

export function gmailSourceId(accountKey: string, messageId: string): string {
  if (!/^[a-f0-9]{24}$/u.test(accountKey) || !/^[a-f0-9]{1,128}$/u.test(messageId))
    throw new Error("Invalid Gmail source identity");
  return `${accountKey}:${messageId}`;
}
