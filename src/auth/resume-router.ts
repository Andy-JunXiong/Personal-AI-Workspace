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
  router.get("/resume/variants",(request,response)=>response.json(serviceFor(request).resumeService.listVariants()));
  router.post("/resume/variants",(request,response)=>{authorizeWrite(request);response.json(serviceFor(request).resumeService.createVariant(request.body));});
  router.get("/resume/variants/:variantId",(request,response)=>response.json(serviceFor(request).resumeService.get(z.uuid().parse(request.params.variantId))));
  router.post("/resume/variants/:variantId",(request,response)=>{authorizeWrite(request);response.json(serviceFor(request).resumeService.save(request.body,z.uuid().parse(request.params.variantId)));});
  router.post(["/resume/export","/resume/preview","/resume/variants/:variantId/export","/resume/variants/:variantId/preview"],async(request,response)=>{
    authorizeWrite(request);
    const variantId=request.params.variantId===undefined?undefined:z.uuid().parse(request.params.variantId);
    const preview=request.path.endsWith("/preview");
    const input=preview?z.object({version:z.number().int().positive(),content:resumeDocumentSchema}).strict().parse(request.body)
      :z.object({format:z.enum(["docx","pdf"]),version:z.number().int().positive()}).strict().parse(request.body);
    const format="format" in input?input.format:"pdf";
    const service=serviceFor(request).resumeService;
    const snapshot="content" in input?service.previewSnapshot(input.version,input.content,variantId):service.exportSnapshot(input.version,variantId);
    if(exporting)throw new ConcurrencyConflictError("An export is already running");
    exporting=true;
    try{
      const file=await exportResume(snapshot,format);
      // Revalidate membership/session after the asynchronous conversion.
      authorizeWrite(request);serviceFor(request).resumeService.exportSnapshot(input.version,variantId);
      const filename=`${snapshot.name.replace(/[<>:"/\\|?*\x00-\x1f]/gu,"_")}-v${input.version}.${format}`;
      response.set("Content-Disposition",`${preview?"inline":"attachment"}; filename="Resume-v${input.version}.${format}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/gu,"%27")}`)
        .type(format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document").send(file);
    }finally{exporting=false;}
  });return router;
}
