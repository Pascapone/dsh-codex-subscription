import assert from 'node:assert/strict'
import test from 'node:test'
import { initializeCanvas, readPsd, writePsd } from 'ag-psd'
import { createSketchDocumentLifecycle } from '../src/sketch-document-lifecycle.js'
import { createSketchSessionState } from '../src/sketch-session-state.js'
import { exportSketchPsd, encodeSketchDocument } from '../src/sketch-formats.js'
import { readSource } from './source-contract.js'

// ponytail: a single-pixel canvas verifies wiring and real PSD I/O; browser rendering needs a browser test.
class PixelData {
  data: Uint8ClampedArray; width: number; height: number
  constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
    this.width = typeof data==='number'?data:width
    this.height = typeof data==='number'?width:height!
    this.data = typeof data==='number'?new Uint8ClampedArray(this.width*this.height*4):data
  }
}
class PixelCanvas {
  width=1; height=1; pixels=new PixelData(1,1)
  getContext() { return {globalAlpha:1, fillStyle:'', createImageData:(width: number,height: number)=>new PixelData(width,height),
    putImageData:(data: PixelData)=>{this.pixels=data}, getImageData:()=>this.pixels,
    drawImage:(source: PixelCanvas)=>{this.pixels=source.pixels}, fillRect:()=>{this.pixels=new PixelData(new Uint8ClampedArray([255,255,255,255]),1,1)},
  } }
  toDataURL() { return 'data:image/png;base64,'+Buffer.from(this.pixels.data).toString('base64') }
}
const workerSource = (await readSource(new URL('../src/sketch-psd-worker.js',import.meta.url))).replace(/^import .*$/gm,'')
class CodecWorker {
  onmessage?: (event: {data: unknown})=>void
  terminate() {}
  postMessage(data: unknown) {
    const self: {onmessage?: (event: {data: unknown})=>void; postMessage(value: unknown): void} = {
      postMessage:value=>queueMicrotask(()=>this.onmessage?.({data:value})),
    }
    new Function('initializeCanvas','readPsd','writePsd','self','OffscreenCanvas','ImageData',workerSource)(initializeCanvas,readPsd,writePsd,self,PixelCanvas,PixelData)
    self.onmessage!({data})
  }
}

test('binary PSD imports through the lifecycle and exports through the actual shared studio path', async () => {
  const descriptors = new Map(['Worker','document','ImageData'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]))
  try {
    Object.defineProperty(globalThis,'Worker',{configurable:true,value:CodecWorker})
    Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new PixelCanvas()}})
    Object.defineProperty(globalThis,'ImageData',{configurable:true,value:PixelData})
    const psd = Buffer.alloc(43)
    psd.write('8BPS'); psd.writeUInt16BE(1,4); psd.writeUInt16BE(3,12)
    psd.writeUInt32BE(1,14); psd.writeUInt32BE(1,18); psd.writeUInt16BE(8,22); psd.writeUInt16BE(3,24); psd[40]=255
    const state = createSketchSessionState()
    const lifecycle = createSketchDocumentLifecycle(state,{sessionId:'psd-test',t:key=>key,
      schedule(){},checkpoint(){},cache:{current:new Map()},setSelection(){},setTextEdit(){},setRecovered(){},store:(async()=>assert.fail('unexpected draft storage')) as NonNullable<Parameters<typeof createSketchDocumentLifecycle>[1]['store']>,decodeImages:async()=>{},
    })
    const file = new File([psd],'RED.PSD')
    Object.defineProperty(file,'text',{value:()=>assert.fail('binary PSD must not use JSON/text decoding')})
    await lifecycle.importImage(file)
    assert.equal(state.doc.current.width,1)
    assert.equal(state.doc.current.layers[0].name,'Background')
    assert.equal(state.dirty.current,true)
    const image = new PixelCanvas()
    image.pixels=new PixelData(new Uint8ClampedArray([255,0,0,255]),1,1)
    const source = await readSource(new URL('../src/sketch-studio.jsx',import.meta.url))
    const body = /const exportFile = (async \(format = 'png'\) => \{[\s\S]*?\n  \})/.exec(source)?.[1]
    assert.ok(body,'exercise the actual shared export function')
    const encode = new Function('env',`with(env){return (${body})}`)({paint(){},doc:state.doc,images:{current:new Map([[state.doc.current.layers[0].image!.src,image]])},canvas:{current:image},exportSketchPsd,encodeSketchDocument}) as (format: string)=>Promise<{blob: Blob;extension: string}>
    const result = await encode('psd')
    assert.equal(result.extension,'psd')
    assert.equal(result.blob.type,'image/vnd.adobe.photoshop')
    const decoded = readPsd(await result.blob.arrayBuffer(),{useImageData:true,skipThumbnail:true})
    assert.equal(decoded.width,1)
    assert.equal(decoded.children?.[0].name,'Background')
    assert.deepEqual([...decoded.children![0].imageData!.data],[255,0,0,255])
    const ui = await readSource(new URL('../src/sketch-files.jsx',import.meta.url))
    assert.match(ui,/\['psd', 'PSD'\]/)
    assert.equal((await encode('draft')).extension,'dsh-sketch.json')
    await assert.rejects(encode('unknown'),/Unsupported format/)
    const before = state.doc.current
    await assert.rejects(lifecycle.importImage(new File(['invalid'],'bad.psd')))
    assert.equal(state.doc.current,before,'failed PSD decoding preserves the current document')
  } finally {
    for (const [key,descriptor] of descriptors) {
      if(descriptor) Object.defineProperty(globalThis,key,descriptor)
      else Reflect.deleteProperty(globalThis,key)
    }
  }
})
