const DB='repoguide-v1';
async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function get(key){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data'),r=t.objectStore('data').get(key);r.onsuccess=()=>{resolve(r.result);d.close();};r.onerror=()=>{reject(r.error);d.close();};});}
export async function put(key,value){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put(value,key);t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>{d.close();reject(t.error);};});}
