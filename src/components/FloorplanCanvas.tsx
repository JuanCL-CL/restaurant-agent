"use client";

import { useMemo, useRef, useState } from "react";

export type FloorplanTable = {
  id: string;
  name: string;
  capacity: number;
  section_id: string;
  section_name?: string;
  x?: number; // 0-100 (percent)
  y?: number; // 0-100 (percent)
  w?: number; // 0-100 (percent)
  h?: number; // 0-100 (percent)
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

type DragState =
  | null
  | {
      kind: "drag";
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      kind: "resize";
      id: string;
      startClientX: number;
      startClientY: number;
      startW: number;
      startH: number;
    };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function withDefaults(t: FloorplanTable): Required<Pick<FloorplanTable, "x" | "y" | "w" | "h">> {
  return {
    x: typeof t.x === "number" ? t.x : 5,
    y: typeof t.y === "number" ? t.y : 8,
    w: typeof t.w === "number" ? t.w : 22,
    h: typeof t.h === "number" ? t.h : 18,
  };
}

export default function FloorplanCanvas({
  tables,
  reservationsByTableId,
  editable = false,
  heightPx = 420,
  onChange,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);

  const tablesWithDefaults = useMemo(() => {
    return tables.map((t) => ({ ...t, ...withDefaults(t) }));
  }, [tables]);

  function updateTable(id: string, patch: Partial<FloorplanTable>) {
    const next = tables.map((t) => (t.id === id ? { ...t, ...patch } : t));
    onChange?.(next);
  }

  function getRect() {
    const el = ref.current;
    if (!el) return null;
    return el.getBoundingClientRect();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!editable || !drag) return;
    const rect = getRect();
    if (!rect) return;

    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

    if (drag.kind === "drag") {
      const t = tablesWithDefaults.find((x) => x.id === drag.id);
      if (!t) return;
      const nextX = clamp(drag.startX + dxPct, 0, 100 - t.w!);
      const nextY = clamp(drag.startY + dyPct, 0, 100 - t.h!);
      updateTable(drag.id, { x: nextX, y: nextY });
    }

    if (drag.kind === "resize") {
      const t = tablesWithDefaults.find((x) => x.id === drag.id);
      if (!t) return;
      const minW = 10;
      const minH = 10;
      const maxW = 100 - t.x!;
      const maxH = 100 - t.y!;

      const nextW = clamp(drag.startW + dxPct, minW, maxW);
      const nextH = clamp(drag.startH + dyPct, minH, maxH);
      updateTable(drag.id, { w: nextW, h: nextH });
    }
  }

  function endDrag() {
    setDrag(null);
  }

  return (
    <div
      ref={ref}
      className="relative w-full rounded-2xl border border-slate-200/60 bg-slate-50 overflow-hidden"
      style={{ height: `${heightPx}px` }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        // Avoid sticky drag if pointer leaves the canvas.
        if (drag) endDrag();
      }}
    >
      {/* light grid */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {tablesWithDefaults.map((t) => {
        const booked = (reservationsByTableId?.[t.id]?.length || 0) > 0;
        const tableReservations = (reservationsByTableId?.[t.id] || []).slice().sort((a, b) => a.time.localeCompare(b.time));

        const isOpen = !booked;
        const color = isOpen
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-amber-200 bg-amber-50/80";

        return (
          <div
            key={t.id}
            className={`absolute rounded-xl border shadow-sm select-none ${color} ${editable ? "cursor-move" : "cursor-pointer"}`}
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.w}%`,
              height: `${t.h}%`,
            }}
            onPointerDown={(e) => {
              if (!editable) return;
              // ignore right-click / non-primary
              if (e.button !== 0) return;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setDrag({
                kind: "drag",
                id: t.id,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startX: t.x!,
                startY: t.y!,
              });
            }}
            onClick={() => {
              if (editable) return;
              setOpenTableId((prev) => (prev === t.id ? null : t.id));
            }}
          >
            <div className="p-2.5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{t.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{t.capacity} seats</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border whitespace-nowrap ${
                    isOpen
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}
                >
                  {isOpen ? "Open" : `${tableReservations.length} booked`}
                </span>
              </div>

              {/* compact reservation preview (view mode) */}
              {!editable && booked && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tableReservations.slice(0, 2).map((r) => (
                    <span key={r.id} className="px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/60 text-[10px] text-slate-600">
                      {r.time}
                    </span>
                  ))}
                  {tableReservations.length > 2 && (
                    <span className="px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/60 text-[10px] text-slate-500">
                      +{tableReservations.length - 2}
                    </span>
                  )}
                </div>
              )}

              {/* resize handle */}
              {editable && (
                <div
                  className="absolute right-1 bottom-1 w-3.5 h-3.5 rounded bg-slate-900/70 cursor-nwse-resize"
                  onPointerDown={(e) => {
                    // prevent starting a drag
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    setDrag({
                      kind: "resize",
                      id: t.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startW: t.w!,
                      startH: t.h!,
                    });
                  }}
                />
              )}
            </div>

            {/* popover (view mode) */}
            {!editable && openTableId === t.id && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 z-20">
                <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
                  <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-400 mb-2">{t.capacity} seats</div>
                  {tableReservations.length === 0 ? (
                    <div className="text-sm text-slate-500">No reservations</div>
                  ) : (
                    <div className="space-y-2">
                      {tableReservations.slice(0, 6).map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">{r.time}</span>
                          <span className="text-xs text-slate-600 truncate">{r.guest_name} ({r.party_size})</span>
                        </div>
                      ))}
                      {tableReservations.length > 6 && (
                        <div className="text-xs text-slate-400">+{tableReservations.length - 6} more</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="absolute right-4 bottom-3 text-[11px] text-slate-400 bg-white/80 border border-slate-200/60 rounded-full px-3 py-1">
          Drag tables to move · Drag the corner to resize
        </div>
      )}
    </div>
  );
}
