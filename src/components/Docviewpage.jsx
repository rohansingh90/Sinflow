import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { pdfjs } from "react-pdf";
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Download,
  Loader2,
  PenLine,
  Plus,
  Send,
  Share2,
  Type,
  User,
  X,
} from "lucide-react";
import { auth, db } from "../Lib/Firebase";
import { ACTIVITY_TYPES, logActivity, makeSignatureId } from "../Lib/activity";
import DraggableField from "./DraggableField";
import DocumentPreview, { getFileKind } from "./DocumentPreview";
import ShareModal from "./ShareModal";
import { getDownloadUrl } from "../Lib/filePreview";
import { exportSignedDocument, isFieldComplete } from "../Lib/exportSignedDoc";
import emailjs from '@emailjs/browser';
import {
  sanitizeFields,
  sanitizeParticipants,
  stripUndefined,
} from "../Lib/firestoreUtils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FIELD_TYPES = [
  { id: "signature", label: "Signature", icon: PenLine, accent: "border-blue-200 bg-blue-50/90 text-blue-700" },
  { id: "date", label: "Date", icon: Calendar, accent: "border-violet-200 bg-violet-50/90 text-violet-700" },
  { id: "name", label: "Name", icon: User, accent: "border-emerald-200 bg-emerald-50/90 text-emerald-700" },
  { id: "text", label: "Text", icon: Type, accent: "border-slate-200 bg-slate-50/90 text-slate-700" },
  { id: "checkbox", label: "Checkbox", icon: CheckSquare, accent: "border-amber-200 bg-amber-50/90 text-amber-700" },
];

const DEFAULT_SIZE = {
  signature: { w: 26, h: 14 },
  date: { w: 18, h: 6 },
  name: { w: 20, h: 6 },
  text: { w: 22, h: 7 },
  checkbox: { w: 5, h: 5 },
};

const WORKFLOW_STEPS = [
  { id: "draft", label: "Draft" },
  { id: "signing", label: "Signing" },
  { id: "completed", label: "Completed" },
];

const statusBadge = (status) => {
  const s = (status || "pending").toLowerCase();
  if (s === "signed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "opened" || s === "signing") return "bg-amber-50 text-amber-700 border-amber-100";
  if (s === "cancelled") return "bg-rose-50 text-rose-600 border-rose-100";
  return "bg-slate-50 text-slate-500 border-slate-200";
};

const Docviewpage = ({ docData, setOpenDoc, user }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [contentType, setContentType] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedField, setSelectedField] = useState(null);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [placedFields, setPlacedFields] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [docStatus, setDocStatus] = useState(docData?.status || "Draft");
  const [ownerId, setOwnerId] = useState(docData?.ownerId || null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantForm, setParticipantForm] = useState({ name: "", email: "" });
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(720);
  const [signModalField, setSignModalField] = useState(null);
  const [typedSignature, setTypedSignature] = useState("");
  const [fillModalField, setFillModalField] = useState(null);
  const [fillModalValue, setFillModalValue] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [sharedWithLive, setSharedWithLive] = useState(docData?.sharedWith || []);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publicShareEnabled, setPublicShareEnabled] = useState(false);
  const [publicShareToken, setPublicShareToken] = useState("");

  const pdfAreaRef = useRef(null);
  const scrollRef = useRef(null);
  const openedTrackedRef = useRef(false);

  const currentUser = user || auth.currentUser;
  const userEmail = (currentUser?.email || "").toLowerCase();
  const isOwner = !ownerId || ownerId === currentUser?.uid;
  const isSharedRecipient = Array.isArray(sharedWithLive)
    ? sharedWithLive.map((e) => String(e).toLowerCase()).includes(userEmail)
    : false;
  const myParticipant = participants.find((p) => p.email?.toLowerCase() === userEmail);
  const isSignerMode =
    !isOwner &&
    isSharedRecipient &&
    myParticipant?.status !== "cancelled" &&
    (docStatus === "Signing" || docStatus === "Completed");
  const canEditFields = isOwner && docStatus !== "Completed" && docStatus !== "Signing";
  const canManageParticipants = isOwner && docStatus !== "Completed";

  const docTitle = docData?.title || fileName || "Untitled Document";

  emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

  useEffect(() => {
    const fetchDocumentVersion = async () => {
      if (!docData?.id) {
        setError("Document not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const versionId = docData.currentVersionId || "version001";
        const versionRef = doc(db, "documents", docData.id, "versions", versionId);
        const versionSnap = await getDoc(versionRef);

        if (!versionSnap.exists()) {
          setError("Document file not found. Please re-upload this document.");
          return;
        }

        const versionData = versionSnap.data();
        setFileUrl(versionData.fileUrl || null);
        setFileName(versionData.fileName || docData.title || "Document");
        setContentType(versionData.contentType || "");
        setFileFormat(versionData.format || "");

        const liveRef = doc(db, "documents", docData.id);
        const liveSnap = await getDoc(liveRef);
        const live = liveSnap.exists() ? liveSnap.data() : docData;

        setDocStatus(live.status || "Draft");
        setOwnerId(live.ownerId || docData.ownerId || null);
        setPlacedFields(Array.isArray(live.fields) ? live.fields : []);
        setParticipants(Array.isArray(live.participants) ? live.participants : []);
        setSharedWithLive(Array.isArray(live.sharedWith) ? live.sharedWith : []);
        setPublicShareEnabled(Boolean(live.publicShareEnabled));
        setPublicShareToken(live.publicShareToken || "");
      } catch (err) {
        console.error("Error loading document:", err);
        setError("Failed to load document. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentVersion();
  }, [docData]);

  // Track when signer opens the document
  useEffect(() => {
    if (loading || !docData?.id || openedTrackedRef.current) return;
    if (isOwner || docStatus !== "Signing") return;
    if (!isSharedRecipient || !myParticipant) return;
    if (myParticipant.status === "signed" || myParticipant.status === "cancelled") return;
    if (myParticipant.status === "opened") {
      openedTrackedRef.current = true;
      return;
    }

    openedTrackedRef.current = true;

    const markOpened = async () => {
      const openedAt = new Date().toISOString();
      const nextParticipants = participants.map((p) =>
        p.email?.toLowerCase() === userEmail
          ? { ...p, status: "opened", openedAt }
          : p
      );

      try {
        await updateDoc(
          doc(db, "documents", docData.id),
          stripUndefined({
            participants: sanitizeParticipants(nextParticipants),
            updatedAt: serverTimestamp(),
          })
        );
        setParticipants(nextParticipants);

        await logActivity({
          type: ACTIVITY_TYPES.DOCUMENT_OPENED,
          documentId: docData.id,
          documentTitle: docTitle,
          actorId: currentUser?.uid,
          actorEmail: userEmail,
          actorName: myParticipant.name || currentUser?.displayName,
          ownerId: ownerId,
          relatedEmails: [userEmail, ...(sharedWithLive || [])],
        });
      } catch (err) {
        console.error("Failed to mark opened:", err);
        openedTrackedRef.current = false;
      }
    };

    markOpened();
  }, [
    loading,
    docData?.id,
    isOwner,
    docStatus,
    isSharedRecipient,
    myParticipant?.status,
    participants,
    userEmail,
  ]);

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
  const isPdf = fileKind === "pdf";
  const isPreviewable = ["pdf", "image", "office", "text", "other"].includes(fileKind);
  const isImage = fileKind === "image";

  const downloadUrl = getDownloadUrl(fileUrl, fileName);

  const currentStepIndex = WORKFLOW_STEPS.findIndex(
    (step) => step.label.toLowerCase() === (docStatus || "Draft").toLowerCase()
  );

  const showToast = (msg) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(""), 2800);
  };

  const handlePdfAreaClick = (event) => {
    if (!canEditFields || !selectedField || !pdfAreaRef.current) return;

    const rect = pdfAreaRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const size = DEFAULT_SIZE[selectedField] || { w: 18, h: 5 };
    const fieldType = FIELD_TYPES.find((f) => f.id === selectedField);

    const next = {
      id: `${selectedField}-${Date.now()}`,
      type: selectedField,
      label: fieldType?.label || selectedField,
      x: Math.min(100 - size.w, Math.max(0, x - size.w / 2)),
      y: Math.min(100 - size.h, Math.max(0, y - size.h / 2)),
      w: size.w,
      h: size.h,
      signed: false,
      filled: false,
      value: null,
      signatureValue: null,
      signatureId: null,
      signedBy: null,
      signedAt: null,
      filledBy: null,
      filledAt: null,
    };

    setPlacedFields((prev) => [...prev, next]);
    setActiveFieldId(next.id);
  };

  const updateField = (fieldId, patch) => {
    setPlacedFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    );
  };

  const removeField = (fieldId) => {
    setPlacedFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (activeFieldId === fieldId) setActiveFieldId(null);
  };

  const handleAddParticipant = async () => {
    if (!participantForm.name.trim() || !participantForm.email.trim()) return;

    const email = participantForm.email.trim().toLowerCase();
    if (participants.some((p) => p.email.toLowerCase() === email && p.status !== "cancelled")) {
      showToast("This email is already added.");
      return;
    }

    const person = {
      id: `p-${Date.now()}`,
      name: participantForm.name.trim(),
      email,
      role: "Signer",
      status: "pending",
    };

    const next = [...participants.filter((p) => p.email.toLowerCase() !== email), person];
    setParticipants(next);
    setParticipantForm({ name: "", email: "" });
    setShowAddParticipant(false);

    // If already sent, persist immediately so they see it on their dashboard
    if (docStatus === "Signing" && docData?.id) {
      const emails = next
        .filter((p) => p.status !== "cancelled")
        .map((p) => p.email.toLowerCase());
      try {
        await updateDoc(
          doc(db, "documents", docData.id),
          stripUndefined({
            participants: sanitizeParticipants(next),
            sharedWith: emails,
            updatedAt: serverTimestamp(),
          })
        );
        setSharedWithLive(emails);
        await logActivity({
          type: ACTIVITY_TYPES.DOCUMENT_SENT,
          documentId: docData.id,
          documentTitle: docTitle,
          actorId: currentUser?.uid,
          actorEmail: userEmail,
          actorName: currentUser?.displayName,
          ownerId: ownerId || currentUser?.uid,
          relatedEmails: emails,
        });
        showToast("Signer added.");
      } catch (err) {
        console.error(err);
        showToast("Failed to add signer.");
      }
    }
  };

  const removeParticipant = async (id) => {
    const person = participants.find((p) => p.id === id);
    if (!person) return;

    if (person.status === "signed") {
      showToast("Cannot cancel — this signer already signed.");
      return;
    }

    // After send: soft-cancel. Before send: hard remove.
    let next;
    if (docStatus === "Signing" || docStatus === "Completed") {
      next = participants.map((p) =>
        p.id === id
          ? { ...p, status: "cancelled", cancelledAt: new Date().toISOString() }
          : p
      );
    } else {
      next = participants.filter((p) => p.id !== id);
    }

    setParticipants(next);

    const emails = next
      .filter((p) => p.status !== "cancelled")
      .map((p) => p.email.toLowerCase());

    if (docData?.id && (docStatus === "Signing" || docStatus === "Draft")) {
      try {
        await updateDoc(
          doc(db, "documents", docData.id),
          stripUndefined({
            participants: sanitizeParticipants(next),
            sharedWith: emails,
            fields: sanitizeFields(placedFields),
            updatedAt: serverTimestamp(),
          })
        );
        setSharedWithLive(emails);

        if (docStatus === "Signing") {
          await logActivity({
            type: ACTIVITY_TYPES.CHANGES_REQUESTED,
            title: "Signer cancelled",
            documentId: docData.id,
            documentTitle: docTitle,
            actorId: currentUser?.uid,
            actorEmail: userEmail,
            actorName: currentUser?.displayName,
            ownerId: ownerId || currentUser?.uid,
            relatedEmails: [...emails, person.email],
            meta: { cancelledEmail: person.email, cancelledName: person.name },
          });
        }
        showToast("Signer cancelled.");
      } catch (err) {
        console.error(err);
        showToast("Failed to cancel signer.");
      }
    }
  };

  const persistDocument = async (extra = {}) => {
    if (!docData?.id) return;
    const active = participants.filter((p) => p.status !== "cancelled");
    const payload = stripUndefined({
      fields: sanitizeFields(placedFields),
      participants: sanitizeParticipants(participants),
      sharedWith: active.map((p) => p.email.toLowerCase()),
      updatedAt: serverTimestamp(),
      ...extra,
    });
    await updateDoc(doc(db, "documents", docData.id), payload);
    setSharedWithLive(payload.sharedWith);
    return payload;
  };

  const handleSave = async () => {
    if (!isOwner) {
      showToast("Only the owner can save layout changes.");
      return;
    }
    try {
      setSaving(true);
      await persistDocument();
      showToast("Document saved successfully.");
    } catch (err) {
      console.error(err);
      showToast("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // const handleSend = async () => {
  //   if (!isOwner) return;

  //   const active = participants.filter((p) => p.status !== "cancelled");
  //   if (active.length === 0) {
  //     showToast("Add at least one signer before sending.");
  //     return;
  //   }

  //   try {
  //     setSaving(true);
  //     const emails = active.map((p) => p.email.toLowerCase());
  //     await persistDocument({
  //       status: "Signing",
  //       sentAt: serverTimestamp(),
  //       ownerEmail: userEmail || null,
  //     });
  //     setDocStatus("Signing");

  //     await logActivity({
  //       type: ACTIVITY_TYPES.DOCUMENT_SENT,
  //       documentId: docData.id,
  //       documentTitle: docTitle,
  //       actorId: currentUser?.uid,
  //       actorEmail: userEmail,
  //       actorName: currentUser?.displayName,
  //       ownerId: ownerId || currentUser?.uid,
  //       relatedEmails: emails,
  //     });

  //     await logActivity({
  //       type: ACTIVITY_TYPES.SIGNING_STARTED,
  //       documentId: docData.id,
  //       documentTitle: docTitle,
  //       actorId: currentUser?.uid,
  //       actorEmail: userEmail,
  //       actorName: currentUser?.displayName,
  //       ownerId: ownerId || currentUser?.uid,
  //       relatedEmails: emails,
  //     });

  //     showToast("Document shared with signers.");
  //   } catch (err) {
  //     console.error(err);
  //     showToast("Failed to send. Please try again.");
  //   } finally {
  //     setSaving(false);
  //   }
  // };







 const handleSend = async () => {
  if (!isOwner) return;

  const active = participants.filter((p) => p.status !== "cancelled");
  if (active.length === 0) {
    showToast("Add at least one signer before sending.");
    return;
  }

  try {
    setSaving(true);
    const emails = active.map((p) => p.email.toLowerCase());

    // 🔑 1. Public share token generate karo (agar pehle se nahi hai to)
    const shareToken =
      publicShareToken ||
      (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // 2. Document save — status + public share fields dono ek saath
    await persistDocument({
      status: "Signing",
      sentAt: serverTimestamp(),
      ownerEmail: userEmail || null,
      ownerName: currentUser?.displayName || null,
      publicShareEnabled: true,
      publicShareToken: shareToken,
    });
    setDocStatus("Signing");
    setPublicShareEnabled(true);
    setPublicShareToken(shareToken);

    // 3. Activity Logs (waise hi rakha)
    await logActivity({
      type: ACTIVITY_TYPES.DOCUMENT_SENT,
      documentId: docData.id,
      documentTitle: docTitle,
      actorId: currentUser?.uid,
      actorEmail: userEmail,
      actorName: currentUser?.displayName,
      ownerId: ownerId || currentUser?.uid,
      relatedEmails: emails,
    });

    await logActivity({
      type: ACTIVITY_TYPES.SIGNING_STARTED,
      documentId: docData.id,
      documentTitle: docTitle,
      actorId: currentUser?.uid,
      actorEmail: userEmail,
      actorName: currentUser?.displayName,
      ownerId: ownerId || currentUser?.uid,
      relatedEmails: emails,
    });

    showToast("Document shared with signers.");

    // 📧 4. Email — ab public link me token bhi jaayega
    try {
      const signingLink = `${window.location.origin}/doc/${docData.id}?token=${shareToken}`;

      const emailPromises = active.map((participant) => {
        return emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_TEMPLATE_SIGNING,
          {
            to_email: participant.email,
            to_name: participant.name || participant.email,
            from_name: currentUser?.displayName || userEmail || "Sender",
            document_title: docTitle,
            signing_link: signingLink,
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        );
      });

      await Promise.all(emailPromises);
      console.log("Email sent successfully!");
    } catch (emailErr) {
      console.error("EmailJS Error text:", emailErr?.text || emailErr);
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to send. Please try again.");
  } finally {
    setSaving(false);
  }
};
  const openSignModal = (field) => {
    if (!isSignerMode || docStatus === "Completed") return;
    if (myParticipant?.status === "cancelled") return;
    setSignModalField(field);
    setTypedSignature(
      currentUser?.displayName || myParticipant?.name || userEmail.split("@")[0] || ""
    );
  };

  const handleFieldAction = (field) => {
    if (!isSignerMode || myParticipant?.status === "cancelled") return;
    if (docStatus === "Completed") return;

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
      const signatureId = makeSignatureId();
      patch = {
        signed: true,
        signatureValue: String(value).trim(),
        signatureId,
        signedBy: userEmail,
        signedAt,
        filled: true,
        value: String(value).trim(),
        filledBy: userEmail,
        filledAt: signedAt,
      };
    } else if (field.type === "checkbox") {
      patch = {
        filled: value === "checked",
        value,
        filledBy: userEmail,
        filledAt: signedAt,
      };
    } else {
      const trimmed = String(value).trim();
      patch = {
        filled: Boolean(trimmed),
        value: trimmed,
        filledBy: userEmail,
        filledAt: signedAt,
      };
    }

    const nextFields = placedFields.map((f) =>
      f.id === field.id ? { ...f, ...patch } : f
    );
    setPlacedFields(nextFields);

    const allComplete =
      nextFields.length === 0 || nextFields.every((f) => isFieldComplete(f));

    const nextParticipants = participants.map((p) => {
      if (p.email.toLowerCase() !== userEmail) return p;
      const updated = {
        ...p,
        status: allComplete ? "signed" : "signing",
      };
      if (allComplete) updated.signedAt = signedAt;
      return updated;
    });
    setParticipants(nextParticipants);

    const nextStatus = allComplete ? "Completed" : "Signing";

    try {
      setSaving(true);
      await updateDoc(
        doc(db, "documents", docData.id),
        stripUndefined({
          fields: sanitizeFields(nextFields),
          participants: sanitizeParticipants(nextParticipants),
          status: nextStatus,
          updatedAt: serverTimestamp(),
          ...(allComplete ? { completedAt: serverTimestamp() } : {}),
        })
      );
      setDocStatus(nextStatus);

      if (field.type === "signature" && !field.signed) {
        await logActivity({
          type: ACTIVITY_TYPES.SIGNED,
          documentId: docData.id,
          documentTitle: docTitle,
          actorId: currentUser?.uid,
          actorEmail: userEmail,
          actorName: String(value).trim(),
          ownerId,
          relatedEmails: nextParticipants
            .filter((p) => p.status !== "cancelled")
            .map((p) => p.email.toLowerCase()),
          meta: { signatureId: patch.signatureId ?? null },
        });
      }

      if (allComplete) {
        await logActivity({
          type: ACTIVITY_TYPES.DOCUMENT_COMPLETED,
          documentId: docData.id,
          documentTitle: docTitle,
          actorId: currentUser?.uid,
          actorEmail: userEmail,
          actorName: currentUser?.displayName || myParticipant?.name,
          ownerId,
          relatedEmails: nextParticipants
            .filter((p) => p.status !== "cancelled")
            .map((p) => p.email.toLowerCase()),
        });
      }

      showToast(
        allComplete
          ? "All fields saved — document complete!"
          : field.filled
            ? `${field.label} updated.`
            : `${field.label} saved.`
      );
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

  // const applySignature = async () => {
  //   if (!signModalField || !typedSignature.trim()) return;
  //   await applyFieldFill(signModalField, typedSignature.trim());
  // };

  const applySignature = async () => {
  if (!signModalField || !typedSignature.trim()) return;

  try {
    // 1. Signature Field ko apply karein (Aapka existing logic)
    await applyFieldFill(signModalField, typedSignature.trim());

    // 📧 2. OWNER KO EMAIL NOTIFICATION BHEJEIN
    try {
      const signingLink = `${window.location.origin}/doc/${docData?.id}`;

      const ownerParams = {
        to_email: docData?.ownerEmail, // Owner ka Email (Dashboard me 'To Email' {{to_email}} hona chahiye)
        owner_name: docData?.ownerName || "Document Owner",
        signer_name: currentUser?.displayName || userEmail || "A Signer",
        signer_email: userEmail || "Signer",
        document_title: docTitle || "Document",
        signing_link: signingLink,
      };

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_OWNER,
        ownerParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      console.log("Owner notification email sent successfully!");
    } catch (emailErr) {
      // Agar email fail bhi hota hai, to user ka signature disturb nahi hoga
      console.error("Failed to send notification email to owner:", emailErr);
    }

  } catch (err) {
    console.error("Error applying signature:", err);
  }
};

  const applyTextFill = async () => {
    if (!fillModalField || !fillModalValue.trim()) return;
    const liveField = placedFields.find((f) => f.id === fillModalField.id) || fillModalField;
    await applyFieldFill(liveField, fillModalValue.trim());
  };

  const handleDownload = async () => {
    if (!fileUrl) return;
    const hasFilled = placedFields.some(isFieldComplete);

    if (!hasFilled) {
      window.open(downloadUrl, "_blank");
      return;
    }

    try {
      setDownloading(true);
      setActiveFieldId(null);
      setSelectedField(null);
      showToast("Generating signed PDF...");
      await new Promise((r) => setTimeout(r, 150));

      const ok = await exportSignedDocument({
        fileName,
        captureElement: pdfAreaRef.current,
      });
      if (ok) showToast("Signed PDF downloaded!");
      else showToast("Could not generate PDF.");
    } catch (err) {
      console.error(err);
      showToast("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const blockPreviewPointer = canEditFields;
  const showPlacementLayer = canEditFields && Boolean(selectedField);
  const signerCanInteract =
    isSignerMode && docStatus !== "Completed" && myParticipant?.status !== "cancelled";

  return (
    <div className="h-full flex flex-col bg-[#f3f4f6] overflow-hidden">
      <header className="shrink-0 h-14 bg-white border-b border-[#e2e4e9] px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setOpenDoc(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0073ea] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Documents
          </button>

          <span className="text-slate-300">|</span>

          <h1 className="text-[15px] font-semibold text-[#1f2937] truncate">{docTitle}</h1>

          {isSignerMode && (
            <span className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              {docStatus === "Completed" || myParticipant?.status === "signed"
                ? "Signed"
                : "Action required: Sign"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveMessage && (
            <span className="text-xs text-emerald-600 font-medium hidden sm:inline max-w-[220px] truncate">
              {saveMessage}
            </span>
          )}

          {fileUrl && (
            <>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="h-9 px-3.5 rounded-lg border border-[#d0d4dc] bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="h-9 px-3.5 rounded-lg border border-[#d0d4dc] bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {placedFields.some(isFieldComplete) ? "Download signed" : "Download"}
                </span>
              </button>
            </>
          )}

          {isOwner && docStatus !== "Completed" && (
            <>
              {canEditFields && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg border border-[#d0d4dc] bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  Save
                </button>
              )}

              {docStatus !== "Signing" && (
                <button
                  onClick={handleSend}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg bg-[#0073ea] hover:bg-[#0067d4] text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  Send
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {canEditFields ? (
          <aside className="w-[200px] shrink-0 bg-white border-r border-[#e2e4e9] flex flex-col">
            <div className="px-4 py-3 border-b border-[#eef0f3]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Fields
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Select, click to place, then drag / resize
              </p>
            </div>

            <div className="p-3 space-y-2 flex-1 overflow-y-auto">
              {FIELD_TYPES.map((field) => {
                const Icon = field.icon;
                const isActive = selectedField === field.id;

                return (
                  <button
                    key={field.id}
                    onClick={() => setSelectedField(isActive ? null : field.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-[13px] font-medium transition-all ${
                      isActive
                        ? `${field.accent} ring-2 ring-[#0073ea]/30`
                        : "border-[#eef0f3] bg-white text-slate-700 hover:bg-[#fafbfc] hover:border-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {field.label}
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}

        <section className="flex-1 min-w-0 flex flex-col bg-[#e8eaed]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#0073ea] mb-3" />
              <p className="text-sm">Loading document...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button
                onClick={() => setOpenDoc(null)}
                className="mt-4 text-sm text-[#0073ea] hover:text-[#005fc4] font-medium"
              >
                Go back to documents
              </button>
            </div>
          ) : (
            <>
              {canEditFields && selectedField && (
                <div className="shrink-0 px-4 py-2 bg-[#0073ea]/10 border-b border-[#0073ea]/20 text-center">
                  <p className="text-[12px] text-[#0073ea] font-medium">
                    Click to place · drag to move · corner to resize{" "}
                    {FIELD_TYPES.find((f) => f.id === selectedField)?.label}
                  </p>
                </div>
              )}

              {signerCanInteract && (
                <div className="shrink-0 px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-center">
                  <p className="text-[12px] text-emerald-700 font-medium">
                    Click each field to fill or edit — Signature, Date, Name, Text, Checkbox
                  </p>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
                <div
                  ref={pdfAreaRef}
                  className={`relative mx-auto bg-white shadow-md ${
                    selectedField && canEditFields ? "ring-2 ring-[#0073ea]/20" : ""
                  }`}
                  style={{
                    width: isPreviewable ? pageWidth : "100%",
                    maxWidth: "100%",
                    minHeight: isPreviewable ? Math.max(640, pageWidth * 0.9) : undefined,
                  }}
                  data-field-layer
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
                    blockPointerEvents={blockPreviewPointer}
                  />

                  {showPlacementLayer && (
                    <div
                      className="absolute inset-0 z-[5] cursor-crosshair"
                      onClick={handlePdfAreaClick}
                      aria-label="Click to place field"
                    />
                  )}

                  {placedFields.map((field) => {
                    const fieldType = FIELD_TYPES.find((f) => f.id === field.type);
                    return (
                      <DraggableField
                        key={field.id}
                        field={field}
                        accent={fieldType?.accent}
                        editable={canEditFields}
                        selected={activeFieldId === field.id}
                        onSelect={setActiveFieldId}
                        onChange={updateField}
                        onRemove={removeField}
                        onFieldAction={handleFieldAction}
                        signerMode={signerCanInteract}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="w-[260px] shrink-0 bg-white border-l border-[#e2e4e9] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eef0f3]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
              Details
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-[#eef0f3]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#1f2937]">Signers</h3>
                {canManageParticipants && (
                  <button
                    onClick={() => setShowAddParticipant(true)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0073ea] hover:text-[#005fc4]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>

              {showAddParticipant && canManageParticipants && (
                <div className="mb-3 p-3 rounded-lg border border-[#eef0f3] bg-[#fafbfc] space-y-2">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={participantForm.name}
                    onChange={(e) =>
                      setParticipantForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-[12px] focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={participantForm.email}
                    onChange={(e) =>
                      setParticipantForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-[12px] focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
                  />
                  <p className="text-[10px] text-slate-400">Role: Signer</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAddParticipant}
                      className="flex-1 h-8 rounded-md bg-[#0073ea] text-white text-[12px] font-medium hover:bg-[#0067d4]"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddParticipant(false)}
                      className="flex-1 h-8 rounded-md border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {participants.filter((p) => p.status !== "cancelled").length === 0 ? (
                <p className="text-[12px] text-slate-400">
                  No signers yet. Add someone to send for signing.
                </p>
              ) : (
                <div className="space-y-2">
                  {participants
                    .filter((p) => p.status !== "cancelled")
                    .map((person) => {
                      const canCancel =
                        canManageParticipants && person.status !== "signed";

                      return (
                        <div
                          key={person.id}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#eef0f3] bg-[#fafbfc]"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#0073ea]/10 text-[#0073ea] flex items-center justify-center text-[12px] font-semibold shrink-0">
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-[#1f2937] truncate">
                              {person.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{person.email}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-block text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                                Signer
                              </span>
                              <span
                                className={`inline-block text-[10px] font-medium border rounded px-1.5 py-0.5 capitalize ${statusBadge(
                                  person.status
                                )}`}
                              >
                                {person.status || "pending"}
                              </span>
                            </div>
                          </div>
                          {canCancel && (
                            <button
                              onClick={() => removeParticipant(person.id)}
                              title="Cancel signer"
                              className="text-slate-300 hover:text-red-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="text-[13px] font-semibold text-[#1f2937] mb-3">Workflow</h3>

              <div className="space-y-0">
                {WORKFLOW_STEPS.map((step, index) => {
                  const isActive = index === (currentStepIndex >= 0 ? currentStepIndex : 0);
                  const isDone = currentStepIndex >= 0 && index < currentStepIndex;

                  return (
                    <div key={step.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isActive
                              ? "bg-[#0073ea] text-white"
                              : isDone
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {isDone ? "✓" : index + 1}
                        </div>
                        {index < WORKFLOW_STEPS.length - 1 && (
                          <div
                            className={`w-0.5 flex-1 min-h-[24px] my-0.5 ${
                              isDone ? "bg-emerald-400" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>

                      <div className="pb-4">
                        <p
                          className={`text-[12px] font-medium ${
                            isActive
                              ? "text-[#0073ea]"
                              : isDone
                                ? "text-emerald-600"
                                : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 p-3 rounded-lg bg-[#fafbfc] border border-[#eef0f3] space-y-1.5">
                <p className="text-[11px] text-slate-500">
                  Status:{" "}
                  <span className="font-medium text-[#1f2937]">{docStatus || "Draft"}</span>
                </p>
                {participants
                  .filter((p) => p.status !== "cancelled")
                  .map((p) => (
                    <p key={p.id} className="text-[11px] text-slate-400 truncate">
                      {p.name}:{" "}
                      <span className="capitalize text-slate-600">{p.status || "pending"}</span>
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {signModalField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSignModalField(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Apply signature</h3>
            <p className="text-xs text-slate-500 mt-1">
              Type your name. A unique ID will appear under the signature.
            </p>

            <input
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="Your full name"
              className="mt-4 w-full h-11 px-3 rounded-lg border border-slate-200 text-sm focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
              autoFocus
            />

            {/* Preview matches DocuSign bracket style */}
            <div className="mt-4 relative px-3 pt-3 pb-3 bg-slate-50 rounded-lg">
              <div className="pointer-events-none absolute left-3 top-3 bottom-3 w-[2px] bg-[#6d28d9]" />
              <div className="pointer-events-none absolute left-3 top-3 h-[2px] w-3 bg-[#6d28d9]" />
              <div className="pointer-events-none absolute left-3 bottom-3 h-[2px] w-3 bg-[#6d28d9]" />

              <div className="pl-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[11px] font-medium text-slate-800">Signed by:</span>
                  <div className="flex-1 h-[1.5px] bg-[#6d28d9]" />
                </div>
                <p
                  className="text-2xl text-slate-900 text-center py-2"
                  style={{
                    fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
                  }}
                >
                  {typedSignature.trim() || "Your signature"}
                </p>
                <div className="relative flex items-center mt-1">
                  <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-[#6d28d9]" />
                  <span className="relative z-[1] bg-slate-50 pr-1 text-[10px] font-mono text-slate-700">
                    53D6649E9FF4402...
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSignModalField(null)}
                className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={applySignature}
                disabled={!typedSignature.trim() || saving}
                className="flex-1 h-10 rounded-lg bg-[#0073ea] text-white text-sm font-medium hover:bg-[#0067d4] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Sign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fillModalField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setFillModalField(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">
              {fillModalField?.filled ? "Edit text" : "Enter text"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {fillModalField?.filled ? "Update" : "Fill"} the {fillModalField?.label} field
            </p>
            <textarea
              value={fillModalValue}
              onChange={(e) => setFillModalValue(e.target.value)}
              placeholder="Type here..."
              rows={3}
              className="mt-4 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-[#0073ea] focus:outline-none focus:ring-1 focus:ring-[#0073ea] resize-y min-h-[80px]"
              autoFocus
            />
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setFillModalField(null)}
                className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={applyTextFill}
                disabled={!fillModalValue.trim() || saving}
                className="flex-1 h-10 rounded-lg bg-[#0073ea] text-white text-sm font-medium hover:bg-[#0067d4] disabled:opacity-50"
              >
                {saving ? "Saving..." : fillModalField?.filled ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        docId={docData?.id}
        docTitle={docTitle}
        fileUrl={fileUrl}
        fileName={fileName}
        user={currentUser}
        participants={participants}
        onParticipantsChange={(next, emails) => {
          setParticipants(next);
          setSharedWithLive(emails);
        }}
        publicShareEnabled={publicShareEnabled}
        publicShareToken={publicShareToken}
        onShareSettingsChange={({ publicShareEnabled: enabled, publicShareToken: token }) => {
          setPublicShareEnabled(enabled);
          setPublicShareToken(token);
        }}
      />
    </div>
  );
};

export default Docviewpage;
