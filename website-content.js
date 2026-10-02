(() => {
 const preview=new URLSearchParams(location.search).get('content-preview')==='1';
 const config=window.HAZARD_SITE_CONFIG||{},base=(config.supabaseUrl||'').replace(/\/$/,'');
 function apply(content){if(!content||typeof content!=='object')return;document.querySelectorAll('[data-content]').forEach(node=>{const value=content[node.dataset.content];if(typeof value==='string')node.textContent=value;});}
 if(preview){
  const trusted=['https://hazard-home-services.ajbennett4463.workers.dev'];
  window.addEventListener('message',event=>{if(!trusted.includes(event.origin)||event.source!==window.parent||event.data?.type!=='hazard-content-preview')return;apply(event.data.content);const hero=event.data.hero;if(hero&&typeof hero.src==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(hero.src)){const target=document.getElementById('website-hero-photo'),img=document.createElement('img');img.src=hero.src;img.alt=typeof hero.alt==='string'?hero.alt:'';window.HAZARD_PREVIEW_HERO=true;target.replaceChildren(img);target.hidden=false;document.getElementById('hero-placeholder').hidden=true;}});
  // Prevent an accidental live inquiry from the editing preview.
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
  return;
 }
 if(!base||!config.supabaseKey)return;
 const headers={apikey:config.supabaseKey};if(!config.supabaseKey.startsWith('sb_publishable_'))headers.Authorization=`Bearer ${config.supabaseKey}`;
 fetch(`${base}/rest/v1/website_content?select=content&id=eq.1`,{headers,cache:'no-store'}).then(r=>r.ok?r.json():[]).then(rows=>apply(rows[0]?.content)).catch(()=>{});
})();
