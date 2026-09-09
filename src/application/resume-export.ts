import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import type {ResumeDocument} from "../domain/resume-document.js";

const exec=promisify(execFile);
// Build copies the helper to dist/scripts, retaining a cwd-independent path.
const helper=fileURLToPath(new URL("../../scripts/resume-template.py",import.meta.url));
const python=process.env.PAW_RESUME_PYTHON??(process.platform==="win32"?"python":"python3");
export async function inspectResumeTemplate(path:string){
  const result=await exec(python,[helper,"inspect",resolve(path)],{timeout:15000,maxBuffer:1_000_000,windowsHide:true});
  return JSON.parse(result.stdout) as unknown;
}
export async function exportResume(snapshot:{template:Buffer;content:ResumeDocument},format:"docx"|"pdf"){
  const directory=await mkdtemp(join(tmpdir(),"paw-resume-"));
  try{
    const template=join(directory,"template.docx"),data=join(directory,"content.json"),docx=join(directory,"resume.docx");
    await writeFile(template,snapshot.template,{mode:0o600});await writeFile(data,JSON.stringify(snapshot.content),{mode:0o600});
    const wordPdf=process.platform==="win32"&&process.env.PAW_RESUME_WORD_PDF==="true";
    const mode=format==="pdf"&&!wordPdf?"export-pdf":"export";
    await exec(python,[helper,mode,template,data,docx],{timeout:15000,maxBuffer:100000,windowsHide:true});
    if(format==="docx")return await readFile(docx);
    if(wordPdf){
      await exec("powershell.exe",["-NoProfile","-File",fileURLToPath(new URL("../../scripts/resume-word-pdf.ps1",import.meta.url)),docx,join(directory,"resume.pdf")],{timeout:75000,maxBuffer:100000,windowsHide:true});
    }else{
      await exec(process.env.PAW_RESUME_SOFFICE??"soffice",["-env:UserInstallation="+pathToFileURL(join(directory,"lo-profile")).href,"--headless","--convert-to","pdf:writer_pdf_Export","--outdir",directory,docx],{timeout:75000,maxBuffer:100000,windowsHide:true});
    }
    const pdf=await readFile(join(directory,"resume.pdf"));
    if(pdf.subarray(0,5).toString()!=="%PDF-")throw new Error("PDF conversion failed");
    return pdf;
  }finally{await rm(directory,{recursive:true,force:true});}
}
