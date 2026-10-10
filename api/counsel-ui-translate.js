export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
  const languageName=String(req.body?.languageName||'').trim().slice(0,120);
  const languageCode=String(req.body?.languageCode||'other').trim().slice(0,16);
  if(!languageName)return res.status(400).json({error:'languageName required'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'translation unavailable'});

  const uiSource={
    title:'社内相談窓口',
    subtitle:'外部相談対応者が受付します。相談内容を音声または文字で入力してください。',
    modeLabel:'相談方法',
    anonymous:'匿名で相談する',
    named:'名前を伝えて相談する',
    nameLabel:'氏名',
    aff:'所属・現場など（任意）',
    subjectLabel:'誰についての相談ですか？',
    subjectUnknown:'わからない・その他',
    subjectCoworker:'同僚',
    subjectLeader:'職長・リーダー',
    subjectManager:'管理職',
    subjectOfficer:'役員',
    subjectVicePresident:'副社長',
    subjectPresident:'社長',
    subjectCompany:'会社・制度全体',
    shareAvoidLabel:'共有してほしくない相手（任意）',
    shareAvoidPlaceholder:'必要な場合：相手の氏名・役職など',
    content:'相談内容',
    placeholder:'ここに相談内容を入力してください。音声入力した内容もここに文字で表示されます。',
    improveLabel:'あなたはどうすればよくなると考えますか？（任意）',
    improvePlaceholder:'会社や周囲にどのような対応・変化があればよくなると思うか、あなたの考えを入力してください。',
    selfActionLabel:'あなたにできることは何ですか？（任意）',
    selfActionPlaceholder:'自分でできそうなこと、協力できること、今後やってみようと思うことがあれば入力してください。',
    voiceStart:'🎤 音声入力を開始',
    voiceStop:'■ 音声入力を停止',
    voiceIdle:'文字入力はいつでも使えます。',
    privacy:'本窓口は外部相談対応者が受付します。相談内容は、対応に必要な担当者に限って共有します。相談対象者本人へ自動的に共有することはありません。',
    consent:'入力した相談内容を外部相談対応者が受け付け、必要に応じて日本語へ自動翻訳し、上で選択した共有範囲に従って取り扱うことに同意します。',
    review:'内容を確認する',
    reviewTitle:'送信前の確認',
    reviewLead:'下記の内容で送信します。間違いがあれば修正してください。',
    edit:'修正する',
    send:'この内容で送信',
    done:'相談を受け付けました',
    doneText:'送信が完了しました。相談IDを控えてください。'
  };
  const shareSource={
    avoidNone:'指定しない',
    avoidSupervisor:'直属上司',
    avoidSubject:'相談対象者本人',
    avoidExecutive:'特定の役員',
    avoidOther:'その他',
    avoidPlaceholder:'必要な場合：相手の氏名・役職など',
    scopeLabel:'この相談内容を対応のためにどこまで共有してよいですか？',
    scopeAnon:'本人特定情報を伏せれば、必要な担当者への共有可',
    scopeSummary:'相談内容の要旨だけなら共有可',
    scopeConfirm:'誰かに共有する前に、まず自分に確認してほしい',
    scopeExternal:'まずは外部相談対応者だけに相談したい',
    scopeNote:'「まずは外部相談対応者だけ」を選んだ場合、この段階では会社側へ共有しません。会社への共有や対応が必要な場合は、原則としてあなたに確認してから進めます。共有を制限するほど、事実確認や具体的な改善対応が難しくなる場合があります。'
  };
  const policySource={
    categoryLabel:'相談の種類',
    catSafety:'安全・暴力・重大なハラスメント等',
    catLabor:'労働条件・勤務・賃金・会社ルール',
    catRelationship:'人間関係・指示のされ方',
    catImprovement:'現場・設備・教育・情報共有の改善',
    catProposal:'会社への提案・改善案',
    catPersonal:'個人的な希望・待遇に関する要望',
    catOther:'その他',
    title:'この窓口について',
    body:'この窓口は、相談や要望をすべてそのまま実現するための窓口ではありません。内容を確認し、必要に応じて「優先確認・対応」「事実確認・会社判断」「助言・調整」「組織改善として検討」「意見として記録」「対応対象外」のいずれかで取り扱います。相談内容によっては、ご希望どおりの対応ができない場合があります。',
    emergency:'生命・身体に差し迫った危険がある場合は、この窓口だけに頼らず、現場責任者や緊急の連絡先へ直接連絡してください。'
  };

  const uiKeys=Object.keys(uiSource);
  const shareKeys=Object.keys(shareSource);
  const policyKeys=Object.keys(policySource);
  const strProps=keys=>Object.fromEntries(keys.map(k=>[k,{type:'string'}]));
  const schema={
    type:'object',additionalProperties:false,
    properties:{
      ui:{type:'object',additionalProperties:false,properties:strProps(uiKeys),required:uiKeys},
      share:{type:'object',additionalProperties:false,properties:strProps(shareKeys),required:shareKeys},
      policy:{type:'object',additionalProperties:false,properties:strProps(policyKeys),required:policyKeys}
    },
    required:['ui','share','policy']
  };

  try{
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-6-luna',
        input:[
          {role:'system',content:[{type:'input_text',text:
            'Translate this employee workplace consultation interface into '+languageName+
            '. Use plain, natural language for workers. Preserve privacy, consent, sharing-scope, consultation-category, and handling-policy meaning exactly. Do not add promises, legal conclusions, company names, or new restrictions. Keep emojis and symbols where present. Return only the required JSON.'}]},
          {role:'user',content:[{type:'input_text',text:JSON.stringify({ui:uiSource,share:shareSource,policy:policySource,languageCode})}]}
        ],
        text:{format:{type:'json_schema',name:'hiragumi_dynamic_ui_translation',strict:true,schema}},
        max_output_tokens:5000
      })
    });
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({error:'translation failed'});
    let out=data.output_text||'';
    if(!out&&Array.isArray(data.output)){
      for(const item of data.output){
        for(const part of (item.content||[])){
          if(typeof part?.text==='string'){out=part.text;break}
        }
        if(out)break;
      }
    }
    return res.status(200).json(JSON.parse(out));
  }catch(e){
    console.error('dynamic UI translation failed',e?.message||e);
    return res.status(500).json({error:'translation failed'});
  }
}
