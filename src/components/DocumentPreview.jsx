import React, { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import mammoth from "mammoth";
import { Loader2 } from "lucide-react";
import {
  getFileKind,
  getGoogleEmbedUrl,
  getOfficeEmbedUrl,
  fileTypeLabel,
} from "../Lib/filePreview";

const DocxHtmlWrapper = ({ fileUrl, blockPointerEvents, onFallback }) => {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(fileUrl)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.arrayBuffer();
      })
      .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then((result) => {
        if (!cancelled) setHtml(result.value);
      })
      .catch(() => {
        if (!cancelled) onFallback?.();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, onFallback]);

  if (loading) {
    return (
      <div className="h-[640px] flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#0073ea]" />
      </div>
    );
  }

  if (!html) return null;

  return (
    <div
      data-pdf-surface
      className={`w-full p-8 prose prose-sm max-w-none text-slate-800 min-h-[640px] bg-white ${
        blockPointerEvents ? "pointer-events-none select-none" : ""
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const OfficeIframePreview = ({
  fileUrl,
  fileName,
  pageWidth,
  blockPointerEvents,
  viewer,
  setViewer,
}) => {
  const embedUrl =
    viewer === "office" ? getOfficeEmbedUrl(fileUrl) : getGoogleEmbedUrl(fileUrl);

  return (
    <div data-pdf-surface className="w-full bg-white">
      <iframe
        title={fileName || "Document preview"}
        src={embedUrl}
        className={`w-full border-0 bg-white ${blockPointerEvents ? "pointer-events-none" : ""}`}
        style={{ height: Math.max(640, pageWidth * 1.3), minHeight: 640 }}
        allowFullScreen
      />
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 pointer-events-auto">
        <p className="text-[11px] text-slate-500">
          {fileTypeLabel("office")} preview
          {viewer === "office" ? " · Microsoft Office" : " · Google Docs"}
        </p>
        <button
          type="button"
          onClick={() => setViewer((v) => (v === "office" ? "google" : "office"))}
          className="text-[11px] text-[#0073ea] font-medium hover:underline shrink-0"
        >
          Switch viewer
        </button>
      </div>
    </div>
  );
};

const OfficePreview = ({ fileUrl, fileName, pageWidth, blockPointerEvents }) => {
  const [viewer, setViewer] = useState("office");
  const [useIframe, setUseIframe] = useState(false);
  const isDocx =
    /\.docx$/i.test(fileName || "") || (fileUrl || "").toLowerCase().includes(".docx");

  if (isDocx && !useIframe) {
    return (
      <DocxHtmlWrapper
        fileUrl={fileUrl}
        blockPointerEvents={blockPointerEvents}
        onFallback={() => setUseIframe(true)}
      />
    );
  }

  return (
    <OfficeIframePreview
      fileUrl={fileUrl}
      fileName={fileName}
      pageWidth={pageWidth}
      blockPointerEvents={blockPointerEvents}
      viewer={viewer}
      setViewer={setViewer}
    />
  );
};

const TextPreview = ({ fileUrl, blockPointerEvents }) => {
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 50000));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="h-[480px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#0073ea]" />
      </div>
    );
  }

  if (failed) {
    return (
      <iframe
        title="Document"
        src={fileUrl}
        className={`w-full border-0 ${blockPointerEvents ? "pointer-events-none" : ""}`}
        style={{ height: 640 }}
      />
    );
  }

  return (
    <pre
      data-pdf-surface
      className={`w-full p-6 text-[13px] text-slate-800 whitespace-pre-wrap font-mono leading-relaxed min-h-[480px] ${
        blockPointerEvents ? "pointer-events-none select-none" : ""
      }`}
    >
      {textContent}
    </pre>
  );
};

const DocumentPreview = ({
  fileUrl,
  fileName,
  contentType,
  fileFormat,
  pageWidth,
  numPages,
  onNumPagesChange,
  onPdfError,
  blockPointerEvents = false,
}) => {
  const kind = getFileKind(fileName, contentType, fileFormat);

  if (!fileUrl) {
    return (
      <div className="h-[480px] flex items-center justify-center text-sm text-slate-500">
        No file available.
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div
        data-pdf-surface
        className={`w-full bg-white ${blockPointerEvents ? "pointer-events-none select-none" : ""}`}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => onNumPagesChange?.(n)}
          onLoadError={onPdfError}
          loading={
            <div className="h-[640px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0073ea]" />
            </div>
          }
        >
          {Array.from({ length: numPages || 0 }, (_, index) => (
            <div key={index} className={index < (numPages || 0) - 1 ? "mb-4" : ""}>
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                devicePixelRatio={Math.max(3, window.devicePixelRatio || 1)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))}
        </Document>
      </div>
    );
  }

  if (kind === "image") {
    return (
      <img
        data-pdf-surface
        src={fileUrl}
        alt={fileName || "Document"}
        className={`w-full h-auto block ${blockPointerEvents ? "pointer-events-none select-none" : ""}`}
        draggable={false}
        crossOrigin="anonymous"
      />
    );
  }

  if (kind === "office") {
    return (
      <OfficePreview
        fileUrl={fileUrl}
        fileName={fileName}
        pageWidth={pageWidth}
        blockPointerEvents={blockPointerEvents}
      />
    );
  }

  if (kind === "text") {
    return <TextPreview fileUrl={fileUrl} blockPointerEvents={blockPointerEvents} />;
  }

  return (
    <div data-pdf-surface className="w-full bg-white">
      <iframe
        title={fileName || "Document"}
        src={fileUrl}
        className={`w-full border-0 ${blockPointerEvents ? "pointer-events-none" : ""}`}
        style={{ height: 640 }}
      />
    </div>
  );
};

export { getFileKind };
export default DocumentPreview;
