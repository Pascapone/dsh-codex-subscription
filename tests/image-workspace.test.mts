import test from 'node:test'
import { createImageTrigger } from '../src/sketch-trigger.js'
import { watchImageTool } from '../src/image-tool-registration.js'
import assert from 'node:assert/strict'
import { attachImageFiles, appendImagePrompt } from '../src/image-composer.js'
import { imageFeaturePatch, assertImageOperation } from '../src/image-features.js'
import { resolveImageModel, validateImageQuality } from '../src/image-models.js'
import { sketchPoint, paintSketch } from '../src/sketch-document.js'
import { createSketchTrigger } from '../src/sketch-trigger.js'

test('image model quality combinations reject unsupported requests without downgrade', () => {
  assert.equal(resolveImageModel(), 'gpt-image-2')
  assert.throws(() => resolveImageModel('__proto__'))
  assert.throws(() => validateImageQuality('gpt-image-2', 'max'))
  for (const model of ['gpt-image-2.5-flare','gpt-image-2.5-sunburst']) validateImageQuality(model, 'max')
})
test('generation and editing switches are independent and strictly boolean', () => {
  assert.throws(() => imageFeaturePatch({ imageEditing: 'false' }))
  assert.throws(() => assertImageOperation({ imageGeneration: false }, false))
  assertImageOperation({ imageGeneration: false }, true)
  assert.throws(() => assertImageOperation({ imageEditing: false }, true))
})
test('composer rejects release all newly created attachments, including thrown errors', () => {
  const created = [{id:'a'},{id:'b'}]; let released: unknown
  const conversation={createDraftImages:()=>created,releaseDraftImages:(value: unknown)=>{released=value}}
  assert.throws(()=>attachImageFiles(((conversation) as unknown as Parameters<typeof attachImageFiles>[0]),(({addImages:()=>false}) as unknown as Parameters<typeof attachImageFiles>[1]),(([]) as unknown as Parameters<typeof attachImageFiles>[2])))
  assert.equal(released,created)
  released=undefined
  assert.throws(()=>attachImageFiles(((conversation) as unknown as Parameters<typeof attachImageFiles>[0]),(({addImages:()=>{throw Error('busy')}}) as unknown as Parameters<typeof attachImageFiles>[1]),(([]) as unknown as Parameters<typeof attachImageFiles>[2])))
  assert.equal(released,created)
})
test('image instruction insertion preserves existing draft and refuses to flatten reference chips', () => {
  let draft='Existing text'
  const input={state:{getSnapshot:(): {draft: string; phase: string; occurrences: unknown[]}=>({draft,phase:'plain',occurrences:[]})},setDraft:(value: string)=>{draft=value}}
  appendImagePrompt(((input) as unknown as Parameters<typeof appendImagePrompt>[0]),'New brief'); assert.equal(draft,'Existing text\n\nNew brief')
  input.state.getSnapshot=()=>({draft,phase:'plain',occurrences:[{}]})
  assert.throws(()=>appendImagePrompt(((input) as unknown as Parameters<typeof appendImagePrompt>[0]),'More'))
})

test('modern DSH attachments carry the session and release refused drafts', () => {
  const files = [{}], created = [{ id: 'new-image' }]
  let released: unknown, admitted: unknown
  const conversation = {
    createDrafts(sessionId: string, received: unknown) { assert.equal(sessionId, 'session-test'); assert.equal(received, files); return created },
    releaseDraftAttachments(items: unknown) { released = items },
  }
  const input = { addAttachments(ids: unknown) { assert.equal(this, input); admitted = ids; return true } }
  assert.equal(attachImageFiles(((conversation) as unknown as Parameters<typeof attachImageFiles>[0]), ((input) as unknown as Parameters<typeof attachImageFiles>[1]), ((files) as unknown as Parameters<typeof attachImageFiles>[2]), (('session-test') as unknown as Parameters<typeof attachImageFiles>[3])), created)
  assert.deepEqual(admitted, ['new-image'])
  assert.equal(released, undefined)
  input.addAttachments = () => false
  assert.throws(() => attachImageFiles(((conversation) as unknown as Parameters<typeof attachImageFiles>[0]), ((input) as unknown as Parameters<typeof attachImageFiles>[1]), ((files) as unknown as Parameters<typeof attachImageFiles>[2]), (('session-test') as unknown as Parameters<typeof attachImageFiles>[3])), /busy/)
  assert.equal(released, created)
  assert.throws(() => attachImageFiles(((conversation) as unknown as Parameters<typeof attachImageFiles>[0]), ((input) as unknown as Parameters<typeof attachImageFiles>[1]), ((files) as unknown as Parameters<typeof attachImageFiles>[2])), /unavailable/)
})
test('sketch coordinates remain relative across viewport sizes and paint taps', () => {
  assert.deepEqual(sketchPoint(100,50,(({left:0,top:0,width:200,height:100}) as unknown as Parameters<typeof sketchPoint>[2])),{x:.5,y:.5})
  assert.deepEqual(sketchPoint(-5,200,(({left:0,top:0,width:100,height:100}) as unknown as Parameters<typeof sketchPoint>[2])),{x:0,y:1})
  assert.equal(sketchPoint(0,0,(({width:0,height:0}) as unknown as Parameters<typeof sketchPoint>[2])),undefined)
  let arc: unknown
  const context={fillRect(){},beginPath(){},arc(...args: number[]){arc=args},fill(){}}
  paintSketch(((context) as unknown as CanvasRenderingContext2D),[{color:'#000000',width:10,points:[{x:.5,y:.5}]}],100)
  assert.deepEqual(arc,[50,50,5,0,Math.PI*2])
})

test('Sketch edits only an accepted composer span, never opens the board, and disabled sources disappear', async () => {
  let enabled=true,accepted=false,opened
  const source=createSketchTrigger({enabled:()=>enabled,consume:()=>accepted,open:(id: string)=>{opened=id}})
  const pick={session:{sessionId:'a'},span:{start:0,end:7,draftRev:1}}
  assert.equal(source.onPick!(((pick) as unknown as Parameters<NonNullable<typeof source.onPick>>[0])),undefined); assert.equal(opened,undefined)
  accepted=true;assert.equal(source.onPick!(((pick) as unknown as Parameters<NonNullable<typeof source.onPick>>[0])),'handled');assert.equal(opened,undefined)
  enabled=false;assert.deepEqual(await source.candidates!((({}) as unknown as Parameters<NonNullable<typeof source.candidates>>[0]), (({query:'Sketch'}) as unknown as Parameters<NonNullable<typeof source.candidates>>[1])),[])
})

test('Image shortcut accepts Chinese and English queries without sending a message', async () => {
  let opened = 0
  const source = createImageTrigger({ enabled: () => true, consume: () => true, open: () => opened++ })
  for (const query of ['image', 'Image', '生图']) assert.equal((await source.candidates!((({}) as unknown as Parameters<NonNullable<typeof source.candidates>>[0]), (({ query }) as unknown as Parameters<NonNullable<typeof source.candidates>>[1]))).length, 1)
  assert.deepEqual(await source.candidates!((({}) as unknown as Parameters<NonNullable<typeof source.candidates>>[0]), (({ query: 'image', quoted: true }) as unknown as Parameters<NonNullable<typeof source.candidates>>[1])), [])
  assert.deepEqual(await source.candidates!((({}) as unknown as Parameters<NonNullable<typeof source.candidates>>[0]), (({ query: 'unrelated' }) as unknown as Parameters<NonNullable<typeof source.candidates>>[1])), [])
  assert.equal(opened, 0)
  assert.equal(source.onPick!((({ session: { sessionId: 'a' }, span: {} }) as unknown as Parameters<NonNullable<typeof source.onPick>>[0])), 'handled')
  assert.equal(opened, 1)
})

test('disabling both image operations removes the tool and re-enabling restores it once', () => {
  let notify!: (value: Record<string, unknown>) => void, active = 0, registered = 0, watching = true
  const dispose = watchImageTool((({ get: () => ({}), watch: (callback: typeof notify) => { notify = callback; return () => { watching = false } } }) as unknown as Parameters<typeof watchImageTool>[0]), () => {
    active++; registered++
    return () => active--
  })
  assert.equal(active, 1)
  notify({ imageGeneration: false, imageEditing: true })
  assert.equal(active, 1)
  notify({ imageGeneration: false, imageEditing: false })
  assert.equal(active, 0)
  notify({ imageGeneration: false, imageEditing: false })
  notify({ imageGeneration: true, imageEditing: false })
  assert.equal(active, 1)
  assert.equal(registered, 2)
  dispose()
  assert.equal(active, 0)
  assert.equal(watching, false)
})
