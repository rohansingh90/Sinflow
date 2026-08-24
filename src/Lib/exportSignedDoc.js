import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/** Download blob as file */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fieldDisplayValue(field) {
  if (field.type === "signature") return field.signatureValue || "";
  if (field.type === "checkbox") return field.value === "checked" ? "✓" : "";
  return field.value || field.signatureValue || "";
}

export function isFieldComplete(field) {
  if (field.type === "signature") {
    return Boolean(field.signed && field.signatureValue);
  }
  if (field.type === "checkbox") {
    return Boolean(field.filled && field.value === "checked");
  }
  return Boolean(field.filled && String(field.value || "").trim());
}

function copyCanvasesIntoClone(sourceRoot, clonedDoc) {
  const originals = sourceRoot.querySelectorAll("canvas");
  const clones = clonedDoc.querySelectorAll("canvas");
  originals.forEach((src, index) => {
    const dest = clones[index];
    if (!dest) return;
    dest.width = src.width;
    dest.height = src.height;
    try {
      const ctx = dest.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(src, 0, 0);
    } catch {
      /* tainted canvas — blob-loaded PDFs avoid this */
    }
  });
}

function canvasToJpeg(canvas, quality = 0.92) {
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

async function captureElementToCanvas(captureElement) {
  const width = Math.ceil(captureElement.scrollWidth);
  const height = Math.ceil(captureElement.scrollHeight);

  return html2canvas(captureElement, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    imageTimeout: 20000,
    onclone: (clonedDoc) => {
      copyCanvasesIntoClone(captureElement, clonedDoc);
    },
  });
}

async function exportFromPdfPageCanvases(captureElement, safeName) {
  const pageEls = [...captureElement.querySelectorAll(".react-pdf__Page")];
  if (!pageEls.length) return false;

  const stackRect = captureElement.getBoundingClientRect();
  const fieldNodes = [...captureElement.querySelectorAll("[data-export-field]")];

  const fieldSnapshots = [];
  for (const node of fieldNodes) {
    try {
      const snap = await html2canvas(node, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      const rect = node.getBoundingClientRect();
      fieldSnapshots.push({
        snap,
        left: rect.left - stackRect.left,
        top: rect.top - stackRect.top,
        width: rect.width,
        height: rect.height,
      });
    } catch {
      /* skip a field rather than failing the whole download */
    }
  }

  let pdf = null;

  for (let i = 0; i < pageEls.length; i += 1) {
    const pageEl = pageEls[i];
    const srcCanvas = pageEl.querySelector("canvas");
    if (!srcCanvas) continue;

    const pageRect = pageEl.getBoundingClientRect();
    const pageLeft = pageRect.left - stackRect.left;
    const pageTop = pageRect.top - stackRect.top;

    const out = document.createElement("canvas");
    out.width = srcCanvas.width;
    out.height = srcCanvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    try {
      ctx.drawImage(srcCanvas, 0, 0);
    } catch {
      return false;
    }

    const scaleX = out.width / Math.max(1, pageRect.width);
    const scaleY = out.height / Math.max(1, pageRect.height);

    fieldSnapshots.forEach(({ snap, left, top, width, height }) => {
      const overlaps =
        left + width > pageLeft &&
        left < pageLeft + pageRect.width &&
        top + height > pageTop &&
        top < pageTop + pageRect.height;
      if (!overlaps) return;
      ctx.drawImage(
        snap,
        (left - pageLeft) * scaleX,
        (top - pageTop) * scaleY,
        width * scaleX,
        height * scaleY
      );
    });

    const imgData = canvasToJpeg(out, 0.95);
    if (!imgData) return false;

    const pageWidth = out.width;
    const pageHeight = out.height;
    if (!pdf) {
      pdf = new jsPDF({ orientation: pageWidth > pageHeight ? "landscape" : "portrait", unit: "px", format: [pageWidth, pageHeight] });
    } else {
      pdf.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? "landscape" : "portrait");
    }
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  if (!pdf) return false;
  pdf.save(`${safeName}.pdf`);
  return true;
}

function saveCapturedCanvas(canvas, safeName) {
  const imgData = canvasToJpeg(canvas, 0.92);
  if (!imgData) return false;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const pageWidth = 794;
  const pageHeight = 1123;
  const ratio = pageWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [pageWidth, pageHeight] });

  if (scaledHeight <= pageHeight) {
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, scaledHeight);
  } else {
    let remaining = scaledHeight;
    let srcY = 0;
    let page = 0;

    while (remaining > 0) {
      if (page > 0) pdf.addPage([pageWidth, pageHeight]);
      const sliceHeight = Math.min(pageHeight, remaining);
      const srcSliceHeight = Math.ceil(sliceHeight / ratio);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = srcSliceHeight;
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, srcY, imgWidth, srcSliceHeight, 0, 0, imgWidth, srcSliceHeight);
      }
      const sliceData = canvasToJpeg(sliceCanvas, 0.92);
      if (!sliceData) return false;
      pdf.addImage(sliceData, "JPEG", 0, 0, pageWidth, sliceHeight);
      srcY += srcSliceHeight;
      remaining -= sliceHeight;
      page += 1;
    }
  }

  pdf.save(`${safeName}.pdf`);
  return true;
}

/**
 * Capture the on-screen document layer (exact WYSIWYG — Signed by bracket, etc.)
 * and export as multi-page PDF if needed.
 */
export async function exportSignedDocument({ fileName, captureElement }) {
  if (!captureElement) return false;

  const safeName = (fileName || "document").replace(/\.[^/.]+$/, "") || "signed-document";

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await captureElementToCanvas(captureElement);
    if (saveCapturedCanvas(canvas, safeName)) return true;
  } catch (err) {
    console.warn("html2canvas export failed, trying page-canvas fallback", err);
  }

  try {
    const ok = await exportFromPdfPageCanvases(captureElement, safeName);
    if (ok) return true;
  } catch (err) {
    console.warn("page-canvas export failed", err);
  }

  return false;
}

export const SIGNATURE_FONT =
  "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', 'Dancing Script', cursive";
