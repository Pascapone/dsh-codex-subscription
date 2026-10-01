type GrainTile = { pixels: number[][]; getContext(): { globalAlpha?: number; fillRect(x: number, y: number): void } };
import test from 'node:test'
import assert from 'node:assert/strict'
import { configureSketchBrush } from '../src/sketch-brushes.js'

test('legacy pencil keeps its original width and opacity; new tips use actual width', () => {
  const context={} as CanvasRenderingContext2D, stroke={shape:'pen',brush:'pencil',width:20,opacity:.8,pressure:.5,color:'#123456'}
  configureSketchBrush(context,stroke)
  assert.equal(context.lineWidth,5.5)
  assert.equal(context.globalAlpha,.8*.65)
  configureSketchBrush(context,{...stroke,brushVersion:2})
  assert.equal(context.lineWidth,10)
  assert.equal(context.globalAlpha,.8*.85)
  configureSketchBrush(context,{...stroke,brush:'marker',brushVersion:2})
  assert.equal(context.lineCap,'butt')
  configureSketchBrush(context,{...stroke,brush:'marker'})
  assert.equal(context.lineCap,'round')
})

test('pencil grain is cached and reproducible across repaint and export contexts', () => {
  const original=globalThis.document
  const tiles: GrainTile[]=[]
  globalThis.document={createElement:()=>{
    const pixels: number[][]=[],ctx: ReturnType<GrainTile['getContext']>={fillRect(x: number,y: number){pixels.push([x,y,this.globalAlpha!])}}
    const canvas={getContext:()=>ctx,pixels};tiles.push(canvas);return canvas
  }} as unknown as Document
  try {
    const context={createPattern:(canvas: GrainTile)=>canvas} as unknown as CanvasRenderingContext2D & {strokeStyle: GrainTile}, stroke={shape:'pen',brush:'pencil',brushVersion:2,width:12,color:'#112233'}
    configureSketchBrush(context,stroke)
    const first=context.strokeStyle
    configureSketchBrush(context,stroke)
    assert.equal(context.strokeStyle,first)
    assert.equal(tiles.length,1)
    assert.ok(first.pixels.length>2000&&first.pixels.length<4096)
    configureSketchBrush(context,{...stroke,color:'#445566'})
    assert.deepEqual(context.strokeStyle.pixels,first.pixels)
  } finally {if(original===undefined)delete (globalThis as unknown as {document?: Document}).document;else globalThis.document=original}
})
