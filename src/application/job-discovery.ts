import type {WorkspaceService} from "./workspace-service.js";
import type {GmailMcpReader} from "../gmail/mcp-reader.js";
import type {JobFitAnalyzer} from "./job-fit-analyzer.js";
import {alertJobLinks,alertJobReferences,resolveAlertJobUrl,fetchJobPosting,canonicalJobUrl} from "./job-posting-source.js";

export async function discoverJobs(service:WorkspaceService,reader:GmailMcpReader,authorize:()=>unknown,
  analyzer?:JobFitAnalyzer){
  const library=service.jobLibraryService,identity=library.identityContext();
  const deadline=Date.now()+15*60*1000;
  const checkAuthority=()=>{authorize();if(Date.now()>deadline)throw new Error("Discovery time limit reached");};
  const result={mailboxes:[] as {mailbox:string;complete:boolean;read:number;error:boolean;emptyResponse:boolean}[],
    candidateCount:0,jdCount:0,matchedCount:0,missingJd:0,comparisonFailures:0,unresolvedLinks:0,limited:false};
  const jobs=new Map<string,ReturnType<typeof alertJobLinks>[number]&{title?:string;company?:string}>();
  const tracking=new Map<string,{title:string;company?:string}>();
  for(const alias of ["mailbox-1","mailbox-2"] as const){
    const receipt={mailbox:alias,complete:false,read:0,error:false,emptyResponse:false};result.mailboxes.push(receipt);
    try{
      const accountKey=reader.accountKey(identity,alias);
      const listed=await reader.jobAlerts(identity,alias);receipt.complete=listed.complete;receipt.emptyResponse=listed.emptyResponse;
      for(const item of listed.messages){
        checkAuthority();
        const input={mailbox:alias,messageId:item.id};
        const metadata=await reader.metadata(identity,input);
        if(!metadata.senderEmail||!/@(?:[a-z0-9-]+\.)*(?:linkedin\.com|seek\.com\.au)$/u.test(metadata.senderEmail))continue;
        if(Date.now()-Date.parse(metadata.receivedAt)>7*86400000)continue;
        // Only targeted job-alert bodies are needed to recover the posting links.
        const message=await reader.read(identity,input);
        if(reader.accountKey(identity,alias)!==accountKey)throw new Error("Account changed");
        receipt.read++;
        if(!message.bodyComplete)receipt.complete=false;
        for(const job of alertJobLinks(message.text))jobs.set(job.url,job);
        for(const ref of alertJobReferences(message.text)){
          const direct=canonicalJobUrl(ref.url);
          if(direct)jobs.set(direct.url,{...direct,title:ref.title,company:ref.company});
          else if(tracking.size<20)tracking.set(ref.url,{title:ref.title,company:ref.company});
          else result.limited=true;
        }
      }
    }catch{receipt.error=true;receipt.complete=false;}
  }
  for(const [url,details] of tracking){
    checkAuthority();
    try{const job=await resolveAlertJobUrl(url);if(job)jobs.set(job.url,{...job,...details});else result.unresolvedLinks++;}
    catch{result.unresolvedLinks++;}
  }
  const applied=new Set(library.applicationPostingUrls().flatMap(url=>{const value=canonicalJobUrl(url);return value?[value.url]:[];}));
  const known=library.knownPostingUrls();
  const pending=[...jobs.values()].filter(job=>!applied.has(job.url)).sort((a,b)=>Number(known.has(a.url))-Number(known.has(b.url)));
  result.limited ||= pending.length>10;
  let comparisons=0;
  for(const job of pending.slice(0,10)){
    checkAuthority();
    let posting:null|Awaited<ReturnType<typeof fetchJobPosting>>=null;
    try{posting=await fetchJobPosting(job.url);}catch{/* Access failures remain missing JD. */}
    checkAuthority();
    const saved=service.candidateService.recordDiscoveredCandidateFromWeb({provider:job.provider,postingId:job.postingId,
      sourceUrl:job.url,title:posting?.title||job.title||`${job.provider} job ${job.postingId}`,company:posting?.company||job.company||"待补公司",
      role:posting?.title||job.title||"待读取职位描述",sourceAvailability:posting?"AVAILABLE":"UNKNOWN",
      fitUncertainty:"UNKNOWN",fitReason:posting?"来自 Job Alert，已获取职位描述。":"来自 Job Alert；原网站未返回可用 JD，请打开原链接补充。"});
    result.candidateCount++;
    if(!posting){result.missingJd++;continue;}
    library.saveDescription(saved.candidate.id,posting.jd,job.url);result.jdCount++;
    if(saved.candidate.decision==="DISMISSED"||saved.candidate.linkedProjectId)continue;
    const snapshot=library.snapshot(),existing=library.fit(saved.candidate.id);
    // Automatic refresh preserves edited drafts; regeneration is explicit.
    if(existing)continue;
    if(!analyzer||!snapshot.sources.length)continue;
    if(comparisons>=3){result.limited=true;continue;}
    comparisons++;
    try{
      const fit=await analyzer.analyze(posting.jd,snapshot.sources,AbortSignal.timeout(120000));
      checkAuthority();library.saveFit(saved.candidate.id,posting.jd,job.url,fit,snapshot.hash,null);result.matchedCount++;
    }catch{result.comparisonFailures++;}
  }
  return result;
}
