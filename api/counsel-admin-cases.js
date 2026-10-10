import { list, get } from '@vercel/blob';
import { isAdmin } from '../lib/counsel-admin-auth.js';

async function readJson(pathname){
  const r=await get(pathname,{access:'private'});
  if(!r||r.statusCode!==200)return null;
  const text=await new Response(r.stream).text();
  return JSON.parse(text);
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!isAdmin(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  if(req.method!=='GET')return res.status(405).json({ok:false});
  try{
    const all=[];let cursor;
    do{
      const page=await list({prefix:'cases/',limit:100,cursor});
      all.push(...page.blobs);cursor=page.cursor||undefined;
    }while(cursor&&all.length<500);
    const recent=all.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt)).slice(0,200);
    const records=(await Promise.all(recent.map(b=>readJson(b.pathname)))).filter(Boolean);
    records.sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt)));
    return res.status(200).json({ok:true,cases:records});
  }catch(e){
    console.error('admin cases failed',e?.message||e);
    return res.status(500).json({ok:false,error:'Failed to load cases'});
  }
}
