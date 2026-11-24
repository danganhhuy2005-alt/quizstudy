'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {BookOpen,Cloud,FilePlus2,Trash2,Pencil,ArrowLeft,CheckCircle2,RotateCcw,Upload,Copy,Shuffle,Save,Search,Download,Sun,Moon,History,ShieldCheck,FileUp} from 'lucide-react';
import ZoomableImage from './ZoomableImage';
import type {Choice,Deck,Question} from '../lib/types';
import {readImageWord,parseAnswerFile,readAnswerKeys} from '../lib/word-image-client';
import {recognizeWordChoices} from '../lib/image-choice-ocr';
import {CHOICES,answerOf,equalsAnswer} from '../lib/types';
const C:Choice[]=[...CHOICES];

const isBase64Image=(value:string)=>/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value);
const isImageOption=(value:string)=>isBase64Image(value)||/^https:\/\/[^\s]+\/storage\/v1\/object\/public\/quiz-images\/[^\s]+$/i.test(value);
/** V20: upload image bytes directly to Supabase Storage; never send Base64 inside a Vercel Function request. */
async function uploadQuizImage(dataUri:string):Promise<string>{
 const match=dataUri.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
 if(!match)throw Error('Ảnh Base64 không đúng định dạng PNG/JPEG/WEBP/GIF.');
 const mime=match[1].toLowerCase();const extension=mime==='image/jpeg'?'jpg':mime.split('/')[1];
 const binary=atob(match[2]);const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const sign=await request('/api/image-word/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime,extension})}) as {signedUrl:string;publicUrl:string};
 const response=await fetch(sign.signedUrl,{method:'PUT',headers:{'Content-Type':mime,'x-upsert':'false'},body:new Blob([bytes],{type:mime})});
 if(!response.ok)throw Error(`Supabase từ chối ảnh (HTTP ${response.status}): ${(await response.text()).slice(0,180)}`);
 return sign.publicUrl;
}
async function uploadEmbeddedPictures(questions:Question[],onProgress:(value:string)=>void):Promise<Question[]>{
 const unique=new Map<string,string>();let done=0;
 const total=questions.reduce((n,q)=>n+C.filter(c=>isBase64Image(q.options[c]||'')).length+(q.imageUrl&&isBase64Image(q.imageUrl)?1:0),0);
 if(total===0)return questions;
 const upload=async(v:string)=>{
  if(!isBase64Image(v))return v;
  let url=unique.get(v);
  if(!url){url=await uploadQuizImage(v);unique.set(v,url);}
  done++;onProgress(`Đang chuyển ảnh lên Supabase Storage: ${done}/${total}`);
  return url;
 };
 const normalized:Question[]=[];
 for(const q of questions){
  const options={...q.options};
  for(const c of C){if(isBase64Image(options[c]||''))options[c]=await upload(options[c]);}
  const imageUrl=q.imageUrl&&isBase64Image(q.imageUrl)?await upload(q.imageUrl):q.imageUrl;
  normalized.push({...q,options,...(imageUrl?{imageUrl}:{})});
 }
 return normalized;
}
function OptionContent({value,label}:{value:string;label:string}){
 return isImageOption(value)?<img className="choice-picture" src={value} alt={`Ảnh lựa chọn ${label}`} loading="lazy"/>:<span>{value}</span>;
}

type Screen='home'|'deck'|'import'|'edit'|'quiz'|'result'|'history'|'history-review'|'export';
type QuizItem={q:Question;choices:Choice[]};
type SavedProgress={deckId:string;questionIds:string[];choiceOrders:Record<string,Choice[]>;picked:Record<string,Choice[]>;checked:Record<string,boolean>;index:number;wrongOnly:boolean;updatedAt:number;sessionId?:string};
type HistoryRecord=SavedProgress & {id:string;startedAt:number;finished:boolean};
const historyKey=(id:string)=>`quizstudy-history-v12:${id}`;
const rangeProgressKey=(id:string)=>`quizstudy-range-progress-v13:${id}`;
const BACKUP_PREFIXES=['quizstudy-history-v12:','quizstudy-progress-v5:','quizstudy-range-progress-v13:','quizstudy-studied-v9:','quizstudy-theme'];
const storageKey=(id:string)=>`quizstudy-progress-v5:${id}`;
const studiedKey=(id:string)=>`quizstudy-studied-v9:${id}`;
function readStudied(id:string):string[]{
 try{const value=JSON.parse(localStorage.getItem(studiedKey(id))||'[]');return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}
}

function readProgress(id:string,key=storageKey(id)):SavedProgress|null{
 try {const raw=localStorage.getItem(key);if(!raw)return null;const data=JSON.parse(raw) as SavedProgress;
  return data.deckId===id&&Array.isArray(data.questionIds)&&data.questionIds.length>0?data:null;
 }catch{return null;}
}

function readHistory(id:string):HistoryRecord[]{
 try{const value=JSON.parse(localStorage.getItem(historyKey(id))||'[]');return Array.isArray(value)?value.filter((v):v is HistoryRecord=>Boolean(v&&typeof v.id==='string'&&Array.isArray(v.questionIds)&&v.deckId===id)):[];}catch{return [];}
}
function saveHistory(id:string,record:HistoryRecord){
 try{
  const existing=readHistory(id).filter(r=>r.id!==record.id);
  const history=[record,...existing].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,80);
  localStorage.setItem(historyKey(id),JSON.stringify(history));
 }catch{/* storage full or blocked */}
}
function downloadJson(name:string,data:unknown){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function shuffle<T>(arr:T[]):T[]{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
async function request(url:string,options?:RequestInit){
 const r=await fetch(url,{cache:'no-store',...options});
 const raw=await r.text();
 let data:Record<string,any>={};
 try{data=JSON.parse(raw);}catch{
  if(r.status===413||/request entity too large|payload too large/i.test(raw)){
   throw Error('File hoặc dữ liệu gửi lên quá lớn (HTTP 413). Hãy chia file Word thành các phần nhỏ hơn 4 MB hoặc giảm kích thước ảnh trong Word.');
  }
  throw Error(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${r.status}). Kiểm tra Vercel → Logs. ${raw.slice(0,120).replace(/<[^>]*>/g,' ').trim()}`);
 }
 if(!r.ok)throw Error(typeof data.error==='string'?data.error:`Yêu cầu thất bại (HTTP ${r.status}).`);
 return data;
}
function noAnswer(q:Question){return answerOf(q).length===0;}
function available(q:Question):Choice[]{return C.filter(c=>Boolean(q.options[c]?.trim()));}
export default function Page(){
 const pathname=usePathname();
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 const themeInitialized=useRef(false);
 useEffect(()=>{try{const saved=localStorage.getItem('quizstudy-theme');const preferred=window.matchMedia('(prefers-color-scheme: dark)').matches;setTheme(saved==='light'||saved==='dark'?saved:(preferred?'dark':'light'));}catch{/* storage unavailable */}},[]);
 useEffect(()=>{if(!themeInitialized.current){themeInitialized.current=true;return;}document.documentElement.dataset.theme=theme;try{localStorage.setItem('quizstudy-theme',theme);}catch{/* storage unavailable */}},[theme]);
 const [decks,setDecks]=useState<Deck[]>([]);const [screen,setScreen]=useState<Screen>('home');
 const handledRoute=useRef('');
 const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [deck,setDeck]=useState<Deck|null>(null);const [draft,setDraft]=useState<Question[]>([]);
 const [title,setTitle]=useState('');const [subject,setSubject]=useState('');const [editing,setEditing]=useState(false);
 const [uploadProgress,setUploadProgress]=useState('');const [ocrWarnings,setOcrWarnings]=useState<Record<number,string>>({});
 const [imageDoc,setImageDoc]=useState<File|null>(null);const [imageKeys,setImageKeys]=useState<File|null>(null);const [imageKeyText,setImageKeyText]=useState('');
 const [examFiles,setExamFiles]=useState<File[]>([]);const [keyFiles,setKeyFiles]=useState<File[]>([]);
 const [examText,setExamText]=useState('');const [keyText,setKeyText]=useState('');
 const [replaceKeyFiles,setReplaceKeyFiles]=useState<File[]>([]);const [replaceKeyText,setReplaceKeyText]=useState('');const [savedProgress,setSavedProgress]=useState<Record<string,number>>({});
 const [studyMode,setStudyMode]=useState<'full'|'batch'>('full');const [rangeFrom,setRangeFrom]=useState('251');const [rangeTo,setRangeTo]=useState('300');const [rangeProgressCounts,setRangeProgressCounts]=useState<Record<string,number>>({});const [batchSize,setBatchSize]=useState(50);const [allowRepeat,setAllowRepeat]=useState(false);const [studiedCounts,setStudiedCounts]=useState<Record<string,number>>({});
 const [query,setQuery]=useState('');const [mixQuestions,setMixQuestions]=useState(false);const [mixAnswers,setMixAnswers]=useState(false);
 const activeProgressKind=useRef<'normal'|'range'>('normal');const [historyDeck,setHistoryDeck]=useState<Deck|null>(null);const [historyRecords,setHistoryRecords]=useState<HistoryRecord[]>([]);const [reviewRecord,setReviewRecord]=useState<HistoryRecord|null>(null);const [historyFilter,setHistoryFilter]=useState<'all'|'wrong'|'right'>('all');const activeSessionId=useRef('');const startedAtRef=useRef(0);const restoringRef=useRef(false);
 const [items,setItems]=useState<QuizItem[]>([]);const [picked,setPicked]=useState<Record<string,Choice[]>>({});const [checked,setChecked]=useState<Record<string,boolean>>({});const [index,setIndex]=useState(0);const [wrongOnly,setWrongOnly]=useState(false);
 const load=async()=>{try{const d=await request('/api/quizzes');setDecks(d.decks);}catch(e){setError((e as Error).message);}};
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!decks.length)return;const resume:Record<string,number>={};for(const d of decks){const saved=readProgress(d.id);if(saved)resume[d.id]=saved.questionIds.length;}setSavedProgress(resume);setRangeProgressCounts(Object.fromEntries(decks.map(d=>[d.id,readProgress(d.id,rangeProgressKey(d.id))?.questionIds.length||0])));
  // Migrate the one active V11 progress snapshot into V12 history without changing legacy keys.
  for(const d of decks){const old=readProgress(d.id);if(old){const id=old.sessionId||`legacy-${d.id}`;if(!readHistory(d.id).some(r=>r.id===id))saveHistory(d.id,{...old,id,startedAt:old.updatedAt,finished:false});}}
  setStudiedCounts(Object.fromEntries(decks.map(d=>[d.id,new Set(readStudied(d.id).filter(id=>d.questions.some(q=>q.id===id))).size])));},[decks]);
 useEffect(()=>{
  if((screen!=='quiz'&&screen!=='result')||!deck||!items.length)return;
  if(restoringRef.current){restoringRef.current=false;return;}
  const id=activeSessionId.current||`legacy-${deck.id}`;
  const progress:SavedProgress={deckId:deck.id,questionIds:items.map(it=>it.q.id),choiceOrders:Object.fromEntries(items.map(it=>[it.q.id,it.choices])) as Record<string,Choice[]>,picked,checked,index,wrongOnly,updatedAt:Date.now(),sessionId:id};
  try{const isRange=activeProgressKind.current==='range';localStorage.setItem(isRange?rangeProgressKey(deck.id):storageKey(deck.id),JSON.stringify(progress));saveHistory(deck.id,{...progress,id,startedAt:startedAtRef.current||Date.now(),finished:screen==='result'});if(isRange)setRangeProgressCounts(x=>({...x,[deck.id]:items.length}));else setSavedProgress(x=>({...x,[deck.id]:items.length}));}catch{/* browser storage blocked */}
 },[screen,deck,items,picked,checked,index,wrongOnly]);

 const setUrl=(url:string)=>{handledRoute.current=url.split('?')[0];window.history.pushState(null,'',url);};
 const deckUrl=(id:string,action='')=>`/quiz/${encodeURIComponent(id)}${action?'/'+action:''}`;
 const close=()=>{setScreen('home');setError('');setNotice('');setDeck(null);setUrl('/');void load();};
 const openDeck=(d:Deck)=>{setDeck(d);setScreen('deck');setError('');setNotice('');setUrl(deckUrl(d.id));};
 const backToDeck=()=>{setError('');setNotice('');if(deck)openDeck(deck);else close();};
 const edit=(d:Deck)=>{setDeck(d);setDraft(structuredClone(d.questions).map(q=>({...q,options:Object.fromEntries(C.map(c=>[c,q.options[c]||''])) as Record<Choice,string>,answer:answerOf(q),multiple:Boolean(q.multiple)||answerOf(q).length>1})));setTitle(d.title);setSubject(d.subject);setEditing(true);setError('');setScreen('edit');};
 const start=(d:Deck,onlyWrong=false,settings?:{mode?:'full'|'batch';size?:number;repeat?:boolean;shuffleQuestions?:boolean;shuffleAnswers?:boolean}):boolean=>{
  const chosenMode=settings?.mode??studyMode, chosenSize=settings?.size??batchSize, chosenRepeat=settings?.repeat??allowRepeat, chosenMixQuestions=settings?.shuffleQuestions??mixQuestions, chosenMixAnswers=settings?.shuffleAnswers??mixAnswers;
  const errorIds=onlyWrong?d.questions.filter(q=>answerOf(q).length&&!equalsAnswer(picked[q.id]||[],answerOf(q))).map(q=>q.id):null;
  let qs=d.questions.filter(q=>errorIds===null||errorIds.includes(q.id));
  if(!qs.length){setNotice('Không có câu sai để luyện lại.');return false;}
  if(!onlyWrong&&chosenMode==='batch'){
   if(!chosenRepeat){
    const seen=new Set(readStudied(d.id));
    qs=qs.filter(q=>!seen.has(q.id));
    if(!qs.length){setNotice('Bạn đã lấy hết câu của bộ đề ở chế độ Không trùng. Nhấn “Xóa lịch sử lượt” để học lại từ đầu, hoặc chọn Cho phép trùng.');return false;}
   }
   qs=shuffle(qs).slice(0,chosenSize);
  } else if(chosenMixQuestions)qs=shuffle(qs);
  if(!onlyWrong&&chosenMode==='batch'&&!chosenRepeat){
   try{const ids=[...new Set([...readStudied(d.id),...qs.map(q=>q.id)])];localStorage.setItem(studiedKey(d.id),JSON.stringify(ids));setStudiedCounts(x=>({...x,[d.id]:ids.length}));}catch{/* localStorage bị chặn */}
  }
  activeProgressKind.current='normal';activeSessionId.current=crypto.randomUUID();startedAtRef.current=Date.now();
  const prepared=qs.map(q=>({q,choices:chosenMixAnswers&&!q.imageUrl?shuffle(available(q)):available(q)}));
  const snapshot:SavedProgress={deckId:d.id,questionIds:prepared.map(it=>it.q.id),choiceOrders:Object.fromEntries(prepared.map(it=>[it.q.id,it.choices])) as Record<string,Choice[]>,picked:{},checked:{},index:0,wrongOnly:onlyWrong,updatedAt:Date.now(),sessionId:activeSessionId.current};
  // Save BEFORE changing routes, so a Next.js remount cannot lose the newly started session.
  try{localStorage.setItem(storageKey(d.id),JSON.stringify(snapshot));saveHistory(d.id,{...snapshot,id:activeSessionId.current,startedAt:startedAtRef.current,finished:false});}catch{}
  setItems(prepared);
  setPicked({});setChecked({});setIndex(0);setDeck(d);setWrongOnly(onlyWrong);setScreen('quiz');
  setNotice(!onlyWrong&&chosenMode==='batch'?`Lượt ôn mới: ${qs.length} câu · ${chosenRepeat?'Cho phép trùng':'Không trùng với các lượt đã lấy'}.`:'');setError('');return true;
 };
 const startRange=(d:Deck,range?:{from:number;to:number}):boolean=>{
  const from=range?.from??Number(rangeFrom),to=range?.to??Number(rangeTo);
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<1||to<from){setError('Hãy nhập vị trí hợp lệ trong danh sách Không trùng, ví dụ từ 251 đến 300 (lượt thứ 6).');return false;}
  // Historical V9/V11 non-repeat log is an append-only array of selected question IDs.
  // Its positions represent the order in which unique questions were allocated to batches,
  // NOT their original numbers in the imported source deck.
  const takenIds=readStudied(d.id);
  if(!takenIds.length){setError('Chưa tìm thấy danh sách các câu đã lấy ở chế độ Không trùng trên trình duyệt này.');return false;}
  if(from>takenIds.length){setError(`Danh sách Không trùng mới có ${takenIds.length} câu đã lấy, không có vị trí ${from}.`);return false;}
  const selectedIds=takenIds.slice(from,Math.min(to,takenIds.length));
  const byId=new Map(d.questions.map(q=>[q.id,q]));
  const qs=selectedIds.map(id=>byId.get(id)).filter((q):q is Question=>Boolean(q));
  if(!qs.length){setError('Không còn tìm thấy các câu ở vị trí này trong bộ đề. Có thể bộ đề đã được thay đổi hoặc thay thế.');return false;}
  const previous=readProgress(d.id,rangeProgressKey(d.id));
  if(previous&&!confirm('Bắt đầu ôn lại nhóm Không trùng khác sẽ thay thế tiến trình ôn lại trước của bộ đề này. Bài đang làm dở ở chế độ thường vẫn được giữ. Tiếp tục?'))return false;
  // Deliberately do not write to quizstudy-studied-v9 or the regular quizstudy-progress-v5.
  activeProgressKind.current='range';activeSessionId.current=crypto.randomUUID();startedAtRef.current=Date.now();
  const prepared=qs.map(q=>({q,choices:mixAnswers&&!q.imageUrl?shuffle(available(q)):available(q)}));
  const snapshot:SavedProgress={deckId:d.id,questionIds:prepared.map(it=>it.q.id),choiceOrders:Object.fromEntries(prepared.map(it=>[it.q.id,it.choices])) as Record<string,Choice[]>,picked:{},checked:{},index:0,wrongOnly:false,updatedAt:Date.now(),sessionId:activeSessionId.current};
  try{localStorage.setItem(rangeProgressKey(d.id),JSON.stringify(snapshot));saveHistory(d.id,{...snapshot,id:activeSessionId.current,startedAt:startedAtRef.current,finished:false});}catch{}
  setItems(prepared);
  setPicked({});setChecked({});setIndex(0);setDeck(d);setWrongOnly(false);setScreen('quiz');
  setNotice(`Ôn lại vị trí ${from}–${Math.min(to,takenIds.length)} trong các câu đã lấy Không trùng: khôi phục được ${qs.length}/${selectedIds.length} câu theo thứ tự từng lượt. Không thay đổi bộ đếm Không trùng hay bài đang làm dở.`);setError('');return true;
 };
 const startNew=(d:Deck,settings?:{mode?:'full'|'batch';size?:number;repeat?:boolean;shuffleQuestions?:boolean;shuffleAnswers?:boolean}):boolean=>{
  if(readProgress(d.id)&&!confirm('Bắt đầu lượt mới sẽ thay thế tiến trình đang lưu của bộ đề này. Tiếp tục?'))return false;
  return start(d,false,settings);
 };
 const clearStudied=(d:Deck)=>{
  if(!confirm(`Xóa lịch sử các lượt Không trùng của “${d.title}”? Tiến trình làm bài hiện tại vẫn được giữ.`))return;
  try{localStorage.removeItem(studiedKey(d.id));}catch{}
  setStudiedCounts(x=>({...x,[d.id]:0}));setNotice(`Đã xóa lịch sử lượt của ${d.title}.`);
 };
 const resume=(d:Deck,kind:'normal'|'range'='normal'):boolean=>{
  const saved=readProgress(d.id,kind==='range'?rangeProgressKey(d.id):storageKey(d.id));if(!saved){setNotice('Không tìm thấy tiến trình đã lưu cho lượt này.');return false;}
  const lookup=new Map(d.questions.map(q=>[q.id,q]));
  const restored=saved.questionIds.map(id=>lookup.get(id)).filter((q):q is Question=>Boolean(q)).map(q=>({q,choices:(saved.choiceOrders[q.id]||available(q)).filter(c=>available(q).includes(c))}));
  if(!restored.length){setError('Các câu của lượt đã lưu không còn trong bộ đề. Không tự tạo lượt mới để tránh làm mất lịch sử.');return false;}
  activeProgressKind.current=kind;activeSessionId.current=saved.sessionId||`legacy-${d.id}`;startedAtRef.current=readHistory(d.id).find(r=>r.id===activeSessionId.current)?.startedAt||saved.updatedAt;
  setDeck(d);setItems(restored);setPicked(saved.picked||{});setChecked(saved.checked||{});setIndex(Math.min(Math.max(0,saved.index||0),restored.length-1));setWrongOnly(Boolean(saved.wrongOnly));setScreen('quiz');setNotice('Đã khôi phục tiến trình trên trình duyệt này.');setError('');return true;
 };
 const reset=()=>{
  if(!deck||!confirm('Xóa các lựa chọn trong lượt làm hiện tại và bắt đầu lại từ câu 1?'))return;
  try{localStorage.removeItem(activeProgressKind.current==='range'?rangeProgressKey(deck.id):storageKey(deck.id));}catch{}
  activeSessionId.current=crypto.randomUUID();startedAtRef.current=Date.now();
  setPicked({});setChecked({});setIndex(0);setWrongOnly(false);setScreen('quiz');setNotice('Đã đặt lại tiến trình của lượt hiện tại; lịch sử lượt cũ và tiến trình của chế độ khác vẫn được giữ.');
 };
 const showHistory=(d:Deck)=>{setHistoryDeck(d);setHistoryRecords(readHistory(d.id));setHistoryFilter('all');setReviewRecord(null);setScreen('history');setError('');setNotice('');};
 const reviewHistory=(record:HistoryRecord)=>{setReviewRecord(record);setScreen('history-review');};
 const deleteHistory=(id:string)=>{if(!historyDeck||!confirm('Xóa riêng lượt ôn này khỏi lịch sử? Bài đang làm dở và bộ đề gốc không bị ảnh hưởng.'))return;try{const updated=readHistory(historyDeck.id).filter(r=>r.id!==id);localStorage.setItem(historyKey(historyDeck.id),JSON.stringify(updated));setHistoryRecords(updated);setNotice('Đã xóa bản ghi lịch sử đã chọn.');}catch{setError('Không xóa được lịch sử trong trình duyệt.');}};
 const exportBackup=()=>{
  try{const entries:Record<string,string>={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&BACKUP_PREFIXES.some(prefix=>key.startsWith(prefix)))entries[key]=localStorage.getItem(key)||'';}
   downloadJson('quizstudy-backup-'+new Date().toISOString().slice(0,10)+'.json',{format:'quizstudy-local-backup',version:13,exportedAt:new Date().toISOString(),entries});setNotice('Đã xuất bản sao lưu. Hãy cất file JSON ở nơi an toàn.');
  }catch{setError('Không đọc được dữ liệu lưu trên trình duyệt.');}
 };
 const importBackup=async(file:File)=>{
  try{const data=JSON.parse(await file.text());if(data?.format!=='quizstudy-local-backup'||![12,13].includes(data.version)||!data.entries||typeof data.entries!=='object'||Array.isArray(data.entries))throw Error('Không phải file sao lưu QuizStudy V12/V13 hợp lệ.');
   const pairs=Object.entries(data.entries) as [string,unknown][];
   if(pairs.length>1000||pairs.some(([k,v])=>!BACKUP_PREFIXES.some(p=>k.startsWith(p))||typeof v!=='string'||v.length>10_000_000))throw Error('File sao lưu chứa dữ liệu không hợp lệ.');
   for(const [k,v] of pairs){if(k!=='quizstudy-theme')JSON.parse(v as string);else if(v!=='light'&&v!=='dark')throw Error('Giá trị giao diện trong sao lưu không hợp lệ.');}
   if(!confirm(`Khôi phục ${pairs.length} mục lưu trữ? Các mục trùng khóa sẽ bị ghi đè. Hãy Xuất bản sao lưu hiện tại trước khi tiếp tục.`))return;
   for(const [k,v] of pairs)localStorage.setItem(k,v as string);
   setNotice('Đã khôi phục dữ liệu. Hãy tải lại trang để cập nhật danh sách tiến trình và lịch sử.');
   await load();
  }catch(e){setError((e as Error).message);}
 };
 const importImageDoc=async()=>{
  if(!imageDoc){setError('Hãy chọn file Word chứa ảnh.');return;}
  setLoading(true);setError('');setNotice('');setUploadProgress('Đang đọc ảnh trong Word trên trình duyệt...');
  try{
   const imageItems=await readImageWord(imageDoc);
   setUploadProgress(`Đã đọc ${imageItems.length} câu. Khởi tạo OCR để đọc nhãn A–H trong từng ảnh...`);
   let identified:Awaited<ReturnType<typeof recognizeWordChoices>>;
   try {
    identified=await recognizeWordChoices(imageItems,(i,total)=>setUploadProgress(`Đang nhận diện A–H trong ảnh ${i}/${total} (Câu ${imageItems[i-1].number})...`));
   }catch(e){throw Error(`Không khởi động được OCR: ${(e as Error).message}. Kiểm tra kết nối mạng hoặc cài đặt OCR. Chưa upload ảnh nào.`);}
   const warnings:Record<number,string>={};
   let raw=imageKeyText;
   if(imageKeys)raw+='\n'+await parseAnswerFile(imageKeys);
   const keys=readAnswerKeys(raw);
   const results:Question[]=[];
   for(let i=0;i<imageItems.length;i++){
    const it=imageItems[i];setUploadProgress(`Đang tải ảnh lên Supabase: ${i+1}/${imageItems.length} (Câu ${it.number})`);
    const sign=await request('/api/image-word/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime:it.mime,extension:it.extension})}) as {signedUrl:string;publicUrl:string};
    const upload=await fetch(sign.signedUrl,{method:'PUT',headers:{'Content-Type':it.mime,'x-upsert':'false'},body:it.image});
    if(!upload.ok){const detail=(await upload.text()).slice(0,250);throw Error(`Không tải được ảnh câu ${it.number} (${upload.status}). ${detail}`);}
    const keyAnswers=keys.get(it.number)||[];
    // DOCX heading tells us how many answers are required, NOT the visible A–H choices.
    // Preserve key letters E–H, never silently discard them as V14 did.
    const maxKeyIndex=keyAnswers.reduce((max,c)=>Math.max(max,C.indexOf(c)),0);
    const detection=identified.get(it.number);
    const fallback=Math.min(8,Math.max(4,maxKeyIndex+1));
    const suggestedCount=Math.min(8,Math.max(detection?.count||fallback,maxKeyIndex+1, detection?.count?2:4));
    if(!detection?.count)warnings[it.number]=detection?.warning||'OCR chưa xác định được số lựa chọn.';
    else if(detection.confidence==='low')warnings[it.number]=`OCR gợi ý A–${C[detection.count-1]} nhưng độ tin cậy thấp; nên đối chiếu ảnh.`;
    else if(maxKeyIndex+1>detection.count)warnings[it.number]=`OCR thấy A–${C[detection.count-1]} nhưng key có ${C[maxKeyIndex]}; vui lòng kiểm tra.`;
    const options=Object.fromEntries(C.map((c,i)=>[c,i<suggestedCount?c:''])) as Record<Choice,string>;
    const answer=keyAnswers;
    results.push({id:crypto.randomUUID(),number:it.number,text:`Câu ${it.number}`,imageUrl:sign.publicUrl,options,answer,multiple:(it.requiredAnswers||1)>1||answer.length>1,...(it.requiredAnswers?{requiredAnswers:it.requiredAnswers}:{})});
   }
   setOcrWarnings(warnings);setDraft(results);setDeck(null);setEditing(false);
   setTitle(imageDoc.name.replace(/\.docx$/i,''));setSubject(imageDoc.name.split('_')[0]||'Khác');setScreen('edit');
   const matched=results.filter(q=>q.answer.length).length;
   const needsReview=results.filter(q=>q.requiredAnswers&&q.answer.length!==q.requiredAnswers).length;
   const uncertain=Object.keys(warnings).length;
   setNotice(`Đã tải ${results.length} ảnh lên Supabase. Ghép đáp án ${matched} câu; ${needsReview} câu có số đáp án chưa khớp ghi chú Word. OCR đã tự đếm A–H từ ảnh; ${uncertain} câu chưa chắc chắn cần kiểm tra tại màn hình sửa. Không tự đoán đáp án đúng.`);
  }catch(e){setError((e as Error).message+' Các ảnh đã tải thành công trước lỗi vẫn còn trên Storage, nhưng bộ đề chưa lưu.');}
  finally{setLoading(false);setUploadProgress('');}
 };
 const importJson=async(file:File)=>{
  setError('');setNotice('');setLoading(true);
  try{
   if(!file.name.toLowerCase().endsWith('.json'))throw Error('Hãy chọn file QuizStudy dạng .json.');
   if(file.size>100*1024*1024)throw Error('File JSON vượt 100 MB. Hãy giảm dung lượng ảnh trước khi nhập.');
   const obj:unknown=JSON.parse(await file.text());
   if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON không phải bộ đề QuizStudy.');
   const data=obj as Record<string,unknown>;
   if(!Array.isArray(data.questions)||!data.questions.length||data.questions.length>2000)throw Error('File thiếu danh sách questions hoặc vượt quá 2000 câu.');
   const parsed:Question[]=data.questions.map((raw:unknown,i:number)=>{
    if(!raw||typeof raw!=='object')throw Error(`Câu ${i+1} không hợp lệ.`);
    const q=raw as Record<string,unknown>;
    const opts=q.options;
    if(typeof q.text!=='string'||!q.text.trim()||!opts||typeof opts!=='object'||Array.isArray(opts))throw Error(`Câu ${i+1} thiếu nội dung hoặc options.`);
    const optionImages=q.optionImages&&typeof q.optionImages==='object'&&!Array.isArray(q.optionImages)?q.optionImages as Record<string,unknown>:{};
    const options=Object.fromEntries(C.map(k=>{
     const val=(opts as Record<string,unknown>)[k];
     const image=optionImages[k];const imageFirst=Array.isArray(image)?image[0]:image;
     return [k,typeof val==='string'&&val.trim()?val:(typeof imageFirst==='string'?imageFirst:'')];
    })) as Record<Choice,string>;
    if(available({options} as Question).length<2)throw Error(`Câu ${i+1} phải có ít nhất 2 lựa chọn.`);
    const rawAnswer=q.answer;
    const a=Array.isArray(rawAnswer)?rawAnswer:(typeof rawAnswer==='string'?(rawAnswer.match(/[A-H]/gi)||[]):[]);
    const answer=[...new Set(a.map(x=>String(x).toUpperCase()))].filter((x):x is Choice=>C.includes(x as Choice));
    const invalid=answer.filter(x=>!options[x]?.trim());
    if(invalid.length)throw Error(`Câu ${i+1}: đáp án ${invalid.join(', ')} không có lựa chọn tương ứng.`);
    return {id:typeof q.id==='string'&&q.id.length<100?q.id:`json-${i+1}-${crypto.randomUUID()}`,number:Number(q.number)||i+1,text:q.text,options,answer,multiple:Boolean(q.multiple)||answer.length>1,imageUrl:typeof q.imageUrl==='string'?q.imageUrl:(Array.isArray(q.images)&&typeof q.images[0]==='string'?q.images[0]:undefined),...(typeof q.requiredAnswers==='number'&&Number.isInteger(q.requiredAnswers)&&q.requiredAnswers>=1&&q.requiredAnswers<=8?{requiredAnswers:q.requiredAnswers}:{})};
   });
   const numbers=new Set<number>();
   for(const q of parsed){if(numbers.has(q.number))throw Error(`Số câu ${q.number} bị trùng trong JSON.`);numbers.add(q.number);}
   setUploadProgress('Đã đọc JSON. Đang kiểm tra ảnh...');
   const prepared=await uploadEmbeddedPictures(parsed,setUploadProgress);
   setDraft(prepared);setDeck(null);setEditing(false);
   setTitle(typeof data.title==='string'&&data.title.trim()?data.title:file.name.replace(/\.json$/i,''));
   setSubject(typeof data.subject==='string'&&data.subject.trim()?data.subject:(file.name.split('_')[0]||'Khác'));
   setScreen('edit');
   const missing=parsed.filter(q=>!answerOf(q).length).length;
   const multi=parsed.filter(q=>q.multiple).length;
   setNotice(`Đã đọc ${parsed.length} câu từ JSON; ${multi} câu chọn nhiều; ${missing} câu chưa có đáp án. Kiểm tra rồi bấm Lưu để đăng chung lên Supabase.`);
  }catch(e){setError('Không nhập được JSON: '+(e as Error).message+' Nếu một số ảnh đã tải lên trước khi lỗi, chúng vẫn nằm trong Storage.');}finally{setLoading(false);setUploadProgress('');}
 };
 const exportJson=(d:Deck)=>{
  const obj={format:'quizstudy-v1',title:d.title,subject:d.subject,questions:d.questions.map(q=>({number:q.number,text:q.text,options:Object.fromEntries(available(q).map(c=>[c,q.options[c]])),answer:answerOf(q),multiple:q.multiple,...(q.imageUrl?{imageUrl:q.imageUrl}:{}) ,...(q.requiredAnswers?{requiredAnswers:q.requiredAnswers}:{})}))};
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(d.subject||'QuizStudy').replace(/[^a-z0-9_-]/gi,'_')+'_QuizStudy.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
 };
 // V18: Real independent URLs; browser history navigation keeps quiz state mounted.
 const goToHistory=(d:Deck)=>{showHistory(d);setUrl(deckUrl(d.id,'history'));};
 const goToEdit=(d:Deck)=>{edit(d);setUrl(deckUrl(d.id,'edit'));};
 const goToPractice=(d:Deck)=>{const options={mode:studyMode,size:batchSize,repeat:allowRepeat,shuffleQuestions:mixQuestions,shuffleAnswers:mixAnswers};
  if(startNew(d,options))setUrl(deckUrl(d.id,'practice')+'?'+new URLSearchParams({mode:options.mode,size:String(options.size),repeat:String(options.repeat),shuffleQuestions:String(options.shuffleQuestions),shuffleAnswers:String(options.shuffleAnswers)}));};
 const goToContinue=(d:Deck,kind:'normal'|'range'='normal')=>{if(resume(d,kind))setUrl(deckUrl(d.id,kind==='range'?'continue-range':'continue'));};
 const goToRange=(d:Deck)=>{const range={from:Number(rangeFrom),to:Number(rangeTo)};if(startRange(d,range))setUrl(deckUrl(d.id,'review-range')+`?from=${range.from}&to=${range.to}`);};
 const goToHistoryRecord=(r:HistoryRecord)=>{if(!historyDeck)return;reviewHistory(r);setUrl(deckUrl(historyDeck.id,'history/'+encodeURIComponent(r.id)));};
 const goToExport=(d:Deck)=>{setDeck(d);setScreen('export');setError('');setUrl(deckUrl(d.id,'export'));};
 const goToResult=()=>{setScreen('result');if(deck)setUrl(deckUrl(deck.id,'result')+(activeProgressKind.current==='range'?'?kind=range':''));};
 // A refresh or pasted link reopens the correct view without resetting legacy progress.
 useEffect(()=>{
  if(!pathname||handledRoute.current===pathname||!decks.length)return;
  const m=pathname.match(/^\/quiz\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if(!m){handledRoute.current=pathname;setScreen('home');setDeck(null);return;}
  let id='';try{id=decodeURIComponent(m[1]);}catch{setError('Link bộ đề không hợp lệ.');return;}
  const d=decks.find(v=>v.id===id);
  if(!d){setError('Không tìm thấy bộ đề này trong Supabase.');return;}
  handledRoute.current=pathname;
  setDeck(d);setError('');
  const action=m[2]||'';
  if(!action){setScreen('deck');return;}
  if(action==='history'){
   showHistory(d);
   if(m[3]){const record=readHistory(d.id).find(v=>v.id===decodeURIComponent(m[3]));if(record)reviewHistory(record);else setError('Không tìm thấy lượt lịch sử trên trình duyệt này.');}
  }else if(action==='edit')edit(d);
  else if(action==='export')setScreen('export');
  else if(action==='continue'||action==='continue-range'){
    if(!resume(d,action==='continue-range'?'range':'normal'))setScreen('deck');
  }else if(action==='review-range'){
    // A direct URL must never restart an existing range session or overwrite normal progress.
    if(!resume(d,'range')){setScreen('deck');setNotice('Hãy vào trang bộ đề và chọn khoảng câu để bắt đầu ôn.');}
  }else if(action==='practice'||action==='result'){
    // Opening a shared link does not automatically create a new session (or mark questions as seen).
    if(resume(d,action==='result'&&window.location.search.includes('kind=range')?'range':'normal')){
      if(action==='result')setScreen('result');
    }else{setScreen('deck');setNotice('Chọn Làm toàn bộ đề hoặc Luyện theo lượt để bắt đầu.');}
  }else{setScreen('deck');setError('Chức năng trong đường dẫn không tồn tại.');}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[pathname,decks]);
 const importing=async()=>{setError('');setNotice('');if(!(examFiles.length||examText.trim())||!(keyFiles.length||keyText.trim())){setError('Cần có cả đề và đáp án (file hoặc văn bản dán).');return;}
 setLoading(true);try{const fd=new FormData();for(const f of examFiles)fd.append('exams',f);for(const f of keyFiles)fd.append('answers',f);if(examText.trim())fd.append('examText',examText);if(keyText.trim())fd.append('answerText',keyText);
 const result=await request('/api/import',{method:'POST',body:fd});if(!result.questions.length)throw Error(result.warning||'Không có câu hỏi hợp lệ.');setDraft(result.questions);setEditing(false);setTitle(examFiles[0]?.name.replace(/\.[^.]+$/,'')||'Đề ôn tập mới');setSubject('Khác');setScreen('edit');setNotice(result.warning);
 }catch(e){setError((e as Error).message);}finally{setLoading(false);}};
 const replaceAnswers=async()=>{
  if(!replaceKeyFiles.length&&!replaceKeyText.trim()){setError('Hãy chọn file đáp án hoặc dán văn bản đáp án.');return;}
  setLoading(true);setError('');setNotice('');try{
   const fd=new FormData();for(const file of replaceKeyFiles)fd.append('answers',file);if(replaceKeyText.trim())fd.append('answerText',replaceKeyText);
   const result=await request('/api/answers',{method:'POST',body:fd});
   const found=result.answers as Record<string,Choice[]>;
   let applied=0,invalid=0;
   const updated=draft.map(q=>{
    const raw=found[String(q.number)];if(!raw)return q;
    const valid=raw.filter(c=>C.includes(c));
    if(valid.length!==raw.length)invalid++;
    if(!valid.length)return q;
    const maxIndex=valid.reduce((n,c)=>Math.max(n,C.indexOf(c)),0);
    const options=q.imageUrl?Object.fromEntries(C.map((c,i)=>[c,i<=maxIndex||q.options[c]?.trim()?c:''])) as Record<Choice,string>:q.options;
    applied++;return {...q,options,answer:valid,multiple:(q.requiredAnswers||1)>1||valid.length>1};
   });
   setDraft(updated);setNotice(`Đọc được ${result.count} số câu trong file, ghép được ${applied}/${draft.length} câu của bộ đề.${invalid?` Có ${invalid} câu chỉ đến lựa chọn không tồn tại.`:''} ${updated.filter(q=>!answerOf(q).length).length} câu vẫn thiếu đáp án. Hãy kiểm tra và bấm Lưu bộ đề.`);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 };
 const update=(n:number,patch:Partial<Question>)=>setDraft(prev=>prev.map((q,i)=>i===n?{...q,...patch}:q));
 const changeOption=(n:number,c:Choice,value:string)=>setDraft(prev=>prev.map((q,i)=>i===n?{...q,options:{...q.options,[c]:value}}:q));
 const save=async()=>{setError('');const mismatch=draft.filter(q=>q.imageUrl&&q.requiredAnswers&&((answerOf(q).length>0&&answerOf(q).length!==q.requiredAnswers)||available(q).length<q.requiredAnswers));if(mismatch.length){setError(`Chưa lưu: câu ${mismatch.slice(0,12).map(q=>q.number).join(', ')}${mismatch.length>12?'...':''} có số đáp án đúng không khớp yêu cầu Chọn 2/3 trong Word. Hãy kiểm tra ảnh và chỉnh đáp án, hoặc xóa đáp án chưa chắc chắn.`);return;}if(!title.trim()){setError('Bạn cần nhập tên bộ đề.');return;}if(!draft.length){setError('Bộ đề đang trống.');return;}setLoading(true);try{const normalized=await uploadEmbeddedPictures(draft,setUploadProgress);setDraft(normalized);const url=editing&&deck?`/api/quizzes/${deck.id}`:'/api/quizzes';await request(url,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,subject,questions:normalized})});setExamFiles([]);setKeyFiles([]);setExamText('');setKeyText('');close();}catch(e){setError((e as Error).message);}finally{setLoading(false);setUploadProgress('');}};
 const remove=async(d:Deck)=>{if(!confirm(`Xóa vĩnh viễn bộ đề "${d.title}"? Mọi người sẽ không còn thấy bộ đề này.`))return;setLoading(true);setError('');try{await request(`/api/quizzes/${d.id}`,{method:'DELETE'});if(deck?.id===d.id)close();else await load();}catch(e){setError((e as Error).message);}finally{setLoading(false);}};
 const done=items.reduce((acc,item)=>acc+((picked[item.q.id]||[]).length?1:0),0);
 const scored=items.filter(item=>answerOf(item.q).length>0);const correct=scored.filter(item=>equalsAnswer(picked[item.q.id]||[],answerOf(item.q))).length;
 const misses=scored.filter(item=>!equalsAnswer(picked[item.q.id]||[],answerOf(item.q)));
 const visibleDecks=useMemo(()=>decks.filter(d=>(d.title+' '+d.subject).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[decks,query]);
 const copy=async(q:Question)=>{try{await navigator.clipboard.writeText(q.imageUrl?`${q.text}\n${q.imageUrl}`:`${q.text}\n${available(q).map(c=>`${c}. ${isImageOption(q.options[c])?'[Đáp án dạng ảnh]':q.options[c]}`).join('\n')}`);setNotice(q.imageUrl?'Đã sao chép link ảnh câu hỏi.':'Đã sao chép câu hỏi.');}catch{setError('Trình duyệt không cho sao chép tự động.');}};
 const current=items[index];
 return <main className="layout">
  <header className="nav"><div className="logo" onClick={close} style={{cursor:'pointer'}}><BookOpen size={23} style={{verticalAlign:'middle',marginRight:8}}/>Quiz<span>Study</span></div><div className="header-actions"><span className="tag"><Cloud size={13} style={{verticalAlign:'middle',marginRight:5}}/>Lưu chung • Không dùng AI</span><button type="button" className="theme-switch" aria-label={theme==='dark'?'Chuyển sang chế độ sáng':'Chuyển sang chế độ tối'} title={theme==='dark'?'Chế độ sáng':'Chế độ tối'} aria-pressed={theme==='dark'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}<span>{theme==='dark'?'Sáng':'Tối'}</span></button></div></header>
  {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {screen==='home'&&<>
   <section className="hero"><h1>Ôn trắc nghiệm theo cách của bạn</h1><p>Upload đề + đáp án một lần. Cả nhóm có thể học, thêm, sửa và xóa từ mọi thiết bị.</p></section>
   <div className="row between" style={{marginBottom:18}}><h2 style={{margin:0}}>Thư viện đề thi ({decks.length})</h2><button className="button" onClick={()=>{setScreen('import');setError('');setNotice('');}}><FilePlus2 size={17}/>Thêm bộ đề</button></div>
   <div className="row" style={{marginBottom:16,flexWrap:'wrap'}}><button className="button ghost small" onClick={exportBackup}><ShieldCheck size={15}/> Xuất sao lưu tiến trình</button><label className="button ghost small" style={{cursor:'pointer'}}><FileUp size={15}/> Khôi phục sao lưu <input type="file" accept=".json" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)void importBackup(f);e.currentTarget.value='';}}/></label></div>
   <div className="row" style={{marginBottom:16}}><div className="search"><Search size={17}/><input placeholder="Tìm môn học, tên bộ đề..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
   <div className="decks">{visibleDecks.map(d=><article className="panel deck" key={d.id} style={{marginBottom:0}}><div><strong>{d.title}</strong><small>{d.subject||'Khác'} · {d.questions.length} câu · {d.questions.filter(x=>answerOf(x).length>0).length} câu có đáp án · Đã lấy {Math.min(studiedCounts[d.id]||0,d.questions.length)}/{d.questions.length} câu không trùng</small></div><div className="topActions"><button className="button" onClick={()=>openDeck(d)}>Mở bộ đề →</button></div></article>)}{visibleDecks.length===0&&<div className="panel muted">{decks.length?'Không tìm thấy bộ đề phù hợp.':'Chưa có bộ đề. Hãy nhấn “Thêm bộ đề” để bắt đầu.'}</div>}</div>
  </>}
  {screen==='deck'&&<div className="quizWrap"><button className="button ghost small" onClick={close}><ArrowLeft size={15}/>Thư viện bộ đề</button>{deck?<><section className="panel" style={{marginTop:18,marginBottom:18}}><h1 style={{margin:'0 0 8px'}}>{deck.title}</h1><p className="muted" style={{margin:'0 0 16px'}}>{deck.subject||'Khác'} · {deck.questions.length} câu · {deck.questions.filter(x=>answerOf(x).length>0).length} câu có đáp án · Đã lấy {Math.min(studiedCounts[deck.id]||0,deck.questions.length)}/{deck.questions.length} câu không trùng</p><div className="row" style={{flexWrap:'wrap',gap:10}}><button className="button ghost small" onClick={()=>goToHistory(deck)}><History size={15}/> Lịch sử ({readHistory(deck.id).length})</button>{savedProgress[deck.id]&&<button className="button ghost small" onClick={()=>goToContinue(deck)}>Tiếp tục ({savedProgress[deck.id]} câu)</button>}{Boolean(rangeProgressCounts[deck.id])&&<button className="button ghost small" onClick={()=>goToContinue(deck,'range')}>Tiếp tục ôn lượt cũ</button>}<button className="button ghost small" onClick={()=>goToRange(deck)}>Ôn câu Không trùng {rangeFrom||'?'}–{rangeTo||'?'}</button><button className="button" onClick={()=>goToPractice(deck)}>{studyMode==='batch'?`Lượt mới (${Math.min(batchSize,allowRepeat?deck.questions.length:Math.max(0,deck.questions.length-(studiedCounts[deck.id]||0)))} câu)`:'Làm toàn bộ đề'}</button>{(studiedCounts[deck.id]||0)>0&&<button className="button ghost small" onClick={()=>clearStudied(deck)} title="Chỉ xóa lịch sử lượt Không trùng của bộ đề này">Xóa lịch sử lượt</button>}<button className="button ghost small" onClick={()=>goToExport(deck)}><Download size={15}/> JSON</button><button className="button ghost small" onClick={()=>goToEdit(deck)}><Pencil size={15}/> Sửa bộ đề</button><button className="button danger small" disabled={loading} onClick={()=>remove(deck)}><Trash2 size={15}/> Xóa bộ đề</button></div></section>
   <div className="panel study-settings"><h3 style={{marginTop:0}}>Cài đặt lượt ôn tập</h3>
    <div className="study-mode-row"><label className="toggle"><input type="radio" name="study-mode" checked={studyMode==='full'} onChange={()=>setStudyMode('full')}/>Làm toàn bộ đề (như cũ)</label><label className="toggle"><input type="radio" name="study-mode" checked={studyMode==='batch'} onChange={()=>setStudyMode('batch')}/>Luyện theo lượt</label></div>
    {studyMode==='batch'&&<div className="batch-controls"><label className="field" style={{margin:0}}><span className="field-title">Số câu mỗi lượt</span><select className="textinput" value={batchSize} onChange={e=>setBatchSize(Number(e.target.value))}>{[10,20,30,50,100,150].map(n=><option key={n} value={n}>{n} câu</option>)}</select></label><div className="batch-repeat"><span className="field-title">Cách chọn câu</span><label className="toggle"><input type="radio" name="batch-repeat" checked={!allowRepeat} onChange={()=>setAllowRepeat(false)}/>Không trùng – chỉ lấy câu chưa từng được đưa vào lượt trước</label><label className="toggle"><input type="radio" name="batch-repeat" checked={allowRepeat} onChange={()=>setAllowRepeat(true)}/>Cho phép trùng – chọn ngẫu nhiên để kiểm tra lại</label></div></div>}
    <div className="row" style={{gap:22,marginTop:18}}><label className="toggle"><input type="checkbox" checked={mixQuestions} onChange={e=>setMixQuestions(e.target.checked)}/>Trộn thứ tự câu hỏi (toàn bộ đề)</label><label className="toggle"><input type="checkbox" checked={mixAnswers} onChange={e=>setMixAnswers(e.target.checked)}/>Trộn A/B/C/D (chỉ đề chữ)</label></div>
    <div className="range-panel" style={{marginTop:20,padding:16,border:'1px solid var(--border, #8884)',borderRadius:12}}>
     <h3 style={{margin:'0 0 8px'}}>Ôn lại 50 câu đã lấy ở chế độ Không trùng (V13)</h3>
     <div className="row" style={{alignItems:'end',gap:12,flexWrap:'wrap'}}>
      <label className="field" style={{margin:0}}><span className="field-title">Từ vị trí đã lấy</span><input className="textinput" type="number" min={1} step={1} value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}/></label>
      <label className="field" style={{margin:0}}><span className="field-title">Đến vị trí đã lấy (bao gồm)</span><input className="textinput" type="number" min={1} step={1} value={rangeTo} onChange={e=>setRangeTo(e.target.value)}/></label>
     </div>
     <p className="muted" style={{margin:'9px 0 0'}}>Ví dụ: lượt thứ 6 trong chế độ Không trùng gồm <strong>vị trí 251–300</strong> (50 câu đã được rút ngẫu nhiên trước đó), <strong>không phải câu số 251–300 trong file gốc</strong>. Thứ tự lấy được khôi phục từ lịch sử đã lấy trên trình duyệt này. Không thay đổi bộ đếm Không trùng, tiến trình đang làm dở hoặc dữ liệu Supabase.</p>
    </div>
    <p className="muted" style={{marginBottom:0}}>Không trùng: câu được đánh dấu đã lấy ngay khi tạo lượt, kể cả bạn chưa hoàn thành; lịch sử tách biệt cho từng bộ đề trên trình duyệt này. Cho phép trùng: các lượt có thể chứa câu đã học, nhưng không lặp câu trong cùng một lượt. Bộ đề gốc trên Supabase không bị thay đổi.</p></div>
</>:<div className="panel"><p>Không tìm thấy bộ đề hoặc bộ đề đã bị xóa.</p><button className="button" onClick={close}>Về thư viện</button></div>}</div>}
  {screen==='export'&&deck&&<div className="quizWrap"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="panel" style={{marginTop:18}}><h2>Xuất JSON – {deck.title}</h2><p className="muted">Xuất bộ câu hỏi và đáp án hiện tại. Bộ đề trên Supabase và tiến trình luyện tập của bạn không thay đổi.</p><button className="button" onClick={()=>exportJson(deck)}><Download size={16}/>Tải file JSON</button></div></div>}
  {screen==='history'&&historyDeck&&<div className="quizWrap"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="panel" style={{marginTop:18}}><h2>Lịch sử ôn tập – {historyDeck.title}</h2><p className="muted">Lịch sử lưu riêng trên trình duyệt này. Tiến trình V11 đang dở được bảo toàn. Các lượt cũ hơn không thể khôi phục đáp án nếu trước đây chỉ lưu danh sách câu đã lấy.</p><p>Đã lấy ở chế độ Không trùng: <strong>{readStudied(historyDeck.id).length}/{historyDeck.questions.length}</strong> câu (không đồng nghĩa đã trả lời).</p><div className="row" style={{marginBottom:12}}><button className="button ghost small" onClick={exportBackup}><Download size={15}/> Sao lưu</button></div>
  {historyRecords.length===0?<p className="muted">Chưa có lượt nào được lưu chi tiết trên trình duyệt này.</p>:historyRecords.map((r,i)=>{const qs=r.questionIds.map(id=>historyDeck.questions.find(q=>q.id===id)).filter((q):q is Question=>Boolean(q));const attempted=qs.filter(q=>(r.picked[q.id]||[]).length).length;const right=qs.filter(q=>r.checked[q.id]&&answerOf(q).length&&equalsAnswer(r.picked[q.id]||[],answerOf(q))).length;return <div className="history-entry" key={r.id}><div><strong>Lượt {historyRecords.length-i} · {qs.length} câu</strong><div className="muted">{new Date(r.startedAt).toLocaleString('vi-VN')} · {r.finished?'Đã xem kết quả':'Đang học / chưa nộp'} · Đã chọn {attempted}/{qs.length} · Đúng {right}</div></div><div className="row"><button className="button small" onClick={()=>goToHistoryRecord(r)}>Xem lại câu đã làm</button><button className="button danger small" onClick={()=>deleteHistory(r.id)}>Xóa</button></div></div>;})}</div></div>}
  {screen==='history-review'&&historyDeck&&reviewRecord&&<div className="quizWrap"><button className="button ghost small" onClick={()=>historyDeck&&goToHistory(historyDeck)}><ArrowLeft size={15}/>Lịch sử</button><div className="panel" style={{marginTop:18}}><h2>Xem lại lượt ôn – {historyDeck.title}</h2><div className="row" style={{marginBottom:16}}><label className="toggle"><input type="radio" checked={historyFilter==='all'} onChange={()=>setHistoryFilter('all')}/>Tất cả</label><label className="toggle"><input type="radio" checked={historyFilter==='wrong'} onChange={()=>setHistoryFilter('wrong')}/>Sai / chưa chọn</label><label className="toggle"><input type="radio" checked={historyFilter==='right'} onChange={()=>setHistoryFilter('right')}/>Đúng</label></div>
  {reviewRecord.questionIds.map(id=>{const q=historyDeck.questions.find(v=>v.id===id);if(!q)return null;const user=reviewRecord.picked[id]||[];const key=answerOf(q);const checkedAnswer=Boolean(reviewRecord.checked[id]);const right=checkedAnswer&&key.length>0&&equalsAnswer(user,key);if(historyFilter==='right'&&!right)return null;if(historyFilter==='wrong'&&right)return null;const order=(reviewRecord.choiceOrders[id]||available(q)).filter(c=>available(q).includes(c));return <div key={id} className="review"><strong>Câu {q.number}. {q.text}</strong>{q.imageUrl&&<ZoomableImage src={q.imageUrl} alt={`Ảnh câu ${q.number}`}/>}<p className="muted">Đã chọn: <b>{user.length?user.join(', '):'Chưa chọn'}</b> · Đáp án: <b>{key.length?key.join(', '):'Chưa có'}</b> · {checkedAnswer?(right?'Đúng':'Sai'):'Chưa kiểm tra'}</p>{order.map(c=><div key={c} className={'review-option '+(key.includes(c)?'success ':user.includes(c)?'bad':'')}>{order.indexOf(c)>=0?C[order.indexOf(c)]:c}. {q.imageUrl&&q.options[c]===c?`Đáp án ${c} (xem ảnh phía trên)`:<OptionContent value={q.options[c]} label={c}/>}{key.includes(c)?' ✓':''}</div>)}</div>;})}</div></div>}
  {screen==='import'&&<div className="quizWrap"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="panel" style={{marginTop:18}}><h2>Thêm đề mới</h2><div className="answer-import"><strong>Nhập 1 file JSON QuizStudy (khuyên dùng)</strong><p className="muted">File đã gồm câu hỏi + lựa chọn + đáp án đơn/nhiều. Chọn một file, kiểm tra trước khi đăng. Không cần AI/API, không cần file đáp án riêng.</p><div className="sample-files" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}><strong>File mẫu:</strong><a className="button ghost small" href="/mau-quizstudy-v20-chu-anh.json" download="mau-quizstudy-v20-chu-anh.json"><Download size={15}/>Mẫu V20 (chữ + ảnh + chọn nhiều)</a><a className="button ghost small" href="/mau-quizstudy-dap-an-anh.json" download="mau-quizstudy-dap-an-anh.json"><Download size={15}/>Mẫu cơ bản</a><a className="button ghost small" href="/mau-quizstudy-public-speaking-anh-va-chu.json" download="mau-quizstudy-public-speaking-anh-va-chu.json"><Download size={15}/>Mẫu Public Speaking (3 câu)</a></div><p className="muted">Nhận JSON lớn có ảnh Base64. Khi nhập hoặc bấm Lưu, ảnh tự được tải lên Supabase Storage; máy chủ chỉ nhận đường dẫn ảnh. Bạn có thể tải mẫu V20 về, sửa câu hỏi/đáp án và nhập lại.</p>{uploadProgress&&<p className="muted" role="status">{uploadProgress}</p>}<input type="file" accept=".json,application/json" disabled={loading} onChange={e=>{const f=e.target.files?.[0];if(f)void importJson(f);e.currentTarget.value="";}}/></div><hr className="divider"/><div className="answer-import"><strong>Nhập Word dạng ảnh (tự nhận diện A–H bằng OCR)</strong>
   <p className="muted">Word theo mẫu: Câu 1, chèn ảnh, Câu 2... Hỗ trợ nhãn “Câu 35 (Chọn 3 đáp án)”. Trình duyệt tự dùng OCR đọc nhãn A–H trong ảnh, sau đó cảnh báo câu không rõ. OCR không xác định đáp án đúng; lần đầu cần mạng để tải mô hình nhận dạng.</p>
   <label className="field"><span className="field-title">File Word chứa ảnh câu hỏi (.docx, tối đa 60 MB)</span><input type="file" accept=".docx" onChange={e=>setImageDoc(e.target.files?.[0]||null)}/></label>
   <label className="field"><span className="field-title">File đáp án (tùy chọn)</span><input type="file" accept=".docx,.txt,.csv" onChange={e=>setImageKeys(e.target.files?.[0]||null)}/></label>
   <textarea rows={2} value={imageKeyText} onChange={e=>setImageKeyText(e.target.value)} placeholder="Hoặc dán đáp án: 1.B 2.A,C 3.D"/>
   <button className="button wide" onClick={importImageDoc} disabled={loading||!imageDoc}><Upload size={16}/>{loading?'Đang xử lý ảnh...':'Đọc Word ảnh để ôn tập'}</button>{uploadProgress&&<p className="muted" role="status">{uploadProgress}</p>}
   <p className="muted">Ảnh lưu trong Supabase Storage. Chỉ hỗ trợ DOCX chứa ảnh được chèn thật; không hỗ trợ DOC cũ hoặc hình liên kết ngoài.</p></div><hr className="divider"/><h3>Hoặc nhập theo cách cũ: đề + đáp án</h3><p className="muted">Website tách câu hỏi A/B/C/D và ghép đáp án theo số thứ tự, hoàn toàn không gọi AI. Hỗ trợ DOCX, PDF có chữ, TXT, CSV và ZIP chứa các file đó. Không đọc được ảnh hoặc PDF scan.</p>
   <label className="field"><span className="field-title">1. File đề thi</span><div className="filezone"><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setExamFiles(Array.from(e.target.files||[]))}/><small>Chọn một hoặc nhiều file đề</small></div></label>
   <label className="field"><span className="field-title">2. File đáp án</span><div className="filezone"><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setKeyFiles(Array.from(e.target.files||[]))}/><small>Ví dụ: 1.A 2.C 3.A,C (chọn nhiều đáp án)</small></div></label>
   <details><summary>Hoặc dán văn bản đề và đáp án trực tiếp</summary><label className="field"><span className="field-title">Nội dung đề</span><textarea rows={7} value={examText} onChange={e=>setExamText(e.target.value)} placeholder={'1. Câu hỏi...\nA. Đáp án A\nB. Đáp án B\nC. Đáp án C\nD. Đáp án D'}/></label><label className="field"><span className="field-title">Nội dung đáp án</span><textarea rows={4} value={keyText} onChange={e=>setKeyText(e.target.value)} placeholder="1.B 2.A,C 3.B và D"/></label></details>
   <div className="notice">Nếu đề là ảnh, hãy chuyển sang văn bản bằng ChatGPT trước rồi dán hoặc tải file Word vào đây. Hãy kiểm tra các câu nhận diện trước khi đăng.</div>
   <button className="button wide" onClick={importing} disabled={loading}><Upload size={17}/>{loading?'Đang đọc file...':'Đọc đề và ghép đáp án'}</button>
  </div></div>}
  {screen==='edit'&&<div className="quizWrap"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="panel" style={{marginTop:18}}><h2>{editing?'Chỉnh sửa bộ đề':'Kiểm tra trước khi đăng đề'}</h2><label className="field"><span className="field-title">Tên bộ đề</span><input className="textinput" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field"><span className="field-title">Tên môn học</span><input className="textinput" value={subject} onChange={e=>setSubject(e.target.value)}/></label><div className="row between"><strong>{draft.length} câu hỏi</strong><span className="badge">{draft.filter(noAnswer).length} câu chưa có đáp án</span></div><p className="muted">Bạn có thể sửa nội dung, để trống lựa chọn không có trong đề và chọn đáp án đúng.</p>
  <div className="answer-import"><strong>Nhập lại file đáp án (không cần tải lại đề)</strong><p className="muted">Nhận dạng 1.A, 2 B, 3.B,D hoặc Câu 4: AC. Chỉ cập nhật câu khớp số, không xóa đáp án cũ của câu không tìm thấy.</p><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setReplaceKeyFiles(Array.from(e.target.files||[]))}/><textarea rows={3} value={replaceKeyText} onChange={e=>setReplaceKeyText(e.target.value)} placeholder="Hoặc dán đáp án: 1.A 2.C 3.B,D"/><button className="button ghost" disabled={loading} onClick={replaceAnswers}>Đọc và ghép lại đáp án</button></div>
  {draft.map((q,i)=><div className="editquestion" key={q.id}><div className="row between"><strong>Câu {q.number}</strong><button className="button danger small" onClick={()=>setDraft(x=>x.filter((_,j)=>j!==i))}><Trash2 size={14}/>Bỏ</button></div><textarea aria-label={`Nội dung câu ${q.number}`} rows={3} value={q.text} onChange={e=>update(i,{text:e.target.value})}/>{q.imageUrl&&<><ZoomableImage src={q.imageUrl} alt={`Ảnh câu hỏi ${q.number}`}/><div className="image-option-config"><strong>Kiểm tra ảnh: có bao nhiêu lựa chọn?</strong><div className="row"><label>Số lựa chọn <select className="textinput" aria-label={`Số lựa chọn câu ${q.number}`} value={available(q).length} onChange={e=>{const count=Number(e.target.value);setDraft(prev=>prev.map((it,j)=>j!==i?it:{...it,options:Object.fromEntries(C.map((c,k)=>[c,k<count?(it.options[c]||c):''])) as Record<Choice,string>,answer:answerOf(it).filter(c=>C.indexOf(c)<count)}));}}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>A–{C[n-1]} ({n})</option>)}</select></label><label>Phải chọn <select className="textinput" aria-label={`Số đáp án cần chọn câu ${q.number}`} value={q.requiredAnswers||((q.multiple||answerOf(q).length>1)?Math.max(2,answerOf(q).length):1)} onChange={e=>update(i,{requiredAnswers:Number(e.target.value),multiple:Number(e.target.value)>1})}>{Array.from({length:Math.max(1,available(q).length)},(_,j)=>j+1).map(n=><option key={n} value={n}>{n} đáp án</option>)}</select></label></div><p className="muted">OCR tự đọc chữ A–H trong ảnh khi nhập Word. Khi ảnh mờ hoặc có lỗi OCR, hãy mở ảnh để xác nhận. {q.requiredAnswers?`Word ghi chọn ${q.requiredAnswers} đáp án.`:'Không có ghi chú số đáp án trong Word.'}</p>{ocrWarnings[q.number]&&<p className="notice error">Cần kiểm tra ảnh: {ocrWarnings[q.number]}</p>}{q.requiredAnswers&&answerOf(q).length>0&&answerOf(q).length!==q.requiredAnswers&&<p className="notice error">Cảnh báo: câu này cần {q.requiredAnswers} đáp án nhưng hiện có {answerOf(q).length} ({answerOf(q).join(', ')}). Kiểm tra lại key.</p>}</div></>}{C.map(c=><div className="editoption" key={c}><strong>{c}.</strong><div className="option-editor-content"><input value={isImageOption(q.options[c])?'[Ảnh đáp án đang được lưu trên Supabase]':(q.options[c]||'')} aria-label={`Câu ${q.number} lựa chọn ${c}`} readOnly={isImageOption(q.options[c])} onChange={e=>changeOption(i,c,e.target.value)}/><label className="small-upload">Tải ảnh {c}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Ảnh tối đa 10 MB. Hãy nén ảnh trước khi tải.');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Không thể đọc ảnh'));reader.readAsDataURL(file);});changeOption(i,c,data);setError('');}catch(err){setError(`Câu ${q.number} - đáp án ${c}: ${(err as Error).message}`);}e.currentTarget.value='';}}/></label>{isImageOption(q.options[c])&&<><ZoomableImage src={q.options[c]} alt={`Đáp án ${c} câu ${q.number}`}/><button type="button" className="button ghost small" onClick={()=>changeOption(i,c,'')}>Xóa ảnh {c}</button></>}</div></div>)}<label className="toggle" style={{marginTop:12}}><input type="checkbox" checked={q.multiple||answerOf(q).length>1} onChange={e=>update(i,{multiple:e.target.checked,requiredAnswers:q.imageUrl?(e.target.checked?Math.max(2,q.requiredAnswers||2):1):undefined,answer:e.target.checked?answerOf(q):answerOf(q).slice(0,1)})}/> Câu chọn nhiều đáp án</label><div className="field"><span className="field-title">Đáp án đúng {q.multiple?'(tích tất cả đáp án đúng)':'(chọn một)'}</span><div className="row" style={{flexWrap:'wrap'}}>{available(q).map(c=><label className="toggle" key={c}><input type={q.multiple?'checkbox':'radio'} name={`answer-${q.id}`} checked={answerOf(q).includes(c)} onChange={e=>{const next=q.multiple?(e.target.checked?[...answerOf(q),c]:answerOf(q).filter(x=>x!==c)):(e.target.checked?[c]:[]);update(i,{answer:[...new Set(next)]});}}/> {c}</label>)}<button className="button ghost small" onClick={()=>update(i,{answer:[]})}>Xóa đáp án</button></div></div></div>)}
  <button className="button ghost" onClick={()=>setDraft(x=>[...x,{id:crypto.randomUUID(),number:Math.max(0,...x.map(q=>q.number))+1,text:'Câu hỏi mới',options:{A:'Phương án A',B:'Phương án B',C:'Phương án C',D:'Phương án D',E:'',F:'',G:'',H:''},answer:[],multiple:false}])}>+ Thêm câu thủ công</button>
  <hr className="divider"/><button className="button wide" onClick={save} disabled={loading}><Save size={17}/>{loading?'Đang lưu...':'Lưu bộ đề lên thư viện chung'}</button>{editing&&deck&&<button className="button danger wide" style={{marginTop:10}} onClick={()=>remove(deck)}><Trash2 size={16}/>Xóa bộ đề</button>}</div></div>}
  {screen==='quiz'&&current&&<div className="quizWrap"><div className="row between"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="row"><span className="badge">{done}/{items.length} câu đã chọn · tự lưu</span><button className="button danger small" onClick={reset}><RotateCcw size={14}/>Reset</button></div></div><div className="panel" style={{marginTop:18}}><div className="row between"><strong>{deck?.title}</strong><span className="muted">Câu {index+1}/{items.length}</span></div><div className="progress"><div style={{width:`${(done/items.length)*100}%`}}/></div><div className="question">{current.q.text}</div>{current.q.imageUrl&&<ZoomableImage src={current.q.imageUrl} alt={`Câu ${current.q.number} - ảnh đề gốc`}/> }<p className="muted">{current.q.multiple||answerOf(current.q).length>1?'Chọn tất cả đáp án đúng (có thể chọn nhiều).':'Chọn một đáp án.'}</p>{current.choices.map((c,i)=>{const chosen=(picked[current.q.id]||[]).includes(c);const revealed=Boolean(checked[current.q.id]);const right=answerOf(current.q).includes(c);return <button key={c} disabled={revealed} className={'choice '+(revealed?(right?'correct':chosen?'wrong':''):(chosen?'active':''))} onClick={()=>{if(revealed)return;const multi=current.q.multiple||answerOf(current.q).length>1;setPicked(x=>{const old=x[current.q.id]||[];return {...x,[current.q.id]:multi?(old.includes(c)?old.filter(v=>v!==c):[...old,c]):[c]};});if(!multi)setChecked(x=>({...x,[current.q.id]:true}));}}><span className="letter">{C[i]}</span><span className="choice-content">{current.q.imageUrl&&current.q.options[c]===c?`Chọn ${c}`:<OptionContent value={current.q.options[c]} label={c}/>}</span>{revealed?(right?' ✓':chosen?' ✗':''):chosen?' ✓':''}</button>;})}{current.choices.some(c=>isImageOption(current.q.options[c]))&&<details className="choice-zoom-list"><summary>Phóng to ảnh đáp án A–H</summary><div className="choice-image-grid">{current.choices.filter(c=>isImageOption(current.q.options[c])).map(c=><div key={c}><b>{c}</b><ZoomableImage src={current.q.options[c]} alt={`Ảnh lựa chọn ${c}`}/></div>)}</div></details>}{!(checked[current.q.id])&&(current.q.multiple||answerOf(current.q).length>1)&&<button className="button" disabled={!(picked[current.q.id]||[]).length} onClick={()=>setChecked(x=>({...x,[current.q.id]:true}))}>Kiểm tra đáp án</button>}{checked[current.q.id]&&<div className={'answer-feedback '+(answerOf(current.q).length===0?'ungraded':equalsAnswer(picked[current.q.id]||[],answerOf(current.q))?'is-correct':'is-wrong')} role="status"><strong>{answerOf(current.q).length===0?'Câu này chưa có đáp án trong bộ đề.':equalsAnswer(picked[current.q.id]||[],answerOf(current.q))?'✓ Chính xác!':'✗ Chưa đúng!'}</strong>{answerOf(current.q).length>0&&<div>Đáp án đúng: <b>{current.choices.map((c,i)=>answerOf(current.q).includes(c)?C[i]:null).filter(Boolean).join(', ')}</b></div>}</div>}<div className="row between" style={{marginTop:20}}><button className="button ghost" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Câu trước</button>{index<items.length-1?<button className="button" onClick={()=>setIndex(i=>i+1)}>Câu sau</button>:<button className="button" onClick={goToResult}><CheckCircle2 size={16}/>Nộp bài</button>}</div><hr className="divider"/><div className="navqs">{items.map((v,i)=><button key={v.q.id} className={(i===index?'current ':picked[v.q.id]?'done':'')} onClick={()=>setIndex(i)}>{i+1}</button>)}</div><div className="row between"><button className="button ghost small" onClick={()=>void copy(current.q)}><Copy size={15}/>Sao chép câu hỏi</button><button className="button ghost small" onClick={goToResult}>Chấm bài ngay</button></div></div></div>}
  {screen==='result'&&<div className="quizWrap"><button className="button ghost small" onClick={backToDeck}><ArrowLeft size={15}/>Bộ đề</button><div className="panel" style={{marginTop:18}}><h2>Kết quả {deck?.title}</h2><button className="button danger small" onClick={reset}><RotateCcw size={14}/>Reset tiến trình</button><div className="result">{correct}/{scored.length}</div><p className="muted">Đúng {correct} · Sai hoặc bỏ trống {misses.length} · {items.length-scored.length} câu chưa được gắn đáp án.</p><div className="row"><button className="button" onClick={()=>deck&&goToPractice(deck)}><RotateCcw size={16}/>{studyMode==='batch'?'Lượt ôn mới':'Làm lại cả đề'}</button>{misses.length>0&&<button className="button ghost" onClick={()=>{const subset=items.filter(x=>answerOf(x.q).length&&!equalsAnswer(picked[x.q.id]||[],answerOf(x.q)));setItems(subset.map(it=>({...it,choices:mixAnswers&&!it.q.imageUrl?shuffle(available(it.q)):available(it.q)})));setPicked({});setChecked({});setIndex(0);setWrongOnly(true);setScreen('quiz');}}><Shuffle size={16}/>Ôn câu sai ({misses.length})</button>}</div><hr className="divider"/><h2>Đối chiếu đáp án {wrongOnly?'(lượt ôn câu sai)':''}</h2>{items.map((it,i)=>{const q=it.q;const user=picked[q.id]||[];const correctAnswers=answerOf(q);const display=(arr:Choice[])=>arr.length?arr.map(a=>C[it.choices.indexOf(a)]).join(', '):'Chưa chọn';return <div key={q.id} className="review"><strong>Câu {q.number}. {q.text}</strong>{q.imageUrl&&<ZoomableImage src={q.imageUrl} alt={`Ảnh câu ${q.number}`}/>}<p className="muted">Bạn chọn: <b>{display(user)}</b> · Đáp án đúng: <b>{correctAnswers.length?display(correctAnswers):'Chưa có'}</b></p>{it.choices.map((c,j)=><div key={c} className={'review-option '+(correctAnswers.includes(c)?'success ':user.includes(c)?'bad':'')}>{C[j]}. {q.imageUrl&&q.options[c]===c?`Đáp án ${c}`:<OptionContent value={q.options[c]} label={c}/>}{correctAnswers.includes(c)?' ✓':''}</div>)}<button className="button ghost small" style={{marginTop:12}} onClick={()=>void copy(q)}><Copy size={14}/>Sao chép câu hỏi để hỏi ChatGPT</button></div>;})}</div></div>}
  <footer className="muted" style={{textAlign:'center',marginTop:30}}>QuizStudy · Không cần Gemini/API · Bộ đề lưu trên Supabase, mọi người được quyền thêm, sửa, xóa.</footer>
 </main>;
}
