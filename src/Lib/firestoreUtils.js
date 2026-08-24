/** Firestore rejects `undefined` — normalize fields before every write */

export function sanitizeField(field) {
  if (!field?.id) return null;
  return {
    id: field.id,
    type: field.type || "text",
    label: field.label || field.type || "Field",
    x: field.x ?? 0,
    y: field.y ?? 0,
    w: field.w ?? 15,
    h: field.h ?? 5,
    signed: Boolean(field.signed),
    filled: Boolean(field.filled),
    value: field.value ?? null,
    signatureValue: field.signatureValue ?? null,
    signatureId: field.signatureId ?? null,
    signedBy: field.signedBy ?? null,
    signedAt: field.signedAt ?? null,
    filledBy: field.filledBy ?? null,
    filledAt: field.filledAt ?? null,
  };
}

export function sanitizeFields(fields) {
  return (fields || []).map(sanitizeField).filter(Boolean);
}

export function sanitizeParticipant(p) {
  if (!p?.id) return null;
  const out = {
    id: p.id,
    name: p.name || "",
    email: p.email || "",
    role: p.role || "Signer",
    status: p.status || "pending",
  };
  if (p.openedAt != null && p.openedAt !== "") out.openedAt = p.openedAt;
  if (p.signedAt != null && p.signedAt !== "") out.signedAt = p.signedAt;
  if (p.cancelledAt != null && p.cancelledAt !== "") out.cancelledAt = p.cancelledAt;
  return out;
}

export function sanitizeParticipants(participants) {
  return (participants || []).map(sanitizeParticipant).filter(Boolean);
}

/** Strip undefined from plain update payloads (keeps Firestore FieldValue sentinels) */
export function stripUndefined(obj) {
  if (obj === undefined) return undefined;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj.constructor?.name === "FieldValue" || obj._methodName) return obj;

  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    out[key] = stripUndefined(val);
  }
  return out;
}
