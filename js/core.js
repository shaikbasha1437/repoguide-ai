// Pure, dependency-free chunking, BM25 retrieval and conservative evidence checks.
export const LIMITS = {fileBytes:200000, files:40, totalBytes:4000000, zipBytes:12000000};
export function skipReason(path, size=0) {
  const p=String(path).replace(/\\/g,'/');
  if (p.startsWith('/') || p.split('/').includes('..')) return 'unsafe path';
  if (/(^|\/)(\.env(?:\.[^/]*)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.npmrc|\.pypirc|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|\.netrc)$/i.test(p) || /\.(pem|key|p12|pfx|keystore)$/i.test(p) || /(^|\/)(\.aws|\.ssh|\.gnupg|\.git)(\/|$)/i.test(p)) return 'secret or credential file';
  if (/(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.venv|venv|__pycache__|target|\.idea)(\/|$)/i.test(p)) return 'generated / dependency directory';
  if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|bun\.lockb?)$/i.test(p)||/\.(min\.(js|css)|map|lock)$/i.test(p)) return 'lockfile or minified bundle';
  if (size>LIMITS.fileBytes) return 'over 200 KB';
  if (/\.(png|jpe?g|gif|svg|webp|ico|avif|pdf|zip|gz|tar|7z|woff2?|ttf|eot|mp[34]|wav|ogg|exe|dll|so|bin|wasm|sqlite|db|class|pyc|jar|xlsx?|docx?|pptx?)$/i.test(p)) return 'binary / media';
  if (!/(\.(md|mdx|txt|rst|js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|c|h|cpp|hpp|cs|rb|php|swift|kt|sql|prisma|graphql|gql|json|yaml|yml|toml|ini|cfg|html|css|scss|sh|bash|vue|svelte|xml|tf|dockerfile)|(^|\/)(LICENSE|README|Dockerfile|Makefile|Procfile))$/i.test(p)) return 'unsupported text type';
  return '';
}
export function redact(text, secrets=[]) {
  let s=String(text);
  for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length)) s=s.split(secret).join('[REDACTED]');
  return s.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, m=>m.replace(/[^\n]/g,'•'))
    .replace(/\b(?:gh[pousr]_[a-zA-Z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}|sk-(?:ant-)?[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{25,})\b/g,'[REDACTED]')
    .replace(/((?:password|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'])(?!\$|process\.|os\.)([^"'\n]{6,})(["'])/gi,'$1[REDACTED]$3');
}
export function normalizeFiles(files) {
  const out=[], skipped=[]; let bytes=0;
  for(const f of files){
    const reason=skipReason(f.path,new TextEncoder().encode(f.text||'').length);
    if(reason) { skipped.push({path:f.path,reason}); continue; }
    if ((f.text||'').split('\n').some(line=>line.length>3000)) { skipped.push({path:f.path,reason:'minified / unusually long line'}); continue; }
    if ((f.text||'').includes('\0')) { skipped.push({path:f.path,reason:'binary content'}); continue; }
    if(out.length>=LIMITS.files||bytes+f.text.length>LIMITS.totalBytes) {skipped.push({path:f.path,reason:'snapshot limit'});continue;}
    const text=redact(f.text.replace(/\r\n?/g,'\n')); bytes+=text.length; out.push({path:f.path,text});
  }
  return {files:out,skipped};
}
export function chunkFile(file) {
  const lines=file.text.split('\n'), chunks=[]; let start=0;
  while(start<lines.length) {
    let end=start, chars=0;
    while(end<lines.length && end-start<42 && chars<1800){chars+=lines[end].length+1;end++;}
    if(end<lines.length){
      for(let n=end-1;n>start+12;n--) if(/^\s*(#{1,6} |(?:export\s+)?(?:async\s+)?(?:function|class|def|async def|interface|type|const\s+\w+\s*=\s*(?:async\s*)?\(|func)\b)/.test(lines[n])) {end=n;break;}
    }
    const text=lines.slice(start,end).join('\n');
    if(text.trim()) chunks.push({id:`${file.path}:${start+1}-${end}`,path:file.path,start:start+1,end,text});
    if(end>=lines.length)break;
    start=Math.max(start+1,end-5);
  }
  return chunks;
}
const STOP=new Set('a an the is are was were be been it this that those these of to and or for with in on at by as i we you how what where which does do can about me from please explain'.split(' '));
export function tokens(text){return String(text).replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().match(/[a-z0-9_]+/g)?.filter(t=>t.length>1&&!STOP.has(t)).map(t=>t.replace(/(?:ing|ed|s)$/,''))||[];}
export function buildIndex(files){
  const chunks=files.flatMap(chunkFile), df={}, docs=chunks.map(c=>{const ts=tokens(c.path+' '+c.text),tf={};for(const t of ts)tf[t]=(tf[t]||0)+1;for(const t of Object.keys(tf))df[t]=(df[t]||0)+1;return {tf,len:ts.length};});
  return {chunks,docs,df,avg:docs.reduce((s,d)=>s+d.len,0)/(docs.length||1)};
}
const SYN={authentication:['authenticate','auth','session','password'],architecture:['readme','api','database','organization'],auth:['authentication','login','session','token'],database:['database','query','sql','repository'],test:['test','assert'],rate:['rate','limit'],store:['database','save'],password:['password','scrypt']};
export function retrieve(index,question,limit=5,vectors=null,queryVector=null){
  const ts=[...new Set(tokens(question))];for(const t of [...ts]) if(SYN[t]) ts.push(...SYN[t].flatMap(tokens));
  const scores=index.docs.map((d,i)=>{let score=0;for(const t of new Set(ts)){const n=d.tf[t]||0;if(!n)continue;const idf=Math.log(1+(index.docs.length-(index.df[t]||0)+.5)/((index.df[t]||0)+.5));score+=idf*(n*2.2)/(n+1.2*(.25+.75*d.len/(index.avg||1)));}return {i,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(vectors&&queryVector){const vr=index.chunks.map((c,i)=>({i,score:cosine(vectors[i]||[],queryVector)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);const ranks=new Map();scores.forEach((x,r)=>ranks.set(x.i,1/(60+r)));vr.forEach((x,r)=>ranks.set(x.i,(ranks.get(x.i)||0)+1/(60+r)));return [...ranks].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([i,score])=>({...index.chunks[i],score}));}
  return scores.slice(0,limit).map(x=>({...index.chunks[x.i],score:x.score}));
}
export function cosine(a,b){if(a.length!==b.length||!a.length)return 0;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function evidenceQuote(chunk,question='') {
  const lines=chunk.text.split('\n');
  if(chunk.text.length<=600)return chunk.text;
  const ts=[...new Set(tokens(question))];for(const t of [...ts])if(SYN[t])ts.push(...SYN[t].flatMap(tokens));
  let best=0,score=-1;
  for(let i=0;i<lines.length;i++){const window=lines.slice(i,i+8).join('\n'),ws=tokens(window);const n=ts.reduce((s,t)=>s+ws.filter(w=>w===t).length,0);if(n>score){score=n;best=i;}}
  const selected=[];let chars=0;for(let i=best;i<lines.length&&selected.length<8;i++){if(chars+lines[i].length>700&&selected.length)break;selected.push(lines[i]);chars+=lines[i].length+1;}
  return selected.join('\n').slice(0,1500);
}
export function extractiveAnswer(hits,question=''){
  if(!hits.length)return {claims:[],notice:'No matching evidence. Try a file name or a more specific question.',mode:'extractive'};
  return {mode:'extractive',notice:'Extractive mode — source excerpts, not an AI explanation. These may only partially answer your question.',claims:hits.slice(0,3).map(c=>({text:'Relevant source excerpt from '+c.path,citations:[{id:c.id,quote:evidenceQuote(c,question)}],extractive:true}))};
}
export function validateAnswer(answer,hits){
  const list=Array.isArray(answer.claims)?answer.claims.slice(0,12):[];
  return list.map(claim=>{
    const citations=(Array.isArray(claim.citations)?claim.citations:[]).map(c=>{const hit=hits.find(h=>h.id===c.id);const quote=typeof c.quote==='string'?c.quote:'';const valid=!!hit&&quote.trim().length>=8&&hit.text.includes(quote); let range=hit;if(valid){const offset=hit.text.indexOf(quote);const start=hit.start+hit.text.slice(0,offset).split('\n').length-1;range={...hit,start,end:start+quote.split('\n').length-1};}return {...c,quote,hit:range,valid};});
    const reasons=[];if(!citations.length||citations.some(c=>!c.valid))reasons.push('Missing or invalid citation / quote');
    if(!claim.extractive){const terms=[...new Set(tokens(claim.text))];const evidence=tokens(citations.filter(c=>c.valid).map(c=>c.quote).join(' '));const coverage=terms.filter(t=>evidence.includes(t)).length/(terms.length||1);if(coverage<.35)reasons.push('Claim wording is weakly supported by its quoted evidence');const nums=String(claim.text).match(/\b\d+(?:\.\d+)?\b/g)||[];if(nums.some(n=>!citations.some(c=>c.quote.includes(n))))reasons.push('Number not found in quoted evidence');}
    return {text:String(claim.text||''),citations,flags:reasons};
  });
}
export function transcriptMarkdown(repo,turns,secrets=[]){
  const text=`# RepoGuide AI — ${repo.name}\n\nSnapshot: ${repo.ref||'local'}\n\n`+turns.map(t=>`## ${t.question}\n\n${t.notice||''}\n\n`+t.claims.map(c=>`${c.flags?.length?'⚠ '+c.flags.join('; ')+'\n\n':''}${c.text}\n\n`+c.citations.filter(x=>x.valid).map(x=>`- **${x.hit.path}:${x.hit.start}-${x.hit.end}**\n\n\`\`\`text\n${x.quote}\n\`\`\`\n`).join('\n')).join('\n')).join('\n');
  return redact(text,secrets);
}
export function starters(files){const readme=files.find(f=>/readme/i.test(f.path));return ['How is this project organized?',readme?'What does the README say about setup?':'Where is the entry point?',files.some(f=>/auth|session/i.test(f.path))?'How does authentication work?':'What are the main API routes?',files.some(f=>/test/i.test(f.path))?'What behavior do the tests cover?':'How is data stored?'];}
