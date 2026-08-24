import { pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Bundle the worker with the app so Netlify does not depend on unpkg/CDN.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
