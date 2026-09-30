(() => {
  const config=window.HAZARD_SITE_CONFIG||{};
  if(!config.supabaseUrl||!config.supabaseKey)return;
  const base=config.supabaseUrl.replace(/\/$/,'');
  const headers={apikey:config.supabaseKey};
  // Legacy anon JWTs also support Authorization; publishable keys belong only in apikey.
  if(!config.supabaseKey.startsWith('sb_publishable_'))headers.Authorization=`Bearer ${config.supabaseKey}`;
  const urls=[];
  window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)));
  async function photoUrl(photo){
    // Private bucket: each request checks whether this particular photo is published.
    const path=photo.object_path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(`${base}/storage/v1/object/authenticated/hazard-website/${path}`,{headers,cache:'no-store'});
    if(!response.ok)throw new Error('Photo unavailable');
    const blob=await response.blob();
    if(!blob.type.startsWith('image/'))throw new Error('Invalid photo');
    const url=URL.createObjectURL(blob);urls.push(url);return url;
  }
  const text=(tag,content)=>{const element=document.createElement(tag);element.textContent=content;return element};
  function openPreview(photo,url,button){
    const dialog=document.createElement('dialog');dialog.className='gallery-lightbox';
    const close=text('button','Close photo ×');close.type='button';close.addEventListener('click',()=>dialog.close());
    const image=document.createElement('img');image.src=url;image.alt=photo.alt_text;
    dialog.append(close,image);if(photo.title)dialog.append(text('h3',photo.title));if(photo.caption)dialog.append(text('p',photo.caption));
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    dialog.addEventListener('close',()=>{dialog.remove();button.focus()});document.body.append(dialog);dialog.showModal();
  }
  async function load(){
    try{
      const response=await fetch(`${base}/rest/v1/website_media?select=kind,object_path,title,caption,alt_text,sort_order,created_at,set_id,photo_phase&order=sort_order.asc,created_at.asc`,{headers,cache:'no-store'});
      if(!response.ok)return;
      const photos=await response.json();if(!Array.isArray(photos))return;
      let sets=[];
      try{const setResponse=await fetch(`${base}/rest/v1/website_photo_sets?select=id,title,caption,sort_order,created_at&published=eq.true&order=sort_order.asc,created_at.asc`,{headers,cache:'no-store'});if(setResponse.ok){const rows=await setResponse.json();if(Array.isArray(rows))sets=rows.filter(row=>row.id&&row.title)}}catch{}
      // A missing image never replaces the existing attractive placeholder.
      await Promise.all(photos.map(async photo=>{
        try{
          if(photo.set_id)return;
          const url=await photoUrl(photo),image=document.createElement('img');image.src=url;image.alt=photo.alt_text;image.decoding='async';
          // Decode the fetched blob eagerly before inserting it. A detached lazy image can stall forever.
          await image.decode();
          if(photo.kind==='about'){
            const about=document.getElementById('website-about-photo');if(!about)return;
            about.replaceChildren(image);if(photo.caption)about.append(text('figcaption',photo.caption));about.hidden=false;document.getElementById('about-placeholder').hidden=true;
          }else if(photo.kind==='gallery'){
            const gallery=document.getElementById('website-gallery');if(!gallery)return;
            const figure=document.createElement('figure'),button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`View photo: ${photo.title||photo.alt_text}`);button.append(image);button.addEventListener('click',()=>openPreview(photo,url,button));figure.append(button);
            const caption=document.createElement('figcaption');if(photo.title)caption.append(text('h3',photo.title));if(photo.caption)caption.append(text('p',photo.caption));figure.append(caption);
            // Preserve server ordering even when downloads complete in different orders.
            figure.dataset.position=String(photo.sort_order||0);gallery.append(figure);[...gallery.children].sort((a,b)=>Number(a.dataset.position)-Number(b.dataset.position)).forEach(child=>gallery.append(child));gallery.hidden=false;document.getElementById('gallery-placeholder').hidden=true;const intro=document.getElementById('gallery-intro');if(intro)intro.textContent='A look at our repairs, improvements, and cleanup projects around greater Indianapolis. Select a photo for a closer look.';
          }
        }catch{/* Keep available photos and placeholders if a download fails. */}
      }));
      await Promise.all(sets.map(async set=>{
        const setPhotos=photos.filter(photo=>photo.set_id===set.id);
        const results=await Promise.all(setPhotos.map(async photo=>{try{return {...photo,url:await photoUrl(photo)}}catch{return null}}));
        const available=results.filter(Boolean);
        if(!['before','after'].every(phase=>available.some(photo=>photo.photo_phase===phase)))return;
        const gallery=document.getElementById('website-gallery');if(!gallery)return;
        const article=document.createElement('article');article.className='public-comparison';article.dataset.position=String(set.sort_order||0);article.append(text('h3',set.title));if(set.caption)article.append(text('p',set.caption));
        const sides=document.createElement('div');sides.className='public-comparison-sides';
        for(const phase of ['before','after']){
          const sidePhotos=available.filter(photo=>photo.photo_phase===phase);
          const side=document.createElement('section');side.className=`public-comparison-side ${phase}`;side.append(text('h4',phase==='before'?'Before':'After'));
          const button=document.createElement('button');button.type='button';button.className='public-comparison-image';const image=document.createElement('img');image.decoding='async';button.append(image);
          const controls=document.createElement('div');controls.className='public-comparison-controls';const prev=text('button','← Previous'),next=text('button','Next →'),counter=text('span','');prev.type=next.type='button';counter.setAttribute('aria-live','polite');controls.append(prev,counter,next);
          const caption=text('p','');let index=0;
          function show(){const photo=sidePhotos[index];image.src=photo.url;image.alt=photo.alt_text;button.setAttribute('aria-label',`Enlarge ${phase} photo ${index+1} of ${sidePhotos.length}: ${photo.alt_text}`);counter.textContent=`${index+1} / ${sidePhotos.length}`;caption.textContent=photo.caption||'';prev.disabled=index===0;next.disabled=index===sidePhotos.length-1;}
          prev.setAttribute('aria-label',`Previous ${phase} photo for ${set.title}`);next.setAttribute('aria-label',`Next ${phase} photo for ${set.title}`);
          prev.addEventListener('click',()=>{if(index>0){index--;show()}});next.addEventListener('click',()=>{if(index<sidePhotos.length-1){index++;show()}});button.addEventListener('click',()=>openPreview(sidePhotos[index],sidePhotos[index].url,button));
          show();side.append(button,controls,caption);sides.append(side);
        }
        article.append(sides);gallery.append(article);[...gallery.children].sort((a,b)=>Number(a.dataset.position)-Number(b.dataset.position)).forEach(child=>gallery.append(child));gallery.hidden=false;document.getElementById('gallery-placeholder').hidden=true;const intro=document.getElementById('gallery-intro');if(intro)intro.textContent='Explore our projects and before-and-after transformations. Select any photo for a closer look.';
      }));
    }catch{/* Website remains useful when the media service is temporarily unavailable. */}
  }
  void load();
})();
