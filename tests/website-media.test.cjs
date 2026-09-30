// Run: node tests/website-media.test.cjs (requires linkedom in test tooling).
const {parseHTML}=require('linkedom');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(resolve(__dirname,'../website-media.js'),'utf8');
const html=readFileSync(resolve(__dirname,'../index.html'),'utf8');
async function scenario(photos,fail=false){
 const {window,document}=parseHTML(html);
 window.HAZARD_SITE_CONFIG={supabaseUrl:'https://example.test',supabaseKey:'public-test-key'};
 const imagePrototype=Object.getPrototypeOf(document.createElement('img'));imagePrototype.decode=async()=>{};
 let requests=[];
 const context={window,document,URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:()=>{}},fetch:async(url,options)=>{
  requests.push({url,options});if(fail)throw new Error('offline');
  if(url.includes('/rest/v1/'))return {ok:true,json:async()=>photos};
  return {ok:true,blob:async()=>({type:'image/jpeg'})};
 }};
 vm.runInNewContext(source,context);await new Promise(r=>setTimeout(r,15));return {document,requests};
}
(async()=>{
 let s=await scenario([]);assert.equal(s.document.querySelector('#website-gallery').hidden,true);assert.equal(s.document.querySelector('#about-placeholder').hidden,false);
 s=await scenario([{kind:'gallery',object_path:'gallery/a.jpg',title:'<script>unsafe</script>',caption:'Repair & cleanup',alt_text:'Job photo'},{kind:'gallery',object_path:'gallery/b.jpg',title:'Second',caption:'',alt_text:'Second photo'},{kind:'about',object_path:'about/a.jpg',caption:'Andy and Kenny',alt_text:'Owners'}]);
 assert.equal(s.document.querySelector('#website-gallery').hidden,false);assert.equal(s.document.querySelectorAll('#website-gallery figure').length,2);assert.equal(s.document.querySelector('#website-gallery h3').textContent,'<script>unsafe</script>');assert.equal(s.document.querySelectorAll('#website-gallery script').length,0);assert.equal(s.document.querySelector('#about-placeholder').hidden,true);assert.equal(s.document.querySelector('#website-about-photo figcaption').textContent,'Andy and Kenny');assert.equal(s.document.querySelector('#website-about-photo img').alt,'Owners');
 assert.ok(s.requests.every(r=>r.options.cache==='no-store'));assert.ok(s.requests.slice(1).every(r=>r.url.includes('/object/authenticated/hazard-website/')));
 s=await scenario([],true);assert.equal(s.document.querySelector('#gallery-placeholder').hidden,false);
 console.log('PASS: gallery rendering, safe captions, About Us replacement, authenticated download paths, empty/offline fallback');
})().catch(e=>{console.error(e);process.exit(1)});
