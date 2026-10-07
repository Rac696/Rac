export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const profile=req.body?.profile&&typeof req.body.profile==='object'?req.body.profile:{};
    const plan=req.body?.plan&&typeof req.body.plan==='object'?req.body.plan:{};
    const transcript=Array.isArray(req.body?.transcript)?req.body.transcript:[];
    const companyName=String(profile.companyName||'').slice(0,120),position=String(profile.position||'').slice(0,120),candidateName=String(profile.candidateName||'').slice(0,80);
    const compact=transcript.slice(-80).map(x=>`${x.role==='candidate'?'応募者':'AI面接官'}: ${String(x.text||'').slice(0,2200)}`).join('\n');
    const pre=JSON.stringify({company_context:plan.company_context||'',interview_focus:plan.interview_focus||[],candidate_brief:plan.candidate_brief||'',document_facts:plan.document_facts||[],inconsistencies_or_gaps:plan.inconsistencies_or_gaps||[],assessment_hypotheses_to_verify:plan.assessment_hypotheses_to_verify||[],must_confirm:plan.must_confirm||[]}).slice(0,16000);
    const schema={type:'object',additionalProperties:false,properties:{
      summary:{type:'string'},confirmed_facts:{type:'array',items:{type:'string'}},document_interview_differences:{type:'array',items:{type:'string'}},unresolved_points:{type:'array',items:{type:'string'}},follow_up_questions:{type:'array',items:{type:'string'}},conditions_mentioned:{type:'array',items:{type:'string'}},assessment_hypotheses_checked:{type:'array',items:{type:'string'}}
    },required:['summary','confirmed_facts','document_interview_differences','unresolved_points','follow_up_questions','conditions_mentioned','assessment_hypotheses_checked']};

    const body={model:'gpt-5.6-sol',input:[
      {role:'system',content:[{type:'input_text',text:`あなたはRac solutionの採用面接記録整理アシスタントです。
会社名: ${companyName}
職種: ${position}
応募者名: ${candidateName}
固定マスターではなく、求人情報から生成された面接計画とAI面接記録を照合してください。
採用・不採用、推薦、ランキング、点数、人物の優劣、適性断定は行いません。
事実と未確認事項を分け、書類と面接回答の差異は追加確認事項として記録してください。
適性診断は仮説としてのみ扱い、声質・話し方・外見等は評価しません。`}]},
      {role:'user',content:[{type:'input_text',text:`【面接計画】\n${pre}\n\n【面接記録】\n${compact}`}]}
    ],text:{format:{type:'json_schema',name:'interview_summary',strict:true,schema}},max_output_tokens:2400};

    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)return res.status(r.status).json({error:data});
    let output=data.output_text||'';if(!output&&Array.isArray(data.output)){for(const item of data.output){for(const c of(item.content||[])){if(c.text){output=c.text;break}}if(output)break}}
    return res.status(200).json(JSON.parse(output));
  }catch(e){console.error(e);return res.status(500).json({error:'Failed to analyze interview'})}
}
