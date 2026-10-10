import crypto from 'node:crypto';

function b64url(v){return Buffer.from(v).toString('base64url')}
function sign(v){
  const secret=process.env.HIRAGUMI_ADMIN_COOKIE_SECRET||'';
  return crypto.createHmac('sha256',secret).update(v).digest('base64url');
}
export function makeAdminCookie(){
  const payload=JSON.stringify({role:'admin',exp:Date.now()+8*60*60*1000});
  const p=b64url(payload); return p+'.'+sign(p);
}
export function isAdmin(req){
  const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hg_admin='));
  if(!raw)return false;
  const token=decodeURIComponent(raw.slice('hg_admin='.length));
  const [p,s]=token.split('.'); if(!p||!s)return false;
  const expected=sign(p);
  const a=Buffer.from(s),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  try{const data=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));return data.role==='admin'&&Number(data.exp)>Date.now()}catch{return false}
}
export function pinMatches(pin){
  const expected=String(process.env.HIRAGUMI_ADMIN_PIN||'');
  const actual=String(pin||'');
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return !!expected&&a.length===b.length&&crypto.timingSafeEqual(a,b);
}
