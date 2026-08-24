/*
Lightweight PDF generation service using Puppeteer.
Run instructions (from repository root):
  npm install express cors puppeteer body-parser
  node generate-pdf-server.js

Service:
  POST /generate-pdf
    JSON body: { html: "<html>..</html>", url: "https://...", filename: "name" }
    Provide either `html` or `url`. `filename` optional.

Responds with application/pdf and Content-Disposition attachment.
*/

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
  return browserPromise;
}

app.get('/health', (req, res) => res.send({ ok: true }));

app.post('/generate-pdf', async (req, res) => {
  const { html, url, filename } = req.body || {};
  if (!html && !url) return res.status(400).send({ error: 'Provide html or url in request body' });

  try {
    const browser = await getBrowser();
    const page = await (await browser).newPage();

    // Set a stable viewport so CSS media/print rules render consistently
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

    // If html provided, set content; otherwise navigate to url
    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle0' });
    } else {
      await page.goto(url, { waitUntil: 'networkidle0' });

      // If a selector was provided, replace the body with that element's outerHTML
      if (selector) {
        try {
          await page.waitForSelector(selector, { timeout: 7000 });
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              // preserve base href so relative assets still resolve
              const base = document.querySelector('base');
              const baseHref = base ? base.getAttribute('href') : location.origin;
              document.documentElement.innerHTML = '<head><base href="' + baseHref + '"></head><body></body>';
              const wrapper = document.createElement('div');
              wrapper.appendChild(el.cloneNode(true));
              document.body.appendChild(wrapper);
            }
          }, selector);

          // Give the page a moment to load any images/fonts inside the extracted element
          await page.waitForTimeout(500);
        } catch (e) {
          console.warn('Selector not found or timed out in page:', selector);
        }
      }
    }

    // Emulate print CSS media so @media print rules apply (use 'print' for true print styling)
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1
    });

    // Close page to free resources
    await page.close();

    res.setHeader('Content-Type', 'application/pdf');
    const outName = (filename || 'document') + '.pdf';
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send({ error: 'PDF generation failed', detail: err.message });
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try {
    if (browserPromise) {
      const b = await browserPromise;
      await b.close();
    }
  } catch (e) {}
  process.exit();
});

app.listen(PORT, () => console.log(`PDF service listening on http://localhost:${PORT}`));
