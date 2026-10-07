export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

function s(v,max){return String(v||'').slice(0,max)}
function files(v,max){return Array.isArray(v)?v.slice(0,max):[]}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const companyName=s(req.body?.companyName,120);
    const position=s(req.body?.position,120);
    const jobDescription=s(req.body?.jobDescription,14000);
    const hiringCriteria=s(req.body?.hiringCriteria,8000);
    const candidateName=s(req.body?.candidateName,80);
    const candidateNotes=s(req.body?.candidateNotes,10000);
    const companyFiles=files(req.body?.companyFiles,2);
    const candidateFiles=files(req.body?.candidateFiles,3);
    if(!companyName||!position||!jobDescription||!candidateName)return res.status(400).json({error:'Required fields are missing'});

    const schema={type:'object',additionalProperties:false,properties:{
      company_context:{type:'string'},
      interview_focus:{type:'array',items:{type:'string'}},
      candidate_brief:{type:'string'},
      document_facts:{type:'array',items:{type:'string'}},
      inconsistencies_or_gaps:{type:'array',items:{type:'string'}},
      assessment_hypotheses_to_verify:{type:'array',items:{type:'string'}},
      must_confirm:{type:'array',items:{type:'string'}},
      tailored_questions:{type:'array',items:{type:'string'}},
      excluded_sensitive_info:{type:'array',items:{type:'string'}}
    },required:['company_context','interview_focus','candidate_brief','document_facts','inconsistencies_or_gaps','assessment_hypotheses_to_verify','must_confirm','tailored_questions','excluded_sensitive_info']};

    const system=`あなたは株式会社Rac solutionの採用面接設計アシスタントです。
固定の会社マスターは使用せず、今回渡された会社情報・求人票・採用基準を読み、この求人専用の面接設計をゼロから作ってください。

重要:
- まず求人情報から、職務で本当に確認すべき能力・経験・勤務条件・定着上の確認点を interview_focus に整理する。
- 応募者書類ですでに確定している事実は無駄に聞き直さない。
- 書類の矛盾、空白、不明点は責めずに事実確認質問へ変換する。
- 適性診断は仮説としてのみ扱い、診断スコアだけで性格や適性を断定しない。
- 採用・不採用、推薦、ランキング、点数は出さない。
- 年齢、性別、家族構成、妊娠、宗教、思想信条、病歴など職務上不要なセンシティブ情報を質問設計に使わない。
- 外見、顔写真、声質、アクセント、話し方を評価材料にしない。
- tailored_questions は8〜12問程度。1問ずつ自然に聞ける日本語にする。

会社名: ${companyName}
募集職種: ${position}
求人内容:
${jobDescription}
採用で重視すること:
${hiringCriteria||'特指定なし'}
応募者名: ${candidateName}`;

    const userContent=[{type:'input_text',text:'【会社・求人資料】'}];
    for(const f of companyFiles){
      const filename=s(f?.name,160),fileData=String(f?.data||'');
      if(filename&&fileData.startsWith('data:'))userContent.push({type:'input_file',filename,file_data:fileData});
    }
    userContent.push({type:'input_text',text:'【応募者資料】'});
    for(const f of candidateFiles){
      const filename=s(f?.name,160),fileData=String(f?.data||'');
      if(filename&&fileData.startsWith('data:'))userContent.push({type:'input_file',filename,file_data:fileData});
    }
    userContent.push({type:'input_text',text:`【応募者補足情報】
${candidateNotes||'未入力'}

上記すべてを求人要件と照合し、この応募者専用のAI一次面接設計を作成してください。`});

    const body={model:'gpt-5.6-sol',input:[
      {role:'system',content:[{type:'input_text',text:system}]},
      {role:'user',content:userContent}
    ],text:{format:{type:'json_schema',name:'interview_plan',strict:true,schema}},max_output_tokens:3000};

    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();
    if(!r.ok){
      const code=data?.error?.code||'OPENAI_API_ERROR';
      if(code==='credit_balance_exhausted') return res.status(402).json({code:'API_CREDIT_EXHAUSTED',message:'OpenAI API credit balance is exhausted.'});
      return res.status(r.status).json({code,message:data?.error?.message||'OpenAI API request failed'});
    }
    let output=data.output_text||'';
    if(!output&&Array.isArray(data.output)){for(const item of data.output){for(const c of(item.content||[])){if(c.text){output=c.text;break}}if(output)break}}
    const plan=JSON.parse(output);
    return res.status(200).json({companyName,position,filesRead:[...companyFiles,...candidateFiles].map(f=>String(f?.name||'')).filter(Boolean),plan});
  }catch(e){console.error(e);return res.status(500).json({error:'Failed to build interview plan'})}
}
