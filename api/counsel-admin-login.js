import { makeAdminCookie, pinMatches } from '../lib/counsel-admin-auth.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false});
  if(!pinMatches(req.body?.pin)){
    await new Promise(r=>setTimeout(r,650));
    return res.status(401).json({ok:false,error:'PINが違います'});
  }
  const secure=process.env.VERCEL_ENV==='production'?'; Secure':'';
  res.setHeader('Set-Cookie',`hg_admin=${encodeURIComponent(makeAdminCookie())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`);
  return res.status(200).json({ok:true});
}
