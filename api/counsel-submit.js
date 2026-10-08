import crypto from 'node:crypto';
import { put } from '@vercel/blob';

function clean(v, max) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
function makeConsultationId() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit'
  }).format(d).replaceAll('-','');
  return `HG-${parts}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
const SUBJECTS=new Set(['unknown','coworker','leader','manager','officer','vice_president','president','company']);

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method Not Allowed'});
  try{
    const p=(req.body&&typeof req.body==='object')?req.body:{};
    if(p.confirmed!==true) return res.status(400).json({ok:false,error:'Confirmation required'});
    const content=clean(p.content,12000);
    if(!content) return res.status(400).json({ok:false,error:'Content required'});

    const identityMode=p.identityMode==='named'?'named':'anonymous';
    const employeeName=identityMode==='named'?clean(p.employeeName,100):'';
    if(identityMode==='named'&&!employeeName) return res.status(400).json({ok:false,error:'Name required'});

    const subjectLevel=SUBJECTS.has(clean(p.subjectLevel,40))?clean(p.subjectLevel,40):'unknown';
    const consultationId=makeConsultationId();
    const receivedAt=new Date().toISOString();
    const record={
      consultationId,receivedAt,status:'未確認',
      identityMode,employeeName,
      affiliation:clean(p.affiliation,160),
      languageName:clean(p.languageName,120),
      languageCode:clean(p.languageCode,16),
      subjectLevel,
      shareAvoid:clean(p.shareAvoid,500),
      content,
      updatedAt:receivedAt
    };

    await put(`cases/${consultationId}.json`,JSON.stringify(record),{
      access:'private',
      addRandomSuffix:false,
      contentType:'application/json; charset=utf-8'
    });

    return res.status(200).json({ok:true,consultationId});
  }catch(e){
    console.error('consultation submit failed',e?.message||e);
    return res.status(500).json({ok:false,error:'Failed to save consultation'});
  }
}
