# Hazard Home Services public website

Static customer-facing website for `hazardhomeservices.com`. This is a standalone customer website. Keep it in its own GitHub repository and deploy it as its own Cloudflare Pages project. There is no build step. The site reads approved website photos from Supabase using a public client key; private business records remain protected.

## Preview

From this directory, run `python3 -m http.server 8000` and open `http://localhost:8000/`.

## Launch checklist

1. Create a Formspree form under the Hazard business account, with notification delivery to `hazardhomeservices@gmail.com`. Verify the receiving email and send a test submission. Formspree's free tier currently allows 50 submissions per month and 30 days of history. Paste its `https://formspree.io/f/FORM_ID` endpoint into `config.js`. Until then, the request button explicitly opens an email instead of pretending the form submits.
2. In Cloudflare Workers & Pages, create a **Pages** project connected to the **website-only** GitHub repository. Leave Root directory at the repository root, leave Build command blank, and set Build output directory to `.`. Confirm the deployment serves this website and not the private operations app.
3. Test a request from a phone and desktop; confirm it reaches the Gmail inbox. Then attach `hazardhomeservices.com` and `www.hazardhomeservices.com` in the Pages Custom domains settings, with a redirect for one canonical host.
4. Add a public business phone number when chosen. Replace the gallery placeholder with real, approved project photos and captions. Review the service descriptions and county coverage for accuracy.
5. Link the live public website from Google Business Profile after it resolves over HTTPS.

The client form has required fields and helpful errors. Formspree handles the actual message delivery and spam filtering; no customer data is stored in this static site. Do not add secrets to `config.js`.

## Gallery and About Us photos

Photos are managed by Andy and Kenny in the internal app’s **Website** tab. Upload a draft, enter its caption and image description, review the preview, then Publish. Gallery display order is editable. The separate About Us section publishes one photo at a time. Visitors see updates on page refresh without a website rebuild.

`config.js` contains the public Supabase client configuration. `website-media.js` reads published records only and downloads images from the private `hazard-website` bucket using RLS. It does not access private job files. The logo/coming-soon placeholders remain if no photos are published or the photo service is unavailable. Public keys are expected in client code; never add a service-role key.

## Existing Cloudflare Worker deployment

The current customer Worker is `hazard-home-services-website`. Its static-asset configuration is in `wrangler.jsonc`; `.assetsignore` excludes test and development files. In that existing Worker, open **Settings → Builds**, connect `ajbennett4463/Hazard-home-services-website`, select production branch `main`, leave build command blank, use root `/`, and set deploy command to `npx wrangler@4.136.3 deploy`. Deploy the latest main commit. Keep the existing domain attachment. Do not change the internal `hazard-home-services` Worker.

For direct deployment from an authorized computer: `npx wrangler@4.136.3 login`, then `npx wrangler@4.136.3 deploy` from this repository. Never commit Cloudflare tokens.

Photo display tests: install `linkedom` in your test tooling, then run `node tests/website-media.test.cjs`. Database access tests live in the internal app repository at `supabase/tests/website_media.sql`.
