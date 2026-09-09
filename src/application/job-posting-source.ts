import {parse,type DefaultTreeAdapterTypes as Tree} from "parse5";

export function canonicalJobUrl(value:string):{url:string;provider:string;postingId:string}|null{
  try{
    const url=new URL(value);
    if(url.protocol!=="https:"||url.port||url.username||url.password)return null;
    const host=url.hostname.toLowerCase();
    const linked=["linkedin.com","www.linkedin.com","au.linkedin.com"].includes(host)&&url.pathname.match(/^\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d+)\/?$/u);
    if(linked)return {url:`https://www.linkedin.com/jobs/view/${linked[1]}`,provider:"linkedin",postingId:linked[1]!};
    const seek=["seek.com.au","www.seek.com.au"].includes(host)&&url.pathname.match(/^\/job\/(\d+)\/?$/u);
    if(seek)return {url:`https://www.seek.com.au/job/${seek[1]}`,provider:"seek",postingId:seek[1]!};
    return null;
  }catch{return null;}
}

export function alertJobLinks(text:string){
  const found=new Map<string,NonNullable<ReturnType<typeof canonicalJobUrl>>>();
  // Decode embedded tracking destinations, but never follow a tracking host.
  const variants=[text];
  for(let i=0;i<2;i++){try{variants.push(decodeURIComponent(variants.at(-1)!));}catch{break;}}
  for(const input of variants)for(const match of input.matchAll(/https:\/\/[^\s<>"')\]]+/gu)){
    const job=canonicalJobUrl(match[0].replace(/&amp;/gu,"&"));if(job)found.set(job.url,job);
  }
  return [...found.values()];
}

function textContent(node:Tree.Node):string{
  if(node.nodeName==="#text")return (node as Tree.TextNode).value;
  if("childNodes" in node)return node.childNodes.map(textContent).join(" ");
  return "";
}
export function postingFromHtml(html:string){
  const tree=parse(html);const postings:Record<string,unknown>[]=[];
  const scanJson=(value:unknown):void=>{
    if(Array.isArray(value)){value.forEach(scanJson);return;}
    if(!value||typeof value!=="object")return;
    const obj=value as Record<string,unknown>;
    if(obj["@type"]==="JobPosting"||(Array.isArray(obj["@type"])&&obj["@type"].includes("JobPosting")))postings.push(obj);
    if(obj["@graph"])scanJson(obj["@graph"]);
  };
  const walk=(node:Tree.Node)=>{
    if("tagName" in node&&node.tagName==="script"&&node.attrs.some(a=>a.name==="type"&&a.value.toLowerCase()==="application/ld+json")){
      try{scanJson(JSON.parse(textContent(node)));}catch{/* malformed data is not a JD */}
    }
    if("childNodes" in node)node.childNodes.forEach(walk);
  };walk(tree);
  if(postings.length!==1)return null;
  const p=postings[0]!,org=p.hiringOrganization;
  if(typeof p.title!=="string"||typeof p.description!=="string"||!org||typeof org!=="object"||!("name" in org)||typeof org.name!=="string")return null;
  const jd=textContent(parse(p.description)).replace(/\s+/gu," ").trim();
  if(jd.length<200||jd.length>50000)return null;
  return {title:p.title.slice(0,300),company:org.name.slice(0,300),jd};
}

export async function fetchJobPosting(value:string,fetcher:typeof fetch=fetch){
  const job=canonicalJobUrl(value);if(!job)throw new Error("Unsupported job URL");
  let url=job.url;
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetcher(url,{redirect:"manual",signal:AbortSignal.timeout(20000),headers:{accept:"text/html"}});
    if([301,302,303,307,308].includes(response.status)){
      const redirected=canonicalJobUrl(new URL(response.headers.get("location")??"",url).href);
      if(!redirected||redirected.provider!==job.provider||redirected.postingId!==job.postingId)return null;
      url=redirected.url;continue;
    }
    if(!response.ok||!response.headers.get("content-type")?.includes("text/html")||!response.body)return null;
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
    try{while(true){const {done,value:part}=await reader.read();if(done)break;length+=part.length;if(length>2000000)return null;chunks.push(part);}}
    finally{await reader.cancel();}
    return postingFromHtml(Buffer.concat(chunks).toString("utf8"));
  }
  return null;
}
