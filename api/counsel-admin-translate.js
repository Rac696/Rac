import { get, put } from '@vercel/blob';
import { isAdmin } from '../lib/counsel-admin-auth.js';

function responseText(data){
  if(data?.output_text)return data.output_text;
  if(Array.isArray(data?.output)){
    for(const item of data.output){
      for(const part of (item.content||[])){
        if(typeof part?.text==='string')return part.text;
      }
    }
  }
  return '';
}
async function translate(record){
  if(record.languageCode==='ja'||record.languageName==='日本語'){
    return {status:'not_needed',contentJa:record.content||'',improveIdeaJa:record.improveIdea||'',selfActionJa:record.selfAction||''};
  }
  const apiKey=String(process.env.OPENAI_API_KEY||'').trim();
  if(!apiKey)throw new Error('OPENAI_API_KEY unavailable');
  const schema={
    type:'object',additionalProperties:false,
    properties:{
      content_ja:{type:'string'},
      improve_idea_ja:{type:'string'},
      self_action_ja:{type:'string'}
    },
    required:['content_ja','improve_idea_ja','self_action_ja']
  };
  const r=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'gpt-6-luna',
      input:[
        {role:'system',content:[{type:'input_text',text:'Translate the employee workplace consultation faithfully into natural Japanese. Do not summarize, judge, soften, strengthen, interpret, or add facts. Preserve names, dates, amounts, and uncertainty. Empty source fields must remain empty. Return only the required JSON fields.'}]},
        {role:'user',content:[{type:'input_text',text:JSON.stringify({
          source_language:record.languageName||record.languageCode||'unknown',
          consultation_content:record.content||'',
          improvement_idea:record.improveIdea||'',
          self_action:record.selfAction||''
        })}]}
      ],
      text:{format:{type:'json_schema',name:'hiragumi_consultation_translation',strict:true,schema}},
      max_output_tokens:4500
    })
  });
  const data=await r.json();
  if(!r.ok)throw new Error('translation failed '+r.status);
  const p=JSON.parse(responseText(data));
  return {
    status:'translated',
    contentJa:String(p.content_ja||''),
    improveIdeaJa:String(p.improve_idea_ja||''),
    selfActionJa:String(p.self_action_ja||'')
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!isAdmin(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  if(req.method!=='POST')return res.status(405).json({ok:false});
  const id=String(req.body?.consultationId||'');
  if(!/^HG-\d{8}-[A-F0-9]{8}$/.test(id))return res.status(400).json({ok:false});
  try{
    const pathname=`cases/${id}.json`;
    const r=await get(pathname,{access:'private',useCache:false});
    if(!r||r.statusCode!==200)return res.status(404).json({ok:false});
    const record=JSON.parse(await new Response(r.stream).text());
    if(record.contentJa||record.translationStatus==='not_needed'){
      return res.status(200).json({ok:true,record});
    }
    const t=await translate(record);
    record.translationStatus=t.status;
    record.contentJa=t.contentJa;
    record.improveIdeaJa=t.improveIdeaJa;
    record.selfActionJa=t.selfActionJa;
    record.translationCheckedAt=new Date().toISOString();
    record.updatedAt=new Date().toISOString();
    await put(pathname,JSON.stringify(record),{
      access:'private',addRandomSuffix:false,allowOverwrite:true,
      contentType:'application/json; charset=utf-8'
    });
    return res.status(200).json({ok:true,record});
  }catch(e){
    console.error('admin translate failed',e?.message||e);
    return res.status(500).json({ok:false,error:'translation_failed'});
  }
}