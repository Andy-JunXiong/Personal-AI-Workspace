import {z} from "zod";

const text=z.string().max(12000).refine(s=>!/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(s),"Invalid document character");
const short=text.pipe(z.string().max(500));
const url=z.union([z.literal(""),z.url().max(2000).refine(s=>/^https?:\/\//u.test(s),"Use an HTTP(S) link")]);
const bullets=z.array(text).max(20);
export const resumeDocumentSchema=z.object({
  name:short,contact:text,headline:short,
  summaryHeading:short,summary:text,skillsHeading:short,
  skills:z.array(z.object({name:short,content:text}).strict()).length(6),
  projectsHeading:short,
  projects:z.array(z.object({name:short.refine(s=>Boolean(s.trim()),"Project name required"),github:url,demo:url,demoLabel:short,bullets}).strict()).min(3).max(5),
  experienceHeading:short,certificationsHeading:short,educationHeading:short,
  experience:z.array(z.object({title:short,location:short,dates:short,summary:text,bullets}).strict()).min(1).max(12),
  certifications:bullets,
  education:z.array(z.object({school:short,location:short,degree:short,dates:short,detail:text}).strict()).min(1).max(8)
}).strict();
export type ResumeDocument=z.infer<typeof resumeDocumentSchema>;
export const resumeSaveSchema=z.object({expectedVersion:z.number().int().positive(),content:resumeDocumentSchema}).strict();
