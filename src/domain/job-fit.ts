import { z } from "zod";
import { ValidationError } from "./errors.js";

export const jobFitSchema = z.object({
  summary: z.string().min(1).max(2000),
  conflicts: z.array(z.string().min(1).max(1000)).max(30),
  requirements: z.array(z.object({
    requirement: z.string().min(1).max(1000), jdQuote: z.string().min(1).max(1200),
    importance: z.enum(["REQUIRED","PREFERRED"]),
    assessment: z.enum(["MATCH","PARTIAL","UNKNOWN"]),
    evidenceQuote: z.string().max(2000), sourceId: z.string().max(100),
    explanation: z.string().min(1).max(1500),
  }).strict()).min(1).max(50),
  resumeSections: z.array(z.object({
    heading: z.enum(["Skills","Experience","Projects","Education","Certifications"]),
    quotes: z.array(z.object({sourceId:z.string().min(1).max(100),text:z.string().min(1).max(2000)}).strict()).max(15),
  }).strict()).max(5),
}).strict();
export type JobFit = z.infer<typeof jobFitSchema>;
export interface FitSource {id:string;title:string;content:string;review_status:string}

export function validateJobFit(input: unknown, jd: string, sources: FitSource[]) {
  const report=jobFitSchema.parse(input);
  const source=(id:string)=>sources.find(s=>s.id===id && s.review_status!=="EXCLUDED");
  let weight=0, earned=0, known=0;
  const seen=new Set<string>();
  for(const r of report.requirements){
    if(!jd.includes(r.jdQuote)) throw new ValidationError("Requirement has no exact JD evidence");
    const key=r.requirement.toLowerCase().replace(/\s+/gu," ").trim();
    if(seen.has(key))throw new ValidationError("Duplicate requirement");
    seen.add(key);
    const w=r.importance==="REQUIRED"?3:1; weight+=w;
    if(r.assessment!=="UNKNOWN"){
      if(!r.evidenceQuote.trim() || !source(r.sourceId)?.content.includes(r.evidenceQuote)) throw new ValidationError("Skill has no exact library evidence");
      earned+=w*(r.assessment==="MATCH"?1:0.5);known+=w;
    }else if(r.sourceId||r.evidenceQuote)throw new ValidationError("Unknown requirement cannot claim evidence");
  }
  for(const section of report.resumeSections) for(const quote of section.quotes){
    if(!source(quote.sourceId)?.content.includes(quote.text)) throw new ValidationError("Resume draft contains unsupported content");
  }
  return {report,score:report.conflicts.length?null:Math.round(100*earned/weight),coverage:Math.round(100*known/weight)};
}
