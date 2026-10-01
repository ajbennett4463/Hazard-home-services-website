const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {webcrypto}=require('node:crypto');
const script=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
function setup(outcomes){
 let submit, resets=0;const calls=[];const storage=new Map();
 const values={name:'Test owner',email:'test@example.com',phone:'3175550100',zip:'46131',service:'Home repair',details:'Repair project',contact_preference:'Email',website:''};
 const form={append(){},addEventListener(type,fn){if(type==='submit')submit=fn},reportValidity:()=>true,reset(){resets++}};
 const message={textContent:'',innerHTML:'',classList:{add(){},remove(){}}},button={};
 const document={querySelector:s=>s==='#requestForm'?form:s==='#formMessage'?message:s==='#submitButton'?button:s==='#year'?{}:null,createElement:()=>({style:{},setAttribute(){}})};
 const context={document,window:{HAZARD_SITE_CONFIG:{formEndpoint:'https://formspree.io/f/xrpbdjko',leadEndpoint:'https://example.com/lead',supabaseKey:'public'}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:webcrypto,TextEncoder,Uint8Array,AbortSignal,console:{warn(){}},FormData:class{*[Symbol.iterator](){yield* Object.entries(values)}},fetch:async(url,options)=>{calls.push({url,options});const result=outcomes.shift();if(result instanceof Error)throw result;return {ok:result};}};
 vm.runInNewContext(script,context);
 return {send:()=>submit({preventDefault(){}}),calls,message,get resets(){return resets}};
}
test('saves lead before email and confirms receipt',async()=>{const x=setup([true,true]);await x.send();assert.equal(x.calls.length,2);assert.match(x.calls[0].url,/lead$/);assert.equal(x.resets,1);assert.match(x.message.textContent,/received/);});
test('email failure does not discard saved lead',async()=>{const x=setup([true,false]);await x.send();assert.equal(x.resets,1);assert.match(x.message.textContent,/received/);});
test('failed save retains form and retries same submission ID',async()=>{const x=setup([false,true,true]);await x.send();assert.equal(x.resets,0);assert.equal(x.calls.length,1);await x.send();assert.equal(JSON.parse(x.calls[0].options.body).submission_id,JSON.parse(x.calls[1].options.body).submission_id);assert.equal(x.resets,1);});
