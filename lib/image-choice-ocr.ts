/** Browser OCR for labels beside options. It does not infer correct answers. */
import type {Choice} from './types';

export type ChoiceOCRResult={count:number|null;found:Choice[];confidence:'high'|'low'|'none';warning?:string};
const LETTERS:Choice[]=['A','B','C','D','E','F','G','H'];

/** Require clearly marked consecutive options rather than interpreting stray letters in question text. */
export function identifyChoices(text:string):ChoiceOCRResult {
  const normalized=text.normalize('NFKC').replace(/\r/g,'\n');
  const matches:Choice[]=[];
  for (const line of normalized.split('\n')) {
    // Typical OCR: A. ..., B) ..., C: ..., or (D) ...
    const hit=line.match(/^\s*(?:\(?\s*([A-H])\s*\)|([A-H])\s*[.):：-])\s*(?:\S|$)/i);
    const letter=(hit?.[1]||hit?.[2])?.toUpperCase() as Choice|undefined;
    if(letter)matches.push(letter);
  }
  // Some screenshots place options in columns on the same OCR line.
  const inline=[...normalized.matchAll(/(?:^|\s)([A-H])[.):：]\s+(?=\S)/gm)].map(m=>m[1].toUpperCase() as Choice);
  const found=LETTERS.filter(c=>matches.includes(c)||inline.includes(c));
  if(!found.includes('A')||!found.includes('B')||found.length<2)
    return {count:null,found,confidence:'none',warning:'OCR không nhận rõ đầy đủ các nhãn lựa chọn. Hãy mở ảnh để xác nhận.'};
  const highest=LETTERS.indexOf(found[found.length-1])+1;
  const consecutive=LETTERS.slice(0,highest).every(c=>found.includes(c));
  if(!consecutive)
    return {count:null,found,confidence:'low',warning:`OCR chỉ nhận ${found.join(', ')}; chưa đủ chắc chắn để tự đặt số lựa chọn.`};
  return {count:highest,found,confidence:found.length>=4?'high':'low'};
}

/** Run recognition on-device. Trained-data and worker scripts may need a network connection first time. */
export async function recognizeWordChoices(
 images:{number:number;image:Blob}[],
 progress:(current:number,total:number)=>void
):Promise<Map<number,ChoiceOCRResult>> {
  const {createWorker}=await import('tesseract.js');
  const worker=await createWorker('eng');
  const result=new Map<number,ChoiceOCRResult>();
  try {
    for(let i=0;i<images.length;i++){
      progress(i+1,images.length);
      const it=images[i];
      const url=URL.createObjectURL(it.image);
      try {
        const recognized=await worker.recognize(url);
        result.set(it.number,identifyChoices(recognized.data.text));
      } catch (e) {
        result.set(it.number,{count:null,found:[],confidence:'none',warning:`OCR lỗi: ${e instanceof Error?e.message:'không đọc được ảnh'}`});
      } finally {URL.revokeObjectURL(url);}
    }
  } finally {await worker.terminate();}
  return result;
}
