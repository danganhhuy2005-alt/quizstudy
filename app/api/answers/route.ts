import {NextRequest,NextResponse} from 'next/server';
import {extract,MAX_BYTES} from '../../../lib/extract';
import {parseAnswers} from '../../../lib/parse';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest){try{
 const fd=await req.formData();
 const files=fd.getAll('answers').filter((f):f is File=>f instanceof File&&f.size>0);
 let raw=String(fd.get('answerText')||'');
 if(!files.length&&!raw.trim())throw Error('Hãy chọn file đáp án hoặc dán văn bản đáp án.');
 if(files.reduce((n,f)=>n+f.size,0)>MAX_BYTES)throw Error('Tổng file vượt quá 4MB.');
 for(const file of files)raw+='\n'+await extract(file.name,Buffer.from(await file.arrayBuffer()));
 const answers=parseAnswers(raw);
 if(!answers.size)throw Error('Không đọc được đáp án từ file. Hãy kiểm tra file có chữ và định dạng như 1.A, 2.B,D hoặc 1 A. Nếu là ảnh/PDF scan, hãy chuyển thành văn bản.');
 return NextResponse.json({answers:Object.fromEntries(answers),count:answers.size,extractedChars:raw.length});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
