import React, { useRef, useState } from "react";
// import { db, auth } from "../firebase"; // Firebase Firestore & Auth import
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../Lib/Firebase";
import { ACTIVITY_TYPES, logActivity } from "../Lib/activity";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const CreateDoc = ({ isOpen = true, onClose = () => {} }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadToCloudinaryAndFirestore(file);
  };

  const uploadToCloudinaryAndFirestore = async (file) => {
    try {
      setIsUploading(true);
      setUploadProgress("Uploading file to Cloudinary...");

      // 1. Cloudinary FormData Prepare Karein
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      // 2. Direct Cloudinary REST API Upload
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: formData,
      });

      const cloudinaryData = await res.json();

      if (!res.ok) {
        throw new Error(cloudinaryData.error?.message || "Cloudinary Upload Failed");
      }

      setUploadProgress("Saving metadata to Firestore...");

      // User details
      const currentUser = auth?.currentUser;
      const userId = currentUser ? currentUser.uid : "user_guest_123";
      const workspaceId = "workspace_default";

      // 3. Step 1: Create Main Document in 'documents' Collection
      const mainDocRef = await addDoc(collection(db, "documents"), {
        title: file.name.replace(/\.[^/.]+$/, ""),
        ownerId: userId,
        ownerEmail: currentUser?.email?.toLowerCase() || null,
        workspaceId: workspaceId,
        status: "Draft",
        currentVersionId: "version001",
        participants: [],
        fields: [],
        sharedWith: [],
        publicShareEnabled: false,
        publicShareToken: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Step 2: Create 'version001' Subcollection
      const versionDocRef = doc(db, "documents", mainDocRef.id, "versions", "version001");

      await setDoc(versionDocRef, {
        versionNumber: 1,
        fileName: file.name,
        storagePath: cloudinaryData.public_id,
        fileUrl: cloudinaryData.secure_url,
        fileSize: file.size,
        contentType: file.type || cloudinaryData.format || "application/octet-stream",
        resourceType: cloudinaryData.resource_type || "raw",
        format: cloudinaryData.format || file.name.split(".").pop()?.toLowerCase() || "",
        createdBy: userId,
        createdAt: serverTimestamp(),
        status: "Draft",
      });

      const docTitle = file.name.replace(/\.[^/.]+$/, "") || file.name;
      const actorEmail = currentUser?.email?.toLowerCase() || null;
      const activityBase = {
        documentId: mainDocRef.id,
        documentTitle: docTitle,
        actorId: userId,
        actorEmail,
        actorName: currentUser?.displayName || null,
        ownerId: userId,
        relatedEmails: actorEmail ? [actorEmail] : [],
      };
      try {
        await logActivity({ ...activityBase, type: ACTIVITY_TYPES.DOCUMENT_CREATED });
        await logActivity({ ...activityBase, type: ACTIVITY_TYPES.DOCUMENT_UPLOADED });
      } catch (activityErr) {
        console.error("Activity log failed:", activityErr);
      }

      setIsUploading(false);
      setUploadProgress("");
      onClose(); // Upload Success, Close Modal
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error: " + error.message);
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={!isUploading ? onClose : undefined} 
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 z-10">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add New Document</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cloudinary + Firestore Upload</p>
          </div>
          
          {!isUploading && (
            <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="my-4 rounded-lg bg-blue-50 p-3 text-center border border-blue-100">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-1" />
            <p className="text-xs font-semibold text-blue-700">{uploadProgress}</p>
          </div>
        )}

        {/* Action Options */}
        <div className={`mt-5 space-y-3 ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-blue-600 hover:bg-blue-50/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                Upload Document
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Select PDF, Image, or Word document from device.
              </p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateDoc;