(() => {
  const config=window.HAZARD_SITE_CONFIG||{};
  if(!config.supabaseUrl||!config.supabaseKey)return;
  const base=config.supabaseUrl.replace(/\/$/,'');
  const headers={apikey:config.supabaseKey,Authorization:`Bearer ${config.supabaseKey}`};
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
      const response=await fetch(`${base}/rest/v1/website_media?select=kind,object_path,title,caption,alt_text,sort_order,created_at&published=eq.true&order=sort_order.asc,created_at.asc`,{headers,cache:'no-store'});
      if(!response.ok)return;
      const photos=await response.json();if(!Array.isArray(photos))return;
      // A missing image never replaces the existing attractive placeholder.
      await Promise.all(photos.map(async photo=>{
        try{
          const url=await photoUrl(photo),image=document.createElement('img');image.src=url;image.alt=photo.alt_text;image.loading='lazy';image.decoding='async';
          await image.decode();
          if(photo.kind==='about'){
            const about=document.getElementById('website-about-photo');if(!about)return;
            about.replaceChildren(image);if(photo.caption)about.append(text('figcaption',photo.caption));about.hidden=false;document.getElementById('about-placeholder').hidden=true;
          }else if(photo.kind==='gallery'){
            const gallery=document.getElementById('website-gallery');if(!gallery)return;
            const figure=document.createElement('figure'),button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`View photo: ${photo.title||photo.alt_text}`);button.append(image);button.addEventListener('click',()=>openPreview(photo,url,button));figure.append(button);
            const caption=document.createElement('figcaption');if(photo.title)caption.append(text('h3',photo.title));if(photo.caption)caption.append(text('p',photo.caption));figure.append(caption);
            // Preserve server ordering even when downloads complete in different orders.
            figure.dataset.position=String(photos.indexOf(photo));gallery.append(figure);[...gallery.children].sort((a,b)=>Number(a.dataset.position)-Number(b.dataset.position)).forEach(child=>gallery.append(child));gallery.hidden=false;document.getElementById('gallery-placeholder').hidden=true;const intro=document.getElementById('gallery-intro');if(intro)intro.textContent='A look at our repairs, improvements, and cleanup projects around greater Indianapolis. Select a photo for a closer look.';
          }
        }catch{/* Keep available photos and placeholders if a download fails. */}
      }));
    }catch{/* Website remains useful when the media service is temporarily unavailable. */}
  }
  void load();
})();
