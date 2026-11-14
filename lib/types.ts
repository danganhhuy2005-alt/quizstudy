export const CHOICES = ['A','B','C','D','E','F','G','H'] as const;
export type Choice = (typeof CHOICES)[number];
export type Question = {id:string;number:number;text:string;options:Record<Choice,string>;answer:Choice[];multiple:boolean;imageUrl?:string};
export type Deck = {id:string;title:string;subject:string;createdAt:string;questions:Question[]};
/** Backwards compatibility with decks saved when answer was a single letter. */
export function answerOf(q:Question):Choice[]{
 const a=q.answer as unknown;
 return Array.isArray(a)?a.filter((x):x is Choice=>typeof x==='string'&&CHOICES.includes(x as Choice)):
 typeof a==='string'&&CHOICES.includes(a as Choice)?[a as Choice]:[];
}
export function equalsAnswer(a:Choice[],b:Choice[]):boolean{
 return a.length===b.length&&a.every(x=>b.includes(x));
}
