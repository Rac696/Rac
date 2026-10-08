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

async function sendNotification(record){
  const apiKey=String(process.env.RESEND_API_KEY||'').trim();
  const rawTo=String(process.env.HIRAGUMI_NOTIFY_TO||'').trim();
  const emailMatch=rawTo.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const to=emailMatch?emailMatch[0]:'';
  if(!apiKey||!to)return {sent:false,reason:'not_configured',status:0};
  const adminUrl='https://hiragumi-ai-consultation.vercel.app/hiragumi/admin';
  const subject='【平組 社内相談窓口】新規相談 '+record.consultationId;
  const text=[
    '新しい相談が届きました。',
    '',
    '相談ID：'+record.consultationId,
    '受付日時：'+new Date(record.receivedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),
    '',
    '相談本文はメールには記載していません。',
    '管理画面で確認してください。',
    adminUrl
  ].join('\n');
  const r=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+apiKey,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      from:String(process.env.HIRAGUMI_NOTIFY_FROM||'onboarding@resend.dev').trim(),
      to:[to],
      subject,
      text
    })
  });
  if(!r.ok){
    const body=await r.text();
    console.error('notification failed',r.status,body.slice(0,500));
    return {sent:false,reason:'send_failed',status:r.status};
  }
  return {sent:true,status:r.status};
}

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
      improveIdea:clean(p.improveIdea,4000),
      selfAction:clean(p.selfAction,4000),
      updatedAt:receivedAt
    };

    await put(`cases/${consultationId}.json`,JSON.stringify(record),{
      access:'private',
      addRandomSuffix:false,
      contentType:'application/json; charset=utf-8'
    });

    // Notification is best-effort, but await it so the serverless function is not
    // terminated before Resend receives the request. A mail failure must never
    // invalidate an already-saved consultation.
    let notification={sent:false,reason:'unknown'};
    try{
      notification=await sendNotification(record);
      if(!notification.sent) console.error('notification not sent',notification.reason);
    }catch(e){
      console.error('notification exception',e?.message||e);
    }

    try{
      record.notification={
        sent:notification.sent===true,
        reason:String(notification.reason||''),
        status:Number(notification.status||0),
        checkedAt:new Date().toISOString()
      };
      await put(`cases/${consultationId}.json`,JSON.stringify(record),{
        access:'private',
        addRandomSuffix:false,
        allowOverwrite:true,
        contentType:'application/json; charset=utf-8'
      });
    }catch(e){
      console.error('notification status save failed',e?.message||e);
    }

    return res.status(200).json({ok:true,consultationId,notificationSent:notification.sent===true});
  }catch(e){
    console.error('consultation submit failed',e?.message||e);
    return res.status(500).json({ok:false,error:'Failed to save consultation'});
  }
}
