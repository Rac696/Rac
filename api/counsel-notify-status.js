import { list, get } from '@vercel/blob';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false});
  try{
    const page=await list({prefix:'cases/',limit:50});
    const blobs=(page.blobs||[]).sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
    if(!blobs.length) return res.status(200).json({ok:true,found:false});
    const r=await get(blobs[0].pathname,{access:'private',useCache:false});
    if(!r||r.statusCode!==200) return res.status(500).json({ok:false,error:'read_failed'});
    const record=JSON.parse(await new Response(r.stream).text());
    const n=record.notification||{};
    return res.status(200).json({
      ok:true,
      found:true,
      receivedAt:record.receivedAt||null,
      notification:{
        sent:n.sent===true,
        reason:String(n.reason||''),
        status:Number(n.status||0),
        checkedAt:n.checkedAt||null
      }
    });
  }catch(e){
    console.error('notify status failed',e?.message||e);
    return res.status(500).json({ok:false,error:'status_failed'});
  }
}