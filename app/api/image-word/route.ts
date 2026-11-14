import {NextRequest,NextResponse} from 'next/server';
import JSZip from 'jszip';
import {randomUUID} from 'node:crypto';
import {database} from '../../../lib/server';
import {extract} from '../../../lib/extract';
import {parseAnswers} from '../../../lib/parse';
import type {Choice,Question} from '../../../lib/types';
import {CHOICES} from '../../../lib/types';
export const runtime='nodejs';
export const maxDuration=60;
const decode=(s:string)=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const attr=(s:string,k:string)=>new RegExp(`${k}="([^"]+)"`).exec(s)?.[1];
export async function POST(req:NextRequest){try{
 const fd=await req.formData();const file=fd.get('docx');
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.docx'))throw Error('Bạn cần tải file .docx có ảnh.');
 if(file.size>4*1024*1024)throw Error('Word quá lớn (tối đa 4 MB trên Vercel).');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const docXml=await zip.file('word/document.xml')?.async('string');
 const relXml=await zip.file('word/_rels/document.xml.rels')?.async('string');
 if(!docXml||!relXml)throw Error('File Word không có cấu trúc DOCX hợp lệ.');
 const relations=new Map<string,string>();
 for(const r of relXml.match(/<Relationship\b[^>]*\/>/g)||[]){const id=attr(r,'Id');const target=attr(r,'Target');if(id&&target&&!target.startsWith('http'))relations.set(id,target.startsWith('/')?target.replace(/^\//,''):target.startsWith('word/')?target:'word/'+target.replace(/^\.\.\//,''));}
 const entries:{number:number;rid:string}[]=[];let number:number|null=null;
 for(const para of docXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[]){
  const texts=(para.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)||[]).map(s=>decode(s.replace(/^<w:t[^>]*>/,'').replace(/<\/w:t>$/,''))).join('');
  const m=texts.match(/^\s*(?:Câu|Question|Q)\s*(\d{1,4})\s*(?:[.):-]|$)/i);
  if(m)number=Number(m[1]);
  for(const b of para.match(/<a:blip\b[^>]*\/?\s*>/g)||[]){const id=attr(b,'r:embed');if(id&&number!==null){entries.push({number,rid:id});number=null;}}
 }
 if(!entries.length)throw Error('Không tìm thấy cặp "Câu 1" + ảnh trong Word. Hãy đặt nhãn Câu N trước mỗi ảnh.');
 if(entries.length>80)throw Error('Mỗi lượt tối đa 80 ảnh. Hãy chia Word thành nhiều bộ đề nhỏ.');
 const answerFile=fd.get('answers');let raw=String(fd.get('answerText')||'');
 if(answerFile instanceof File&&answerFile.size){if(answerFile.size>4*1024*1024)throw Error('File đáp án quá lớn.');raw+='\n'+await extract(answerFile.name,Buffer.from(await answerFile.arrayBuffer()));}
 const keys=parseAnswers(raw);const nums=new Set<number>();const questions:Question[]=[];
 const db=database();
 for(const entry of entries){
  if(nums.has(entry.number))throw Error(`Câu ${entry.number} có hơn một ảnh hoặc bị trùng số. Mỗi câu chỉ nên có 1 ảnh.`);nums.add(entry.number);
  const target=relations.get(entry.rid);if(!target)throw Error(`Không tìm thấy ảnh gắn với câu ${entry.number}.`);
  const image=zip.file(target);if(!image)throw Error(`Ảnh của câu ${entry.number} bị thiếu trong Word.`);
  const ext=target.split('.').pop()?.toLowerCase();const types:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
  if(!ext||!types[ext])throw Error(`Ảnh của câu ${entry.number} không hỗ trợ định dạng ${ext||'không xác định'}. Hãy dùng PNG/JPG/WEBP.`);
  const buf=Buffer.from(await image.async('uint8array'));if(buf.length>3*1024*1024)throw Error(`Ảnh câu ${entry.number} quá 3MB.`);
  const filename=`${randomUUID()}.${ext}`;
  const {error}=await db.storage.from('quiz-images').upload(filename,buf,{contentType:types[ext],upsert:false});
  if(error)throw Error(`Không upload được ảnh câu ${entry.number}: ${error.message}. Hãy chạy file supabase-images.sql trước.`);
  const {data}=db.storage.from('quiz-images').getPublicUrl(filename);
  const options=Object.fromEntries(CHOICES.map(c=>[c,CHOICES.indexOf(c)<4?c:''])) as Record<Choice,string>;
  const answer=(keys.get(entry.number)||[]).filter(c=>Boolean(options[c]));
  questions.push({id:randomUUID(),number:entry.number,text:`Câu ${entry.number}`,imageUrl:data.publicUrl,options,answer,multiple:answer.length>1});
 }
 const matched=questions.filter(q=>q.answer.length).length;
 return NextResponse.json({questions,matched,missing:questions.length-matched});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
