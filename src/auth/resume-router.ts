import {Router,type Request} from "express";
import {z} from "zod";
import type {WorkspaceService} from "../application/workspace-service.js";
import {ConcurrencyConflictError} from "../domain/errors.js";
import {exportResume} from "../application/resume-export.js";
import {resumeDocumentSchema} from "../domain/resume-document.js";

export function createResumeRouter(serviceFor:(request:Request)=>WorkspaceService,authorizeWrite:(request:Request)=>unknown){
  const router=Router();let exporting=false;
  router.get("/resume",(request,response)=>response.json(serviceFor(request).resumeService.get()));
  router.post("/resume",(request,response)=>{authorizeWrite(request);response.json(serviceFor(request).resumeService.save(request.body));});
  router.post(["/resume/export","/resume/preview"],async(request,response)=>{
    authorizeWrite(request);
    const preview=request.path==="/resume/preview";
    const input=preview?z.object({version:z.number().int().positive(),content:resumeDocumentSchema}).strict().parse(request.body)
      :z.object({format:z.enum(["docx","pdf"]),version:z.number().int().positive()}).strict().parse(request.body);
    const format="format" in input?input.format:"pdf";
    const service=serviceFor(request).resumeService;
    const snapshot="content" in input?service.previewSnapshot(input.version,input.content):service.exportSnapshot(input.version);
    if(exporting)throw new ConcurrencyConflictError("An export is already running");
    exporting=true;
    try{
      const file=await exportResume(snapshot,format);
      // Revalidate membership/session after the asynchronous conversion.
      authorizeWrite(request);serviceFor(request).resumeService.exportSnapshot(input.version);
      response.set("Content-Disposition",`${preview?"inline":"attachment"}; filename="Resume-v${input.version}.${format}"`)
        .type(format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document").send(file);
    }finally{exporting=false;}
  });return router;
}
