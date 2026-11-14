import JSZip from 'jszip';
import type {Choice} from './types';

export type WordImageItem={number:number;image:Blob;mime:string;extension:string};
const decode=(s:string)=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const getAttr=(tag:string,key:string)=>new RegExp(`${key}="([^"]+)"`).exec(tag)?.[1];
const content=(xml:string)=>[...(xml.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)||[])].map(x=>decode(x.replace(/^<w:t[^>]*>/,'').replace(/<\/w:t>$/,''))).join('');
const paragraphs=(xml:string)=>xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[];
export async function readImageWord(file:File):Promise<WordImageItem[]>{
 if(!/\.docx$/i.test(file.name))throw Error('Hãy chọn file .docx');
 if(file.size>60*1024*1024)throw Error('Word vượt 60 MB; hãy nén ảnh hoặc chia tài liệu.');
 const zip=await JSZip.loadAsync(file);
 const xml=await zip.file('word/document.xml')?.async('string');
 const rel=await zip.file('word/_rels/document.xml.rels')?.async('string');
 if(!xml||!rel)throw Error('File DOCX bị thiếu cấu trúc cần thiết.');
 const links=new Map<string,string>();
 for(const tag of rel.match(/<Relationship\b[^>]*\/?>/g)||[]){
  const id=getAttr(tag,'Id');const target=getAttr(tag,'Target');
  if(id&&target&&!/^https?:/i.test(target)){
   let path=target.startsWith('/')?target.slice(1):target.startsWith('word/')?target:'word/'+target;
   path=path.replace(/^word\/\.\//,'word/');
   links.set(id,path);
  }
 }
 const entries:{number:number;rid:string}[]=[];let current:number|null=null;
 for(const para of paragraphs(xml)){
  const text=content(para).trim();
  const heading=text.match(/^(?:Câu|Question|Q)\s*(\d{1,4})(?:\s*[.):\-]|\s*$)/i);
  if(heading)current=Number(heading[1]);
  for(const img of para.match(/<a:blip\b[^>]*\/?>/g)||[]){
   const rid=getAttr(img,'r:embed');if(rid&&current!==null){entries.push({number:current,rid});current=null;}
  }
 }
 if(!entries.length)throw Error('Không tìm thấy nhãn Câu 1, Câu 2... trước mỗi ảnh.');
 if(entries.length>500)throw Error('Tối đa 500 câu ảnh mỗi lần tải.');
 const seen=new Set<number>();const result:WordImageItem[]=[];
 for(const entry of entries){
  if(seen.has(entry.number))throw Error(`Trùng số Câu ${entry.number}.`);seen.add(entry.number);
  const path=links.get(entry.rid);const fileEntry=path?zip.file(path):null;
  if(!fileEntry)throw Error(`Không tìm được ảnh Câu ${entry.number} trong Word.`);
  const ext=(path?.split('.').pop()||'').toLowerCase();
  const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'} as Record<string,string>)[ext];
  if(!mime)throw Error(`Câu ${entry.number} có ảnh ${ext} chưa hỗ trợ. Hãy dùng PNG/JPG/WEBP.`);
  const bytes=await fileEntry.async('uint8array');
  if(bytes.length>3*1024*1024)throw Error(`Ảnh Câu ${entry.number} vượt 3 MB. Hãy nén riêng ảnh đó trong Word.`);
  result.push({number:entry.number,image:new Blob([new Uint8Array(bytes)],{type:mime}),mime,extension:ext});
 }
 return result;
}

export async function parseAnswerFile(file:File):Promise<string>{
 if(file.size>4*1024*1024)throw Error('File đáp án quá 4 MB.');
 if(/\.docx$/i.test(file.name)){
  const zip=await JSZip.loadAsync(file);const xml=await zip.file('word/document.xml')?.async('string');
  if(!xml)throw Error('Word đáp án không hợp lệ.');
  // Include table rows; cells separated for number + answer in adjacent columns.
  return paragraphs(xml).map(p=>content(p).trim()).filter(Boolean).join('\n');
 }
 return file.text();
}
export function readAnswerKeys(text:string):Map<number,Choice[]>{
 const map=new Map<number,Choice[]>();const s=text.replace(/\r/g,'\n').replace(/\u00a0/g,' ');
 // Supports '1.A', '1 A', 'Câu 1: B,D', '2. ABC'.
 const reg=/(?:^|[\s;|])(?:Câu\s*)?(\d{1,4})\s*[.):\-]?\s*(?:đáp\s*án\s*[:\-]?\s*)?([A-H](?:\s*(?:,|;|\+|&|\/|và|and)\s*[A-H])*|[A-H]{1,8})(?=$|[\s;|,.)])/gim;
 let m:RegExpExecArray|null;
 while((m=reg.exec(s))){const a=[...new Set((m[2].toUpperCase().match(/[A-H]/g)||[]))] as Choice[];if(a.length)map.set(Number(m[1]),a);}
 return map;
}
