"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";

export type FloorplanTable = {
  id: string;
  name: string;
  capacity: number;
  section_id: string;
  section_name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type FloorplanReservation = {
  id: string;
  guest_name: string;
  party_size: number;
  time: string;
};

type Props = {
  tables: FloorplanTable[];
  reservationsByTableId?: Record<string, FloorplanReservation[]>;
  editable?: boolean;
  heightPx?: number;
  onChange?: (tables: FloorplanTable[]) => void;
};

type DragState = {
  kind: "drag" | "resize";
  id: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
} | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function withDefaults(t: FloorplanTable): Required<Pick<FloorplanTable, "x" | "y" | "w" | "h">> {
  return {
    x: typeof t.x === "number" ? t.x : 5,
    y: typeof t.y === "number" ? t.y : 8,
    w: typeof t.w === "number" ? t.w : 18,
    h: typeof t.h === "number" ? t.h : 16,
  };
}

/* Mini chair SVG — seat + backrest, rotated to face the table */
function ChairIcon({ rotation, color }: { rotation: number; color: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className="w-3.5 h-3.5"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="M3 2 C3 0.5, 11 0.5, 11 2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3" y="3.5" width="8" height="6" rx="1.5" fill={color} opacity="0.55" />
      <rect x="3" y="3.5" width="8" height="6" rx="1.5" fill="none" stroke={color} strokeWidth="1" />
    </svg>
  );
}

/* Chairs around a table */
function ChairDots({ capacity, isOpen }: { capacity: number; isOpen: boolean }) {
  const count = Math.min(capacity, 12);
  const color = isOpen ? "#6ee7b7" : "#fbbf24";
  const top = Math.ceil(count / 4);
  const bottom = Math.ceil((count - top) / 3);
  const left = Math.ceil((count - top - bottom) / 2);
  const right = count - top - bottom - left;

  return (
    <>
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex gap-1">
        {Array.from({ length: top }, (_, i) => <ChairIcon key={`t${i}`} rotation={180} color={color} />)}
      </div>
      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1">
        {Array.from({ length: bottom }, (_, i) => <ChairIcon key={`b${i}`} rotation={0} color={color} />)}
      </div>
      <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-1">
        {Array.from({ length: left }, (_, i) => <ChairIcon key={`l${i}`} rotation={90} color={color} />)}
      </div>
      <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-1">
        {Array.from({ length: right }, (_, i) => <ChairIcon key={`r${i}`} rotation={270} color={color} />)}
      </div>
    </>
  );
}

/** Extract clientX/clientY from mouse or touch event */
function getClientXY(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } | null {
  if ("touches" in e) {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return null;
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export default function FloorplanCanvas({
  tables,
  reservationsByTableId,
  editable = false,
  heightPx = 420,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [, forceUpdate] = useState(0);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);

  // Keep tables ref current for event handlers
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const tablesWithDefaults = useMemo(() => {
    return tables.map((t) => ({ ...t, ...withDefaults(t) }));
  }, [tables]);

  const updateTable = useCallback(
    (id: string, patch: Partial<FloorplanTable>) => {
      const next = tablesRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t));
      onChangeRef.current?.(next);
    },
    []
  );

  // Global move/end handlers (attached to window so they fire even if finger leaves the element)
  useEffect(() => {
    if (!editable) return;

    function handleMove(e: MouseEvent | TouchEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault(); // Prevent scroll during drag

      const pos = getClientXY(e);
      if (!pos) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dxPct = ((pos.clientX - drag.startClientX) / rect.width) * 100;
      const dyPct = ((pos.clientY - drag.startClientY) / rect.height) * 100;

      const currentTables = tablesRef.current;
      const t = currentTables.find((x) => x.id === drag.id);
      if (!t) return;
      const td = { ...withDefaults(t) };

      if (drag.kind === "drag") {
        updateTable(drag.id, {
          x: clamp(drag.startX + dxPct, 0, 100 - td.w),
          y: clamp(drag.startY + dyPct, 0, 100 - td.h),
        });
      } else if (drag.kind === "resize") {
        updateTable(drag.id, {
          w: clamp(drag.startW + dxPct, 8, 100 - (t.x ?? 5)),
          h: clamp(drag.startH + dyPct, 8, 100 - (t.y ?? 8)),
        });
      }
    }

    function handleEnd() {
      if (dragRef.current) {
        dragRef.current = null;
        forceUpdate((n) => n + 1);
      }
    }

    // Use passive: false so we can preventDefault on touchmove
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [editable, updateTable]);

  function startDrag(id: string, kind: "drag" | "resize", e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    if ("button" in e && e.button !== 0) return;

    // Prevent default touch behavior (scrolling)
    if ("touches" in e) {
      e.preventDefault();
    }

    const pos = "touches" in e
      ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      : { clientX: e.clientX, clientY: e.clientY };

    const t = tablesWithDefaults.find((x) => x.id === id);
    if (!t) return;

    dragRef.current = {
      kind,
      id,
      startClientX: pos.clientX,
      startClientY: pos.clientY,
      startX: t.x,
      startY: t.y,
      startW: t.w,
      startH: t.h,
    };
    setSelectedTableId(id);
    forceUpdate((n) => n + 1);
  }

  const isDragging = dragRef.current !== null;

  return (
    <div
      ref={canvasRef}
      className="relative w-full rounded-2xl border border-slate-200/60 overflow-hidden"
      style={{
        height: `${heightPx}px`,
        background: editable
          ? "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
          : "linear-gradient(135deg, #fafbfc 0%, #f3f5f8 100%)",
        touchAction: editable ? "none" : "auto",
      }}
      onClick={() => {
        if (!editable) setOpenTableId(null);
        setSelectedTableId(null);
      }}
    >
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Section label watermark */}
      {tablesWithDefaults.length > 0 && (
        <div className="absolute top-3 left-4 text-[11px] font-semibold text-slate-300 uppercase tracking-widest pointer-events-none select-none">
          {tablesWithDefaults[0].section_name || ""}
        </div>
      )}

      {/* Tables */}
      {tablesWithDefaults.map((t) => {
        const booked = (reservationsByTableId?.[t.id]?.length || 0) > 0;
        const tableReservations = (reservationsByTableId?.[t.id] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
        const isOpen = !booked;
        const isSelected = selectedTableId === t.id;
        const isBeingDragged = dragRef.current?.id === t.id;

        const borderColor = isSelected
          ? "border-blue-400 ring-2 ring-blue-200/60"
          : isOpen
          ? "border-emerald-200/80"
          : "border-amber-200/80";

        const bgColor = isOpen
          ? "bg-gradient-to-br from-emerald-50 to-emerald-100/60"
          : "bg-gradient-to-br from-amber-50 to-amber-100/60";

        return (
          <div
            key={t.id}
            className={`absolute rounded-xl border-2 select-none transition-shadow ${borderColor} ${bgColor} ${
              isBeingDragged ? "shadow-lg z-20" : "shadow-sm z-10"
            } ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:shadow-md"}`}
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.w}%`,
              height: `${t.h}%`,
              transition: isDragging ? "none" : "box-shadow 0.15s ease, border-color 0.15s ease",
              touchAction: "none",
            }}
            onMouseDown={(e) => editable && startDrag(t.id, "drag", e)}
            onTouchStart={(e) => editable && startDrag(t.id, "drag", e)}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) {
                setSelectedTableId(t.id);
              } else {
                setOpenTableId((prev) => (prev === t.id ? null : t.id));
              }
            }}
          >
            {/* Chair dots (edit mode) */}
            {editable && <ChairDots capacity={t.capacity} isOpen={isOpen} />}

            <div className="p-2 h-full flex flex-col justify-center items-center text-center relative pointer-events-none">
              <div className="text-sm font-bold text-slate-800 truncate max-w-full leading-tight">{t.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] text-slate-500">
                  {t.capacity} {t.capacity === 1 ? "seat" : "seats"}
                </span>
              </div>

              {/* Reservation count badge (view mode) */}
              {!editable && booked && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/70 text-amber-800">
                    {tableReservations.length} booked
                  </span>
                </div>
              )}

              {/* Open badge (view mode) */}
              {!editable && isOpen && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-200/70 text-emerald-800">
                    ✓ Open
                  </span>
                </div>
              )}
            </div>

            {/* Resize handle (edit mode) */}
            {editable && (
              <div
                className="absolute right-0 bottom-0 w-8 h-8 cursor-nwse-resize group"
                style={{ touchAction: "none" }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(t.id, "resize", e); }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(t.id, "resize", e); }}
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4 absolute right-1 bottom-1 text-slate-400 group-hover:text-slate-600 transition-colors">
                  <line x1="14" y1="4" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="14" y1="8" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="14" y1="12" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            )}

            {/* Popover (view mode) */}
            {!editable && openTableId === t.id && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-64 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-4 relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-400">{t.capacity} seats</div>
                    </div>
                    {tableReservations.length === 0 ? (
                      <div className="text-sm text-slate-400 italic py-2">No reservations today</div>
                    ) : (
                      <div className="space-y-1.5">
                        {tableReservations.slice(0, 6).map((r) => {
                          const [h, m] = r.time.split(":");
                          const hour = parseInt(h);
                          const ampm = hour >= 12 ? "PM" : "AM";
                          const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                          const timeStr = `${h12}:${m} ${ampm}`;
                          return (
                            <div key={r.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-slate-50">
                              <span className="text-xs font-semibold text-slate-700">{timeStr}</span>
                              <span className="text-xs text-slate-600 truncate">
                                {r.guest_name}
                                <span className="text-slate-400 ml-1">({r.party_size})</span>
                              </span>
                            </div>
                          );
                        })}
                        {tableReservations.length > 6 && (
                          <div className="text-xs text-slate-400 text-center pt-1">+{tableReservations.length - 6} more</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {tablesWithDefaults.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
          <div className="text-4xl mb-2">🪑</div>
          <div className="text-sm font-medium">No tables in this section</div>
          <div className="text-xs mt-1">Add tables in the list below, then arrange them here</div>
        </div>
      )}

      {/* Help bar (edit mode) */}
      {editable && tablesWithDefaults.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-slate-400 bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-full px-3 sm:px-4 py-1.5 shadow-sm max-w-[calc(100%-2rem)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">drag</kbd> move
          </span>
          <span className="text-slate-200">|</span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" className="w-3 h-3 text-slate-400 inline-block">
              <line x1="14" y1="4" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="8" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="12" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            resize
          </span>
          <span className="text-slate-200 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Don&apos;t forget to <strong className="text-slate-600">Save Layout</strong></span>
        </div>
      )}
    </div>
  );
}
