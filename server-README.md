PDF generation service (local)

This repository includes a small script to run a Puppeteer-based PDF service locally.

Quick start
1. From the repository root, install required packages:
   npm install express cors puppeteer body-parser

   Note: Puppeteer downloads Chromium during install. If you prefer to use a system-installed Chrome, set environment variable PUPPETEER_EXECUTABLE_PATH to the path of your chrome executable before running `npm install`.

2. Start the service:
   node generate-pdf-server.js

3. Generate a PDF (example using curl):
   curl -X POST http://localhost:3001/generate-pdf \
     -H "Content-Type: application/json" \
     -d "{ \"url\": \"http://localhost:5173/preview-page\", \"filename\": \"mypdf\" }" --output mypdf.pdf

   Or send HTML directly:
   curl -X POST http://localhost:3001/generate-pdf \
     -H "Content-Type: application/json" \
     -d "{ \"html\": \"<html><body><h1>Hello</h1></body></html>\", \"filename\": \"mypdf\" }" --output mypdf.pdf

Client integration
- From the client, POST the page HTML or a public URL to /generate-pdf and download the response blob as a file.
- Example (fetch):
  const res = await fetch('http://localhost:3001/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/doc', filename: 'doc' })
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'doc.pdf'; a.click();

Security
- Do not expose this service publicly without authentication and rate limiting.
- For production deploy in a separate container/VM and secure access.
