import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Eye,
  PenLine,
  ArrowUpRight,
  Plus,
  Clock3,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc as firestoreDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../Lib/Firebase";

const Dashboard = ({ user, setScreen, setcreateDocModal, setOpenDoc }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // menu and modal state for per-document actions
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [renameModal, setRenameModal] = useState({ open: false, id: null, value: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, title: '' });



  const userEmail = (user?.email || "").toLowerCase();
  const userId = user?.uid;

  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDocuments(docsData);
        setLoading(false);
      },
      (error) => {
        console.error("Dashboard fetch error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const myDocuments = useMemo(() => {
    return documents.filter((docItem) => {
      const isOwner = docItem.ownerId === userId;
      const shared = Array.isArray(docItem.sharedWith)
        ? docItem.sharedWith.map((e) => String(e).toLowerCase()).includes(userEmail)
        : false;
      // Ignore if this user was cancelled as a signer
      const me = Array.isArray(docItem.participants)
        ? docItem.participants.find((p) => p.email?.toLowerCase() === userEmail)
        : null;
      if (shared && me?.status === "cancelled") return false;
      return isOwner || shared;
    });
  }, [documents, userId, userEmail]);

  const stats = useMemo(() => {
    const total = myDocuments.length;
    const waitingReview = myDocuments.filter((d) => {
      const s = (d.status || "").toLowerCase();
      return s === "review" || s === "in review";
    }).length;
    const waitingSigning = myDocuments.filter(
      (d) => (d.status || "").toLowerCase() === "signing"
    ).length;

    return [
      { label: "Total documents", value: total, icon: FileText },
      { label: "Waiting for review", value: waitingReview, icon: Eye },
      { label: "Waiting for signing", value: waitingSigning, icon: PenLine },
    ];
  }, [myDocuments]);

  const recentDocuments = myDocuments.slice(0, 6);

  const userName =
    user?.displayName || user?.email?.split("@")[0] || "there";

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Greeting based on local time of day
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return 'Good night';
  };

  const getStatus = (status) => {
    const s = status || "Draft";
    if (s === "Signing") {
      return { className: "bg-blue-50 text-blue-600 border-blue-100", dot: "bg-blue-500" };
    }
    if (s === "Review" || s === "In Review") {
      return { className: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-500" };
    }
    if (s === "Completed") {
      return {
        className: "bg-emerald-50 text-emerald-600 border-emerald-100",
        dot: "bg-emerald-500",
      };
    }
    return { className: "bg-slate-50 text-slate-500 border-slate-100", dot: "bg-slate-400" };
  };

  const openDoc = (document) => {
    if (setOpenDoc && setScreen) {
      setOpenDoc(document);
      setScreen("documents");
    }
  };

  return (
    <div className="min-h-full bg-[#f8f9fb]">
      <div className="max-w-[1100px] mx-auto px-8 py-9">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[13px] text-slate-400 mb-2">{todayLabel}</p>
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.6px] text-[#1f2937]">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-[13px] text-slate-500 mt-2">
              Here's what's happening with your documents.
            </p>
          </div>

          <button
            onClick={() => setcreateDocModal?.(true)}
            className="flex items-center gap-2 bg-[#0073ea] hover:bg-[#0067d4] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New document
          </button>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-xl mb-9 overflow-hidden">
          <div className="grid grid-cols-3">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`px-6 py-5 flex items-center gap-4 ${
                    index !== 0 ? "border-l border-[#eef0f3]" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#f5f7fa] flex items-center justify-center">
                    <Icon className="w-[17px] h-[17px] text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.04em] font-medium text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-[22px] font-semibold tracking-[-0.3px] text-[#1f2937] mt-0.5">
                      {loading ? "—" : stat.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1f2937]">Recent documents</h2>
              <p className="text-[12px] text-slate-400 mt-1">
                Owned by you and shared with you
              </p>
            </div>

            <button
              onClick={() => setScreen?.("documents")}
              className="text-[12px] font-medium text-[#0073ea] hover:text-[#005fc4] flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_150px_180px_40px] items-center px-5 py-3 bg-[#fafbfc] border-b border-[#eef0f3] text-[10px] uppercase tracking-[0.06em] font-semibold text-slate-400">
              <span>Document</span>
              <span>Status</span>
              <span>Last updated</span>
              <span></span>
            </div>

            <div>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading documents...
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No documents yet. Create one to get started.
                </div>
              ) : (
                recentDocuments.map((document) => {
                  const status = getStatus(document.status);
                  const sharedToMe =
                    document.ownerId !== userId &&
                    Array.isArray(document.sharedWith) &&
                    document.sharedWith
                      .map((e) => String(e).toLowerCase())
                      .includes(userEmail);

                  return (
                    <div
                      key={document.id}
                      onClick={() => openDoc(document)}
                      className="grid grid-cols-[1fr_150px_180px_40px] items-center px-5 py-4 border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#fafbfc] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-md bg-[#f5f7fa] flex items-center justify-center border border-[#eef0f3]">
                          <FileText className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#293241] truncate">
                            {document.title || "Untitled Document"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {sharedToMe ? "Shared with you" : "Owned by you"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${status.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {document.status || "Draft"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Clock3 className="w-3.5 h-3.5" />
                        {formatDate(document.updatedAt || document.createdAt)}
                      </div>

                      <div className="relative text-right">
                        <button
                          onClick={(e) => { e.stopPropagation();
                            // toggle menu
                            if (activeMenuId === document.id) { setActiveMenuId(null); setMenuPos(null); }
                            else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                              setActiveMenuId(document.id);
                            }
                          }}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeMenuId === document.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => { setActiveMenuId(null); setMenuPos(null); }} />
                            <div style={{ position: 'fixed', top: menuPos ? menuPos.top + 'px' : '50%', left: menuPos ? menuPos.left + 'px' : '50%', transform: 'translateY(6px)', zIndex: 20 }} className="w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-left text-sm text-slate-700">
                              <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuPos(null); openDoc(document); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50">View</button>
                              {document.ownerId === userId && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); setRenameModal({ open: true, id: document.id, value: document.title || '' }); setActiveMenuId(null); setMenuPos(null); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50">Rename</button>
                                  <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: document.id, title: document.title || '' }); setActiveMenuId(null); setMenuPos(null); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600">Delete</button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          All documents are synced
        </div>

        {/* Rename modal */}
        {renameModal.open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg p-5 w-[420px] shadow-lg">
              <h3 className="text-lg font-semibold mb-3">Rename document</h3>
              <input autoFocus value={renameModal.value} onChange={(e) => setRenameModal(rm => ({ ...rm, value: e.target.value }))} className="w-full border px-3 py-2 rounded mb-3" />
              <div className="flex justify-end gap-2">
        <button onClick={() => setRenameModal({ open: false, id: null, value: '' })} className="px-3 py-2 rounded border">Cancel</button>
        <button onClick={async () => {
          const val = renameModal.value && renameModal.value.trim();
          if (!val) return;
          try {
            await updateDoc(firestoreDoc(db, 'documents', renameModal.id), { title: val, updatedAt: serverTimestamp() });
            setRenameModal({ open: false, id: null, value: '' });
          } catch (err) { console.error('Rename failed', err); alert('Rename failed'); }
        }} className="px-3 py-2 rounded bg-[#0073ea] text-white">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteModal.open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg p-5 w-[420px] shadow-lg">
              <h3 className="text-lg font-semibold mb-3">Delete document</h3>
              <p className="text-sm text-slate-600 mb-4">Are you sure you want to delete "{deleteModal.title}"? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
        <button onClick={() => setDeleteModal({ open: false, id: null, title: '' })} className="px-3 py-2 rounded border">Cancel</button>
        <button onClick={async () => {
          try { await deleteDoc(firestoreDoc(db, 'documents', deleteModal.id)); setDeleteModal({ open: false, id: null, title: '' }); }
          catch (err) { console.error('Delete failed', err); alert('Delete failed'); }
        }} className="px-3 py-2 rounded bg-red-600 text-white">Delete</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
