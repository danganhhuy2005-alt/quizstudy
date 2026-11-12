import {NextRequest,NextResponse} from 'next/server';
import {database,safeQuestions,toDeck} from '../../../../lib/server';
export const runtime='nodejs';
type Params={params:Promise<{id:string}>};
export async function PUT(req:NextRequest,{params}:Params){try{
 const {id}=await params;const b=await req.json();const title=String(b.title||'').trim().slice(0,180);const subject=String(b.subject||'Khác').trim().slice(0,100)||'Khác';
 if(!title)throw Error('Thiếu tiêu đề.');const questions=safeQuestions(b.questions);if(!questions.length)throw Error('Không có câu hỏi hợp lệ.');
 const {data,error}=await database().from('quiz_decks').update({title,subject,questions,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();
 if(error)throw Error(error.message);return NextResponse.json({deck:toDeck(data)});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export async function DELETE(req:NextRequest,{params}:Params){try{
 const {id}=await params;const {error}=await database().from('quiz_decks').delete().eq('id',id);
 if(error)throw Error(error.message);return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
