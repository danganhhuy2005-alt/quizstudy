import JSZip from 'jszip';
import mammoth from 'mammoth';
export const MAX_BYTES=4*1024*1024; // Vercel Functions request size limit ~4.5 MB
export async function extract(name:string,buf:Buffer,depth=0):Promise<string>{
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
