// Optional OpenAI-compatible embeddings; model / API selected explicitly by the user.
export async function embed(texts,cfg,deps={}){
 const base=new URL(cfg.embedBase||'https://api.openai.com/v1');if(base.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Embeddings require HTTPS or a localhost endpoint.');
 if(base.username||base.password||base.search||base.hash)throw Error('Use a clean embedding URL without credentials, query or fragment.');
 const out=[];for(let i=0;i<texts.length;i+=16){const r=await (deps.fetch||fetch)(base.href.replace(/\/$/,'')+'/embeddings',{method:'POST',headers:{'Content-Type':'application/json',...(cfg.embedKey?{Authorization:'Bearer '+cfg.embedKey}:{})},body:JSON.stringify({model:cfg.embedModel||'text-embedding-3-small',input:texts.slice(i,i+16)}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error('Embeddings request failed ('+r.status+'). Lexical index is still available.');const j=await r.json();if(!Array.isArray(j.data)||j.data.length!==texts.slice(i,i+16).length)throw Error('Invalid embedding count');const batch=j.data.sort((a,b)=>a.index-b.index).map(x=>x.embedding);if(batch.some(v=>!Array.isArray(v)||!v.length||v.some(n=>!Number.isFinite(n))))throw Error('Invalid vector');out.push(...batch);}
 return out;
}
