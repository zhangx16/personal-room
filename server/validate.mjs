const short = (value, max) => typeof value === 'string' && value.length <= max;
const address = value => { if(!value) return value==='';try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;} };
export function validRecord(r) {
  const keys=['id','kind','title','description','url','github','adminUrl','tags','status','favorite','order','content','environment','sessions','username','relatedProject','secret','updatedAt','version'];
  if(!r || typeof r!=='object' || Array.isArray(r) || Object.keys(r).some(k=>!keys.includes(k)) || keys.some(k=>!(k in r))) return false;
  if(!short(r.id,36)||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(r.id)||!['project','link','script','secret'].includes(r.kind)) return false;
  if(!short(r.title,120)||!r.title.trim()||!short(r.description,4000)||!short(r.content,50000)||!short(r.environment,300)||!short(r.username,300)||!short(r.relatedProject,120)) return false;
  if(['url','github','adminUrl'].some(k=>!short(r[k],2048)||!address(r[k]))) return false;
  if(!Array.isArray(r.tags)||r.tags.length>12||r.tags.some(t=>!short(t,40))) return false;
  if(!['active','paused','done'].includes(r.status)||typeof r.favorite!=='boolean'||!Number.isInteger(r.order)||r.order<0||r.order>1000000||!Number.isSafeInteger(r.version)||r.version<0||!short(r.updatedAt,40)||!Number.isFinite(Date.parse(r.updatedAt))) return false;
  if(!Array.isArray(r.sessions)||r.sessions.length>100||r.sessions.some(s=>!s||!short(s.id,36)||!short(s.title,120)||!s.title||!short(s.thread,100)||!/^[a-zA-Z0-9-]{8,100}$/.test(s.thread)||!short(s.directory,500)||!short(s.progress,4000)||!short(s.next,4000)||Object.keys(s).some(k=>!['id','title','thread','directory','progress','next'].includes(k)))) return false;
  if(r.secret!==null) {
    const s=r.secret;
    if(!s||Object.keys(s).sort().join(',')!=='ciphertext,iv,salt'||!short(s.salt,100)||!short(s.iv,100)||!short(s.ciphertext,12000)) return false;
    const b64=/^[A-Za-z0-9+/]+={0,2}$/;
    if(![s.salt,s.iv,s.ciphertext].every(v=>b64.test(v))||Buffer.from(s.salt,'base64').length!==16||Buffer.from(s.iv,'base64').length!==12||Buffer.from(s.ciphertext,'base64').length<16) return false;
  }
  // Secrets have one designated encrypted field. Avoid accidental plaintext in the script field.
  if(r.kind==='secret' && (r.content!==''||r.sessions.length>0)) return false;
  return true;
}
