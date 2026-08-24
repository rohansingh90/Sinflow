import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { FileText, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { auth, db } from "../../Lib/Firebase";

const statusStyles = {
  "In Review": "text-amber-700 bg-amber-50 ring-1 ring-amber-200",
  Review: "text-amber-700 bg-amber-50 ring-1 ring-amber-200",
  Draft: "text-slate-600 bg-slate-100 ring-1 ring-slate-200",
  Signing: "text-blue-700 bg-blue-50 ring-1 ring-blue-200",
  Completed: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200",
};

const DocumentsList = ({ setcreateDocModal, setOpenDoc, user }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null);
  // menu position for fixed overlay so it won't be clipped by scrollable container
  const [menuPos, setMenuPos] = useState(null);
  const [search, setSearch] = useState("");

  const currentUser = user || auth.currentUser;
  const userId = currentUser?.uid;
  const userEmail = (currentUser?.email || "").toLowerCase();

  const handleViewDocument = (docItem) => {
    setActiveMenuId(null);
    setOpenDoc(docItem);
  };

  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsData = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setDocuments(docsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching documents:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const visibleDocuments = useMemo(() => {
    const mine = documents.filter((docItem) => {
      const isOwner = docItem.ownerId === userId;
      const shared = Array.isArray(docItem.sharedWith)
        ? docItem.sharedWith.map((e) => String(e).toLowerCase()).includes(userEmail)
        : false;
      const me = Array.isArray(docItem.participants)
        ? docItem.participants.find((p) => p.email?.toLowerCase() === userEmail)
        : null;
      if (shared && me?.status === "cancelled") return false;
      return isOwner || shared;
    });

    if (!search.trim()) return mine;
    const q = search.trim().toLowerCase();
    return mine.filter((d) => (d.title || "").toLowerCase().includes(q));
  }, [documents, userId, userEmail, search]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleRenameDocument = async (docId, currentTitle) => {
    setActiveMenuId(null);
    const newTitle = window.prompt("Enter new document name:", currentTitle);
    if (!newTitle || newTitle.trim() === "" || newTitle === currentTitle) return;

    try {
      await updateDoc(doc(db, "documents", docId), {
        title: newTitle.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error renaming document:", error);
      alert("Failed to rename document.");
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    setActiveMenuId(null);
    if (!window.confirm(`Are you sure you want to delete "${title || "this document"}"?`)) return;

    try {
      await deleteDoc(doc(db, "documents", docId));
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document.");
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-800">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Documents</h1>

          <button
            onClick={() => setcreateDocModal(true)}
            className="inline-flex cursor-pointer h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Create Document
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mb-6 py-2">
          <div className="relative min-w-[260px] flex-1 sm:flex-none">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Documents..."
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="w-full overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3 px-3 w-10 text-center">Type</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 w-44">Status</th>
                <th className="py-3 px-4 w-48">Last Change</th>
                <th className="py-3 px-4 w-20 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    Loading documents...
                  </td>
                </tr>
              ) : visibleDocuments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    No documents found. Create one or wait for someone to share with you.
                  </td>
                </tr>
              ) : (
                visibleDocuments.map((docItem) => {
                  const isOwner = docItem.ownerId === userId;
                  const sharedToMe = !isOwner;

                  return (
                    <tr
                      key={docItem.id}
                      onClick={() => handleViewDocument(docItem)}
                      className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-3 text-center">
                        <div className="inline-flex items-center justify-center p-1.5 bg-red-50 rounded-lg">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {docItem.title || "Untitled Document"}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {sharedToMe
                            ? docItem.status === "Signing"
                              ? "Shared with you · Sign required"
                              : "Shared with you"
                            : `Owner: ${docItem.ownerEmail || "You"}`}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[docItem.status] || statusStyles.Draft
                            }`}
                        >
                          {docItem.status || "Draft"}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs sm:text-sm text-slate-600">
                        {formatDate(docItem.updatedAt || docItem.createdAt)}
                      </td>

                      <td className="py-4 px-4 text-right relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenuId === docItem.id) {
                              setActiveMenuId(null);
                              setMenuPos(null);
                            } else {
                              // compute fixed position based on button location
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                              setActiveMenuId(docItem.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === docItem.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => { setActiveMenuId(null); setMenuPos(null); }} />

                            {/* fixed positioned menu so it's not clipped by scrollable container */}
                            <div
                              style={{
                                position: 'fixed',
                                top: menuPos ? menuPos.top + 'px' : '50%',
                                left: menuPos ? menuPos.left + 'px' : '40%',
                                transform: 'translateY(6px)',
                                zIndex: 20,
                              }}
                              className="w-36 bg-white border mr-20 border-slate-200 rounded-lg shadow-lg py-1 text-left text-xs font-medium text-slate-700"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null); setMenuPos(null);
                                  handleViewDocument(docItem);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                View
                              </button>

                              {isOwner && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null); setMenuPos(null);
                                      handleRenameDocument(docItem.id, docItem.title);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                    Rename
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null); setMenuPos(null);
                                      handleDeleteDocument(docItem.id, docItem.title);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DocumentsList;
