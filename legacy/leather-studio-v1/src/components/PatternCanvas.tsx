import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Maximize2,
  MousePointer2,
  PenTool,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { computePieceGeometry, pointsToSvgPath } from '../shared/cadEngine';
import type { PathNode, PatternPiece } from '../shared/types';

interface PatternCanvasProps {
  patterns: PatternPiece[];
  selectedPieceId: string | null;
  proMode?: boolean;
  onSelectPiece: (id: string | null) => void;
  onUpdatePiece: (piece: PatternPiece, commitVersionSummary?: string) => void;
}

type CanvasMode = 'move' | 'edit_nodes' | 'add_hole';
type PatternLayerMode = 'all' | 'net_stitch' | 'process' | 'cut';

const LAYER_MODE_OPTIONS: Array<{ id: PatternLayerMode; label: string }> = [
  { id: 'all', label: '全层叠加' },
  { id: 'net_stitch', label: 'A 净版与缝合线' },
  { id: 'process', label: 'B 工艺版' },
  { id: 'cut', label: 'C 裁剪版' },
];

export const PatternCanvas: React.FC<PatternCanvasProps> = ({
  patterns,
  selectedPieceId,
  proMode = false,
  onSelectPiece,
  onUpdatePiece,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 30, y: 30 });
  const [mode, setMode] = useState<CanvasMode>('move');
  const [layerMode, setLayerMode] = useState<PatternLayerMode>('all');

  const [layers, setLayers] = useState({
    cut: true,
    sew: true,
    stitch: true,
    fold: true,
    hole: true,
    notch: true,
    dims: true,
  });

  const handleSelectLayerMode = (nextMode: PatternLayerMode) => {
    setLayerMode(nextMode);
    if (nextMode === 'all') {
      setLayers({
        cut: true,
        sew: true,
        stitch: true,
        fold: true,
        hole: true,
        notch: true,
        dims: true,
      });
    } else if (nextMode === 'net_stitch') {
      setLayers({
        cut: false,
        sew: true,
        stitch: true,
        fold: false,
        hole: false,
        notch: false,
        dims: true,
      });
    } else if (nextMode === 'process') {
      setLayers({
        cut: true,
        sew: true,
        stitch: false,
        fold: true,
        hole: true,
        notch: true,
        dims: true,
      });
    } else if (nextMode === 'cut') {
      setLayers({
        cut: true,
        sew: false,
        stitch: false,
        fold: false,
        hole: false,
        notch: true,
        dims: true,
      });
    }
  };

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const dragRef = useRef<{
    kind: 'pan' | 'piece' | 'node' | 'ctrl1' | 'ctrl2';
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    pieceId?: string;
    nodeId?: string;
    origX?: number;
    origY?: number;
    workingPiece?: PatternPiece;
  } | null>(null);

  const fitAll = () => {
    if (!svgRef.current || patterns.length === 0) {
      setZoom(0.9);
      setPan({ x: 30, y: 30 });
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of patterns) {
      minX = Math.min(minX, p.canvasX - 20);
      minY = Math.min(minY, p.canvasY - 20);
      maxX = Math.max(maxX, p.canvasX + p.boundingBoxMm.width + 30);
      maxY = Math.max(maxY, p.canvasY + p.boundingBoxMm.height + 30);
    }
    const contentW = Math.max(200, maxX - minX);
    const contentH = Math.max(200, maxY - minY);
    const scale = Math.min(
      (rect.width - 60) / contentW,
      (rect.height - 60) / contentH,
      1.6
    );
    const clampedZoom = Math.max(0.25, Math.min(2.0, scale));
    setZoom(clampedZoom);
    setPan({
      x: (rect.width - contentW * clampedZoom) / 2 - minX * clampedZoom,
      y: (rect.height - contentH * clampedZoom) / 2 - minY * clampedZoom,
    });
  };

  useEffect(() => {
    fitAll();
  }, [patterns.length]);

  useEffect(() => {
    if (!proMode && mode !== 'move') {
      setMode('move');
      setSelectedNodeId(null);
    }
  }, [proMode, mode]);

  const screenToWorldMm = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const nextZoom = Math.max(0.2, Math.min(4.0, zoom * factor));
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPan({
        x: mx - ((mx - pan.x) / zoom) * nextZoom,
        y: my - ((my - pan.y) / zoom) * nextZoom,
      });
    }
    setZoom(nextZoom);
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as Element).getAttribute('data-bg') === 'true') {
      onSelectPiece(null);
      setSelectedNodeId(null);
      dragRef.current = {
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;

    const dxPx = e.clientX - d.startClientX;
    const dyPx = e.clientY - d.startClientY;
    const dxMm = Math.round((dxPx / zoom) * 2) / 2;
    const dyMm = Math.round((dyPx / zoom) * 2) / 2;

    if (d.kind === 'pan') {
      setPan({ x: d.startPanX + dxPx, y: d.startPanY + dyPx });
      return;
    }

    if (d.kind === 'piece' && d.workingPiece) {
      const updated = {
        ...d.workingPiece,
        canvasX: Math.round((d.origX! + dxMm) * 10) / 10,
        canvasY: Math.round((d.origY! + dyMm) * 10) / 10,
      };
      onUpdatePiece(updated);
      return;
    }

    if (
      (d.kind === 'node' || d.kind === 'ctrl1' || d.kind === 'ctrl2') &&
      d.workingPiece &&
      d.nodeId
    ) {
      const updatedNodes = d.workingPiece.nodes.map((n) => {
        if (n.id !== d.nodeId) return n;
        if (d.kind === 'node') {
          return {
            ...n,
            x: Math.round((d.origX! + dxMm) * 10) / 10,
            y: Math.round((d.origY! + dyMm) * 10) / 10,
          };
        }
        if (d.kind === 'ctrl1') {
          return {
            ...n,
            cx1: Math.round((d.origX! + dxMm) * 10) / 10,
            cy1: Math.round((d.origY! + dyMm) * 10) / 10,
          };
        }
        return {
          ...n,
          cx2: Math.round((d.origX! + dxMm) * 10) / 10,
          cy2: Math.round((d.origY! + dyMm) * 10) / 10,
        };
      });
      const recomputed = computePieceGeometry({
        ...d.workingPiece,
        nodes: updatedNodes,
        manuallyEdited: true,
      });
      onUpdatePiece(recomputed);
    }
  };

  const handlePointerUp = () => {
    const d = dragRef.current;
    if (
      d &&
      (d.kind === 'node' || d.kind === 'ctrl1' || d.kind === 'ctrl2') &&
      d.workingPiece
    ) {
      const latest = patterns.find((p) => p.id === d.workingPiece!.id);
      if (latest) {
        onUpdatePiece(latest, `手工编辑 ${latest.partCode} 轮廓节点`);
      }
    }
    dragRef.current = null;
  };

  const selectedPiece = useMemo(
    () => patterns.find((p) => p.id === selectedPieceId) || null,
    [patterns, selectedPieceId]
  );

  const toggleSelectedNodeCurve = () => {
    if (!selectedPiece || !selectedNodeId) return;
    const idx = selectedPiece.nodes.findIndex((n) => n.id === selectedNodeId);
    if (idx <= 0) return;
    const prev = selectedPiece.nodes[idx - 1];
    const curr = selectedPiece.nodes[idx];
    const updatedNodes: PathNode[] = selectedPiece.nodes.map((n, i) => {
      if (i !== idx) return n;
      if (n.type === 'line') {
        return {
          ...n,
          type: 'quad',
          cx1: Math.round(((prev.x + curr.x) / 2) * 10) / 10,
          cy1: Math.round(((prev.y + curr.y) / 2 - 15) * 10) / 10,
        };
      }
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        type: 'line',
      };
    });
    const recomputed = computePieceGeometry({
      ...selectedPiece,
      nodes: updatedNodes,
      manuallyEdited: true,
    });
    onUpdatePiece(recomputed, `切换 ${selectedPiece.partCode} 节点 ${selectedNodeId} 直线/曲线`);
  };

  return (
    <div className="relative flex-1 bg-[#F2F0EA] overflow-hidden flex flex-col h-full min-h-0">
      {/* Compact Canvas Toolbar: 3-Layer Pattern View + Full CAD tools in Pro Mode */}
      {proMode ? (
        <div className="h-11 bg-[#FFFFFF] border-b border-[#E4E2DC] px-3 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 bg-[#F6F5F1] p-0.5 rounded border border-[#E4E2DC] shrink-0">
            <button
              type="button"
              onClick={() => setMode('move')}
              className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                mode === 'move'
                  ? 'bg-white text-[#141413] shadow-xs'
                  : 'text-[#5C5B57] hover:text-[#141413]'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              移动纸格
            </button>
            <button
              type="button"
              onClick={() => setMode('edit_nodes')}
              className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                mode === 'edit_nodes'
                  ? 'bg-white text-[#9A4D22] shadow-xs'
                  : 'text-[#5C5B57] hover:text-[#141413]'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              节点/曲线
            </button>
            <button
              type="button"
              onClick={() => setMode('add_hole')}
              className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                mode === 'add_hole'
                  ? 'bg-white text-[#9A4D22] shadow-xs'
                  : 'text-[#5C5B57] hover:text-[#141413]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              打孔
            </button>
          </div>

          {/* 3-Layer Standard Pattern Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF9F6] p-0.5 rounded border border-[#E4E2DC] shrink-0">
            {LAYER_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectLayerMode(opt.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                  layerMode === opt.id
                    ? 'bg-[#9A4D22] text-white'
                    : 'text-[#5C5B57] hover:text-[#141413]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Granular Layer Toggles */}
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                ['cut', '裁剪'],
                ['sew', '净线'],
                ['stitch', '斩孔'],
                ['fold', '折边'],
                ['hole', '孔位'],
                ['notch', '刀口'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`px-1.5 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                  layers[key]
                    ? 'bg-[#FAF6F2] border-[#9A4D22]/40 text-[#9A4D22]'
                    : 'bg-white border-[#E4E2DC] text-[#78756E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, z * 0.85))}
              aria-label="缩小"
              className="p-1.5 rounded hover:bg-[#F6F5F1] text-[#5C5B57]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums text-[#5C5B57] w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, z * 1.15))}
              aria-label="放大"
              className="p-1.5 rounded hover:bg-[#F6F5F1] text-[#5C5B57]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitAll}
              aria-label="适配画布"
              className="px-2 py-1 text-xs text-[#5C5B57] hover:text-[#141413] hover:bg-[#F6F5F1] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              适配
            </button>
          </div>
        </div>
      ) : (
        <div className="h-10 bg-[#FAF9F6] border-b border-[#E4E2DC] px-4 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1 bg-[#ECEAE3] p-0.5 rounded shrink-0">
            {LAYER_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectLayerMode(opt.id)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                  layerMode === opt.id
                    ? 'bg-white text-[#9A4D22] shadow-xs'
                    : 'text-[#5C5B57] hover:text-[#141413]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, z * 0.85))}
              aria-label="缩小"
              className="p-1 rounded hover:bg-[#ECEAE3] text-[#5C5B57]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono tabular-nums text-[#5C5B57] w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, z * 1.15))}
              aria-label="放大"
              className="p-1 rounded hover:bg-[#ECEAE3] text-[#5C5B57]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitAll}
              aria-label="适配画布"
              className="px-2 py-1 text-xs text-[#5C5B57] hover:text-[#141413] hover:bg-[#ECEAE3] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              适配
            </button>
          </div>
        </div>
      )}

      {/* Interactive Node Editing Bar when node selected in Pro Mode */}
      {proMode && mode === 'edit_nodes' && selectedPiece && (
        <div className="bg-[#FAF6F2] border-b border-[#E4E2DC] px-4 py-1.5 flex items-center justify-between gap-4 text-xs">
          <div className="text-[#5C5B57]">
            正在编辑 <span className="font-semibold text-[#141413]">{selectedPiece.partCode} {selectedPiece.name}</span>：拖拽蓝色节点调整轮廓坐标，拖拽橙色手柄调节贝塞尔弧度
          </div>
          {selectedNodeId && (
            <button
              type="button"
              onClick={toggleSelectedNodeCurve}
              className="px-2.5 py-1 bg-white border border-[#D8D5CD] rounded text-xs font-medium text-[#9A4D22] hover:bg-[#F6F5F1] whitespace-nowrap shrink-0"
            >
              切换当前节点 直线 / 贝塞尔曲线
            </button>
          )}
        </div>
      )}

      {/* Main SVG CAD Viewport */}
      <div className="relative flex-1 min-h-0">
        {patterns.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <p className="text-sm font-medium text-[#5C5B57]">
              画布暂无二维纸格
            </p>
            <p className="text-xs text-[#78756E] mt-1">
              请在左侧输入自然语言（如“生成一个托特包”），或在右侧「部件」面板点击「+ 手工新增纸格」或导入 DXF。
            </p>
          </div>
        ) : null}

        <svg
          ref={svgRef}
          onWheel={handleWheel}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-full select-none cursor-grab active:cursor-grabbing"
        >
          <defs>
            <pattern
              id="grid-minor-10mm"
              width={10 * zoom}
              height={10 * zoom}
              patternUnits="userSpaceOnUse"
              x={pan.x % (10 * zoom)}
              y={pan.y % (10 * zoom)}
            >
              <path
                d={`M ${10 * zoom} 0 L 0 0 0 ${10 * zoom}`}
                fill="none"
                stroke="#E4E1D8"
                strokeWidth="0.6"
              />
            </pattern>
            <pattern
              id="grid-major-50mm"
              width={50 * zoom}
              height={50 * zoom}
              patternUnits="userSpaceOnUse"
              x={pan.x % (50 * zoom)}
              y={pan.y % (50 * zoom)}
            >
              <path
                d={`M ${50 * zoom} 0 L 0 0 0 ${50 * zoom}`}
                fill="none"
                stroke="#D6D2C7"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid-minor-10mm)" data-bg="true" />
          <rect width="100%" height="100%" fill="url(#grid-major-50mm)" data-bg="true" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 100mm Reference Scale Bar at Origin */}
            <g transform="translate(20, 12)">
              <line x1={0} y1={0} x2={100} y2={0} stroke="#78756E" strokeWidth={1.2 / zoom} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="#78756E" strokeWidth={1.2 / zoom} />
              <line x1={100} y1={-3} x2={100} y2={3} stroke="#78756E" strokeWidth={1.2 / zoom} />
              <text
                x={50}
                y={-5}
                textAnchor="middle"
                fontSize={10 / zoom}
                fill="#78756E"
                fontFamily="JetBrains Mono, monospace"
              >
                100 mm
              </text>
            </g>

            {patterns.map((piece) => {
              const isSelected = piece.id === selectedPieceId;
              const cutPath = pointsToSvgPath(
                piece.cutContour.length ? piece.cutContour : piece.sewContour
              );
              const sewPath = pointsToSvgPath(piece.sewContour);
              const stitchPath = pointsToSvgPath(piece.stitchContour);
              const cx = piece.boundingBoxMm.width / 2;
              const cy = piece.boundingBoxMm.height / 2;

              return (
                <g
                  key={piece.id}
                  transform={`translate(${piece.canvasX}, ${piece.canvasY})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectPiece(piece.id);
                    if (mode === 'add_hole') {
                      const world = screenToWorldMm(e.clientX, e.clientY);
                      const lx = Math.round((world.x - piece.canvasX) * 10) / 10;
                      const ly = Math.round((world.y - piece.canvasY) * 10) / 10;
                      const nextPiece: PatternPiece = {
                        ...piece,
                        manuallyEdited: true,
                        holes: [
                          ...piece.holes,
                          {
                            id: `hole_${Date.now()}`,
                            x: lx,
                            y: ly,
                            diameterMm: 2.5,
                            kind: 'rivet',
                            label: '手工孔位',
                          },
                        ],
                      };
                      onUpdatePiece(nextPiece, `在 ${piece.partCode} 添加手工孔位 (${lx}, ${ly})mm`);
                      return;
                    }
                    if (mode === 'move') {
                      dragRef.current = {
                        kind: 'piece',
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startPanX: pan.x,
                        startPanY: pan.y,
                        pieceId: piece.id,
                        origX: piece.canvasX,
                        origY: piece.canvasY,
                        workingPiece: piece,
                      };
                    }
                  }}
                  className="cursor-pointer"
                >
                  {/* Layer C: Cut Contour */}
                  {layers.cut && cutPath && (
                    <path
                      d={cutPath}
                      fill={isSelected ? 'rgba(154, 77, 34, 0.08)' : 'rgba(255, 255, 255, 0.88)'}
                      stroke={isSelected ? '#9A4D22' : '#141413'}
                      strokeWidth={(isSelected ? 1.8 : 1.2) / zoom}
                    />
                  )}

                  {/* Layer A: Sew / Net Contour */}
                  {layers.sew && sewPath && (
                    <path
                      d={sewPath}
                      fill={!layers.cut ? (isSelected ? 'rgba(22, 163, 74, 0.08)' : 'rgba(255,255,255,0.88)') : 'none'}
                      stroke="#16A34A"
                      strokeWidth={1.1 / zoom}
                      strokeDasharray={layers.cut ? `${4 / zoom} ${3 / zoom}` : undefined}
                    />
                  )}

                  {/* Layer A: Stitch Line Contour */}
                  {layers.stitch && stitchPath && (
                    <path
                      d={stitchPath}
                      fill="none"
                      stroke="#9A4D22"
                      strokeOpacity={0.7}
                      strokeWidth={0.85 / zoom}
                      strokeDasharray={`${1.5 / zoom} ${2.5 / zoom}`}
                    />
                  )}

                  {/* Layer B: Fold Lines */}
                  {layers.fold &&
                    piece.foldLines.map((fl) => (
                      <line
                        key={fl.id}
                        x1={fl.x1}
                        y1={fl.y1}
                        x2={fl.x2}
                        y2={fl.y2}
                        stroke="#0284C7"
                        strokeWidth={1.1 / zoom}
                        strokeDasharray={`${6 / zoom} ${2.5 / zoom} ${1.5 / zoom} ${2.5 / zoom}`}
                      />
                    ))}

                  {/* Layer B: Holes */}
                  {layers.hole &&
                    piece.holes.map((h) => (
                      <g key={h.id}>
                        <circle
                          cx={h.x}
                          cy={h.y}
                          r={Math.max(1.2, h.diameterMm / 2)}
                          fill="#FFFFFF"
                          stroke={h.kind === 'stitch' ? '#78756E' : '#D97706'}
                          strokeWidth={1 / zoom}
                        />
                        {h.kind !== 'stitch' && (
                          <circle cx={h.x} cy={h.y} r={0.5} fill="#D97706" />
                        )}
                      </g>
                    ))}

                  {/* Layer B/C: Notches */}
                  {layers.notch &&
                    piece.notches.map((n) => (
                      <line
                        key={n.id}
                        x1={n.x}
                        y1={n.y}
                        x2={n.x - n.nx * n.depthMm * 1.4}
                        y2={n.y - n.ny * n.depthMm * 1.4}
                        stroke="#DC2626"
                        strokeWidth={1.4 / zoom}
                      />
                    ))}

                  {/* Grain Line Arrow */}
                  {piece.boundingBoxMm.height > 40 && (
                    <g opacity={0.45}>
                      <line
                        x1={cx}
                        y1={Math.max(10, cy - 22)}
                        x2={cx}
                        y2={Math.min(piece.boundingBoxMm.height - 10, cy + 22)}
                        stroke="#5C5B57"
                        strokeWidth={0.9 / zoom}
                      />
                      <path
                        d={`M ${cx - 3} ${Math.max(10, cy - 22) + 5} L ${cx} ${Math.max(10, cy - 22)} L ${cx + 3} ${Math.max(10, cy - 22) + 5}`}
                        fill="none"
                        stroke="#5C5B57"
                        strokeWidth={0.9 / zoom}
                      />
                    </g>
                  )}

                  {/* Piece Labels & Dimensions */}
                  <text
                    x={cx}
                    y={cy - 3}
                    textAnchor="middle"
                    fontSize={Math.min(13, 11 / zoom)}
                    fontWeight={600}
                    fill={isSelected ? '#9A4D22' : '#141413'}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {piece.partCode} · {piece.name.split(' ')[0]} ×{piece.quantity}
                  </text>
                  {layers.dims && (
                    <text
                      x={cx}
                      y={cy + 12 / zoom}
                      textAnchor="middle"
                      fontSize={Math.min(11, 9.5 / zoom)}
                      fill="#5C5B57"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {piece.boundingBoxMm.width} × {piece.boundingBoxMm.height} mm
                    </text>
                  )}

                  {/* Interactive Node & Bezier Handles in Edit Mode */}
                  {mode === 'edit_nodes' &&
                    isSelected &&
                    piece.nodes.map((node, ni) => {
                      const prevNode = piece.nodes[ni - 1];
                      const isNodeSel = node.id === selectedNodeId;
                      return (
                        <g key={node.id}>
                          {node.type === 'quad' &&
                            node.cx1 != null &&
                            node.cy1 != null &&
                            prevNode && (
                              <>
                                <line
                                  x1={prevNode.x}
                                  y1={prevNode.y}
                                  x2={node.cx1}
                                  y2={node.cy1}
                                  stroke="#D97706"
                                  strokeWidth={0.9 / zoom}
                                  strokeDasharray={`${3 / zoom} ${2 / zoom}`}
                                />
                                <line
                                  x1={node.x}
                                  y1={node.y}
                                  x2={node.cx1}
                                  y2={node.cy1}
                                  stroke="#D97706"
                                  strokeWidth={0.9 / zoom}
                                  strokeDasharray={`${3 / zoom} ${2 / zoom}`}
                                />
                                <circle
                                  cx={node.cx1}
                                  cy={node.cy1}
                                  r={4.5 / zoom}
                                  fill="#D97706"
                                  stroke="#FFFFFF"
                                  strokeWidth={1.2 / zoom}
                                  className="cursor-move"
                                  onPointerDown={(ev) => {
                                    ev.stopPropagation();
                                    setSelectedNodeId(node.id);
                                    dragRef.current = {
                                      kind: 'ctrl1',
                                      startClientX: ev.clientX,
                                      startClientY: ev.clientY,
                                      startPanX: pan.x,
                                      startPanY: pan.y,
                                      pieceId: piece.id,
                                      nodeId: node.id,
                                      origX: node.cx1,
                                      origY: node.cy1,
                                      workingPiece: piece,
                                    };
                                  }}
                                />
                              </>
                            )}
                          <rect
                            x={node.x - 4.5 / zoom}
                            y={node.y - 4.5 / zoom}
                            width={9 / zoom}
                            height={9 / zoom}
                            rx={1.5 / zoom}
                            fill={isNodeSel ? '#9A4D22' : '#0284C7'}
                            stroke="#FFFFFF"
                            strokeWidth={1.3 / zoom}
                            className="cursor-move"
                            onPointerDown={(ev) => {
                              ev.stopPropagation();
                              setSelectedNodeId(node.id);
                              dragRef.current = {
                                kind: 'node',
                                startClientX: ev.clientX,
                                startClientY: ev.clientY,
                                startPanX: pan.x,
                                startPanY: pan.y,
                                pieceId: piece.id,
                                nodeId: node.id,
                                origX: node.x,
                                origY: node.y,
                                workingPiece: piece,
                              };
                            }}
                          />
                        </g>
                      );
                    })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Quiet legend + selected piece 3-layer & skiving info in bottom-left */}
        <div className="pointer-events-none absolute bottom-3 left-3 bg-[#FFFFFF]/94 border border-[#E4E2DC] rounded px-3 py-1.5 text-[11px] text-[#5C5B57] flex flex-wrap items-center gap-x-3 gap-y-1 font-mono max-w-[92%]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#141413] inline-block" />
            CUT 裁剪版
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-[#16A34A] inline-block" />
            SEW 净版线
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dotted border-[#9A4D22] inline-block" />
            STITCH 缝线
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dotted border-[#0284C7] inline-block" />
            FOLD 折边
          </span>
          {selectedPiece && (
            <span className="text-[#141413] border-l border-[#E4E2DC] pl-3">
              {selectedPiece.partCode} 对称:{selectedPiece.symmetryRule || 'none'} · 纹向:{selectedPiece.grainAngleDeg}°
              {selectedPiece.skivingZones && selectedPiece.skivingZones.length > 0
                ? ` · 铲薄边:${selectedPiece.skivingZones.length}条`
                : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
