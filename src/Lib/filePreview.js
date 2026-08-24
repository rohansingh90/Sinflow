/** Detect preview kind from MIME type and filename */
export function getFileKind(fileName = "", contentType = "", format = "") {
  const name = fileName.toLowerCase();
  const mime = (contentType || "").toLowerCase();
  const ext = (format || name.split(".").pop() || "").toLowerCase();

  const hasExt = (list) => list.some((e) => name.endsWith(e) || ext === e.replace(".", ""));

  if (mime.includes("pdf") || hasExt([".pdf"]) || ext === "pdf") return "pdf";

  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
  ) {
    return "image";
  }

  if (
    mime.includes("word") ||
    mime.includes("msword") ||
    mime.includes("officedocument.wordprocessing") ||
    hasExt([".doc", ".docx", ".odt", ".rtf"])
  ) {
    return "office";
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    hasExt([".xls", ".xlsx", ".ods", ".csv"])
  ) {
    return "office";
  }

  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    hasExt([".ppt", ".pptx", ".odp"])
  ) {
    return "office";
  }

  if (mime.startsWith("text/") || hasExt([".txt", ".md", ".log"])) {
    return "text";
  }

  return "other";
}

export function getOfficeEmbedUrl(fileUrl) {
  if (!fileUrl) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function getGoogleEmbedUrl(fileUrl) {
  if (!fileUrl) return null;
  return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}

/** Cloudinary force-download URL */
export function getDownloadUrl(fileUrl, fileName = "document") {
  if (!fileUrl) return null;
  if (fileUrl.includes("res.cloudinary.com") && fileUrl.includes("/upload/")) {
    const withAttachment = fileUrl.replace("/upload/", "/upload/fl_attachment/");
    return withAttachment;
  }
  return fileUrl;
}

export function getPublicShareUrl(docId, token) {
  if (!docId || !token) return "";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/?share=${docId}&token=${token}`;
}

export function makeShareToken() {
  const part = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${part}${time}`;
}

export function fileTypeLabel(kind) {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "office":
      return "Office document";
    case "text":
      return "Text file";
    default:
      return "Document";
  }
}
