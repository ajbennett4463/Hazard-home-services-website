(() => {
  const config = window.HAZARD_SITE_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseKey) return;
  const base = config.supabaseUrl.replace(/\/$/, '');
  const headers = { apikey: config.supabaseKey };
  if (!config.supabaseKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${config.supabaseKey}`;
  const urls = [], downloads = new Map();
  window.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  };
  const button = (className, label, action) => {
    const node = element('button', className, label);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  };
  const image = (photo, url) => {
    const node = element('img'); node.src = url;
    node.alt = photo.alt_text || photo.title || 'Hazard Home Services project';
    node.decoding = 'async';
    return node;
  };
  async function photoUrl(photo) {
    if (downloads.has(photo.object_path)) return downloads.get(photo.object_path);
    const promise = (async () => {
      const path = photo.object_path.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${base}/storage/v1/object/authenticated/hazard-website/${path}`, { headers, cache: 'no-store' });
      if (!response.ok) throw new Error('Photo unavailable');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Invalid photo');
      const url = URL.createObjectURL(blob); urls.push(url); return url;
    })();
    downloads.set(photo.object_path, promise);
    try { return await promise; } catch (error) { downloads.delete(photo.object_path); throw error; }
  }
  // Bound downloads; full-resolution project photos are requested only when the viewer opens.
  async function each(items, task) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) { const item = items[next++]; try { await task(item); } catch {} }
    }));
  }
  function openViewer(project, opener) {
    const dialog = element('dialog', 'project-viewer');
    dialog.setAttribute('aria-labelledby', 'project-viewer-title');
    const top = element('header', 'viewer-header');
    const heading = element('div', 'viewer-heading');
    heading.append(element('span', 'viewer-eyebrow', project.comparison ? 'THE TRANSFORMATION' : 'A CLOSER LOOK'));
    const title = element('h3', '', project.title); title.id = 'project-viewer-title'; heading.append(title);
    const close = button('viewer-close', '×', () => dialog.close()); close.setAttribute('aria-label', 'Close project');
    top.append(heading, close);
    const tabs = element('div', 'viewer-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Photo stage');
    const stage = element('div', 'viewer-stage');
    const photoFrame = element('div', 'viewer-photo');
    const loading = element('p', 'viewer-loading', 'Loading photo…'); loading.setAttribute('role', 'status');
    const prev = button('viewer-arrow viewer-prev', '‹', () => move(-1));
    const next = button('viewer-arrow viewer-next', '›', () => move(1));
    prev.setAttribute('aria-label', 'Previous photo'); next.setAttribute('aria-label', 'Next photo');
    stage.append(photoFrame, loading, prev, next);
    const detail = element('div', 'viewer-detail');
    const caption = element('p', 'viewer-caption');
    const counter = element('span', 'viewer-counter'); counter.setAttribute('aria-live', 'polite');
    detail.append(caption, counter);
    const thumbnails = element('div', 'viewer-thumbnails'); thumbnails.setAttribute('aria-label', 'Choose a photo');
    const footer = element('footer', 'viewer-footer');
    const projectCaption = element('p', '', project.caption || 'Real projects. Practical improvements.');
    const inquiry = element('a', 'viewer-inquiry', 'Have a similar project? ↗'); inquiry.href = '#request';
    inquiry.addEventListener('click', () => { dialog.close(); document.getElementById('request')?.scrollIntoView({ behavior: 'smooth' }); });
    footer.append(projectCaption, inquiry);
    dialog.append(top, tabs, stage, detail, thumbnails, footer);
    const groups = project.comparison ? {
      before: project.photos.filter(p => p.photo_phase === 'before'),
      after: project.photos.filter(p => p.photo_phase === 'after'),
    } : { photos: project.photos };
    let phase = project.comparison ? 'after' : 'photos', index = 0, version = 0;
    const selected = { before: 0, after: 0, photos: 0 };
    const tabButtons = {};
    if (project.comparison) for (const key of ['before', 'after']) {
      const tab = button('viewer-tab', key === 'before' ? 'Before' : 'After', () => {
        selected[phase] = index; phase = key; index = selected[phase]; renderThumbnails(); void show();
      });
      tabButtons[key] = tab; tabs.append(tab);
    }
    else tabs.hidden = true;
    function move(direction) {
      const target = index + direction;
      if (target < 0 || target >= groups[phase].length) return;
      index = target; selected[phase] = index; void show();
    }
    function renderThumbnails() {
      thumbnails.replaceChildren();
      groups[phase].forEach((photo, position) => {
        const thumb = button('viewer-thumbnail', '', () => { index = position; selected[phase] = index; void show(); });
        thumb.setAttribute('aria-label', `View ${phase === 'photos' ? '' : phase + ' '}photo ${position + 1}`);
        thumb.append(element('span', 'thumbnail-number', String(position + 1)));
        thumbnails.append(thumb);
        void photoUrl(photo).then(url => { if (thumb.isConnected) thumb.replaceChildren(image(photo, url)); }).catch(() => {});
      });
      thumbnails.hidden = groups[phase].length < 2;
    }
    async function show() {
      const current = ++version, photos = groups[phase], photo = photos[index];
      for (const [key, tab] of Object.entries(tabButtons)) tab.setAttribute('aria-pressed', String(key === phase));
      [...thumbnails.children].forEach((thumb, position) => thumb.setAttribute('aria-pressed', String(position === index)));
      prev.disabled = index === 0; next.disabled = index === photos.length - 1;
      prev.hidden = next.hidden = photos.length < 2;
      counter.textContent = `${project.comparison ? (phase === 'before' ? 'Before · ' : 'After · ') : ''}${index + 1} of ${photos.length}`;
      caption.textContent = photo.caption || photo.title || '';
      photoFrame.replaceChildren(); loading.textContent = 'Loading photo…'; loading.hidden = false;
      stage.setAttribute('aria-busy', 'true');
      try {
        const url = await photoUrl(photo), img = image(photo, url);
        await img.decode();
        if (current !== version || !dialog.open) return;
        photoFrame.replaceChildren(img); loading.hidden = true;
      } catch {
        if (current === version) loading.textContent = 'This photo could not load. Try another photo or reopen the project.';
      } finally { if (current === version) stage.setAttribute('aria-busy', 'false'); }
    }
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    });
    let touchStart;
    stage.addEventListener('touchstart', event => {
      if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    stage.addEventListener('touchend', event => {
      if (!touchStart || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    }, { passive: true });
    let backdropDown = false;
    dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog; });
    dialog.addEventListener('click', event => { if (backdropDown && event.target === dialog) dialog.close(); backdropDown = false; });
    const oldOverflow = document.body.style.overflow;
    dialog.addEventListener('close', () => {
      version++; document.body.style.overflow = oldOverflow; dialog.remove(); opener.focus();
    });
    document.body.append(dialog); dialog.showModal(); document.body.style.overflow = 'hidden';
    renderThumbnails(); void show(); close.focus();
  }
  async function load() {
    try {
      const response = await fetch(`${base}/rest/v1/website_media?select=kind,object_path,title,caption,alt_text,sort_order,created_at,set_id,photo_phase&order=sort_order.asc,created_at.asc`, { headers, cache: 'no-store' });
      if (!response.ok) return;
      const photos = await response.json(); if (!Array.isArray(photos)) return;
      let sets = [];
      try {
        const response = await fetch(`${base}/rest/v1/website_photo_sets?select=id,title,caption,sort_order,created_at&published=eq.true&order=sort_order.asc,created_at.asc`, { headers, cache: 'no-store' });
        if (response.ok) { const rows = await response.json(); if (Array.isArray(rows)) sets = rows.filter(row => row.id && row.title); }
      } catch {}
      await each(photos.filter(photo => photo.kind === 'about' && !photo.set_id).slice(0, 1), async photo => {
        const img = image(photo, await photoUrl(photo)); await img.decode();
        const about = document.getElementById('website-about-photo'); if (!about) return;
        about.replaceChildren(img); if (photo.caption) about.append(element('figcaption', '', photo.caption));
        about.hidden = false; document.getElementById('about-placeholder').hidden = true;
      });
      const projects = [
        ...photos.filter(p => p.kind === 'gallery' && !p.set_id).map(p => ({ title: p.title || 'A Hazard project', caption: p.caption || '', photos: [p], order: p.sort_order || 0, date: p.created_at || '', comparison: false })),
        ...sets.map(set => ({ title: set.title, caption: set.caption || '', photos: photos.filter(p => p.set_id === set.id), order: set.sort_order || 0, date: set.created_at || '', comparison: true })),
      ].filter(project => !project.comparison || ['before', 'after'].every(phase => project.photos.some(p => p.photo_phase === phase)))
        .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
      const gallery = document.getElementById('website-gallery'); if (!gallery) return;
      const cards = [];
      await each(projects, async project => {
        try {
          const coverPhotos = project.comparison ? ['before', 'after'].map(phase => project.photos.find(p => p.photo_phase === phase)) : [project.photos[0]];
          const coverImages = await Promise.all(coverPhotos.map(async photo => { const img = image(photo, await photoUrl(photo)); await img.decode(); return img; }));
          const card = element('article', 'project-card');
          const open = button('project-card-open', '', () => openViewer(project, open));
          open.setAttribute('aria-label', `Explore ${project.title}${project.comparison ? ', before and after' : ''}`);
          const visual = element('div', project.comparison ? 'project-card-visual project-card-pair' : 'project-card-visual');
          coverImages.forEach((img, index) => {
            const panel = element('div', 'project-card-panel'); panel.append(img);
            if (project.comparison) panel.append(element('span', 'project-phase-label', index === 0 ? 'Before' : 'After'));
            visual.append(panel);
          });
          const copy = element('div', 'project-card-copy');
          const category = element('span', 'project-card-category', project.comparison ? 'BEFORE & AFTER' : 'PROJECT SPOTLIGHT');
          const name = element('h3', '', project.title);
          const description = element('p', '', project.caption || (project.comparison ? 'See the transformation, one detail at a time.' : 'Take a closer look at our work.'));
          const bottom = element('div', 'project-card-bottom');
          bottom.append(element('span', '', `${project.photos.length} photo${project.photos.length === 1 ? '' : 's'}`), element('span', 'project-open-label', 'Explore project ↗'));
          copy.append(category, name, description, bottom); open.append(visual, copy); card.append(open);
          cards.push({ project, card });
        } catch {}
      });
      if (!cards.length) return;
      cards.sort((a, b) => projects.indexOf(a.project) - projects.indexOf(b.project));
      const filters = element('div', 'gallery-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filter projects');
      const grid = element('div', 'project-grid');
      const empty = element('p', 'gallery-empty', 'No projects in this collection yet. Explore all projects to see our latest work.'); empty.hidden = true;
      const status = element('p', 'gallery-status'); status.setAttribute('role', 'status');
      const controls = [];
      for (const [key, label] of [['all', 'All projects'], ['comparison', 'Before & after'], ['photos', 'Project photos']]) {
        const control = button('gallery-filter', label, () => {
          let visible = 0;
          cards.forEach(({ project, card }) => { card.hidden = key === 'comparison' ? !project.comparison : key === 'photos' ? project.comparison : false; if (!card.hidden) visible++; });
          controls.forEach(item => item.node.setAttribute('aria-pressed', String(item.key === key)));
          empty.hidden = visible > 0; status.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
        });
        control.setAttribute('aria-pressed', String(key === 'all')); controls.push({ key, node: control }); filters.append(control);
      }
      cards.forEach(({ card }) => grid.append(card));
      status.textContent = `${cards.length} project${cards.length === 1 ? '' : 's'}`;
      gallery.replaceChildren(filters, status, grid, empty); gallery.hidden = false;
      document.getElementById('gallery-placeholder').hidden = true;
      const intro = document.getElementById('gallery-intro');
      if (intro) intro.textContent = 'Real homes. Real progress. Explore the details, from the first look to the final result.';
    } catch { /* Keep the useful existing page and placeholder when media is offline. */ }
  }
  void load();
})();
