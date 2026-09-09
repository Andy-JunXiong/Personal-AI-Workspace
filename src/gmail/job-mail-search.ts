/** Literal search criteria; email content never supplies Gmail query operators. */
export const JOB_MAIL_KEYWORDS = ["job", "jobs", "interview", "interviews", "application", "applied", "applying",
  "assessment", "offer", "recruiter", "recruitment", "招聘", "面试", "申请", "录用"];
export type JobMailCriteria = { companies: string[]; senders: string[] };
export const searchLiteral = (value: string) => value.normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
export function jobMailQuery(criteria: JobMailCriteria): string {
  const subjects = [...new Set([...JOB_MAIL_KEYWORDS, ...criteria.companies.map(searchLiteral)].filter(Boolean))];
  const senders=criteria.senders.filter(s=>/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/iu.test(s));
  const query="{" + [...subjects.map(s=>`subject:"${s}"`),...senders.map(s=>`from:"${s}"`)].join(" ") + "}";
  if(query.length>12000) throw new Error("Job search criteria exceed the query limit; no search was performed");
  return query;
}
export function matchesJobMail(subject: string, sender: string | null, criteria: JobMailCriteria): string | null {
  if(sender && criteria.senders.some(s=>s.toLowerCase()===sender.toLowerCase())) return "KNOWN_SENDER";
  const normalized=searchLiteral(subject).toLowerCase();
  const contains=(term:string)=> {
    const literal=searchLiteral(term).toLowerCase();
    return literal && (/[\u3400-\u9fff]/u.test(literal) ? normalized.includes(literal) : ` ${normalized} `.includes(` ${literal} `));
  };
  if(criteria.companies.some(contains)) return "APPLICATION_COMPANY";
  return JOB_MAIL_KEYWORDS.some(contains) ? "JOB_SUBJECT" : null;
}
