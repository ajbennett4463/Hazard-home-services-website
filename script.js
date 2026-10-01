const menuButton = document.querySelector('#menuButton');
const siteNav = document.querySelector('#siteNav');
menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  siteNav.classList.toggle('open', !isOpen);
});
siteNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  siteNav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
}));
document.querySelector('#year').textContent = new Date().getFullYear();

const form = document.querySelector('#requestForm');
const message = document.querySelector('#formMessage');
const submitButton = document.querySelector('#submitButton');
const endpoint = window.HAZARD_SITE_CONFIG?.formEndpoint?.trim();
const leadEndpoint = window.HAZARD_SITE_CONFIG?.leadEndpoint;
const honeypot = document.createElement('input');
honeypot.name = 'website'; honeypot.type = 'text'; honeypot.tabIndex = -1;
honeypot.autocomplete = 'off'; honeypot.setAttribute('aria-hidden', 'true');
honeypot.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
form.append(honeypot);
let pendingSubmission;
const requestIdentity = async (payload) => {
  const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(payload))))).map(n => n.toString(16).padStart(2, '0')).join('');
  try { pendingSubmission ||= JSON.parse(sessionStorage.getItem('hazard-inquiry-retry') || 'null'); } catch {}
  if (!pendingSubmission || pendingSubmission.signature !== signature) {
    pendingSubmission = { signature, id: crypto.randomUUID() };
    try { sessionStorage.setItem('hazard-inquiry-retry', JSON.stringify(pendingSubmission)); } catch {}
  }
  return pendingSubmission.id;
};
if (!endpoint || !/^https:\/\/formspree\.io\/f\/[\w-]+$/.test(endpoint)) {
  submitButton.innerHTML = 'Open email request <span aria-hidden="true">↗</span>';
  message.innerHTML = 'This opens your email app with the details filled in. Press Send there to deliver it, or write to <a href="mailto:hazardhomeservices@gmail.com">hazardhomeservices@gmail.com</a>.';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const body = [
      `Name: ${fields.get('name')}`, `Phone: ${fields.get('phone')}`,
      `Email: ${fields.get('email')}`, `Project ZIP: ${fields.get('zip')}`,
      `Service: ${fields.get('service')}`, `Preferred contact: ${fields.get('contact_preference')}`,
      '', `Project details:`, String(fields.get('details')),
    ].join('\n');
    window.location.href = `mailto:hazardhomeservices@gmail.com?subject=${encodeURIComponent('Hazard Home Services project request')}&body=${encodeURIComponent(body)}`;
  });
} else {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    message.textContent = '';
    try {
      const fields = new FormData(form);
      if (leadEndpoint) {
        const payload = Object.fromEntries(fields);
        payload.submission_id = await requestIdentity(payload);
        const saved = await fetch(leadEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.HAZARD_SITE_CONFIG.supabaseKey },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
        });
        if (!saved.ok) throw new Error('Request could not be saved');
        // The lead is durable before attempting the independent email notification.
        try {
          const notification = await fetch(endpoint, { method: 'POST', body: fields,
            headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
          if (!notification.ok) console.warn('Email notification unavailable; request saved.');
        } catch { console.warn('Email notification unavailable; request saved.'); }
        pendingSubmission = null;
        try { sessionStorage.removeItem('hazard-inquiry-retry'); } catch {}
      } else {
        const response = await fetch(endpoint, {
          method: 'POST', body: fields, headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Request could not be sent');
      }
      form.reset();
      message.textContent = 'Thanks! We received your request. We’ll be in touch.';
      message.classList.add('success');
    } catch {
      message.innerHTML = 'We couldn’t send your request. Please email <a href="mailto:hazardhomeservices@gmail.com">hazardhomeservices@gmail.com</a> instead.';
      message.classList.remove('success');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Send project request <span aria-hidden="true">↗</span>';
    }
  });
}
