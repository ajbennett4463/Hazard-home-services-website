// Run: node tests/website-media.test.cjs (requires linkedom in test tooling).
const {parseHTML}=require('linkedom');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(resolve(__dirname,'../website-media.js'),'utf8');
const html=readFileSync(resolve(__dirname,'../index.html'),'utf8');
async function scenario(photos,fail=false,sets=[]){
 const {window,document}=parseHTML(html);
 window.HAZARD_SITE_CONFIG={supabaseUrl:'https://example.test',supabaseKey:'sb_publishable_test'};
 const imagePrototype=Object.getPrototypeOf(document.createElement('img'));imagePrototype.decode=async function(){assert.notEqual(this.loading,'lazy','Do not lazy-load detached images before decoding');};
 let requests=[];
 const context={window,document,URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:()=>{}},fetch:async(url,options)=>{
  requests.push({url,options});if(fail)throw new Error('offline');
  if(url.includes('/rest/v1/website_photo_sets'))return {ok:true,json:async()=>sets};
  if(url.includes('/rest/v1/'))return {ok:true,json:async()=>photos};
  return {ok:true,blob:async()=>({type:'image/jpeg'})};
 }};
 vm.runInNewContext(source,context);await new Promise(r=>setTimeout(r,15));return {document,requests};
}
(async()=>{
 let s=await scenario([]);assert.equal(s.document.querySelector('#website-gallery').hidden,true);assert.equal(s.document.querySelector('#about-placeholder').hidden,false);
 s=await scenario([{kind:'gallery',object_path:'gallery/a.jpg',title:'<script>unsafe</script>',caption:'Repair & cleanup',alt_text:'Job photo'},{kind:'gallery',object_path:'gallery/b.jpg',title:'Second',caption:'',alt_text:'Second photo'},{kind:'about',object_path:'about/a.jpg',caption:'Andy and Kenny',alt_text:'Owners'}]);
 assert.equal(s.document.querySelector('#website-gallery').hidden,false);assert.equal(s.document.querySelectorAll('#website-gallery figure').length,2);assert.equal(s.document.querySelector('#website-gallery h3').textContent,'<script>unsafe</script>');assert.equal(s.document.querySelectorAll('#website-gallery script').length,0);assert.equal(s.document.querySelector('#about-placeholder').hidden,true);assert.equal(s.document.querySelector('#website-about-photo figcaption').textContent,'Andy and Kenny');assert.equal(s.document.querySelector('#website-about-photo img').alt,'Owners');
 assert.ok(s.requests.every(r=>r.options.cache==='no-store'));assert.ok(s.requests.every(r=>!r.options.headers.Authorization),'Publishable keys must not be sent as bearer JWTs');assert.ok(s.requests.filter(r=>!r.url.includes('/rest/v1/')).every(r=>r.url.includes('/object/authenticated/hazard-website/')));
 s=await scenario([],true);assert.equal(s.document.querySelector('#gallery-placeholder').hidden,false);
 s=await scenario([{set_id:'s1',kind:'gallery',photo_phase:'before',object_path:'gallery/b1.jpg',alt_text:'Before one',caption:'Original'}, {set_id:'s1',kind:'gallery',photo_phase:'before',object_path:'gallery/b2.jpg',alt_text:'Before two',caption:'Second view'}, {set_id:'s1',kind:'gallery',photo_phase:'after',object_path:'gallery/a1.jpg',alt_text:'After one',caption:'Finished'}],false,[{id:'s1',title:'Bathroom project',caption:'Renovation',sort_order:10}]);
 assert.equal(s.document.querySelectorAll('.public-comparison').length,1);assert.equal(s.document.querySelectorAll('.public-comparison-side').length,2);assert.equal(s.document.querySelector('.public-comparison-side.before img').alt,'Before one');
 const next=s.document.querySelector('.public-comparison-side.before .public-comparison-controls button:last-child');next.click();assert.equal(s.document.querySelector('.public-comparison-side.before img').alt,'Before two');assert.equal(s.document.querySelector('.public-comparison-side.before .public-comparison-controls span').textContent,'2 / 2');assert.equal(next.disabled,true);
 s=await scenario([{set_id:'s1',kind:'gallery',photo_phase:'before',object_path:'gallery/b1.jpg',alt_text:'Before'}],false,[{id:'s1',title:'Incomplete',sort_order:10}]);assert.equal(s.document.querySelectorAll('.public-comparison').length,0,'Do not show misleading half-loaded comparisons');
 console.log('PASS: multiple Before/After photos and next-photo navigation; gallery rendering, safe captions, About Us replacement, authenticated download paths, empty/offline fallback');
})().catch(e=>{console.error(e);process.exit(1)});
