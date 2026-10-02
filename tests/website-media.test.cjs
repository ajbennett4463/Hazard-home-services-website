// Run: node --test tests/website-media.test.cjs (requires linkedom in test tooling).
const {parseHTML}=require('linkedom'), {readFileSync}=require('node:fs'), {resolve}=require('node:path');
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm');
const source=readFileSync(resolve(__dirname,'../website-media.js'),'utf8'), html=readFileSync(resolve(__dirname,'../index.html'),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const photos=[
 {kind:'gallery',set_id:'s1',photo_phase:'before',object_path:'before-1.jpg',alt_text:'Before one',caption:'Original'},
 {kind:'gallery',set_id:'s1',photo_phase:'before',object_path:'before-2.jpg',alt_text:'Before two'},
 {kind:'gallery',set_id:'s1',photo_phase:'after',object_path:'after-1.jpg',alt_text:'After one',caption:'Completed work'},
 {kind:'gallery',set_id:'s1',photo_phase:'after',object_path:'after-2.jpg',alt_text:'After two'},
 {kind:'gallery',object_path:'single.jpg',title:'<script>unsafe</script>',alt_text:'Single photo',sort_order:20},
 {kind:'about',object_path:'owners.jpg',alt_text:'Andy and Kenny',caption:'Owners'},
];
const sets=[{id:'s1',title:'Kitchen project',caption:'Project details',sort_order:0}];
async function setup(rows=photos,setRows=sets,offline=false,missing=''){
 const {window,document}=parseHTML(html), create=document.createElement.bind(document);
 document.createElement=(tag)=>{
  const node=create(tag);
  if(tag==='img')node.decode=async()=>assert.notEqual(node.loading,'lazy');
  if(tag==='dialog'){node.showModal=()=>{node.open=true};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'))};}
  return node;
 };
 window.HAZARD_SITE_CONFIG={supabaseUrl:'https://example.test',supabaseKey:'sb_publishable_test'};
 const requests=[];
 vm.runInNewContext(source,{window,document,URL:{createObjectURL:()=> 'blob:photo',revokeObjectURL:()=>{}},fetch:async(url,options)=>{
  requests.push({url,options});if(offline)throw Error('Offline');
  if(url.includes('/rest/v1/website_photo_sets'))return {ok:true,json:async()=>setRows};
  if(url.includes('/rest/v1/'))return {ok:true,json:async()=>rows};
  if(missing&&url.includes(missing))return {ok:false};
  return {ok:true,blob:async()=>({type:'image/jpeg'})};
 }});
 await tick();return {window,document,requests};
}
test('renders ordered safe project cards and About photo with private authorized downloads',async()=>{
 const {document:d,requests}=await setup();
 assert.equal(d.querySelectorAll('.project-card').length,2);
 assert.equal(d.querySelector('.project-card h3').textContent,'Kitchen project');
 assert.equal(d.querySelectorAll('.project-card h3')[1].textContent,'<script>unsafe</script>');
 assert.equal(d.querySelectorAll('#website-gallery script').length,0);
 assert.equal(d.querySelector('#website-about-photo img').alt,'Andy and Kenny');
 assert.equal(d.querySelector('#about-placeholder').hidden,true);
 assert.ok(requests.every(r=>r.options.cache==='no-store'&&!r.options.headers.Authorization));
 assert.ok(requests.filter(r=>r.url.includes('/storage/')).every(r=>r.url.includes('/object/authenticated/hazard-website/')));
 assert.equal(requests.some(r=>r.url.includes('before-2.jpg')||r.url.includes('after-2.jpg')),false);
});
test('single viewer preserves before/after positions, thumbnails and rapid-switch correctness',async()=>{
 const {document:d,window:w}=await setup();
 d.querySelector('.project-card-open').click();await tick();
 assert.equal(d.querySelector('.viewer-photo img').alt,'After one');
 assert.equal(d.querySelector('.viewer-counter').textContent,'After · 1 of 2');
 d.querySelector('.viewer-next').click();await tick();
 assert.equal(d.querySelector('.viewer-photo img').alt,'After two');
 assert.equal(d.querySelector('.viewer-next').disabled,true);
 d.querySelectorAll('.viewer-tab')[0].click();await tick();
 assert.equal(d.querySelector('.viewer-photo img').alt,'Before one');
 d.querySelectorAll('.viewer-thumbnail')[1].click();await tick();
 assert.equal(d.querySelector('.viewer-counter').textContent,'Before · 2 of 2');
 d.querySelectorAll('.viewer-tab')[1].click();d.querySelectorAll('.viewer-tab')[0].click();await tick();
 assert.equal(d.querySelector('.viewer-photo img').alt,'Before two');
 const key=new w.Event('keydown');key.key='ArrowLeft';d.querySelector('dialog').dispatchEvent(key);await tick();
 assert.equal(d.querySelector('.viewer-photo img').alt,'Before one');
 assert.equal(d.body.style.overflow,'hidden');
 d.querySelector('.viewer-close').click();assert.equal(d.querySelector('dialog'),null);
 assert.notEqual(d.body.style.overflow,'hidden');
});
test('horizontal swipe changes photos while vertical gesture does not',async()=>{
 const {document:d,window:w}=await setup();d.querySelector('.project-card-open').click();await tick();
 const stage=d.querySelector('.viewer-stage');
 const swipe=(dx,dy)=>{
  const start=new w.Event('touchstart');start.touches=[{clientX:300,clientY:200}];stage.dispatchEvent(start);
  const end=new w.Event('touchend');end.changedTouches=[{clientX:300+dx,clientY:200+dy}];stage.dispatchEvent(end);
 };
 swipe(-100,200);await tick();assert.equal(d.querySelector('.viewer-photo img').alt,'After one');
 swipe(-100,10);await tick();assert.equal(d.querySelector('.viewer-photo img').alt,'After two');
});
test('filters projects and single-photo viewer omits unnecessary controls',async()=>{
 const {document:d}=await setup();d.querySelectorAll('.gallery-filter')[2].click();
 assert.equal(d.querySelectorAll('.project-card')[0].hidden,true);
 assert.equal(d.querySelectorAll('.project-card')[1].hidden,false);
 assert.equal(d.querySelector('.gallery-status').textContent,'1 project');
 d.querySelectorAll('.project-card-open')[1].click();await tick();
 assert.equal(d.querySelector('.viewer-tabs').hidden,true);
 assert.equal(d.querySelector('.viewer-next').hidden,true);
 assert.equal(d.querySelector('.viewer-thumbnails').hidden,true);
});
test('empty, offline and incomplete comparisons retain useful fallback',async()=>{
 for(const args of [[[],[]],[[],[],true],[[photos[0]],sets]]){
  const {document:d}=await setup(...args);
  assert.equal(d.querySelector('#website-gallery').hidden,true);
  assert.equal(d.querySelector('#gallery-placeholder').hidden,false);
 }
 const {document:d}=await setup(photos,sets,false,'after-1.jpg');
 assert.equal(d.querySelectorAll('.project-card').length,1,'Never render a half-loaded comparison');
});
test('homepage photo replaces artwork without entering gallery',async()=>{
 const {document:d}=await setup([{kind:'hero',object_path:'hero/owners.jpg',alt_text:'Andy and Kenny at work'}],[]);
 assert.equal(d.querySelector('#website-hero-photo').hidden,false);
 assert.equal(d.querySelector('#website-hero-photo img').alt,'Andy and Kenny at work');
 assert.equal(d.querySelector('#hero-placeholder').hidden,true);
 assert.equal(d.querySelector('#website-gallery').hidden,true);
});
