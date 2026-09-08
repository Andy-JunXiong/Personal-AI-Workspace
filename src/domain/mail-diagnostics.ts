import { ValidationError } from "./errors.js";

// Only fixed categories leave the provider boundary: never persist exception text,
// HTTP response bodies, credentials or message content as diagnostics.
export const mailDiagnosticMessages = {
  NOT_CONNECTED: "邮箱尚未连接",
  AUTHORIZATION_FAILED: "未能取得邮箱访问授权，请检查连接",
  GMAIL_ACCESS_DENIED: "邮箱访问被拒绝，请检查授权",
  GMAIL_RATE_LIMITED: "邮箱请求受到频率限制，请稍后重试",
  GMAIL_REQUEST_FAILED: "邮箱搜索或读取请求失败，请稍后重试",
  GMAIL_RESPONSE_INVALID: "邮箱返回的数据无法解析",
  PAGE_LIMIT: "候选邮件超过本次读取上限，尚有分页未检查",
  BODY_MISSING: "部分邮件没有可读取的纯文本正文",
  BODY_TRUNCATED: "部分邮件正文超过读取上限，未读取完整",
  MODEL_REQUEST_FAILED: "邮件分析请求失败，请稍后重试",
  MODEL_RATE_LIMITED: "邮件分析受到频率限制，请稍后重试",
  MODEL_INCOMPLETE: "邮件分析未完整返回结果",
  MODEL_REFUSED: "模型未能分析这批邮件",
  MODEL_RESPONSE_INVALID: "邮件分析结果格式不完整，未采用该批结果",
  MODEL_EVIDENCE_INVALID: "邮件分析引用与原文不一致，未采用该批结果",
  CLASSIFICATION_UNCERTAIN: "部分邮件无法确定是否属于本次申请，需要进一步核对",
  IDENTITY_UNPROVEN: "历史邮件归属尚未确认，原记录已保留",
  ACCOUNT_CHANGED: "检查期间邮箱账户发生变化，请重新检查",
  EVIDENCE_LOOKUP_FAILED: "未能核对已保存的邮件证据",
  EVIDENCE_SAVE_FAILED: "邮件证据未能保存，请稍后重试",
  RECEIPT_SAVE_FAILED: "检查结果未能完整保存，成功范围未推进",
  TIMEOUT: "检查超时，未完成的范围需要重试",
  UNKNOWN: "检查未能完成，原因尚未确定",
} as const;
export type MailDiagnosticCode = keyof typeof mailDiagnosticMessages;
export type MailCheckStage = "AUTHORIZE" | "SEARCH" | "DEDUPLICATE" | "INTERPRET" | "SAVE" | "COMPLETE";
export interface MailDiagnostic { mailbox: "mailbox-1" | "mailbox-2" | null; stage: MailCheckStage; code: MailDiagnosticCode; }
export class MailCheckError extends Error {
  constructor(public readonly code: MailDiagnosticCode) { super(mailDiagnosticMessages[code]); }
}
// DOMException and errors from another realm need not inherit this realm's Error.
export const isMailTimeout = (error: unknown) => typeof error === "object" && error !== null
  && "name" in error && (error.name === "TimeoutError" || error.name === "AbortError");
export function mailDiagnostic(error: unknown, stage: MailCheckStage, slot?: number): MailDiagnostic {
  const fallback: Record<MailCheckStage, MailDiagnosticCode> = {
    AUTHORIZE: "AUTHORIZATION_FAILED", SEARCH: "GMAIL_REQUEST_FAILED", DEDUPLICATE: "EVIDENCE_LOOKUP_FAILED",
    INTERPRET: "MODEL_REQUEST_FAILED", SAVE: "EVIDENCE_SAVE_FAILED", COMPLETE: "RECEIPT_SAVE_FAILED",
  };
  const code = error instanceof MailCheckError ? error.code
    : isMailTimeout(error) ? "TIMEOUT"
    : error instanceof ValidationError && error.message === "Historical Gmail evidence needs account reconciliation; existing records were preserved"
      ? "IDENTITY_UNPROVEN" : fallback[stage];
  return { mailbox: slot === 1 ? "mailbox-1" : slot === 2 ? "mailbox-2" : null, stage, code };
}
export const diagnosticText = (diagnostic: MailDiagnostic) =>
  `${diagnostic.mailbox ? `邮箱 ${diagnostic.mailbox === "mailbox-1" ? "1" : "2"}：` : ""}${mailDiagnosticMessages[diagnostic.code]}`;
