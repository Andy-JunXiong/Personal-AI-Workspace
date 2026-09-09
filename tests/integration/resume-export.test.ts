import {execFileSync} from "node:child_process";
import {expect,it} from "vitest";
it("preserves Word template parts, fixed identity, typography and editable project links",()=>{
  const python=process.env.PAW_RESUME_PYTHON??(process.platform==="win32"?"python":"python3");
  expect(()=>execFileSync(python,["tests/helpers/test_resume_template.py"],{windowsHide:true,timeout:15000,stdio:"pipe"})).not.toThrow();
});
