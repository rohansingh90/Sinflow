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


// export async function exportSignedDocument({ fileName, captureElement }) {
//   // Direct client-side export using html2canvas + jsPDF so a single click
//   // downloads a PDF without opening a print dialog or requiring a server.
//   if (!captureElement) return false;

//   const safeName = (fileName || "document").replace(/\.[^/.]+$/, "");

//   // Wait for web fonts to load to avoid blank/misplaced text
//   if (document.fonts && document.fonts.ready) {
//     try { await document.fonts.ready; } catch (e) { /* ignore */ }
//   }

//   // Keep scale modest (2x). Pushing this higher just upscales whatever
//   // resolution the source page/canvas already has — it does not add real
//   // detail, and blows up file size for no visual benefit.
//   const scale = 2;

//   // Capture full element dimensions
//   const width = Math.ceil(captureElement.scrollWidth);
//   const height = Math.ceil(captureElement.scrollHeight);

//   const canvas = await html2canvas(captureElement, {
//     scale,
//     useCORS: true,
//     allowTaint: false,
//     backgroundColor: '#ffffff',
//     logging: false,
//     width,
//     height,
//     windowWidth: document.documentElement.scrollWidth,
//     windowHeight: document.documentElement.scrollHeight,
//     scrollX: -window.scrollX,
//     scrollY: -window.scrollY,
//   });

//   // JPEG at high quality keeps file size sane. PNG here just makes huge
//   // files without improving quality, since the source canvas itself is the
//   // resolution bottleneck (fix that in DocumentPreview.jsx instead).
//   const imgData = canvas.toDataURL('image/jpeg', 0.92);
//   const imgWidth = canvas.width;
//   const imgHeight = canvas.height;

//   // A4 in px at 96dpi: 210mm * 96/25.4 ≈ 794px
//   const pageWidth = 794;
//   const pageHeight = 1123;
//   const ratio = pageWidth / imgWidth;
//   const scaledHeight = imgHeight * ratio;

//   const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pageWidth, pageHeight] });

//   if (scaledHeight <= pageHeight) {
//     pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, scaledHeight);
//   } else {
//     let remaining = scaledHeight;
//     let srcY = 0;
//     let page = 0;

//     while (remaining > 0) {
//       if (page > 0) pdf.addPage([pageWidth, pageHeight]);

//       const sliceHeight = Math.min(pageHeight, remaining);
//       const srcSliceHeight = Math.ceil(sliceHeight / ratio);

//       const sliceCanvas = document.createElement('canvas');
//       sliceCanvas.width = imgWidth;
//       sliceCanvas.height = srcSliceHeight;
//       const ctx = sliceCanvas.getContext('2d');
//       if (ctx) {
//         ctx.imageSmoothingEnabled = true;
//         if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
//       }
//       ctx.drawImage(canvas, 0, srcY, imgWidth, srcSliceHeight, 0, 0, imgWidth, srcSliceHeight);

//       const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
//       pdf.addImage(sliceData, 'JPEG', 0, 0, pageWidth, sliceHeight);

//       srcY += srcSliceHeight;
//       remaining -= sliceHeight;
//       page += 1;
//     }
//   }

//   // Trigger download
//   pdf.save(`${safeName}.pdf`);
//   return true;
// }



export async function exportSignedDocument({ fileName, captureElement }) {
  if (!captureElement) return false;

  const safeName = (fileName || "document").replace(/\.[^/.]+$/, "");

  // 1. Wait for web fonts to load
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      /* ignore */
    }
  }

  // 2. Small delay to allow DOM/signatures to finish painting
  await new Promise((resolve) => setTimeout(resolve, 350));

  const scale = 2;
  const width = Math.ceil(captureElement.scrollWidth);
  const height = Math.ceil(captureElement.scrollHeight);

  const canvas = await html2canvas(captureElement, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width,
    height,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    // Fix: Force visibility on cloned DOM for html2canvas
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.querySelector("[data-pdf-surface]") || clonedDoc.body;
      if (clonedElement) {
        clonedElement.style.visibility = "visible";
        clonedElement.style.opacity = "1";
      }
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 dimensions in px
  const pageWidth = 794;
  const pageHeight = 1123;
  const ratio = pageWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [pageWidth, pageHeight],
  });

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
      }
      ctx.drawImage(
        canvas,
        0,
        srcY,
        imgWidth,
        srcSliceHeight,
        0,
        0,
        imgWidth,
        srcSliceHeight
      );

      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(sliceData, "JPEG", 0, 0, pageWidth, sliceHeight);

      srcY += srcSliceHeight;
      remaining -= sliceHeight;
      page += 1;
    }
  }

  pdf.save(`${safeName}.pdf`);
  return true;
}

export const SIGNATURE_FONT =
  "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";




















