import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools';
const number={type:'number'} as const,string={type:'string'} as const
const object=<const P extends ParameterSchemaSpec>(properties: P)=>({type:'object',additionalProperties:false,properties} as const)
const points={type:'array',items:object({x:{...number,required:true},y:{...number,required:true}})} as const
const point=object({x:{...number,required:true},y:{...number,required:true}})
const style={color:string,width:number,opacity:number,fill:{type:'boolean'},text:string,points} as const
// DSH compiles this schema for both native function calls and run_code SDKs.
export const sketchCommandArray={type:'array',items:object({
  op:{type:'string',required:true,enum:['stroke','object','layer','resize']},
  id:{oneOf:[{type:'string'},{type:'integer'}],description:'Object string ID. Layer add: optional NEW unique integer ID; other layer actions: existing layer ID.'},
  after:{type:'integer',description:'Layer add only: existing layer to insert after; defaults to active.'},
  start:point,segments:{type:'array',items:object({control1:{...point,required:true},control2:{...point,required:true},end:{...point,required:true}})},
  layer:{type:'integer'},shape:{type:'string',enum:['pen','line','arrow','text','rectangle','circle','ellipse','polygon','bezier','eraser','triangle','diamond','star']},
  ...style,
  action:{type:'string',enum:['update','duplicate','delete','add','select','rename','visible','up','down','clear']},
  value:string,ratio:{type:'string',enum:['1:1','4:3','3:4','16:9','9:16']},
  patch:object(style),transform:object({dx:number,dy:number,scaleX:number,scaleY:number}),
})} as const
