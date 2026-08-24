import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./Firebase";

/** Canonical activity event types */
export const ACTIVITY_TYPES = {
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_SENT: "DOCUMENT_SENT",
  DOCUMENT_OPENED: "DOCUMENT_OPENED",
  COMMENT_ADDED: "COMMENT_ADDED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  APPROVED: "APPROVED",
  SIGNING_STARTED: "SIGNING_STARTED",
  SIGNED: "SIGNED",
  DOCUMENT_COMPLETED: "DOCUMENT_COMPLETED",
};

/** Human-readable titles shown in the Activity feed */
export const ACTIVITY_TITLES = {
  DOCUMENT_CREATED: "Document created",
  DOCUMENT_UPLOADED: "Document uploaded",
  DOCUMENT_SENT: "Document sent for signing",
  DOCUMENT_OPENED: "Document opened",
  COMMENT_ADDED: "Comment added",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Document approved",
  SIGNING_STARTED: "Signing started",
  SIGNED: "Client signed",
  DOCUMENT_COMPLETED: "Document completed",
};

/** Map legacy lowercase types → new constants */
const LEGACY_TYPE_MAP = {
  document_uploaded: "DOCUMENT_UPLOADED",
  document_sent: "DOCUMENT_SENT",
  document_opened: "DOCUMENT_OPENED",
  client_signed: "SIGNED",
  document_completed: "DOCUMENT_COMPLETED",
  participant_added: "DOCUMENT_SENT",
  signer_cancelled: "CHANGES_REQUESTED",
  document_saved: "DOCUMENT_CREATED",
};

export function normalizeActivityType(type) {
  if (!type) return null;
  if (ACTIVITY_TITLES[type]) return type;
  return LEGACY_TYPE_MAP[type] || type;
}

export function getActivityTitle(type, fallbackTitle) {
  const normalized = normalizeActivityType(type);
  return ACTIVITY_TITLES[normalized] || fallbackTitle || "Activity";
}

/**
 * Write an activity event visible to the owner and related participants.
 */
export async function logActivity({
  type,
  title,
  documentId = null,
  documentTitle = "",
  actorId = null,
  actorEmail = null,
  actorName = null,
  ownerId = null,
  relatedEmails = [],
  meta = {},
}) {
  const normalized = normalizeActivityType(type) || type;
  const emails = Array.from(
    new Set(
      [...relatedEmails, actorEmail, ...(meta.sharedWith || [])]
        .filter(Boolean)
        .map((e) => String(e).toLowerCase())
    )
  );

  await addDoc(collection(db, "activities"), {
    type: normalized,
    title: title || getActivityTitle(normalized),
    documentId,
    documentTitle: documentTitle || "Untitled Document",
    actorId,
    actorEmail: actorEmail ? String(actorEmail).toLowerCase() : null,
    actorName: actorName || null,
    ownerId,
    relatedEmails: emails,
    meta,
    createdAt: serverTimestamp(),
  });
}

export function makeSignatureId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
