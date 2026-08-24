import React, { useRef } from "react";
import { Check, X } from "lucide-react";
import { fieldDisplayValue } from "../Lib/exportSignedDoc";

const MIN = { w: 5, h: 3 };
const DEFAULT = { w: 15, h: 10 };

const FieldChrome = ({ field, selected, editable, accent, isComplete, canFill, canEdit }) => {
  if (field.type === "signature" && isComplete) return null;

  const tone =
    canFill || canEdit
      ? "border-[#0073ea] bg-[#e8f4fd]"
      : isComplete
        ? "border-emerald-400/80 bg-white"
        : accent?.includes("blue")
          ? "border-[#0073ea]/40 bg-[#f0f7ff]"
          : "border-slate-300/80 bg-[#fafbfc]";

  return (
    <>
      <div
        className={`absolute inset-0 rounded-sm border-2 border-dashed transition-shadow ${tone} ${
          selected && editable ? "ring-2 ring-[#0073ea]/30 shadow-md" : "shadow-sm"
        }`}
      />
      {!isComplete && (
        <div className="absolute top-0 left-0 right-0 h-[18px] px-1.5 flex items-center bg-[#0073ea]/10 border-b border-[#0073ea]/15 rounded-t-sm">
          <span className="text-[9px] font-semibold text-[#0073ea] uppercase tracking-wide truncate">
            {field.label}
          </span>
        </div>
      )}
    </>
  );
};

const SignatureBlock = ({ field }) => {
  const shortId = field.signatureId
    ? field.signatureId.length > 22
      ? `${field.signatureId.slice(0, 22)}...`
      : field.signatureId
    : "";

  return (
    <div className="relative w-full h-full min-h-[52px] px-2 pt-2 pb-1.5 bg-white">
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] bg-[#6d28d9]" />
      <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-[18px] bg-[#6d28d9]" />
      <div className="pointer-events-none absolute left-0 bottom-0 h-[2px] w-[18px] bg-[#6d28d9]" />

      <div className="relative flex items-center gap-1 mb-0.5 pl-0.5">
        <span className="text-[9px] font-semibold text-slate-800 whitespace-nowrap">Signed by:</span>
        <div className="flex-1 h-[1.5px] bg-[#6d28d9] min-w-[8px]" />
      </div>

      <div className="flex items-center justify-center px-1 py-0.5 min-h-[28px]">
        <span
          className="text-[clamp(14px,2.5vw,24px)] leading-none text-slate-900 text-center break-words w-full"
          style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive" }}
        >
          {field.signatureValue}
        </span>
      </div>

      <div className="relative flex items-center mt-0.5 pl-0.5">
        <div className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-[#6d28d9]" />
        <span className="relative z-[1] bg-white pr-1 text-[8px] font-mono text-slate-700 tracking-wide truncate max-w-full">
          {shortId}
        </span>
      </div>
    </div>
  );
};

const ResizeHandle = ({ position, onPointerDown }) => {
  const posClass = {
    se: "bottom-0 right-0 cursor-se-resize rounded-tl",
    sw: "bottom-0 left-0 cursor-sw-resize rounded-tr",
    ne: "top-0 right-0 cursor-ne-resize rounded-bl",
    nw: "top-0 left-0 cursor-nw-resize rounded-br",
  }[position];

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute w-2.5 h-2.5 bg-[#0073ea] border border-white shadow z-50 ${posClass}`}
      data-resize-handle
    />
  );
};

const DraggableField = ({
  field,
  accent,
  editable,
  selected,
  onSelect,
  onChange,
  onRemove,
  onFieldAction,
  signerMode,
}) => {
  const dragRef = useRef(null);

  const isComplete =
    field.type === "signature"
      ? Boolean(field.signed && field.signatureValue)
      : Boolean(field.filled && (field.type === "checkbox" ? field.value === "checked" : field.value));

  const canFill = !editable && signerMode && !isComplete && onFieldAction;
  const canEdit =
    !editable &&
    signerMode &&
    isComplete &&
    onFieldAction &&
    (field.type === "text" || field.type === "name" || field.type === "date");
  const canToggle = !editable && signerMode && field.type === "checkbox" && onFieldAction;

  const displayValue = fieldDisplayValue(field);

  const getLayerRect = () =>
    dragRef.current?.closest("[data-field-layer]")?.getBoundingClientRect();

  const startDrag = (event) => {
    if (!editable || event.button !== 0) return;
    if ((event.target).closest("[data-resize-handle]")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(field.id);

    const rect = getLayerRect();
    if (!rect) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const origX = field.x;
    const origY = field.y;

    const onMove = (e) => {
      const dx = ((e.clientX - startX) / rect.width) * 100;
      const dy = ((e.clientY - startY) / rect.height) * 100;
      onChange(field.id, {
        x: Math.min(100 - (field.w || DEFAULT.w), Math.max(0, origX + dx)),
                y: Math.min(100 - (field.h || DEFAULT.h), Math.max(0, origY + dy)),
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResize = (position) => (event) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(field.id);

    const rect = getLayerRect();
    if (!rect) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const orig = { x: field.x, y: field.y, w: field.w || DEFAULT.w, h: field.h || DEFAULT.h };

    const onMove = (e) => {
      const dx = ((e.clientX - startX) / rect.width) * 100;
      const dy = ((e.clientY - startY) / rect.height) * 100;
      let { x, y, w, h } = orig;

      if (position.includes("e")) w = Math.min(100 - x, Math.max(MIN.w, orig.w + dx));
      if (position.includes("w")) {
        const nw = Math.max(MIN.w, orig.w - dx);
        x = Math.max(0, orig.x + orig.w - nw);
        w = nw;
      }
      if (position.includes("s")) h = Math.min(20, 100 - y, Math.max(MIN.h, orig.h + dy));
      if (position.includes("n")) {
              let nh = Math.max(MIN.h, orig.h - dy);
              nh = Math.min(20, nh);
              y = Math.max(0, orig.y + orig.h - nh);
              h = nh;
            }

      onChange(field.id, { x, y, w, h });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (canFill || canEdit || canToggle) onFieldAction(field);
    else onSelect?.(field.id);
  };

  const isSignatureDone = field.type === "signature" && isComplete;

  return (
    <div
      ref={dragRef}
      data-export-field
      style={{
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.w || DEFAULT.w}%`,
      // height: `${Math.min(field.h ?? DEFAULT.h, 20)}%`,
      height:"50px",
      // expose the actual height value used for layout via a data attribute for testing/debug
      // data-height-percent: Math.min(field.h ?? DEFAULT.h, 20)

        minWidth: field.type === "checkbox" ? 28 : 48,
        minHeight: field.type === "checkbox" ? 28 : isSignatureDone ? 56 : 20,
      }}
      onPointerDown={editable ? startDrag : undefined}
      onClick={handleClick}
      className={`absolute z-30 group ${editable && !isComplete ? "cursor-move" : ""} ${
        canFill || canEdit || canToggle ? "cursor-pointer" : ""
      }`}
    >
      {isSignatureDone ? (
        <SignatureBlock field={field} />
      ) : (
        <div className="relative w-full h-full">
          <FieldChrome
            field={field}
            selected={selected}
            editable={editable}
            accent={accent}
            isComplete={isComplete}
            canFill={canFill}
            canEdit={canEdit}
          />

          <div
            className={`absolute inset-0 flex items-center justify-center px-2 ${
              !isComplete ? "pt-[18px]" : ""
            }`}
          >
            {isComplete ? (
              field.type === "checkbox" ? (
                <div className="w-full h-full flex items-center justify-center border-2 border-slate-700 rounded-sm bg-white">
                  <Check className="w-[60%] h-[60%] text-slate-800" strokeWidth={2.5} />
                </div>
              ) : (
                <span className="text-[clamp(10px,1.8vw,14px)] font-medium text-slate-800 text-center w-full break-words leading-tight">
                  {displayValue}
                </span>
              )
            ) : (
              <span className="text-[10px] text-slate-500 text-center leading-tight">
                {canFill || canEdit ? "Click to fill" : field.label}
              </span>
            )}
          </div>
        </div>
      )}

      {editable && !isComplete && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(field.id);
            }}
            className="absolute -right-2 -top-2 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
          {selected && (
            <>
              <ResizeHandle position="se" onPointerDown={startResize("se")} />
              <ResizeHandle position="sw" onPointerDown={startResize("sw")} />
              <ResizeHandle position="ne" onPointerDown={startResize("ne")} />
              <ResizeHandle position="nw" onPointerDown={startResize("nw")} />
            </>
          )}
        </>
      )}

      {canEdit && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-[#0073ea] font-medium opacity-0 group-hover:opacity-100">
          Click to edit
        </div>
      )}
    </div>
  );
};

export default DraggableField;
