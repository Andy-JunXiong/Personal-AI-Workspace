import type {ResumeDocument} from "../../src/domain/resume-document.js";
export const resumeFixture=():ResumeDocument=>({name:"Example Person",contact:"Example City | person@example.test",headline:"Engineer",summary:"Builds tested software.",summaryHeading:"Professional Summary",skillsHeading:"Core Skills",experienceHeading:"Professional Experience",certificationsHeading:"Certifications",educationHeading:"Education",
  skills:Array.from({length:6},(_,i)=>({name:i<5?`Group ${i+1}`:"",content:i<5?"Example skills":""})),projectsHeading:"Independent Engineering",
  projects:Array.from({length:3},(_,i)=>({name:`Project ${i+1}`,github:"https://github.com/example/project",demo:"https://example.test/demo",demoLabel:"Demo",bullets:["Built a service"]})),
  experience:[{title:"Engineer, Example",location:"City",dates:"2020 – 2024",summary:"Worked on systems",bullets:["Delivered software"]}],
  certifications:["Example certification"],education:[{school:"Example University",location:"City",degree:"Degree",dates:"2016 – 2020",detail:"Software"}]});
