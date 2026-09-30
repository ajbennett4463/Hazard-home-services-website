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
      const response = await fetch(endpoint, {
        method: 'POST', body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Request could not be sent');
      form.reset();
      message.textContent = 'Thanks! Your request was sent. We’ll be in touch.';
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
