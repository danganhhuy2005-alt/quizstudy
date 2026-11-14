import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import type {Deck,Question,Choice} from './types';
import {CHOICES,answerOf} from './types';
const choices:readonly string[]=CHOICES;
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Chưa cấu hình Supabase. Xem README.md và .env.local.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function safeQuestions(input:unknown):Question[]{
 if(!Array.isArray(input)||input.length>2000)throw Error('Danh sách câu hỏi không hợp lệ (tối đa 2000 câu).');
 const seen=new Set<string>();
 return input.map<Question|null>((raw,i)=>{
  const q=raw as Partial<Question>;
  const options=q?.options as Record<string,string> | undefined;
  if(!q||typeof q.text!=='string'||!q.text.trim()||q.text.length>8000||!options||!choices.some(c=>typeof options[c]==='string'&&options[c].trim())||choices.some(c=>options[c]!==undefined&&(typeof options[c]!=='string'||options[c].length>4000))||(q.imageUrl!==undefined&&(typeof q.imageUrl!=='string'||!q.imageUrl.startsWith((process.env.NEXT_PUBLIC_SUPABASE_URL||'')+'/storage/v1/object/public/quiz-images/'))))throw Error(`Câu ${i+1} thiếu nội dung hoặc không có lựa chọn hợp lệ.`);
  const answers=answerOf(q as Question).filter(a=>options[a]?.trim());
  const normalized=q.text.trim().toLowerCase().replace(/\s+/g,' ')+choices.map(c=>(options[c]||'').trim().toLowerCase()).join('|');
  if(seen.has(normalized))return null;
  seen.add(normalized);
  return {id:typeof q.id==='string'&&q.id.length<100?q.id:randomUUID(),number:Number(q.number)||i+1,text:q.text.trim(),options:Object.fromEntries(CHOICES.map(c=>[c,(options[c]||'').trim()])) as Record<Choice,string>,answer:answers,multiple:Boolean(q.multiple)||answers.length>1,imageUrl:q.imageUrl};
 }).filter((x):x is Question=>x!==null);
}
export function toDeck(data:Record<string,unknown>):Deck{return {id:String(data.id),title:String(data.title),subject:String(data.subject),createdAt:String(data.created_at),questions:data.questions as Question[]};}
