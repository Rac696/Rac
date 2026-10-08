import { get, put } from '@vercel/blob';
import { isAdmin } from '../lib/counsel-admin-auth.js';
const ALLOWED=new Set(['未確認','確認済','対応中','対応済']);
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!isAdmin(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  if(req.method!=='POST')return res.status(405).json({ok:false});
  const id=String(req.body?.consultationId||'');
  const status=String(req.body?.status||'');
  if(!/^HG-\d{8}-[A-F0-9]{8}$/.test(id)||!ALLOWED.has(status))return res.status(400).json({ok:false});
  try{
    const pathname=`cases/${id}.json`;
    const r=await get(pathname,{access:'private',useCache:false});
    if(!r||r.statusCode!==200)return res.status(404).json({ok:false});
    const record=JSON.parse(await new Response(r.stream).text());
    record.status=status;record.updatedAt=new Date().toISOString();
    await put(pathname,JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json; charset=utf-8'});
    return res.status(200).json({ok:true});
  }catch(e){console.error(e);return res.status(500).json({ok:false})}
}
