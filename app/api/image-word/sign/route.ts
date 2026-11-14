import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {database} from '../../../../lib/server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const body=await req.json() as {mime?:string;extension?:string};
  const mime=body.mime;const ext=body.extension?.toLowerCase();
  const allowed:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
  if(!ext||!mime||allowed[ext]!==mime)return NextResponse.json({error:'Ảnh không đúng định dạng.'},{status:400});
  const db=database();const path=`${randomUUID()}.${ext}`;
  const {data,error}=await db.storage.from('quiz-images').createSignedUploadUrl(path);
  if(error||!data)throw Error(error?.message||'Không tạo được đường dẫn tải ảnh.');
  const {data:publicInfo}=db.storage.from('quiz-images').getPublicUrl(path);
  const signedUrl=data.signedUrl.startsWith('http')?data.signedUrl:`${process.env.NEXT_PUBLIC_SUPABASE_URL}${data.signedUrl}`;
  return NextResponse.json({signedUrl,publicUrl:publicInfo.publicUrl});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
