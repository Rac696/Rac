import { get, put } from '@vercel/blob';
import { isAdmin } from '../lib/counsel-admin-auth.js';

const STATUSES=new Set(['未確認','確認済','対応中','対応済']);
const HANDLING_TYPES=new Set(['','priority_action','fact_check','advice_coordination','org_improvement','record_opinion','out_of_scope']);
const clean=(v,max=4000)=>String(v??'').trim().slice(0,max);

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!isAdmin(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method Not Allowed'});

  const id=clean(req.body?.consultationId,40);
  if(!/^HG-\d{8}-[A-F0-9]{8}$/.test(id))return res.status(400).json({ok:false,error:'Invalid consultation ID'});

  const hasStatus=Object.prototype.hasOwnProperty.call(req.body||{},'status');
  const hasHandling=['handlingType','handlingReason','handlingNote'].some(k=>Object.prototype.hasOwnProperty.call(req.body||{},k));
  if(!hasStatus&&!hasHandling)return res.status(400).json({ok:false,error:'No update fields'});

  const status=clean(req.body?.status,20);
  if(hasStatus&&!STATUSES.has(status))return res.status(400).json({ok:false,error:'Invalid status'});

  const handlingType=clean(req.body?.handlingType,40);
  const handlingReason=clean(req.body?.handlingReason,3000);
  const handlingNote=clean(req.body?.handlingNote,5000);
  if(hasHandling&&!HANDLING_TYPES.has(handlingType))return res.status(400).json({ok:false,error:'Invalid handling type'});
  if(hasHandling&&handlingType==='out_of_scope'&&!handlingReason)return res.status(400).json({ok:false,error:'対応対象外にする場合は理由が必要です。'});

  try{
    const pathname=`cases/${id}.json`;
    const r=await get(pathname,{access:'private',useCache:false});
    if(!r||r.statusCode!==200)return res.status(404).json({ok:false,error:'Not found'});
    const record=JSON.parse(await new Response(r.stream).text());
    const now=new Date().toISOString();

    if(hasStatus)record.status=status;
    if(hasHandling){
      record.handlingType=handlingType;
      record.handlingReason=handlingReason;
      record.handlingNote=handlingNote;
      const history=Array.isArray(record.handlingHistory)?record.handlingHistory:[];
      history.push({at:now,type:handlingType,reason:handlingReason,note:handlingNote});
      record.handlingHistory=history.slice(-50);
    }
    record.updatedAt=now;

    await put(pathname,JSON.stringify(record),{
      access:'private',
      addRandomSuffix:false,
      allowOverwrite:true,
      contentType:'application/json; charset=utf-8'
    });

    return res.status(200).json({ok:true,status:record.status,handlingHistory:record.handlingHistory||[]});
  }catch(e){
    console.error(e);
    return res.status(500).json({ok:false,error:'Update failed'});
  }
}
