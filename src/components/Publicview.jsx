import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../Lib/Firebase";
import emailjs from "@emailjs/browser";
import { ACTIVITY_TYPES, logActivity, makeSignatureId } from "../Lib/activity";
import DraggableField from "./DraggableField";
import DocumentPreview, { getFileKind } from "./DocumentPreview";
import { getDownloadUrl } from "../Lib/filePreview";
import { exportSignedDocument, isFieldComplete } from "../Lib/exportSignedDoc";
import {
  sanitizeFields,
  sanitizeParticipants,
  stripUndefined,
} from "../Lib/firestoreUtils";

const FIELD_LABELS = {
  signature: "Signature",
  date: "Date",
  name: "Name",
  text: "Text",
  checkbox: "Checkbox",
};

const Publicview = ({ shareId, token }) => {
  const [docData, setDocData] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [contentType, setContentType] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [placedFields, setPlacedFields] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(720);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Gate: signer must enter name+email before interacting (no login needed)
  const [gatePassed, setGatePassed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  const [signModalField, setSignModalField] = useState(null);
  const [typedSignature, setTypedSignature] = useState("");
  const [fillModalField, setFillModalField] = useState(null);
  const [fillModalValue, setFillModalValue] = useState("");

  const [isCompleted, setIsCompleted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const pdfAreaRef = useRef(null);
  const scrollRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  // 1. Load document + verify public share token + load real file
  useEffect(() => {
    const load = async () => {
      if (!shareId) {
        setError("Invalid document link.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const docRef = doc(db, "documents", shareId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("Document not found or link has expired.");
          return;
        }

        const data = { id: docSnap.id, ...docSnap.data() };

        // Security check: link must be enabled & token must match
        if (!data.publicShareEnabled || !token || data.publicShareToken !== token) {
          setError("This link is invalid or has been disabled by the owner.");
          return;
        }

        setDocData(data);
        setPlacedFields(Array.isArray(data.fields) ? data.fields : []);
        if (data.status === "Completed") setIsCompleted(true);

        // Fetch the actual file (same as owner view)
        const versionId = data.currentVersionId || "version001";
        const versionRef = doc(db, "documents", shareId, "versions", versionId);
        const versionSnap = await getDoc(versionRef);

        if (versionSnap.exists()) {
          const v = versionSnap.data();
          setFileUrl(v.fileUrl || null);
          setFileName(v.fileName || data.title || "Document");
          setContentType(v.contentType || "");
          setFileFormat(v.format || "");
        } else {
          setError("Document file not found. Ask the sender to re-share.");
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setError("Failed to load document details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareId, token]);

  // Responsive preview width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      setPageWidth(Math.max(320, Math.min(820, w - 48)));
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  const fileKind = getFileKind(fileName, contentType, fileFormat);
  const isPreviewable = ["pdf", "image", "office", "text", "other"].includes(fileKind);
  const downloadUrl = getDownloadUrl(fileUrl, fileName);
  const docTitle = docData?.title || fileName || "Untitled Document";

  const canInteract = gatePassed && !isCompleted;

  const openSignModal = (field) => {
    if (!canInteract) return;
    setSignModalField(field);
    setTypedSignature(signerName || signerEmail.split("@")[0] || "");
  };

  const handleFieldAction = (field) => {
    if (!canInteract) return;

    if (field.type === "signature") {
      if (!field.signed) openSignModal(field);
      return;
    }
    if (field.type === "text" || field.type === "name") {
      setFillModalField(field);
      setFillModalValue(field.value || "");
      return;
    }
    if (field.type === "date") {
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      applyFieldFill(field, today);
      return;
    }
    if (field.type === "checkbox") {
      applyFieldFill(field, field.value === "checked" ? "unchecked" : "checked");
    }
  };

  const applyFieldFill = async (field, value) => {
    if (!field) return;
    if (field.type !== "checkbox" && (value === undefined || value === null || !String(value).trim())) {
      showToast("Please enter a value.");
      return;
    }

    const signedAt = new Date().toISOString();
    let patch = {};

    if (field.type === "signature") {
      patch = {
        signed: true,
        signatureValue: String(value).trim(),
        signatureId: makeSignatureId(),
        signedBy: signerEmail,
        signedAt,
        filled: true,
        value: String(value).trim(),
        filledBy: signerEmail,
        filledAt: signedAt,
      };
    } else if (field.type === "checkbox") {
      patch = { filled: value === "checked", value, filledBy: signerEmail, filledAt: signedAt };
    } else {
      const trimmed = String(value).trim();
      patch = { filled: Boolean(trimmed), value: trimmed, filledBy: signerEmail, filledAt: signedAt };
    }

    const nextFields = placedFields.map((f) => (f.id === field.id ? { ...f, ...patch } : f));
    setPlacedFields(nextFields);

    const allComplete = nextFields.length > 0 && nextFields.every((f) => isFieldComplete(f));

    try {
      setSaving(true);
      await updateDoc(
        doc(db, "documents", shareId),
        stripUndefined({
          fields: sanitizeFields(nextFields),
          updatedAt: serverTimestamp(),
          ...(allComplete
            ? {
                status: "Completed",
                completedAt: serverTimestamp(),
                signedByEmail: signerEmail.toLowerCase(),
                signedByName: signerName || "Anonymous Signer",
              }
            : {}),
        })
      );

      if (allComplete) {
        setIsCompleted(true);

        await logActivity({
          type: ACTIVITY_TYPES.DOCUMENT_COMPLETED,
          documentId: shareId,
          documentTitle: docTitle,
          actorEmail: signerEmail,
          actorName: signerName,
          ownerId: docData?.ownerId,
          relatedEmails: [signerEmail, docData?.ownerEmail].filter(Boolean),
        });

        // Notify owner by email
        try {
          const targetOwnerEmail = docData?.ownerEmail || docData?.createdByEmail;
          if (targetOwnerEmail) {
            await emailjs.send(
              import.meta.env.VITE_EMAILJS_SERVICE_ID,
              import.meta.env.VITE_EMAILJS_TEMPLATE_OWNER,
              {
                to_email: targetOwnerEmail.toLowerCase().trim(),
                owner_name: docData?.ownerName || "Document Owner",
                signer_name: signerName || signerEmail,
                signer_email: signerEmail,
                document_title: docTitle,
                signing_link: window.location.href,
              },
              import.meta.env.VITE_EMAILJS_PUBLIC_KEY
            );
          }
        } catch (emailErr) {
          console.error("Owner notification email failed:", emailErr);
        }

        showToast("Document signed — thank you!");
      } else {
        showToast(`${FIELD_LABELS[field.type] || field.type} saved.`);
      }

      setSignModalField(null);
      setFillModalField(null);
      setTypedSignature("");
      setFillModalValue("");
    } catch (err) {
      console.error(err);
      showToast("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const applySignature = async () => {
    if (!signModalField || !typedSignature.trim()) return;
    await applyFieldFill(signModalField, typedSignature.trim());
  };

  const applyTextFill = async () => {
    if (!fillModalField || !fillModalValue.trim()) return;
    const liveField = placedFields.find((f) => f.id === fillModalField.id) || fillModalField;
    await applyFieldFill(liveField, fillModalValue.trim());
  };

  const handleGateSubmit = (e) => {
    e.preventDefault();
    if (!signerName.trim() || !signerEmail.trim()) return;
    setGatePassed(true);
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-slate-400">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100 p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-md w-full text-center">
          <div className="text-red-400 text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">{error}</h2>
          <p className="text-sm text-slate-400">Please verify the URL or ask the sender for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="w-full flex items-center justify-between px-4 md:px-8 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            SingFlow
          </span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
            Public Signing
          </span>
        </div>
        <h1 className="text-sm font-medium text-slate-300 truncate max-w-[50%]">{docTitle}</h1>
        {fileUrl && (
          <button
            type="button"
            onClick={async () => {
              if (!placedFields.some(isFieldComplete)) {
                if (downloadUrl) window.open(downloadUrl, "_blank");
                return;
              }
              try {
                setDownloading(true);
                showToast("Generating signed PDF...");
                await new Promise((r) => setTimeout(r, 150));
                const ok = await exportSignedDocument({
                  fileName,
                  captureElement: pdfAreaRef.current,
                });
                showToast(ok ? "Signed PDF downloaded!" : "Could not generate PDF.");
              } catch (err) {
                console.error(err);
                showToast("Download failed.");
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-60"
          >
            {downloading ? "Preparing…" : placedFields.some(isFieldComplete) ? "Download signed" : "Download"}
          </button>
        )}
      </header>

      {toast && (
        <div className="text-center text-xs text-emerald-400 py-1 bg-emerald-950/40 border-b border-emerald-900">
          {toast}
        </div>
      )}

      {!gatePassed && !isCompleted && (
        <div className="max-w-md mx-auto mt-10 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl w-full">
          <h3 className="text-lg font-semibold mb-1">Before you sign</h3>
          <p className="text-xs text-slate-400 mb-4">
            Enter your name and email — no account needed.
          </p>
          <form onSubmit={handleGateSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              required
              placeholder="Full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              required
              placeholder="Email address"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              Continue to document
            </button>
          </form>
        </div>
      )}

      {isCompleted && (
        <div className="max-w-md mx-auto mt-10 bg-emerald-950/40 border border-emerald-800/50 p-6 rounded-xl text-center w-full">
          <span className="text-3xl block mb-2">✅</span>
          <h4 className="text-emerald-400 font-semibold text-sm">Document Signed</h4>
          <p className="text-xs text-slate-400 mt-1">This document has been completed and verified.</p>
        </div>
      )}

      {(gatePassed || isCompleted) && (
        <>
          {canInteract && (
            <div className="shrink-0 px-4 py-2 bg-emerald-50/10 border-b border-emerald-900 text-center">
              <p className="text-[12px] text-emerald-400 font-medium">
                Click each highlighted field to fill or sign it
              </p>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-auto p-4 sm:p-6">
            <div
              ref={pdfAreaRef}
              data-field-layer
              className="relative mx-auto bg-white shadow-md"
              style={{
                width: isPreviewable ? pageWidth : "100%",
                maxWidth: "100%",
                minHeight: isPreviewable ? Math.max(640, pageWidth * 0.9) : undefined,
              }}
            >
              <DocumentPreview
                fileUrl={fileUrl}
                fileName={fileName}
                contentType={contentType}
                fileFormat={fileFormat}
                pageWidth={pageWidth}
                numPages={numPages}
                onNumPagesChange={setNumPages}
                onPdfError={(err) => {
                  console.error("PDF loading error:", err);
                  setError("Failed to load PDF.");
                }}
                blockPointerEvents={false}
              />

              {placedFields.map((field) => (
                <DraggableField
                  key={field.id}
                  field={field}
                  editable={false}
                  selected={false}
                  onSelect={() => {}}
                  onChange={() => {}}
                  onRemove={() => {}}
                  onFieldAction={handleFieldAction}
                  signerMode={canInteract}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {signModalField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSignModalField(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Apply signature</h3>
            <p className="text-xs text-slate-400 mt-1">Type your name to sign this field.</p>
            <input
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="Your full name"
              className="mt-4 w-full h-11 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-white focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
            <p className="mt-3 text-2xl text-center text-indigo-200 font-serif italic">
              {typedSignature.trim() || "Your signature"}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSignModalField(null)}
                className="flex-1 h-10 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={applySignature}
                disabled={!typedSignature.trim() || saving}
                className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Sign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fillModalField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setFillModalField(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">
              {fillModalField?.filled ? "Edit text" : "Enter text"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {fillModalField?.filled ? "Update" : "Fill"} the {fillModalField?.label} field
            </p>
            <textarea
              value={fillModalValue}
              onChange={(e) => setFillModalValue(e.target.value)}
              placeholder="Type here..."
              rows={3}
              className="mt-4 w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-white focus:border-indigo-500 focus:outline-none resize-y min-h-[80px]"
              autoFocus
            />
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setFillModalField(null)}
                className="flex-1 h-10 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={applyTextFill}
                disabled={!fillModalValue.trim() || saving}
                className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : fillModalField?.filled ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Publicview;