'use client';
import {useEffect,useState} from 'react';
import {Maximize2,Minus,Plus,RotateCcw,X} from 'lucide-react';

/** Displays the original image untouched. Zooming changes only its presentation. */
export default function ZoomableImage({src,alt}:{src:string;alt:string}){
 const [open,setOpen]=useState(false);
 const [zoom,setZoom]=useState(100);
 useEffect(()=>{
  if(!open)return;
  const handleKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setOpen(false);
   if(event.key==='+'||event.key==='=')setZoom(value=>Math.min(400,value+25));
   if(event.key==='-')setZoom(value=>Math.max(50,value-25));
  };
  document.addEventListener('keydown',handleKey);
  return()=>document.removeEventListener('keydown',handleKey);
 },[open]);
 const close=()=>{setOpen(false);setZoom(100);};
 return <>
  <button type="button" className="image-zoom-trigger" onClick={()=>{setZoom(100);setOpen(true);}} title="Nhấn để phóng to ảnh" aria-label={`Phóng to ${alt}`}>
   <img className="question-image" src={src} alt={alt}/>
   <span className="image-zoom-hint"><Maximize2 size={15}/> Nhấn để phóng to</span>
  </button>
  {open&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`Xem ảnh: ${alt}`} onClick={close}>
   <div className="image-lightbox-toolbar" onClick={e=>e.stopPropagation()}>
    <button type="button" onClick={()=>setZoom(v=>Math.max(50,v-25))} disabled={zoom<=50} aria-label="Thu nhỏ"><Minus size={18}/></button>
    <input type="range" min="50" max="400" step="25" value={zoom} aria-label="Mức phóng to" onChange={e=>setZoom(Number(e.target.value))}/>
    <span className="image-zoom-value">{zoom}%</span>
    <button type="button" onClick={()=>setZoom(v=>Math.min(400,v+25))} disabled={zoom>=400} aria-label="Phóng to"><Plus size={18}/></button>
    <button type="button" onClick={()=>setZoom(100)} aria-label="Đưa về 100%"><RotateCcw size={18}/></button>
    <button type="button" onClick={close} aria-label="Đóng ảnh"><X size={21}/></button>
   </div>
   <div className="image-lightbox-viewport" onClick={e=>e.stopPropagation()}>
    <img src={src} alt={alt} draggable={false} style={{width:`${zoom}%`}}/>
   </div>
   <p className="image-lightbox-tip">Phóng to/thu nhỏ bằng +, − hoặc thanh trượt · Cuộn để xem phần ảnh bị khuất · Esc để đóng</p>
  </div>}
 </>;
}
