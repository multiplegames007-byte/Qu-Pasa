import React, { useState, useRef, useEffect } from 'react';
import { RestaurantTable, TableStatus, Reservation } from '../types/index.ts';
import { Users, AlertCircle, Link2, Unlink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface FloorPlanSVGProps {
  mode: 'customer' | 'management';
  tables: RestaurantTable[];
  selectedTableId?: number | null;
  onSelectTable?: (table: RestaurantTable) => void;
  // Customer mode props
  requiredGuests?: number;
  tableAvailabilityMap?: Record<number, { isFree: boolean; isBlocked?: boolean }>;
  // Management mode props
  tableStatusMap?: Record<number, { status: TableStatus; currentReservation?: Reservation }>;
  onUpdateTablePosition?: (id: number, x: number, y: number) => void;
  onTableActionClick?: (table: RestaurantTable) => void;
  isDraggable?: boolean;
}

export const FloorPlanSVG: React.FC<FloorPlanSVGProps> = ({
  mode,
  tables,
  selectedTableId,
  onSelectTable,
  requiredGuests = 2,
  tableAvailabilityMap = {},
  tableStatusMap = {},
  onUpdateTablePosition,
  onTableActionClick,
  isDraggable = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [draggingTableId, setDraggingTableId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredTableId, setHoveredTableId] = useState<number | null>(null);

  // SVG coordinate transformation
  const getSVGCoords = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(transformed.x), y: Math.round(transformed.y) };
  };

  const handlePointerDown = (e: React.PointerEvent, table: RestaurantTable) => {
    if (mode === 'management' && isDraggable) {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      const coords = getSVGCoords(e as unknown as React.PointerEvent<SVGSVGElement>);
      setDraggingTableId(table.id);
      setDragOffset({
        x: coords.x - table.x,
        y: coords.y - table.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingTableId !== null && onUpdateTablePosition) {
      const coords = getSVGCoords(e);
      const newX = Math.max(70, Math.min(930, coords.x - dragOffset.x));
      const newY = Math.max(70, Math.min(570, coords.y - dragOffset.y));
      onUpdateTablePosition(draggingTableId, newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingTableId !== null) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setDraggingTableId(null);
    }
  };

  // Helper to determine customer table color & state
  const getCustomerTableState = (table: RestaurantTable) => {
    if (!table.isActive) {
      return { color: '#94A3B8', statusText: 'Inativa', isClickable: false, badge: 'Desativada' };
    }

    const avail = tableAvailabilityMap[table.id];
    if (avail?.isBlocked) {
      return { color: '#F59E0B', statusText: 'Bloqueada temporariamente', isClickable: false, badge: 'Em reserva' };
    }
    if (avail && !avail.isFree) {
      return { color: '#EF4444', statusText: 'Ocupada / Reservada neste turno', isClickable: false, badge: 'Ocupada' };
    }

    // Available free table
    const isSuitable = table.capacity >= requiredGuests;
    return {
      color: '#10B981',
      statusText: isSuitable
        ? `Disponível (${table.capacity} lugares)`
        : `Disponível (${table.capacity} lugares para ${requiredGuests} pessoas)`,
      isClickable: true,
      badge: `${table.capacity} pax`,
    };
  };

  // Helper for management mode table color & status
  const getManagementTableState = (table: RestaurantTable) => {
    if (!table.isActive) {
      return {
        bg: '#94A3B8',
        border: '#64748B',
        text: 'white',
        statusLabel: 'Inativa',
        res: undefined,
      };
    }

    const info = tableStatusMap[table.id];
    const status = info?.status || 'livre';

    switch (status) {
      case 'sentada':
        return {
          bg: '#DC2626', // Vermelho
          border: '#991B1B',
          text: 'white',
          statusLabel: 'Sentada',
          res: info?.currentReservation,
        };
      case 'chegou':
        return {
          bg: '#F59E0B', // Âmbar / Laranja
          border: '#D97706',
          text: 'white',
          statusLabel: 'Chegou',
          res: info?.currentReservation,
        };
      case 'reservada':
        return {
          bg: '#2563EB', // Azul
          border: '#1D4ED8',
          text: 'white',
          statusLabel: 'Reservada',
          res: info?.currentReservation,
        };
      case 'a_limpar':
        return {
          bg: '#8B5CF6', // Roxo
          border: '#6D28D9',
          text: 'white',
          statusLabel: 'A Limpar',
          res: info?.currentReservation,
        };
      case 'bloqueada':
        return {
          bg: '#EAB308',
          border: '#CA8A04',
          text: 'white',
          statusLabel: 'Bloqueada (Hold)',
          res: undefined,
        };
      case 'livre':
      default:
        return {
          bg: '#10B981', // Verde
          border: '#059669',
          text: 'white',
          statusLabel: 'Livre',
          res: undefined,
        };
    }
  };

  // Helper to render decorative chairs around table circle
  const renderChairs = (table: RestaurantTable, isSelected: boolean) => {
    const chairs: React.ReactNode[] = [];
    const count = table.capacity;
    const chairDist = table.radius + 15;

    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      const cx = table.x + chairDist * Math.cos(angle);
      const cy = table.y + chairDist * Math.sin(angle);
      chairs.push(
        <circle
          key={`chair-${table.id}-${i}`}
          cx={cx}
          cy={cy}
          r={9}
          fill={isSelected ? '#F59E0B' : '#E2E8F0'}
          stroke="#475569"
          strokeWidth="2"
          className="transition-colors duration-200"
        />
      );
    }
    return chairs;
  };

  const vbWidth = Math.round(1000 / zoom);
  const vbHeight = Math.round(640 / zoom);
  const vbX = Math.round((1000 - vbWidth) / 2);
  const vbY = Math.round((640 - vbHeight) / 2);

  return (
    <div className="w-full relative select-none">
      {/* SVG Container */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
        {/* Zoom Controls (management mode only) */}
        {mode === 'management' && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1.0, Number((z - 0.25).toFixed(2))))}
              disabled={zoom <= 1.0}
              title="Diminuir Zoom"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-bold text-amber-400 px-1 min-w-[38px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.25).toFixed(2))))}
              disabled={zoom >= 1.75}
              title="Aumentar Zoom"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoom > 1.0 && (
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                title="Repor Zoom"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className={`w-full ${mode === 'management' ? 'overflow-x-auto touch-pan-x' : ''}`}>
          <svg
            ref={svgRef}
            viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
            className={`w-full h-auto block touch-manipulation select-none ${mode === 'management' ? 'min-w-[650px] sm:min-w-full' : 'max-w-full'}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
          {/* Defs for gradients & patterns */}
          <defs>
            <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B132B" />
              <stop offset="100%" stopColor="#1C2541" />
            </linearGradient>

            <linearGradient id="canalWater" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0369A1" stopOpacity="0.1" />
            </linearGradient>

            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.25" />
            </pattern>

            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.35" />
            </filter>
            
            <filter id="glowSelect" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#F59E0B" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Restaurant Floor Background */}
          <rect x="0" y="0" width="1000" height="640" fill="url(#floorGrad)" />
          <rect x="0" y="0" width="1000" height="640" fill="url(#gridPattern)" />

          {/* Room Boundary Wall */}
          <rect x="2" y="2" width="996" height="636" rx="12" fill="none" stroke="#334155" strokeWidth="2.5" />

          {/* Architectural Elements */}

          {/* 1. Entrada Principal (Top Left) */}
          <g transform="translate(60, 20)">
            <rect x="0" y="0" width="110" height="32" rx="4" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
            <path d="M 20 0 A 25 25 0 0 1 45 25" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="55" y="20" fill="#E2E8F0" fontSize="11" fontWeight="700" letterSpacing="1">
              ENTRADA
            </text>
            <polygon points="5,16 12,11 12,21" fill="#F59E0B" />
          </g>

          {/* 2. Cozinha Aberta / Pass (Top Right) */}
          <g transform="translate(730, 20)">
            <rect x="0" y="0" width="230" height="48" rx="6" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
            <text x="115" y="24" textAnchor="middle" fill="#CBD5E1" fontSize="12" fontWeight="700" letterSpacing="1">
              COZINHA // PASS
            </text>
            <line x1="20" y1="36" x2="210" y2="36" stroke="#475569" strokeWidth="1" strokeDasharray="4 2" />
            <text x="115" y="44" textAnchor="middle" fill="#94A3B8" fontSize="8" letterSpacing="0.5">
              Cozinha de Autor Barba Azul
            </text>
          </g>

          {/* 3. Balcão / Bar de Vinhos & Petiscos (Right Side) */}
          <g transform="translate(930, 110)">
            <rect x="0" y="0" width="45" height="380" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
            <text
              x="22"
              y="190"
              transform="rotate(90, 22, 190)"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="11"
              fontWeight="600"
              letterSpacing="2"
            >
              BAR & GARRAFEIRA
            </text>
            {/* Bar stools */}
            {[40, 90, 140, 190, 240, 290, 340].map((stY, idx) => (
              <circle key={`stool-${idx}`} cx="-12" cy={stY} r="7" fill="#334155" stroke="#64748B" strokeWidth="1.5" />
            ))}
          </g>

          {/* 4. Instalações Sanitárias / WC (Bottom Right) */}
          <g transform="translate(850, 560)">
            <rect x="0" y="0" width="110" height="55" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
            <text x="55" y="32" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="600" letterSpacing="1">
              WC RESTAURANTE
            </text>
          </g>

          {/* 5. Acolhimento / Receção (near Entrance) */}
          <g transform="translate(190, 24)">
            <rect x="0" y="0" width="55" height="26" rx="4" fill="#334155" stroke="#475569" strokeWidth="1" />
            <text x="27" y="17" textAnchor="middle" fill="#CBD5E1" fontSize="9" fontWeight="600">
              HOST
            </text>
          </g>

          {/* Connections for Joined Tables (Mesas Unidas) */}
          {tables
            .filter((t) => t.joinedWithId && t.id < t.joinedWithId)
            .map((table) => {
              const partner = tables.find((p) => p.id === table.joinedWithId);
              if (!partner) return null;
              return (
                <g key={`joined-${table.id}-${partner.id}`}>
                  <line
                    x1={table.x}
                    y1={table.y}
                    x2={partner.x}
                    y2={partner.y}
                    stroke="#F59E0B"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                  <rect
                    x={(table.x + partner.x) / 2 - 40}
                    y={(table.y + partner.y) / 2 - 12}
                    width="80"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                  />
                  <text
                    x={(table.x + partner.x) / 2}
                    y={(table.y + partner.y) / 2 + 4}
                    textAnchor="middle"
                    fill="#FDE68A"
                    fontSize="9"
                    fontWeight="700"
                  >
                    UNIDAS
                  </text>
                </g>
              );
            })}


          {/* THE 12 CIRCULAR TABLES */}
          {tables.map((table) => {
            const isSelected = selectedTableId === table.id;
            const isHovered = hoveredTableId === table.id;

            let fillColor = '#10B981';
            let strokeColor = '#059669';
            let isClickable = true;
            let statusBadge = '';

            if (mode === 'customer') {
              const custState = getCustomerTableState(table);
              fillColor = custState.color;
              strokeColor = isSelected ? '#F59E0B' : custState.color;
              isClickable = custState.isClickable;
              statusBadge = custState.badge || '';
            } else {
              const mgmtState = getManagementTableState(table);
              fillColor = mgmtState.bg;
              strokeColor = mgmtState.border;
              statusBadge = mgmtState.statusLabel;
            }

            return (
              <g
                key={`table-g-${table.id}`}
                className={`transition-all duration-200 ${
                  mode === 'customer'
                    ? isClickable
                      ? 'cursor-pointer hover:opacity-95'
                      : 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:opacity-95'
                }`}
                onPointerDown={(e) => handlePointerDown(e, table)}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try {
                      navigator.vibrate(25);
                    } catch {
                      // ignore
                    }
                  }
                  if (mode === 'customer') {
                    if (isClickable && onSelectTable) {
                      onSelectTable(table);
                    }
                  } else {
                    if (onTableActionClick) {
                      onTableActionClick(table);
                    }
                  }
                }}
                onMouseEnter={() => setHoveredTableId(table.id)}
                onMouseLeave={() => setHoveredTableId(null)}
              >
                {/* Generous touch / click hit area for mobile and desktop */}
                <circle
                  cx={table.x}
                  cy={table.y}
                  r={table.radius + 18}
                  fill="transparent"
                  pointerEvents="all"
                  cursor={isClickable ? 'pointer' : 'not-allowed'}
                />
                {/* Decorative Chairs around table */}
                {renderChairs(table, isSelected)}

                {/* Table Shadow & Base Circle */}
                <circle
                  cx={table.x}
                  cy={table.y}
                  r={table.radius}
                  fill={fillColor}
                  stroke={isSelected ? '#F59E0B' : strokeColor}
                  strokeWidth={isSelected ? '5' : '3'}
                  filter={isSelected ? 'url(#glowSelect)' : 'url(#softShadow)'}
                  className="transition-colors duration-200"
                />

                {/* Inner decorative rim */}
                <circle
                  cx={table.x}
                  cy={table.y}
                  r={table.radius - 8}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="2"
                />

                {/* Pulsing selection ring */}
                {isSelected && (
                  <circle
                    cx={table.x}
                    cy={table.y}
                    r={table.radius + 6}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                )}

                {/* "MESA" Label */}
                <text
                  x={table.x}
                  y={table.y - 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255, 255, 255, 0.9)"
                  fontSize="11"
                  fontWeight="800"
                  letterSpacing="1"
                  className="font-sans pointer-events-none drop-shadow"
                >
                  MESA
                </text>

                {/* Table Number in center */}
                {/* Table Number */}
                <text
                  x={table.x}
                  y={table.y + 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize={table.radius > 50 ? '24' : '20'}
                  fontWeight="700"
                  fontFamily="var(--font-texto)"
                  className="cliente-mesa-num pointer-events-none drop-shadow"
                >
                  {table.number}
                </text>

                {/* Capacity Subscript */}
                <text
                  x={table.x}
                  y={table.y + 20}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize="12"
                  fontWeight="500"
                  fontFamily="var(--font-texto)"
                  className="pointer-events-none drop-shadow"
                >
                  {table.capacity} lug.
                </text>

                {/* Selected Checkmark Badge (Customer Mode) */}
                {isSelected && mode === 'customer' && (
                  <g transform={`translate(${table.x + table.radius - 8}, ${table.y - table.radius + 6})`}>
                    <circle cx="0" cy="0" r="14" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
                    <path
                      d="M -5 0 L -1 4 L 6 -3"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Management Status Pill below table */}
                {mode === 'management' && (
                  <g transform={`translate(${table.x}, ${table.y + table.radius + 14})`}>
                    <rect
                      x="-34"
                      y="-8"
                      width="68"
                      height="16"
                      rx="8"
                      fill="#0F172A"
                      stroke={strokeColor}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="9"
                      fontWeight="700"
                      className="pointer-events-none tracking-tight"
                    >
                      {statusBadge}
                    </text>
                  </g>
                )}

                {/* Hover Tooltip in Customer Mode */}
                {mode === 'customer' && isHovered && (
                  <g transform={`translate(${table.x}, ${table.y - table.radius - 20})`}>
                    <rect
                      x="-65"
                      y="-24"
                      width="130"
                      height="24"
                      rx="6"
                      fill="#0F172A"
                      stroke="#475569"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-8"
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="10"
                      fontWeight="600"
                    >
                      Mesa {table.number} · {table.capacity} lug. ({isClickable ? 'Livre' : 'Indisponível'})
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      {/* Floor Plan Legend Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium text-slate-400">Legenda:</span>
          {mode === 'customer' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/20" />
                <span>Livre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 inline-block" />
                <span>Reservada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block" />
                <span>Bloqueada (em reserva)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 inline-block" />
                <span>Capacidade insuficiente</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block" />
                <span>Livre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block" />
                <span>Reservada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block" />
                <span>Chegou</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-red-600 inline-block" />
                <span>Sentada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 inline-block" />
                <span>A Limpar</span>
              </div>
            </>
          )}
        </div>

        {mode === 'management' && isDraggable && (
          <div className="text-amber-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Modo de Edição Ativo: arraste as mesas para posicionar</span>
          </div>
        )}
      </div>
    </div>
  );
};
