'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Cloud,FilePlus2,Trash2,Pencil,ArrowLeft,CheckCircle2,RotateCcw,Upload,Copy,Shuffle,Save,Search,Download,Sun,Moon} from 'lucide-react';
import type {Choice,Deck,Question} from '../lib/types';
import {CHOICES,answerOf,equalsAnswer} from '../lib/types';
const C:Choice[]=[...CHOICES];
type Screen='home'|'import'|'edit'|'quiz'|'result';
type QuizItem={q:Question;choices:Choice[]};
type SavedProgress={deckId:string;questionIds:string[];choiceOrders:Record<string,Choice[]>;picked:Record<string,Choice[]>;checked:Record<string,boolean>;index:number;wrongOnly:boolean;updatedAt:number};
const storageKey=(id:string)=>`quizstudy-progress-v5:${id}`;
const studiedKey=(id:string)=>`quizstudy-studied-v9:${id}`;
function readStudied(id:string):string[]{
 try{const value=JSON.parse(localStorage.getItem(studiedKey(id))||'[]');return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}
}

function readProgress(id:string):SavedProgress|null{
 try {const raw=localStorage.getItem(storageKey(id));if(!raw)return null;const data=JSON.parse(raw) as SavedProgress;
  return data.deckId===id&&Array.isArray(data.questionIds)&&data.questionIds.length>0?data:null;
 }catch{return null;}
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
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 const themeInitialized=useRef(false);
 useEffect(()=>{try{const saved=localStorage.getItem('quizstudy-theme');const preferred=window.matchMedia('(prefers-color-scheme: dark)').matches;setTheme(saved==='light'||saved==='dark'?saved:(preferred?'dark':'light'));}catch{/* storage unavailable */}},[]);
 useEffect(()=>{if(!themeInitialized.current){themeInitialized.current=true;return;}document.documentElement.dataset.theme=theme;try{localStorage.setItem('quizstudy-theme',theme);}catch{/* storage unavailable */}},[theme]);
 const [decks,setDecks]=useState<Deck[]>([]);const [screen,setScreen]=useState<Screen>('home');
 const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [deck,setDeck]=useState<Deck|null>(null);const [draft,setDraft]=useState<Question[]>([]);
 const [title,setTitle]=useState('');const [subject,setSubject]=useState('');const [editing,setEditing]=useState(false);
 const [imageDoc,setImageDoc]=useState<File|null>(null);const [imageKeys,setImageKeys]=useState<File|null>(null);const [imageKeyText,setImageKeyText]=useState('');
 const [examFiles,setExamFiles]=useState<File[]>([]);const [keyFiles,setKeyFiles]=useState<File[]>([]);
 const [examText,setExamText]=useState('');const [keyText,setKeyText]=useState('');
 const [replaceKeyFiles,setReplaceKeyFiles]=useState<File[]>([]);const [replaceKeyText,setReplaceKeyText]=useState('');const [savedProgress,setSavedProgress]=useState<Record<string,number>>({});
 const [studyMode,setStudyMode]=useState<'full'|'batch'>('full');const [batchSize,setBatchSize]=useState(50);const [allowRepeat,setAllowRepeat]=useState(false);const [studiedCounts,setStudiedCounts]=useState<Record<string,number>>({});
 const [query,setQuery]=useState('');const [mixQuestions,setMixQuestions]=useState(false);const [mixAnswers,setMixAnswers]=useState(false);
 const [items,setItems]=useState<QuizItem[]>([]);const [picked,setPicked]=useState<Record<string,Choice[]>>({});const [checked,setChecked]=useState<Record<string,boolean>>({});const [index,setIndex]=useState(0);const [wrongOnly,setWrongOnly]=useState(false);
 const load=async()=>{try{const d=await request('/api/quizzes');setDecks(d.decks);}catch(e){setError((e as Error).message);}};
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!decks.length)return;const resume:Record<string,number>={};for(const d of decks){const saved=readProgress(d.id);if(saved)resume[d.id]=saved.questionIds.length;}setSavedProgress(resume);setStudiedCounts(Object.fromEntries(decks.map(d=>[d.id,new Set(readStudied(d.id).filter(id=>d.questions.some(q=>q.id===id))).size])));},[decks]);
 useEffect(()=>{
  if((screen!=='quiz'&&screen!=='result')||!deck||!items.length)return;
  const progress:SavedProgress={deckId:deck.id,questionIds:items.map(it=>it.q.id),choiceOrders:Object.fromEntries(items.map(it=>[it.q.id,it.choices])) as Record<string,Choice[]>,picked,checked,index,wrongOnly,updatedAt:Date.now()};
  try{localStorage.setItem(storageKey(deck.id),JSON.stringify(progress));setSavedProgress(x=>({...x,[deck.id]:items.length}));}catch{/* browser storage blocked */}
 },[screen,deck,items,picked,checked,index,wrongOnly]);

 const close=()=>{setScreen('home');setError('');setNotice('');setDeck(null);void load();};
 const edit=(d:Deck)=>{setDeck(d);setDraft(structuredClone(d.questions).map(q=>({...q,options:Object.fromEntries(C.map(c=>[c,q.options[c]||''])) as Record<Choice,string>,answer:answerOf(q),multiple:Boolean(q.multiple)||answerOf(q).length>1})));setTitle(d.title);setSubject(d.subject);setEditing(true);setError('');setScreen('edit');};
 const start=(d:Deck,onlyWrong=false)=>{
  const errorIds=onlyWrong?d.questions.filter(q=>answerOf(q).length&&!equalsAnswer(picked[q.id]||[],answerOf(q))).map(q=>q.id):null;
  let qs=d.questions.filter(q=>errorIds===null||errorIds.includes(q.id));
  if(!qs.length){setNotice('Không có câu sai để luyện lại.');return;}
  if(!onlyWrong&&studyMode==='batch'){
   if(!allowRepeat){
    const seen=new Set(readStudied(d.id));
    qs=qs.filter(q=>!seen.has(q.id));
    if(!qs.length){setNotice('Bạn đã lấy hết câu của bộ đề ở chế độ Không trùng. Nhấn “Xóa lịch sử lượt” để học lại từ đầu, hoặc chọn Cho phép trùng.');return;}
   }
   qs=shuffle(qs).slice(0,batchSize);
  } else if(mixQuestions)qs=shuffle(qs);
  if(!onlyWrong&&studyMode==='batch'&&!allowRepeat){
   try{const ids=[...new Set([...readStudied(d.id),...qs.map(q=>q.id)])];localStorage.setItem(studiedKey(d.id),JSON.stringify(ids));setStudiedCounts(x=>({...x,[d.id]:ids.length}));}catch{/* localStorage bị chặn */}
  }
  setItems(qs.map(q=>({q,choices:mixAnswers&&!q.imageUrl?shuffle(available(q)):available(q)})));
  setPicked({});setChecked({});setIndex(0);setDeck(d);setWrongOnly(onlyWrong);setScreen('quiz');
  setNotice(!onlyWrong&&studyMode==='batch'?`Lượt ôn mới: ${qs.length} câu · ${allowRepeat?'Cho phép trùng':'Không trùng với các lượt đã lấy'}.`:'');setError('');
 };
 const startNew=(d:Deck)=>{
  if(readProgress(d.id)&&!confirm('Bắt đầu lượt mới sẽ thay thế tiến trình đang lưu của bộ đề này. Tiếp tục?'))return;
  start(d);
 };
 const clearStudied=(d:Deck)=>{
  if(!confirm(`Xóa lịch sử các lượt Không trùng của “${d.title}”? Tiến trình làm bài hiện tại vẫn được giữ.`))return;
  try{localStorage.removeItem(studiedKey(d.id));}catch{}
  setStudiedCounts(x=>({...x,[d.id]:0}));setNotice(`Đã xóa lịch sử lượt của ${d.title}.`);
 };
 const resume=(d:Deck)=>{
  const saved=readProgress(d.id);if(!saved){start(d);return;}
  const lookup=new Map(d.questions.map(q=>[q.id,q]));
  const restored=saved.questionIds.map(id=>lookup.get(id)).filter((q):q is Question=>Boolean(q)).map(q=>({q,choices:(saved.choiceOrders[q.id]||available(q)).filter(c=>available(q).includes(c))}));
  if(!restored.length){start(d);return;}
  setDeck(d);setItems(restored);setPicked(saved.picked||{});setChecked(saved.checked||{});setIndex(Math.min(Math.max(0,saved.index||0),restored.length-1));setWrongOnly(Boolean(saved.wrongOnly));setScreen('quiz');setNotice('Đã khôi phục tiến trình trên trình duyệt này.');setError('');
 };
 const reset=()=>{
  if(!deck||!confirm('Xóa các lựa chọn trong lượt làm hiện tại và bắt đầu lại từ câu 1?'))return;
  try{localStorage.removeItem(storageKey(deck.id));}catch{}
  setPicked({});setChecked({});setIndex(0);setWrongOnly(false);setScreen('quiz');setNotice('Đã đặt lại tiến trình làm bài.');
 };
 const importImageDoc=async()=>{
  if(!imageDoc){setError('Hãy chọn file Word chứa ảnh.');return;}
  if(imageDoc.size>4*1024*1024){setError(`File Word ${(imageDoc.size/1024/1024).toFixed(2)} MB vượt 4 MB. Hãy nén ảnh hoặc chia Word thành nhiều file nhỏ.`);return;}
  if(imageKeys&&imageKeys.size>4*1024*1024){setError('File đáp án vượt 4 MB.');return;}
  if(imageDoc.size+(imageKeys?.size||0)+new TextEncoder().encode(imageKeyText).length>4*1024*1024){setError('Tổng dữ liệu Word + đáp án vượt 4 MB. Hãy chia nhỏ file.');return;}
  setLoading(true);setError('');setNotice('');
  try{
   const fd=new FormData();fd.append('docx',imageDoc);
   if(imageKeys)fd.append('answers',imageKeys);
   if(imageKeyText.trim())fd.append('answerText',imageKeyText);
   const res=await request('/api/image-word',{method:'POST',body:fd});
   setDraft(res.questions as Question[]);setDeck(null);setEditing(false);
   setTitle(imageDoc.name.replace(/\.docx$/i,''));setSubject(imageDoc.name.split('_')[0]||'Khác');setScreen('edit');
   setNotice(`Đã lấy ${res.questions.length} ảnh; ${res.matched} câu được ghép đáp án. ${res.missing} câu cần chọn đáp án thủ công. Kiểm tra trước khi Lưu.`);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 };
 const importJson=async(file:File)=>{
  setError('');setNotice('');setLoading(true);
  try{
   if(!file.name.toLowerCase().endsWith('.json'))throw Error('Hãy chọn file QuizStudy dạng .json.');
   if(file.size>12*1024*1024)throw Error('File quá lớn (tối đa 12 MB).');
   const obj:unknown=JSON.parse(await file.text());
   if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON không phải bộ đề QuizStudy.');
   const data=obj as Record<string,unknown>;
   if(!Array.isArray(data.questions)||!data.questions.length||data.questions.length>2000)throw Error('File thiếu danh sách questions hoặc vượt quá 2000 câu.');
   const parsed:Question[]=data.questions.map((raw:unknown,i:number)=>{
    if(!raw||typeof raw!=='object')throw Error(`Câu ${i+1} không hợp lệ.`);
    const q=raw as Record<string,unknown>;
    const opts=q.options;
    if(typeof q.text!=='string'||!q.text.trim()||!opts||typeof opts!=='object'||Array.isArray(opts))throw Error(`Câu ${i+1} thiếu nội dung hoặc options.`);
    const options=Object.fromEntries(C.map(k=>[k,typeof (opts as Record<string,unknown>)[k]==='string'?(opts as Record<string,string>)[k]:''])) as Record<Choice,string>;
    if(available({options} as Question).length<2)throw Error(`Câu ${i+1} phải có ít nhất 2 lựa chọn.`);
    const rawAnswer=q.answer;
    const a=Array.isArray(rawAnswer)?rawAnswer:(typeof rawAnswer==='string'?(rawAnswer.match(/[A-H]/gi)||[]):[]);
    const answer=[...new Set(a.map(x=>String(x).toUpperCase()))].filter((x):x is Choice=>C.includes(x as Choice));
    const invalid=answer.filter(x=>!options[x]?.trim());
    if(invalid.length)throw Error(`Câu ${i+1}: đáp án ${invalid.join(', ')} không có lựa chọn tương ứng.`);
    return {id:typeof q.id==='string'&&q.id.length<100?q.id:`json-${i+1}-${crypto.randomUUID()}`,number:Number(q.number)||i+1,text:q.text,options,answer,multiple:Boolean(q.multiple)||answer.length>1,imageUrl:typeof q.imageUrl==='string'?q.imageUrl:undefined};
   });
   const numbers=new Set<number>();
   for(const q of parsed){if(numbers.has(q.number))throw Error(`Số câu ${q.number} bị trùng trong JSON.`);numbers.add(q.number);}
   setDraft(parsed);setDeck(null);setEditing(false);
   setTitle(typeof data.title==='string'&&data.title.trim()?data.title:file.name.replace(/\.json$/i,''));
   setSubject(typeof data.subject==='string'&&data.subject.trim()?data.subject:(file.name.split('_')[0]||'Khác'));
   setScreen('edit');
   const missing=parsed.filter(q=>!answerOf(q).length).length;
   const multi=parsed.filter(q=>q.multiple).length;
   setNotice(`Đã đọc ${parsed.length} câu từ JSON; ${multi} câu chọn nhiều; ${missing} câu chưa có đáp án. Kiểm tra rồi bấm Lưu để đăng chung lên Supabase.`);
  }catch(e){setError('Không nhập được JSON: '+(e as Error).message);}finally{setLoading(false);}
 };
 const exportJson=(d:Deck)=>{
  const obj={format:'quizstudy-v1',title:d.title,subject:d.subject,questions:d.questions.map(q=>({number:q.number,text:q.text,options:Object.fromEntries(available(q).map(c=>[c,q.options[c]])),answer:answerOf(q),multiple:q.multiple,...(q.imageUrl?{imageUrl:q.imageUrl}:{})}))};
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(d.subject||'QuizStudy').replace(/[^a-z0-9_-]/gi,'_')+'_QuizStudy.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
 };
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
    const valid=raw.filter(c=>Boolean(q.options[c]?.trim()));
    if(valid.length!==raw.length)invalid++;
    if(!valid.length)return q;
    applied++;return {...q,answer:valid,multiple:valid.length>1};
   });
   setDraft(updated);setNotice(`Đọc được ${result.count} số câu trong file, ghép được ${applied}/${draft.length} câu của bộ đề.${invalid?` Có ${invalid} câu chỉ đến lựa chọn không tồn tại.`:''} ${updated.filter(q=>!answerOf(q).length).length} câu vẫn thiếu đáp án. Hãy kiểm tra và bấm Lưu bộ đề.`);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 };
 const update=(n:number,patch:Partial<Question>)=>setDraft(prev=>prev.map((q,i)=>i===n?{...q,...patch}:q));
 const changeOption=(n:number,c:Choice,value:string)=>setDraft(prev=>prev.map((q,i)=>i===n?{...q,options:{...q.options,[c]:value}}:q));
 const save=async()=>{setError('');if(!title.trim()){setError('Bạn cần nhập tên bộ đề.');return;}if(!draft.length){setError('Bộ đề đang trống.');return;}setLoading(true);try{const url=editing&&deck?`/api/quizzes/${deck.id}`:'/api/quizzes';await request(url,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,subject,questions:draft})});setExamFiles([]);setKeyFiles([]);setExamText('');setKeyText('');close();}catch(e){setError((e as Error).message);}finally{setLoading(false);}};
 const remove=async(d:Deck)=>{if(!confirm(`Xóa vĩnh viễn bộ đề "${d.title}"? Mọi người sẽ không còn thấy bộ đề này.`))return;setLoading(true);setError('');try{await request(`/api/quizzes/${d.id}`,{method:'DELETE'});if(deck?.id===d.id)close();else await load();}catch(e){setError((e as Error).message);}finally{setLoading(false);}};
 const done=items.reduce((acc,item)=>acc+((picked[item.q.id]||[]).length?1:0),0);
 const scored=items.filter(item=>answerOf(item.q).length>0);const correct=scored.filter(item=>equalsAnswer(picked[item.q.id]||[],answerOf(item.q))).length;
 const misses=scored.filter(item=>!equalsAnswer(picked[item.q.id]||[],answerOf(item.q)));
 const visibleDecks=useMemo(()=>decks.filter(d=>(d.title+' '+d.subject).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[decks,query]);
 const copy=async(q:Question)=>{try{await navigator.clipboard.writeText(q.imageUrl?`${q.text}\n${q.imageUrl}`:`${q.text}\n${available(q).map(c=>`${c}. ${q.options[c]}`).join('\n')}`);setNotice(q.imageUrl?'Đã sao chép link ảnh câu hỏi.':'Đã sao chép câu hỏi.');}catch{setError('Trình duyệt không cho sao chép tự động.');}};
 const current=items[index];
 return <main className="layout">
  <header className="nav"><div className="logo" onClick={close} style={{cursor:'pointer'}}><BookOpen size={23} style={{verticalAlign:'middle',marginRight:8}}/>Quiz<span>Study</span></div><div className="header-actions"><span className="tag"><Cloud size={13} style={{verticalAlign:'middle',marginRight:5}}/>Lưu chung • Không dùng AI</span><button type="button" className="theme-switch" aria-label={theme==='dark'?'Chuyển sang chế độ sáng':'Chuyển sang chế độ tối'} title={theme==='dark'?'Chế độ sáng':'Chế độ tối'} aria-pressed={theme==='dark'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}<span>{theme==='dark'?'Sáng':'Tối'}</span></button></div></header>
  {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {screen==='home'&&<>
   <section className="hero"><h1>Ôn trắc nghiệm theo cách của bạn</h1><p>Upload đề + đáp án một lần. Cả nhóm có thể học, thêm, sửa và xóa từ mọi thiết bị.</p></section>
   <div className="row between" style={{marginBottom:18}}><h2 style={{margin:0}}>Thư viện đề thi ({decks.length})</h2><button className="button" onClick={()=>{setScreen('import');setError('');setNotice('');}}><FilePlus2 size={17}/>Thêm bộ đề</button></div>
   <div className="row" style={{marginBottom:16}}><div className="search"><Search size={17}/><input placeholder="Tìm môn học, tên bộ đề..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
   <div className="panel study-settings"><h3 style={{marginTop:0}}>Cài đặt lượt ôn tập</h3>
    <div className="study-mode-row"><label className="toggle"><input type="radio" name="study-mode" checked={studyMode==='full'} onChange={()=>setStudyMode('full')}/>Làm toàn bộ đề (như cũ)</label><label className="toggle"><input type="radio" name="study-mode" checked={studyMode==='batch'} onChange={()=>setStudyMode('batch')}/>Luyện theo lượt</label></div>
    {studyMode==='batch'&&<div className="batch-controls"><label className="field" style={{margin:0}}><span className="field-title">Số câu mỗi lượt</span><select className="textinput" value={batchSize} onChange={e=>setBatchSize(Number(e.target.value))}>{[10,20,30,50,100,150].map(n=><option key={n} value={n}>{n} câu</option>)}</select></label><div className="batch-repeat"><span className="field-title">Cách chọn câu</span><label className="toggle"><input type="radio" name="batch-repeat" checked={!allowRepeat} onChange={()=>setAllowRepeat(false)}/>Không trùng – chỉ lấy câu chưa từng được đưa vào lượt trước</label><label className="toggle"><input type="radio" name="batch-repeat" checked={allowRepeat} onChange={()=>setAllowRepeat(true)}/>Cho phép trùng – chọn ngẫu nhiên để kiểm tra lại</label></div></div>}
    <div className="row" style={{gap:22,marginTop:18}}><label className="toggle"><input type="checkbox" checked={mixQuestions} onChange={e=>setMixQuestions(e.target.checked)}/>Trộn thứ tự câu hỏi (toàn bộ đề)</label><label className="toggle"><input type="checkbox" checked={mixAnswers} onChange={e=>setMixAnswers(e.target.checked)}/>Trộn A/B/C/D (chỉ đề chữ)</label></div>
    <p className="muted" style={{marginBottom:0}}>Không trùng: câu được đánh dấu đã lấy ngay khi tạo lượt, kể cả bạn chưa hoàn thành; lịch sử tách biệt cho từng bộ đề trên trình duyệt này. Cho phép trùng: các lượt có thể chứa câu đã học, nhưng không lặp câu trong cùng một lượt. Bộ đề gốc trên Supabase không bị thay đổi.</p></div>
   <div className="decks">{visibleDecks.map(d=><article className="panel deck" key={d.id} style={{marginBottom:0}}><div><strong>{d.title}</strong><small>{d.subject||'Khác'} · {d.questions.length} câu · {d.questions.filter(x=>answerOf(x).length>0).length} đáp án · Đã lấy {Math.min(studiedCounts[d.id]||0,d.questions.length)}/{d.questions.length} câu không trùng</small></div><div className="topActions">{savedProgress[d.id]&&<button className="button ghost small" onClick={()=>resume(d)}>Tiếp tục ({savedProgress[d.id]} câu)</button>}<button className="button small" onClick={()=>startNew(d)}>{studyMode==='batch'?`Lượt mới (${Math.min(batchSize,allowRepeat?d.questions.length:Math.max(0,d.questions.length-(studiedCounts[d.id]||0)))} câu)`:'Làm toàn bộ đề'}</button>{(studiedCounts[d.id]||0)>0&&<button className="button ghost small" onClick={()=>clearStudied(d)} title="Chỉ xóa lịch sử lượt Không trùng của bộ đề này">Xóa lịch sử lượt</button>}<button className="button ghost small" onClick={()=>exportJson(d)} title="Tải về JSON để sao lưu"><Download size={15}/> JSON</button><button className="button ghost small" onClick={()=>edit(d)} title="Sửa đề"><Pencil size={15}/> Sửa</button><button className="button danger small" disabled={loading} onClick={()=>remove(d)} title="Xóa đề"><Trash2 size={15}/></button></div></article>)}{visibleDecks.length===0&&<div className="panel muted">{decks.length?'Không tìm thấy bộ đề phù hợp.':'Chưa có bộ đề. Hãy nhấn “Thêm bộ đề” để bắt đầu.'}</div>}</div>
  </>}
  {screen==='import'&&<div className="quizWrap"><button className="button ghost small" onClick={close}><ArrowLeft size={15}/>Thư viện</button><div className="panel" style={{marginTop:18}}><h2>Thêm đề mới</h2><div className="answer-import"><strong>Nhập 1 file JSON QuizStudy (khuyên dùng)</strong><p className="muted">File đã gồm câu hỏi + lựa chọn + đáp án đơn/nhiều. Chọn một file, kiểm tra trước khi đăng. Không cần AI/API, không cần file đáp án riêng.</p><input type="file" accept=".json,application/json" disabled={loading} onChange={e=>{const f=e.target.files?.[0];if(f)void importJson(f);e.currentTarget.value="";}}/></div><hr className="divider"/><div className="answer-import"><strong>Nhập Word dạng ảnh (không OCR, không AI)</strong>
   <p className="muted">Word theo mẫu: ghi Câu 1, chèn 1 ảnh chứa câu hỏi và A/B/C/D, rồi Câu 2, chèn ảnh tiếp theo. Có thể kèm file đáp án hoặc nhập sau.</p>
   <label className="field"><span className="field-title">File Word chứa ảnh câu hỏi (.docx)</span><input type="file" accept=".docx" onChange={e=>setImageDoc(e.target.files?.[0]||null)}/></label>
   <label className="field"><span className="field-title">File đáp án (tùy chọn)</span><input type="file" accept=".docx,.txt,.csv" onChange={e=>setImageKeys(e.target.files?.[0]||null)}/></label>
   <textarea rows={2} value={imageKeyText} onChange={e=>setImageKeyText(e.target.value)} placeholder="Hoặc dán đáp án: 1.B 2.A,C 3.D"/>
   <button className="button wide" onClick={importImageDoc} disabled={loading||!imageDoc}><Upload size={16}/>{loading?'Đang xử lý ảnh...':'Đọc Word ảnh để ôn tập'}</button>
   <p className="muted">Ảnh lưu trong Supabase Storage. Chỉ hỗ trợ DOCX chứa ảnh được chèn thật; không hỗ trợ DOC cũ hoặc hình liên kết ngoài.</p></div><hr className="divider"/><h3>Hoặc nhập theo cách cũ: đề + đáp án</h3><p className="muted">Website tách câu hỏi A/B/C/D và ghép đáp án theo số thứ tự, hoàn toàn không gọi AI. Hỗ trợ DOCX, PDF có chữ, TXT, CSV và ZIP chứa các file đó. Không đọc được ảnh hoặc PDF scan.</p>
   <label className="field"><span className="field-title">1. File đề thi</span><div className="filezone"><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setExamFiles(Array.from(e.target.files||[]))}/><small>Chọn một hoặc nhiều file đề</small></div></label>
   <label className="field"><span className="field-title">2. File đáp án</span><div className="filezone"><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setKeyFiles(Array.from(e.target.files||[]))}/><small>Ví dụ: 1.A 2.C 3.A,C (chọn nhiều đáp án)</small></div></label>
   <details><summary>Hoặc dán văn bản đề và đáp án trực tiếp</summary><label className="field"><span className="field-title">Nội dung đề</span><textarea rows={7} value={examText} onChange={e=>setExamText(e.target.value)} placeholder={'1. Câu hỏi...\nA. Đáp án A\nB. Đáp án B\nC. Đáp án C\nD. Đáp án D'}/></label><label className="field"><span className="field-title">Nội dung đáp án</span><textarea rows={4} value={keyText} onChange={e=>setKeyText(e.target.value)} placeholder="1.B 2.A,C 3.B và D"/></label></details>
   <div className="notice">Nếu đề là ảnh, hãy chuyển sang văn bản bằng ChatGPT trước rồi dán hoặc tải file Word vào đây. Hãy kiểm tra các câu nhận diện trước khi đăng.</div>
   <button className="button wide" onClick={importing} disabled={loading}><Upload size={17}/>{loading?'Đang đọc file...':'Đọc đề và ghép đáp án'}</button>
  </div></div>}
  {screen==='edit'&&<div className="quizWrap"><button className="button ghost small" onClick={close}><ArrowLeft size={15}/>Thư viện</button><div className="panel" style={{marginTop:18}}><h2>{editing?'Chỉnh sửa bộ đề':'Kiểm tra trước khi đăng đề'}</h2><label className="field"><span className="field-title">Tên bộ đề</span><input className="textinput" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field"><span className="field-title">Tên môn học</span><input className="textinput" value={subject} onChange={e=>setSubject(e.target.value)}/></label><div className="row between"><strong>{draft.length} câu hỏi</strong><span className="badge">{draft.filter(noAnswer).length} câu chưa có đáp án</span></div><p className="muted">Bạn có thể sửa nội dung, để trống lựa chọn không có trong đề và chọn đáp án đúng.</p>
  <div className="answer-import"><strong>Nhập lại file đáp án (không cần tải lại đề)</strong><p className="muted">Nhận dạng 1.A, 2 B, 3.B,D hoặc Câu 4: AC. Chỉ cập nhật câu khớp số, không xóa đáp án cũ của câu không tìm thấy.</p><input type="file" multiple accept=".docx,.pdf,.txt,.md,.csv,.zip" onChange={e=>setReplaceKeyFiles(Array.from(e.target.files||[]))}/><textarea rows={3} value={replaceKeyText} onChange={e=>setReplaceKeyText(e.target.value)} placeholder="Hoặc dán đáp án: 1.A 2.C 3.B,D"/><button className="button ghost" disabled={loading} onClick={replaceAnswers}>Đọc và ghép lại đáp án</button></div>
  {draft.map((q,i)=><div className="editquestion" key={q.id}><div className="row between"><strong>Câu {q.number}</strong><button className="button danger small" onClick={()=>setDraft(x=>x.filter((_,j)=>j!==i))}><Trash2 size={14}/>Bỏ</button></div><textarea aria-label={`Nội dung câu ${q.number}`} rows={3} value={q.text} onChange={e=>update(i,{text:e.target.value})}/>{q.imageUrl&&<><img className="question-image" src={q.imageUrl} alt={`Ảnh câu hỏi ${q.number}`}/><p className="muted">Chọn đáp án bằng ô bên dưới; A/B/C/D đã có trong ảnh, không cần gõ lại. Không trộn lựa chọn của câu ảnh.</p></>}{!q.imageUrl&&C.map(c=><label className="editoption" key={c}><strong>{c}.</strong><input value={q.options[c]||''} aria-label={`Câu ${q.number} lựa chọn ${c}`} onChange={e=>changeOption(i,c,e.target.value)}/></label>)}<label className="toggle" style={{marginTop:12}}><input type="checkbox" checked={q.multiple||answerOf(q).length>1} onChange={e=>update(i,{multiple:e.target.checked,answer:e.target.checked?answerOf(q):answerOf(q).slice(0,1)})}/> Câu chọn nhiều đáp án</label><div className="field"><span className="field-title">Đáp án đúng {q.multiple?'(tích tất cả đáp án đúng)':'(chọn một)'}</span><div className="row" style={{flexWrap:'wrap'}}>{available(q).map(c=><label className="toggle" key={c}><input type={q.multiple?'checkbox':'radio'} name={`answer-${q.id}`} checked={answerOf(q).includes(c)} onChange={e=>{const next=q.multiple?(e.target.checked?[...answerOf(q),c]:answerOf(q).filter(x=>x!==c)):(e.target.checked?[c]:[]);update(i,{answer:[...new Set(next)]});}}/> {c}</label>)}<button className="button ghost small" onClick={()=>update(i,{answer:[]})}>Xóa đáp án</button></div></div></div>)}
  <button className="button ghost" onClick={()=>setDraft(x=>[...x,{id:crypto.randomUUID(),number:Math.max(0,...x.map(q=>q.number))+1,text:'Câu hỏi mới',options:{A:'Phương án A',B:'Phương án B',C:'Phương án C',D:'Phương án D',E:'',F:'',G:'',H:''},answer:[],multiple:false}])}>+ Thêm câu thủ công</button>
  <hr className="divider"/><button className="button wide" onClick={save} disabled={loading}><Save size={17}/>{loading?'Đang lưu...':'Lưu bộ đề lên thư viện chung'}</button>{editing&&deck&&<button className="button danger wide" style={{marginTop:10}} onClick={()=>remove(deck)}><Trash2 size={16}/>Xóa bộ đề</button>}</div></div>}
  {screen==='quiz'&&current&&<div className="quizWrap"><div className="row between"><button className="button ghost small" onClick={close}><ArrowLeft size={15}/>Thư viện</button><div className="row"><span className="badge">{done}/{items.length} câu đã chọn · tự lưu</span><button className="button danger small" onClick={reset}><RotateCcw size={14}/>Reset</button></div></div><div className="panel" style={{marginTop:18}}><div className="row between"><strong>{deck?.title}</strong><span className="muted">Câu {index+1}/{items.length}</span></div><div className="progress"><div style={{width:`${(done/items.length)*100}%`}}/></div><div className="question">{current.q.text}</div>{current.q.imageUrl&&<img className="question-image" src={current.q.imageUrl} alt={`Câu ${current.q.number} - ảnh đề gốc`}/> }<p className="muted">{current.q.multiple||answerOf(current.q).length>1?'Chọn tất cả đáp án đúng (có thể chọn nhiều).':'Chọn một đáp án.'}</p>{current.choices.map((c,i)=>{const chosen=(picked[current.q.id]||[]).includes(c);const revealed=Boolean(checked[current.q.id]);const right=answerOf(current.q).includes(c);return <button key={c} disabled={revealed} className={'choice '+(revealed?(right?'correct':chosen?'wrong':''):(chosen?'active':''))} onClick={()=>{if(revealed)return;const multi=current.q.multiple||answerOf(current.q).length>1;setPicked(x=>{const old=x[current.q.id]||[];return {...x,[current.q.id]:multi?(old.includes(c)?old.filter(v=>v!==c):[...old,c]):[c]};});if(!multi)setChecked(x=>({...x,[current.q.id]:true}));}}><span className="letter">{C[i]}</span><span>{current.q.imageUrl?`Chọn ${c}`:current.q.options[c]}</span>{revealed?(right?' ✓':chosen?' ✗':''):chosen?' ✓':''}</button>;})}{!(checked[current.q.id])&&(current.q.multiple||answerOf(current.q).length>1)&&<button className="button" disabled={!(picked[current.q.id]||[]).length} onClick={()=>setChecked(x=>({...x,[current.q.id]:true}))}>Kiểm tra đáp án</button>}{checked[current.q.id]&&<div className={'answer-feedback '+(answerOf(current.q).length===0?'ungraded':equalsAnswer(picked[current.q.id]||[],answerOf(current.q))?'is-correct':'is-wrong')} role="status"><strong>{answerOf(current.q).length===0?'Câu này chưa có đáp án trong bộ đề.':equalsAnswer(picked[current.q.id]||[],answerOf(current.q))?'✓ Chính xác!':'✗ Chưa đúng!'}</strong>{answerOf(current.q).length>0&&<div>Đáp án đúng: <b>{current.choices.map((c,i)=>answerOf(current.q).includes(c)?C[i]:null).filter(Boolean).join(', ')}</b></div>}</div>}<div className="row between" style={{marginTop:20}}><button className="button ghost" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Câu trước</button>{index<items.length-1?<button className="button" onClick={()=>setIndex(i=>i+1)}>Câu sau</button>:<button className="button" onClick={()=>setScreen('result')}><CheckCircle2 size={16}/>Nộp bài</button>}</div><hr className="divider"/><div className="navqs">{items.map((v,i)=><button key={v.q.id} className={(i===index?'current ':picked[v.q.id]?'done':'')} onClick={()=>setIndex(i)}>{i+1}</button>)}</div><div className="row between"><button className="button ghost small" onClick={()=>void copy(current.q)}><Copy size={15}/>Sao chép câu hỏi</button><button className="button ghost small" onClick={()=>setScreen('result')}>Chấm bài ngay</button></div></div></div>}
  {screen==='result'&&<div className="quizWrap"><button className="button ghost small" onClick={close}><ArrowLeft size={15}/>Thư viện</button><div className="panel" style={{marginTop:18}}><h2>Kết quả {deck?.title}</h2><button className="button danger small" onClick={reset}><RotateCcw size={14}/>Reset tiến trình</button><div className="result">{correct}/{scored.length}</div><p className="muted">Đúng {correct} · Sai hoặc bỏ trống {misses.length} · {items.length-scored.length} câu chưa được gắn đáp án.</p><div className="row"><button className="button" onClick={()=>deck&&startNew(deck)}><RotateCcw size={16}/>{studyMode==='batch'?'Lượt ôn mới':'Làm lại cả đề'}</button>{misses.length>0&&<button className="button ghost" onClick={()=>{const subset=items.filter(x=>answerOf(x.q).length&&!equalsAnswer(picked[x.q.id]||[],answerOf(x.q)));setItems(subset.map(it=>({...it,choices:mixAnswers&&!it.q.imageUrl?shuffle(available(it.q)):available(it.q)})));setPicked({});setChecked({});setIndex(0);setWrongOnly(true);setScreen('quiz');}}><Shuffle size={16}/>Ôn câu sai ({misses.length})</button>}</div><hr className="divider"/><h2>Đối chiếu đáp án {wrongOnly?'(lượt ôn câu sai)':''}</h2>{items.map((it,i)=>{const q=it.q;const user=picked[q.id]||[];const correctAnswers=answerOf(q);const display=(arr:Choice[])=>arr.length?arr.map(a=>C[it.choices.indexOf(a)]).join(', '):'Chưa chọn';return <div key={q.id} className="review"><strong>Câu {q.number}. {q.text}</strong>{q.imageUrl&&<img className="question-image" src={q.imageUrl} alt={`Ảnh câu ${q.number}`}/>}<p className="muted">Bạn chọn: <b>{display(user)}</b> · Đáp án đúng: <b>{correctAnswers.length?display(correctAnswers):'Chưa có'}</b></p>{it.choices.map((c,j)=><div key={c} className={'review-option '+(correctAnswers.includes(c)?'success ':user.includes(c)?'bad':'')}>{C[j]}. {q.imageUrl?`Đáp án ${c}`:q.options[c]}{correctAnswers.includes(c)?' ✓':''}</div>)}<button className="button ghost small" style={{marginTop:12}} onClick={()=>void copy(q)}><Copy size={14}/>Sao chép câu hỏi để hỏi ChatGPT</button></div>;})}</div></div>}
  <footer className="muted" style={{textAlign:'center',marginTop:30}}>QuizStudy · Không cần Gemini/API · Bộ đề lưu trên Supabase, mọi người được quyền thêm, sửa, xóa.</footer>
 </main>;
}
