import {NextRequest,NextResponse} from 'next/server';
import {extract,MAX_BYTES} from '../../../lib/extract';
import {combineQuestions} from '../../../lib/parse';
export const runtime='nodejs';
export const maxDuration=60;
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
