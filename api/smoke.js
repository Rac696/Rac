export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'Method Not Allowed'});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({ok:false,stage:'env',error:'OPENAI_API_KEY missing'});
  try{
    const schema={
      type:'object',
      additionalProperties:false,
      properties:{ok:{type:'boolean'},message:{type:'string'}},
      required:['ok','message']
    };
    const body={
      model:'gpt-5.6-sol',
      input:[{role:'user',content:[{type:'input_text',text:'Return ok=true and message="smoke test passed".'}]}],
      text:{format:{type:'json_schema',name:'smoke_test',strict:true,schema}},
      max_output_tokens:200
    };
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await r.json();
    if(!r.ok){
      return res.status(200).json({
        ok:false,
        stage:'openai_responses',
        status:r.status,
        errorType:data?.error?.type||null,
        errorCode:data?.error?.code||null,
        message:data?.error?.message||'OpenAI request failed'
      });
    }
    return res.status(200).json({ok:true,stage:'openai_responses',model:data.model||'gpt-5.6-sol'});
  }catch(e){
    return res.status(200).json({ok:false,stage:'exception',message:String(e?.message||e)});
  }
}
