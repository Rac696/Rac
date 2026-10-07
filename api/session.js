import crypto from 'node:crypto';

function arr(v,n=10,l=600){return Array.isArray(v)?v.slice(0,n).map(x=>String(x||'').slice(0,l)).filter(Boolean):[]}
function s(v,n){return String(v||'').slice(0,n)}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).send('Method Not Allowed');
  if(!process.env.OPENAI_API_KEY)return res.status(500).send('OPENAI_API_KEY is not configured');
  try{
    const payload=req.body&&typeof req.body==='object'?req.body:{};
    const sdp=String(payload.sdp||'');if(!sdp.trim())return res.status(400).send('SDP is required');
    const profile=payload.profile&&typeof payload.profile==='object'?payload.profile:{};
    const plan=payload.plan&&typeof payload.plan==='object'?payload.plan:{};
    const companyName=s(profile.companyName,120),position=s(profile.position,120),candidateName=s(profile.candidateName,80);
    const jobDescription=s(profile.jobDescription,8000),hiringCriteria=s(profile.hiringCriteria,5000);
    const focus=arr(plan.interview_focus,12,500),gaps=arr(plan.inconsistencies_or_gaps,8,600),hypotheses=arr(plan.assessment_hypotheses_to_verify,8,600),must=arr(plan.must_confirm,10,500),tailored=arr(plan.tailored_questions,12,800);
    const instructions=`あなたは株式会社Rac solutionが運用するAI一次面接官です。
今回の会社・求人は固定マスターではなく、以下の情報から構成されています。

会社名: ${companyName}
募集職種: ${position}
求人内容: ${jobDescription}
採用で重視すること: ${hiringCriteria||'特指定なし'}
応募者名: ${candidateName}

求人から抽出した確認軸:
${focus.map((x,i)=>`${i+1}. ${x}`).join('\n')||'求人内容から判断する'}

事前資料の差異・不足:
${gaps.map((x,i)=>`${i+1}. ${x}`).join('\n')||'特になし'}

適性診断からの確認仮説:
${hypotheses.map((x,i)=>`${i+1}. ${x}`).join('\n')||'特になし'}

必ず確認:
${must.map((x,i)=>`${i+1}. ${x}`).join('\n')||'求人確認軸に従う'}

応募者専用質問候補:
${tailored.map((x,i)=>`${i+1}. ${x}`).join('\n')||'求人と回答内容から組み立てる'}

会話ルール:
- 日本語で落ち着いた自然な面接口調。
- 一度に質問は1つだけ。
- 固定台本ではなく、直前の回答を理解して最も情報価値の高い次質問を選ぶ。
- すでに書類で確定している内容は無駄に聞き直さない。
- 曖昧・抽象的・書類と食い違う場合だけ自然に深掘りする。
- 8〜12問程度を目安にし、必要事項が揃えば終了する。
- AI自身は採用・不採用、点数、ランキング、推薦、適性断定をしない。
- 声質、アクセント、感情、外見から人物評価しない。
- 職務上不要なセンシティブ情報を尋ねない。
- 適性診断は仮説として扱い、本人の具体例で確認する。

開始時は会社名と職種を簡潔に伝え、最も重要な未確認事項から1問だけ質問する。
終了時は「以上でAI一次面接を終了します。ご回答ありがとうございました。担当者が内容を確認します。」と伝える。`;

    const keywords=[companyName,position,...focus].map(v=>String(v).replace(/[<>\r\n]/g,' ').slice(0,80)).filter(Boolean).slice(0,16);
    const session=JSON.stringify({type:'realtime',model:'gpt-realtime-2.1',output_modalities:['audio'],instructions,audio:{input:{transcription:{model:'gpt-live-transcribe',languages:['ja'],delay:'low',prompt:`採用面接。会社: ${companyName}。職種: ${position}。`,keywords},turn_detection:{type:'semantic_vad',eagerness:'low',create_response:true,interrupt_response:true}},output:{voice:'marin'}}});
    const fd=new FormData();fd.set('sdp',sdp);fd.set('session',session);
    const safetyId=crypto.createHash('sha256').update(`${companyName}:${position}:${candidateName||'anonymous'}`).digest('hex');
    const r=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'OpenAI-Safety-Identifier':safetyId},body:fd});
    const text=await r.text();if(!r.ok)return res.status(r.status).send(text);res.setHeader('Content-Type','application/sdp');return res.status(200).send(text);
  }catch(e){console.error(e);return res.status(500).send('Failed to create realtime session')}
}
