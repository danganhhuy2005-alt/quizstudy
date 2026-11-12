import {NextRequest,NextResponse} from 'next/server';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import {combineQuestions} from '../../../lib/parse';
export const runtime='nodejs';
export const maxDuration=60;
const MAX_BYTES=4*1024*1024; // Vercel Functions request size limit ~4.5 MB
async function extract(name:string,buf:Buffer,depth=0):Promise<string>{
 if(buf.length>MAX_BYTES)throw Error('File quá lớn (giới hạn 4MB mỗi lượt).');
 const e=name.toLowerCase().split('.').pop();
 if(e==='docx'){const r=await mammoth.extractRawText({buffer:buf});return r.value;}
 if(['txt','md','csv'].includes(e||''))return buf.toString('utf8');
 if(e==='pdf'){
  // pdf-parse 1.x extracts text PDFs; image-only scanned PDFs require external OCR.
  const pdf=(await import('pdf-parse')).default;
  const r=await pdf(buf);return r.text;
 }
 if(e==='zip'){
  if(depth)throw Error('ZIP lồng nhau chưa được hỗ trợ.');
  const zip=await JSZip.loadAsync(buf);const arr=Object.values(zip.files).filter(x=>!x.dir&&!x.name.startsWith('__MACOSX/'));
  if(arr.length>35)throw Error('ZIP vượt quá 35 file. Hãy chia nhỏ.');
  let out='';for(const file of arr){const b=await file.async('nodebuffer');if(b.length>MAX_BYTES)throw Error('Một file trong ZIP vượt quá 4MB.');out+='\n'+await extract(file.name,b,depth+1);}return out;
 }
 if(['png','jpg','jpeg','webp','gif'].includes(e||''))throw Error('File ảnh không thể tự đọc khi không dùng AI/OCR. Hãy chuyển ảnh thành Word/TXT có thể chọn chữ rồi upload.');
 throw Error('Chỉ hỗ trợ PDF có chữ, DOCX, TXT, CSV hoặc ZIP chứa các định dạng này.');
}
export async function POST(req:NextRequest){try{
 const f=await req.formData();const exams=f.getAll('exams').filter((x):x is File=>x instanceof File&&x.size>0);const keys=f.getAll('answers').filter((x):x is File=>x instanceof File&&x.size>0);
 if(!(exams.length||String(f.get('examText')||'').trim())||!(keys.length||String(f.get('answerText')||'').trim()))throw Error('Cần nhập cả đề và đáp án.');
 if([...exams,...keys].reduce((n,x)=>n+x.size,0)>MAX_BYTES)throw Error('Tổng file mỗi lần nhập không quá 4MB. Hãy chia file nhỏ hơn.');
 let exam=String(f.get('examText')||''),answer=String(f.get('answerText')||'');
 for(const f of exams)exam+='\n'+await extract(f.name,Buffer.from(await f.arrayBuffer()));
 for(const f of keys)answer+='\n'+await extract(f.name,Buffer.from(await f.arrayBuffer()));
 const result=combineQuestions(exam,answer);
 return NextResponse.json({...result,extracted:{examChars:exam.length,answerChars:answer.length}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
