import type { SketchDocument, SketchDraft, SketchDraftMetadata, SketchRecovery } from './sketch-types.js';
const DATABASE = 'dsh-codex-sketches-v1'
const MAX_STORAGE = 32 * 1024 * 1024
const metadata = (kind: string, row: SketchDraft) => ({key:`${kind}:${row.id}`,kind,id:row.id,name:row.name,updated:row.updated,size:JSON.stringify(row).length})

export function sketchDrafts(action: 'list', value?: undefined): Promise<SketchDraftMetadata[]>;
export function sketchDrafts(action: 'get', value: string): Promise<SketchDraft | undefined>;
export function sketchDrafts(action: 'recover', value: string): Promise<SketchRecovery | undefined>;
export function sketchDrafts(action: 'save', value: SketchDraft, recoverySession?: string): Promise<SketchDraft>;
export function sketchDrafts(action: 'checkpoint', value: SketchRecovery): Promise<SketchRecovery>;
export function sketchDrafts(action: 'delete' | 'clearRecovery', value: string): Promise<void>;
export async function sketchDrafts(action: string, value?: unknown, recoverySession?: string): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve,reject) => {
    let blocked=false
    const request=indexedDB.open(DATABASE,2)
    request.onblocked=()=>{blocked=true;reject(Object.assign(Error('Close other sketch windows and retry'),{code:'SKETCH_STORAGE_BLOCKED'}))}
    request.onupgradeneeded=()=>{
      if(blocked){request.transaction!.abort();return}
      const db=request.result,tx=request.transaction!
      if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts',{keyPath:'id'})
      const meta=db.createObjectStore('metadata',{keyPath:'key'})
      db.createObjectStore('recovery',{keyPath:'id'})
      // One-time migration; subsequent list/save operations read only metadata.
      const cursor=tx.objectStore('drafts').openCursor()
      cursor.onsuccess=()=>{const row=cursor.result;if(row){meta.put(metadata('drafts',row.value));row.continue()}}
    }
    request.onsuccess=()=>{if(blocked){request.result.close();return}request.result.onversionchange=()=>request.result.close();resolve(request.result)}
    request.onerror=()=>reject(request.error)
  })
  try {
    return await new Promise<unknown>((resolve,reject) => {
      const write=['save','delete','checkpoint','clearRecovery'].includes(action)
      const tx=db.transaction(['drafts','metadata','recovery'],write?'readwrite':'readonly')
      const meta=tx.objectStore('metadata'),kind=['checkpoint','recover','clearRecovery'].includes(action)?'recovery':'drafts',store=tx.objectStore(kind)
      let result: unknown, failure: unknown
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(failure??tx.error??Error('Draft transaction aborted'))
      if(action==='get'||action==='recover'){const req=store.get(value as string);req.onsuccess=()=>{result=req.result};return}
      if(action==='delete'||action==='clearRecovery'){store.delete(value as string);meta.delete(`${kind}:${value}`);return}
      if(!['list','save','checkpoint'].includes(action)){tx.abort();return}
      const request=meta.getAll()
      request.onsuccess=()=>{
        const rows: SketchDraftMetadata[]=request.result
        if(action==='list'){result=rows.filter(row=>row.kind==='drafts').sort((a,b)=>b.updated-a.updated);return}
        const next=metadata(kind,value as SketchDraft),others=rows.filter(row=>row.key!==next.key && !(action==='save'&&recoverySession&&row.key===`recovery:${recoverySession}`))
        const code=others.filter(row=>row.kind===kind).length>=20?'SKETCH_DRAFT_LIMIT':others.reduce((n,row)=>n+row.size,0)+next.size>MAX_STORAGE?'SKETCH_STORAGE_LIMIT':null
        if(code){failure=Object.assign(Error('Draft storage limit reached'),{code});tx.abort();return}
        store.put(value);meta.put(next);if(action==='save'&&recoverySession){tx.objectStore('recovery').delete(recoverySession);meta.delete(`recovery:${recoverySession}`)}result=value
      }
    })
  } finally { db.close() }
}

export async function decodeSketchImages(doc: Pick<SketchDocument, 'layers'>, images: Map<string, HTMLImageElement>) {
  for(const layer of doc.layers) {
    const src=layer.image?.src
    if(!src || images.has(src))continue
    if(!src.startsWith('data:image/png;base64,') || src.length>8*1024*1024)throw Error('Invalid image')
    const image=new Image();image.src=src;await image.decode();images.set(src,image)
  }
}

export async function importSketchImage(file: File) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>20*1024*1024)throw Error('Image must be PNG, JPEG or WebP under 20 MB')
  const bitmap=await createImageBitmap(file)
  try {
    if(bitmap.width*bitmap.height>32*1024*1024)throw Error('Image too large')
    const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
    return {src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height}
  } finally {bitmap.close()}
}
