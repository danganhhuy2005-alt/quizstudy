import {NextRequest,NextResponse} from 'next/server';
import {database,safeQuestions,toDeck} from '../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{
 const {data,error}=await database().from('quiz_decks').select('*').order('created_at',{ascending:false}).limit(300);
 if(error)throw Error(error.message);
 return NextResponse.json({decks:(data||[]).map(toDeck)});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:500});}}
export async function POST(req:NextRequest){try{
 const b=await req.json();const title=String(b.title||'').trim().slice(0,180);const subject=String(b.subject||'Khác').trim().slice(0,100)||'Khác';
 if(!title)throw Error('Thiếu tên bộ đề.');const questions=safeQuestions(b.questions);
 if(!questions.length)throw Error('Không có câu hỏi hợp lệ.');
 const {data,error}=await database().from('quiz_decks').insert({title,subject,questions}).select('*').single();
 if(error)throw Error(error.message);return NextResponse.json({deck:toDeck(data)});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
