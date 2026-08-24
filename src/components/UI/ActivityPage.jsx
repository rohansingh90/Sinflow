import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChevronDown, Loader2 } from "lucide-react";
import { db } from "../../Lib/Firebase";
import {
  ACTIVITY_TYPES,
  formatRelativeTime,
  getActivityTitle,
  normalizeActivityType,
} from "../../Lib/activity";

const FILTERS = [
  { id: "all", label: "All Activity" },
  { id: ACTIVITY_TYPES.SIGNED, label: "Signed" },
  { id: ACTIVITY_TYPES.DOCUMENT_SENT, label: "Sent" },
  { id: ACTIVITY_TYPES.DOCUMENT_UPLOADED, label: "Uploaded" },
  { id: ACTIVITY_TYPES.DOCUMENT_OPENED, label: "Opened" },
  { id: ACTIVITY_TYPES.DOCUMENT_COMPLETED, label: "Completed" },
  { id: ACTIVITY_TYPES.APPROVED, label: "Approved" },
];

const TYPE_DOT = {
  DOCUMENT_CREATED: "bg-slate-400",
  DOCUMENT_UPLOADED: "bg-slate-400",
  DOCUMENT_SENT: "bg-blue-500",
  DOCUMENT_OPENED: "bg-amber-500",
  COMMENT_ADDED: "bg-violet-500",
  CHANGES_REQUESTED: "bg-orange-500",
  APPROVED: "bg-teal-500",
  SIGNING_STARTED: "bg-blue-500",
  SIGNED: "bg-emerald-500",
  DOCUMENT_COMPLETED: "bg-emerald-600",
};

const ActivityPage = ({ user }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const userId = user?.uid;
  const userEmail = (user?.email || "").toLowerCase();

  useEffect(() => {
    const q = query(collection(db, "activities"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setActivities(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Activity fetch error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const visible = useMemo(() => {
    const mine = activities.filter((a) => {
      if (a.ownerId === userId || a.actorId === userId) return true;
      if (Array.isArray(a.relatedEmails) && a.relatedEmails.includes(userEmail)) {
        return true;
      }
      return false;
    });

    if (filter === "all") return mine;

    return mine.filter((a) => {
      const type = normalizeActivityType(a.type);
      if (filter === ACTIVITY_TYPES.SIGNED) {
        return type === ACTIVITY_TYPES.SIGNED || type === ACTIVITY_TYPES.DOCUMENT_COMPLETED;
      }
      if (filter === ACTIVITY_TYPES.DOCUMENT_SENT) {
        return type === ACTIVITY_TYPES.DOCUMENT_SENT || type === ACTIVITY_TYPES.SIGNING_STARTED;
      }
      if (filter === ACTIVITY_TYPES.DOCUMENT_UPLOADED) {
        return type === ACTIVITY_TYPES.DOCUMENT_UPLOADED || type === ACTIVITY_TYPES.DOCUMENT_CREATED;
      }
      return type === filter;
    });
  }, [activities, userId, userEmail, filter]);

  const activeFilterLabel = FILTERS.find((f) => f.id === filter)?.label || "All Activity";

  return (
    <div className="min-h-full bg-[#f8f9fb]">
      <div className="max-w-[720px] px-10 py-9">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.6px] text-[#1f2937]">
            Activity
          </h1>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#d0d4dc] bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {activeFilterLabel}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFilter(f.id);
                        setFilterOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors hover:bg-slate-50 ${
                        filter === f.id ? "text-[#0073ea] font-medium bg-blue-50/50" : "text-slate-700"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading activity...
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center px-6">
              <p className="text-[14px] font-medium text-slate-600">No activity yet</p>
              <p className="text-[12px] text-slate-400 mt-1.5">
                Upload or send a document — events will show up here.
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((item, index) => {
                const type = normalizeActivityType(item.type);
                const title = getActivityTitle(type, item.title);

                return (
                  <li
                    key={item.id}
                    className={`flex gap-3.5 px-5 py-4 hover:bg-[#fafbfc] transition-colors ${
                      index !== visible.length - 1 ? "border-b border-[#f0f1f3]" : ""
                    }`}
                  >
                    <div className="pt-[7px] shrink-0">
                      <span
                        className={`block w-2 h-2 rounded-full ${
                          TYPE_DOT[type] || "bg-slate-400"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#1f2937] leading-snug">
                        {title}
                      </p>
                      <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                        {item.documentTitle || "Untitled Document"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
