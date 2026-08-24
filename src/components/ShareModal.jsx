import React, { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Copy,
  Download,
  Globe,
  Link2,
  Loader2,
  Mail,
  Check,
  X,
} from "lucide-react";
import { db } from "../Lib/Firebase";
import { ACTIVITY_TYPES, logActivity } from "../Lib/activity";
import { getDownloadUrl, getPublicShareUrl, makeShareToken } from "../Lib/filePreview";

const ShareModal = ({
  isOpen,
  onClose,
  docId,
  docTitle,
  fileUrl,
  fileName,
  user,
  participants,
  onParticipantsChange,
  publicShareEnabled: initialPublicEnabled,
  publicShareToken: initialPublicToken,
  onShareSettingsChange,
}) => {
  const [tab, setTab] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(initialPublicEnabled || false);
  const [shareToken, setShareToken] = useState(initialPublicToken || "");

  useEffect(() => {
    setPublicEnabled(initialPublicEnabled || false);
    setShareToken(initialPublicToken || "");
  }, [initialPublicEnabled, initialPublicToken, isOpen]);

  if (!isOpen) return null;

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2800);
  };

  const handleEmailShare = async () => {
    if (!email.trim()) {
      showMsg("Enter an email address.");
      return;
    }

    const normalized = email.trim().toLowerCase();
    if (participants.some((p) => p.email?.toLowerCase() === normalized && p.status !== "cancelled")) {
      showMsg("This email is already added.");
      return;
    }

    const person = {
      id: `p-${Date.now()}`,
      name: name.trim() || normalized.split("@")[0],
      email: normalized,
      role: "Signer",
      status: "pending",
    };

    const next = [...participants.filter((p) => p.email?.toLowerCase() !== normalized), person];

    try {
      setSaving(true);
      const emails = next.filter((p) => p.status !== "cancelled").map((p) => p.email.toLowerCase());
      await updateDoc(doc(db, "documents", docId), {
        participants: next,
        sharedWith: emails,
        updatedAt: serverTimestamp(),
      });
      onParticipantsChange?.(next, emails);

      await logActivity({
        type: ACTIVITY_TYPES.DOCUMENT_SENT,
        documentId: docId,
        documentTitle: docTitle,
        actorId: user?.uid,
        actorEmail: user?.email?.toLowerCase(),
        actorName: user?.displayName,
        ownerId: user?.uid,
        relatedEmails: emails,
        meta: { sharedEmail: normalized },
      });

      showMsg(`Shared with ${normalized}`);
      setEmail("");
      setName("");
    } catch (err) {
      console.error(err);
      showMsg("Failed to share. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublicLink = async () => {
    try {
      setSaving(true);
      let token = shareToken;
      let enabled = !publicEnabled;

      if (enabled && !token) {
        token = makeShareToken();
      }

      await updateDoc(doc(db, "documents", docId), {
        publicShareEnabled: enabled,
        publicShareToken: enabled ? token : shareToken,
        updatedAt: serverTimestamp(),
      });

      setPublicEnabled(enabled);
      setShareToken(token);
      onShareSettingsChange?.({ publicShareEnabled: enabled, publicShareToken: token });
      showMsg(enabled ? "Public link enabled." : "Public link disabled.");
    } catch (err) {
      console.error(err);
      showMsg("Could not update link settings.");
    } finally {
      setSaving(false);
    }
  };

  const regenerateLink = async () => {
    try {
      setSaving(true);
      const token = makeShareToken();
      await updateDoc(doc(db, "documents", docId), {
        publicShareEnabled: true,
        publicShareToken: token,
        updatedAt: serverTimestamp(),
      });
      setPublicEnabled(true);
      setShareToken(token);
      onShareSettingsChange?.({ publicShareEnabled: true, publicShareToken: token });
      showMsg("New link generated.");
    } catch (err) {
      console.error(err);
      showMsg("Failed to regenerate link.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    const url = getPublicShareUrl(docId, shareToken);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showMsg("Copy failed — select and copy manually.");
    }
  };

  const downloadUrl = getDownloadUrl(fileUrl, fileName);
  const publicUrl = publicEnabled && shareToken ? getPublicShareUrl(docId, shareToken) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Share document</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[320px]">{docTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors ${
              tab === "email"
                ? "text-[#0073ea] border-b-2 border-[#0073ea] bg-blue-50/30"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setTab("link")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors ${
              tab === "link"
                ? "text-[#0073ea] border-b-2 border-[#0073ea] bg-blue-50/30"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Public link
          </button>
        </div>

        <div className="p-5">
          {message && (
            <p className="mb-3 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          {tab === "email" ? (
            <div className="space-y-3">
              <p className="text-[12px] text-slate-500">
                Share via email. The recipient will see this document in their dashboard.
              </p>
              <input
                type="text"
                placeholder="Full name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
              />
              <button
                type="button"
                onClick={handleEmailShare}
                disabled={saving}
                className="w-full h-10 rounded-lg bg-[#0073ea] text-white text-sm font-medium hover:bg-[#0067d4] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Share via email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Public link</p>
                    <p className="text-[11px] text-slate-500">Anyone with the link can view</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={togglePublicLink}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    publicEnabled ? "bg-[#0073ea]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      publicEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {publicEnabled && publicUrl && (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    Share link
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={publicUrl}
                      className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 truncate"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 text-sm font-medium shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={regenerateLink}
                    disabled={saving}
                    className="text-[12px] text-[#0073ea] hover:text-[#005fc4] font-medium"
                  >
                    Regenerate link
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <a
              href={downloadUrl}
              download={fileName || "document"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download original file
            </a>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              After signing, download the signed document from here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
