import type {Choice,Question} from './types';
import {CHOICES} from './types';
import {randomUUID} from 'node:crypto';
const clean=(s:string)=>s.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
const blank=():Record<Choice,string>=>Object.fromEntries(CHOICES.map(c=>[c,''])) as Record<Choice,string>;
/** Parses "1.A 2.C", "1.A,C", "2: B và D", "3. AC", "Câu 4: A và E". */
export function parseAnswers(raw:string):Map<number,Choice[]>{
 const out=new Map<number,Choice[]>();
 const normalized=raw.replace(/\r/g,'\n');
 const re=/(?:^|[\s;|])(?:câu|question|q)?\s*(\d{1,4})\s*[.):=\-]\s*/gim;
 const matches=[...normalized.matchAll(re)];
 for(let i=0;i<matches.length;i++){
  const m=matches[i];const tail=normalized.slice((m.index||0)+m[0].length,i+1<matches.length?matches[i+1].index:undefined);
  const first=tail.split(/\n|[;|]/)[0].trim();
  // Only read the opening answer tokens, never attempt to derive answers from explanations.
  const match=first.match(/^([A-H](?:\s*(?:,|\+|&|\/|\bvà\b|\band\b|\s)\s*[A-H])*)/i);
  if(!match)continue;
  const letters=[...new Set((match[1].toUpperCase().match(/[A-H]/g)||[]))] as Choice[];
  if(letters.length)out.set(Number(m[1]),letters);
 }
 return out;
}
/** Option labels must occur at start of line, avoiding e.g. "C. Mác" inside a question. */
export function parseExam(raw:string):Question[]{
 const lines=raw.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').split('\n').map(clean).filter(Boolean);
 const result:Question[]=[];
 type Pending={number:number;text:string;opts:Record<Choice,string>;current:Choice|null};
 let cur:Pending|null=null;
 const push=()=>{if(cur&&cur.text.trim()&&CHOICES.some(c=>cur!.opts[c].trim()))result.push({id:randomUUID(),number:cur.number,text:cur.text.trim(),options:cur.opts,answer:[],multiple:false});};
 for(const line of lines){
  const question=line.match(/^(?:(?:câu|question|q)\s+)?(\d{1,4})\s*[.):-]\s*(.*)$/i);
  if(question){push();cur={number:Number(question[1]),text:question[2]||'',opts:blank(),current:null};continue;}
  const option=line.match(/^([A-H])\s*[.):]\s+(.+)$/i);
  if(option&&cur){const c=option[1].toUpperCase() as Choice;if(!cur.opts[c]){cur.opts[c]=option[2];cur.current=c;continue;}}
  if(cur){if(cur.current)cur.opts[cur.current]+=' '+line;else cur.text+=(cur.text?' ':'')+line;}
 }
 push();
 const seen=new Set<string>();return result.filter(q=>{
  const signature=(q.text+'|'+CHOICES.map(c=>q.options[c]).join('|')).toLocaleLowerCase().replace(/\s+/g,' ').trim();
  if(seen.has(signature))return false;seen.add(signature);return true;
 });
}
export function combineQuestions(exam:string,answers:string):{questions:Question[];warning:string}{
 const questions=parseExam(exam), keys=parseAnswers(answers);
 for(const q of questions){const proposed=keys.get(q.number)||[];q.answer=proposed.filter(c=>!!q.options[c]?.trim());q.multiple=q.answer.length>1;}
 const missing=questions.filter(q=>!q.answer.length);
 const invalid=questions.filter(q=>(keys.get(q.number)||[]).some(c=>!q.options[c]?.trim()));
 const numbers=new Set<number>(),repeated:number[]=[];
 for(const q of questions){if(numbers.has(q.number))repeated.push(q.number);numbers.add(q.number);}
 const parts:string[]=[];
 if(!questions.length)parts.push('Không nhận diện được câu hỏi. Hãy kiểm tra nhãn Câu 1. / A. / B. ở đầu dòng.');
 if(missing.length)parts.push(`${missing.length} câu chưa ghép được đáp án, hãy kiểm tra trước khi lưu.`);
 if(invalid.length)parts.push(`Câu ${invalid.map(q=>q.number).join(', ')} có đáp án trỏ đến lựa chọn trống.`);
 if(repeated.length)parts.push(`Trùng số câu: ${[...new Set(repeated)].join(', ')}.`);
 if(keys.size&&!questions.some(q=>keys.has(q.number)))parts.push('Số câu trong file đáp án không khớp với đề.');
 return {questions,warning:parts.join(' ')||'Đã ghép câu hỏi và đáp án. Hãy kiểm tra trước khi lưu.'};
}
