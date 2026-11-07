import {skipReason,LIMITS,normalizeFiles} from './core.js';
export function parseRepo(input,branch=''){
  const raw=String(input).trim().replace(/\/$/,'');
  const m=raw.match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/tree\/(.+))?$/);
  if(!m||m[1]==='.'||m[2]==='..')throw Error('Use owner/repo or https://github.com/owner/repo (optional /tree/branch).');
  return {owner:m[1],repo:m[2].replace(/\.git$/,''),branch:branch||decodeURIComponent(m[3]||'')};
}
export async function loadGithub(input,branch,token='',deps={}){
 const f=deps.fetch||fetch,progress=deps.progress||(()=>{}),quota=deps.quota||(()=>{});let remaining=null;
 async function api(path){
  if(remaining!==null&&remaining<2)throw Error('GitHub quota nearly exhausted. Wait for reset or add your own PAT.');
  const r=await f('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})},signal:deps.signal});
  const left=r.headers.get('x-ratelimit-remaining'),reset=r.headers.get('x-ratelimit-reset');if(left!==null){remaining=Number(left);quota({remaining,reset:Number(reset)*1000});}
  if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub rate limited this request. Wait for reset; no automatic retries.':`GitHub ${r.status}: repository/ref unavailable or access denied.`);
  return r.json();
 }
 const {owner,repo,branch:requested}=parseRepo(input,branch);const base='/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo);
 progress('tree',0,0);const meta=await api(base);const ref=requested||meta.default_branch;const commit=await api(base+'/commits/'+encodeURIComponent(ref));
 const tree=await api(base+'/git/trees/'+commit.commit.tree.sha+'?recursive=1');const skipped=[],eligible=[];
 for(const entry of tree.tree||[]){if(entry.type!=='blob')continue;const reason=skipReason(entry.path,entry.size||0);if(reason)skipped.push({path:entry.path,reason});else eligible.push(entry);}
 eligible.sort((a,b)=>(/readme/i.test(a.path)?-1:0)-(/readme/i.test(b.path)?-1:0)||a.path.localeCompare(b.path));
 progress('filter',eligible.length,skipped.length);const files=[];let total=0;
 for(let i=0;i<eligible.length;i++){
  const e=eligible[i];if(files.length>=LIMITS.files||total+(e.size||0)>LIMITS.totalBytes||remaining!==null&&remaining<3){skipped.push({path:e.path,reason:'snapshot / quota limit'});continue;}
  progress('fetch',files.length+1,Math.min(eligible.length,LIMITS.files));
  const blob=await api(base+'/git/blobs/'+e.sha);if(blob.encoding!=='base64'){skipped.push({path:e.path,reason:'unsupported GitHub encoding'});continue;}
  const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  const text=new TextDecoder().decode(bytes);total+=bytes.length;files.push({path:e.path,text});
 }
 const safe=normalizeFiles(files);return {name:owner+'/'+repo,ref:commit.sha,files:safe.files,skipped:skipped.concat(safe.skipped),truncated:!!tree.truncated||skipped.some(x=>/limit/.test(x.reason)),demo:false};
}
