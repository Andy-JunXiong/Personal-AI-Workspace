import { z } from "zod";

export const applicationMailCategorySchema = z.enum([
  "APPLICATION_CONFIRMATION", "APPLICATION_UPDATE", "INTERVIEW", "OFFER", "REJECTION", "ACTION_REQUEST",
  "JOB_ADVERTISEMENT", "UNRELATED", "UNCERTAIN",
]);
export const applicationMailTitles: Record<string, string> = {
  APPLICATION_CONFIRMATION: "申请已收到", APPLICATION_UPDATE: "申请进展",
  INTERVIEW: "面试安排", OFFER: "录用通知 / Offer", REJECTION: "申请未通过", ACTION_REQUEST: "招聘方请求",
};
export const isApplicationMailCategory = (category: string): boolean => Object.hasOwn(applicationMailTitles, category);

// These are vacancy marketing signals, not evidence that the recipient applied.
export const isVacancyMarketing = (summary: string): boolean =>
  /职位推荐|岗位推荐|推荐.{0,50}(职位|岗位)|招聘信息|招聘广告|职位仍.{0,8}(开放|招聘)|(?:仍然?|依然|继续)开放申请|邀请.{0,12}(投递|申请)|job alerts?|job recommendations?|recommended jobs?|vacancy advert|invitation to apply|invited? you to apply|still (?:open|hiring)/iu.test(summary);

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};
const normalize = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase() : "";

/** Legacy unclassified mail is shown only with a clear application milestone. */
export function applicationMailEvent(facts: unknown, company: unknown, role: unknown): { category: string; title: string; summary: string; receivedAt: string | null } | null {
  const record = object(facts), interpretation = object(record.interpretation), source = object(record.sourceFacts);
  if (record.contractVersion !== "gmail-job-observation-v0.1"
    || !normalize(company) || !normalize(role)
    || normalize(interpretation.company) !== normalize(company) || normalize(interpretation.role) !== normalize(role)) return null;
  const summary = typeof interpretation.summary === "string" ? interpretation.summary.trim() : "";
  if (!summary || isVacancyMarketing(summary)) return null;
  let category: string | null = null;
  if (interpretation.category !== undefined) {
    if (typeof interpretation.category !== "string" || !isApplicationMailCategory(interpretation.category)) return null;
    category = interpretation.category;
  } else {
    const signals: [string, RegExp][] = [
      ["REJECTION", /申请.{0,20}(未通过|被拒|不成功)|未通过.{0,15}(申请|筛选|面试)|不再.{0,12}考虑|拒绝.{0,12}(申请|候选)|申请被拒|application.{0,30}(unsuccessful|rejected)|not.{0,12}(proceed|moving forward)/iu],
      ["OFFER", /录用通知|收到.{0,8}offer|offer of employment|job offer|employment offer/iu],
      ["INTERVIEW", /面试邀请|邀请.{0,15}面试|安排.{0,15}面试|面试.{0,15}(安排|时间|改期|取消)|interview.{0,20}(invitation|scheduled|rescheduled|cancelled)|invite.{0,20}interview/iu],
      ["APPLICATION_CONFIRMATION", /申请已收到|已收到.{0,20}(申请|简历)|确认收到.{0,100}(申请|简历)|确认.{0,12}(申请|投递)|成功.{0,8}(投递|提交)|application.{0,20}(received|submitted|confirmation|receipt)|received.{0,15}(application|resume)|(?:confirmed|acknowledged) receipt of (?:the |your |an )?application/iu],
      ["ACTION_REQUEST", /招聘方.{0,20}(联系|沟通|询问|要求)|要求.{0,15}(补充|提交).{0,15}(材料|信息)|recruiter.{0,15}(requested|contacted)|request.{0,15}(availability|documents)/iu],
      ["APPLICATION_UPDATE", /申请状态.{0,15}(in progress|under review|审核|处理中)|申请.{0,15}(进入|下一轮|审核中|审查中|评估中)|application.{0,20}(under review|shortlisted|next stage)/iu],
    ];
    category = signals.find(([, pattern]) => pattern.test(summary))?.[0] ?? null;
  }
  if (!category) return null;
  const receivedAt = typeof source.receivedAt === "string" && Number.isFinite(Date.parse(source.receivedAt)) ? source.receivedAt : null;
  return { category, title: applicationMailTitles[category]!, summary, receivedAt };
}
