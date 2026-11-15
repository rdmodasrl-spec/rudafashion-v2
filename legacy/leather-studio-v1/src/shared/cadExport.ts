import { jsPDF } from 'jspdf';
import { computePieceGeometry } from './cadEngine';
import type {
  FoldLine,
  PathNode,
  PatternHole,
  PatternNotch,
  PatternPiece,
  Point2D,
  Project,
} from './types';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface PlacedPiece {
  piece: PatternPiece;
  offsetX: number;
  offsetY: number;
}

function layoutPiecesInMillimeters(pieces: PatternPiece[]): {
  placed: PlacedPiece[];
  totalWidthMm: number;
  totalHeightMm: number;
} {
  const margin = 20;
  const gap = 24;
  const maxRowWidth = 960;

  let curX = margin;
  let curY = margin;
  let rowMaxH = 0;
  let maxX = margin;

  const placed: PlacedPiece[] = [];
  for (const piece of pieces) {
    const contour = piece.cutContour.length ? piece.cutContour : piece.sewContour;
    let minX = 0;
    let minY = 0;
    let maxPX = piece.boundingBoxMm.width;
    let maxPY = piece.boundingBoxMm.height;
    if (contour.length > 0) {
      minX = Math.min(...contour.map((p) => p.x));
      minY = Math.min(...contour.map((p) => p.y));
      maxPX = Math.max(...contour.map((p) => p.x));
      maxPY = Math.max(...contour.map((p) => p.y));
    }
    const w = Math.max(10, maxPX - minX);
    const h = Math.max(10, maxPY - minY);

    if (curX > margin && curX + w + margin > maxRowWidth) {
      curX = margin;
      curY += rowMaxH + gap;
      rowMaxH = 0;
    }

    placed.push({
      piece,
      offsetX: r2(curX - minX),
      offsetY: r2(curY - minY),
    });

    curX += w + gap;
    maxX = Math.max(maxX, curX);
    rowMaxH = Math.max(rowMaxH, h);
  }

  return {
    placed,
    totalWidthMm: r2(Math.max(240, maxX + margin)),
    totalHeightMm: r2(Math.max(200, curY + rowMaxH + margin + 35)),
  };
}

/**
 * Liang-Barsky 2D segment clipper to strictly confine PDF tile strokes
 * inside the printable boundary without bleeding into margins or headers.
 */
function clipSegmentToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): [number, number, number, number] | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }

  return [
    r2(x1 + t0 * dx),
    r2(y1 + t0 * dy),
    r2(x1 + t1 * dx),
    r2(y1 + t1 * dy),
  ];
}

/**
 * Exports project patterns to standard millimeter-unit ASCII DXF
 * with separated layers: CUT, SEW, FOLD, HOLE, NOTCH, MARK.
 */
export function exportProjectToDxf(project: Project): string {
  const { placed, totalWidthMm, totalHeightMm } = layoutPiecesInMillimeters(
    project.patterns
  );
  const lines: string[] = [];

  const push = (...pairs: Array<[number, string | number]>) => {
    for (const [code, val] of pairs) {
      lines.push(String(code), String(val));
    }
  };

  // HEADER
  push([0, 'SECTION'], [2, 'HEADER']);
  push([9, '$ACADVER'], [1, 'AC1009']);
  push([9, '$INSUNITS'], [70, 4]); // 4 = Millimeters
  push([9, '$MEASUREMENT'], [70, 1]); // 1 = Metric
  push([9, '$LUNITS'], [70, 2]); // 2 = Decimal
  push([9, '$EXTMIN'], [10, 0], [20, 0], [30, 0]);
  push([9, '$EXTMAX'], [10, totalWidthMm], [20, totalHeightMm], [30, 0]);
  push([0, 'ENDSEC']);

  // TABLES (LAYERS)
  push([0, 'SECTION'], [2, 'TABLES']);
  push([0, 'TABLE'], [2, 'LAYER'], [70, 6]);
  const layers: Array<[string, number]> = [
    ['CUT', 1],
    ['SEW', 3],
    ['FOLD', 4],
    ['HOLE', 2],
    ['NOTCH', 6],
    ['MARK', 7],
  ];
  for (const [name, color] of layers) {
    push([0, 'LAYER'], [2, name], [70, 0], [62, color], [6, 'CONTINUOUS']);
  }
  push([0, 'ENDTAB'], [0, 'ENDSEC']);

  // ENTITIES
  push([0, 'SECTION'], [2, 'ENTITIES']);

  const toCadY = (svgY: number) => r2(totalHeightMm - svgY);

  const emitClosedPolyline = (layer: string, pts: Point2D[], ox: number, oy: number) => {
    if (pts.length < 3) return;
    push([0, 'POLYLINE'], [8, layer], [66, 1], [70, 1]);
    for (const p of pts) {
      push([0, 'VERTEX'], [8, layer], [10, r2(p.x + ox)], [20, toCadY(p.y + oy)], [30, 0]);
    }
    push([0, 'SEQEND'], [8, layer]);
  };

  for (const { piece, offsetX, offsetY } of placed) {
    const cut = piece.cutContour.length ? piece.cutContour : piece.sewContour;
    emitClosedPolyline('CUT', cut, offsetX, offsetY);
    emitClosedPolyline('SEW', piece.sewContour, offsetX, offsetY);

    for (const fl of piece.foldLines) {
      push(
        [0, 'LINE'],
        [8, 'FOLD'],
        [10, r2(fl.x1 + offsetX)],
        [20, toCadY(fl.y1 + offsetY)],
        [30, 0],
        [11, r2(fl.x2 + offsetX)],
        [21, toCadY(fl.y2 + offsetY)],
        [31, 0]
      );
    }

    for (const hole of piece.holes) {
      push(
        [0, 'CIRCLE'],
        [8, 'HOLE'],
        [10, r2(hole.x + offsetX)],
        [20, toCadY(hole.y + offsetY)],
        [30, 0],
        [40, r2(hole.diameterMm / 2)]
      );
    }

    for (const notch of piece.notches) {
      const x1 = r2(notch.x + offsetX);
      const y1 = toCadY(notch.y + offsetY);
      const x2 = r2(notch.x - notch.nx * notch.depthMm + offsetX);
      const y2 = toCadY(notch.y - notch.ny * notch.depthMm + offsetY);
      push(
        [0, 'LINE'],
        [8, 'NOTCH'],
        [10, x1],
        [20, y1],
        [30, 0],
        [11, x2],
        [21, y2],
        [31, 0]
      );
    }

    // Center mark text + grain direction line
    const cx = r2(offsetX + piece.boundingBoxMm.width / 2);
    const cy = toCadY(offsetY + piece.boundingBoxMm.height / 2);
    push(
      [0, 'TEXT'],
      [8, 'MARK'],
      [10, cx],
      [20, cy],
      [30, 0],
      [40, 5],
      [1, `${piece.partCode} | ${piece.name} | QTY x${piece.quantity}`]
    );
    if (piece.boundingBoxMm.height > 40) {
      push(
        [0, 'LINE'],
        [8, 'MARK'],
        [10, cx],
        [20, r2(cy - 14)],
        [30, 0],
        [11, cx],
        [21, r2(cy + 14)],
        [31, 0]
      );
    }
  }

  // 100mm Calibration Bar on MARK layer
  push(
    [0, 'LINE'],
    [8, 'MARK'],
    [10, 20],
    [20, 18],
    [30, 0],
    [11, 120],
    [21, 18],
    [31, 0]
  );
  push(
    [0, 'TEXT'],
    [8, 'MARK'],
    [10, 20],
    [20, 10],
    [30, 0],
    [40, 4],
    [1, 'CALIBRATION_100MM (UNIT: MM)']
  );

  push([0, 'ENDSEC'], [0, 'EOF']);
  return lines.join('\n');
}

export interface DxfVerificationResult {
  valid: boolean;
  units: string;
  layersFound: string[];
  cutContours: number;
  sewContours: number;
  foldLines: number;
  holes: number;
  notches: number;
  marks: number;
  maxDimensionDeltaMm: number;
  importedPieces: PatternPiece[];
  summary: string;
}

/**
 * Parses an ASCII DXF file back into full editable RUDA PatternPiece[]
 * restoring CUT/SEW contours, FOLD lines, HOLE circles, NOTCH ticks, and MARK labels,
 * and measures dimensional round-trip delta against original project pieces.
 */
export function parseAndVerifyDxf(
  dxfText: string,
  originalPieces?: PatternPiece[]
): DxfVerificationResult {
  const rawLines = dxfText.split(/\r?\n/);
  const pairs: Array<{ code: number; val: string }> = [];
  for (let i = 0; i + 1 < rawLines.length; i += 2) {
    const code = Number.parseInt(rawLines[i].trim(), 10);
    const val = rawLines[i + 1].trim();
    if (!Number.isNaN(code)) {
      pairs.push({ code, val });
    }
  }

  let units = 'Unknown';
  const layersFound = new Set<string>();
  let inEntities = false;

  interface ParsedPoly {
    layer: string;
    points: Point2D[];
  }
  interface ParsedLine {
    layer: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  interface ParsedText {
    layer: string;
    x: number;
    y: number;
    text: string;
  }

  const polylines: ParsedPoly[] = [];
  const holes: Array<{ x: number; y: number; r: number }> = [];
  const parsedLines: ParsedLine[] = [];
  const parsedTexts: ParsedText[] = [];

  let i = 0;
  while (i < pairs.length) {
    const { code, val } = pairs[i];
    if (code === 9 && val === '$INSUNITS') {
      const next = pairs[i + 1];
      if (next && next.val === '4') units = 'Millimeters ($INSUNITS=4)';
    }
    if (code === 2 && val === 'ENTITIES') {
      inEntities = true;
    }
    if (inEntities && code === 0 && val === 'ENDSEC') {
      inEntities = false;
    }

    if (inEntities && code === 0) {
      if (val === 'POLYLINE') {
        let layer = '0';
        const pts: Point2D[] = [];
        i++;
        while (i < pairs.length && !(pairs[i].code === 0 && pairs[i].val === 'SEQEND')) {
          if (pairs[i].code === 8) layer = pairs[i].val;
          if (pairs[i].code === 0 && pairs[i].val === 'VERTEX') {
            let vx = 0;
            let vy = 0;
            i++;
            while (i < pairs.length && pairs[i].code !== 0) {
              if (pairs[i].code === 10) vx = Number.parseFloat(pairs[i].val);
              if (pairs[i].code === 20) vy = Number.parseFloat(pairs[i].val);
              i++;
            }
            pts.push({ x: vx, y: vy });
            continue;
          }
          i++;
        }
        layersFound.add(layer);
        if (pts.length >= 3) polylines.push({ layer, points: pts });
      } else if (val === 'LWPOLYLINE') {
        let layer = '0';
        const pts: Point2D[] = [];
        let curX: number | null = null;
        i++;
        while (i < pairs.length && pairs[i].code !== 0) {
          if (pairs[i].code === 8) layer = pairs[i].val;
          if (pairs[i].code === 10) curX = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 20 && curX != null) {
            pts.push({ x: curX, y: Number.parseFloat(pairs[i].val) });
            curX = null;
          }
          i++;
        }
        layersFound.add(layer);
        if (pts.length >= 3) polylines.push({ layer, points: pts });
        continue;
      } else if (val === 'CIRCLE') {
        let layer = 'HOLE';
        let cx = 0;
        let cy = 0;
        let rad = 1;
        i++;
        while (i < pairs.length && pairs[i].code !== 0) {
          if (pairs[i].code === 8) layer = pairs[i].val;
          if (pairs[i].code === 10) cx = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 20) cy = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 40) rad = Number.parseFloat(pairs[i].val);
          i++;
        }
        layersFound.add(layer);
        holes.push({ x: cx, y: cy, r: rad });
        continue;
      } else if (val === 'LINE') {
        let layer = '0';
        let x1 = 0;
        let y1 = 0;
        let x2 = 0;
        let y2 = 0;
        i++;
        while (i < pairs.length && pairs[i].code !== 0) {
          if (pairs[i].code === 8) layer = pairs[i].val;
          if (pairs[i].code === 10) x1 = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 20) y1 = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 11) x2 = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 21) y2 = Number.parseFloat(pairs[i].val);
          i++;
        }
        layersFound.add(layer);
        parsedLines.push({ layer, x1, y1, x2, y2 });
        continue;
      } else if (val === 'TEXT') {
        let layer = 'MARK';
        let tx = 0;
        let ty = 0;
        let text = '';
        i++;
        while (i < pairs.length && pairs[i].code !== 0) {
          if (pairs[i].code === 8) layer = pairs[i].val;
          if (pairs[i].code === 10) tx = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 20) ty = Number.parseFloat(pairs[i].val);
          if (pairs[i].code === 1) text = pairs[i].val;
          i++;
        }
        layersFound.add(layer);
        parsedTexts.push({ layer, x: tx, y: ty, text });
        continue;
      }
    }
    i++;
  }

  const cutPolys = polylines.filter((p) => p.layer === 'CUT');
  const sewPolys = polylines.filter((p) => p.layer === 'SEW');
  const foldLineEntities = parsedLines.filter((l) => l.layer === 'FOLD');
  const notchLineEntities = parsedLines.filter((l) => l.layer === 'NOTCH');
  const sourcePolys = sewPolys.length > 0 ? sewPolys : cutPolys.length > 0 ? cutPolys : polylines;

  // Compute max Y to invert CAD Y-up back to SVG Y-down
  let maxY = 0;
  for (const poly of [...cutPolys, ...sewPolys, ...polylines]) {
    for (const pt of poly.points) {
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const importedPieces: PatternPiece[] = sourcePolys.map((poly, idx) => {
    const minX = Math.min(...poly.points.map((p) => p.x));
    const maxX = Math.max(...poly.points.map((p) => p.x));
    const minSvgY = Math.min(...poly.points.map((p) => maxY - p.y));
    const maxSvgY = Math.max(...poly.points.map((p) => maxY - p.y));

    const localPts = poly.points.map((p) => ({
      x: r2(p.x - minX),
      y: r2(maxY - p.y - minSvgY),
    }));
    const nodes: PathNode[] = localPts.map((pt, ni) => ({
      id: `dxf_n_${idx}_${ni}`,
      x: pt.x,
      y: pt.y,
      type: ni === 0 ? 'move' : 'line',
    }));

    const insideBox = (px: number, pyCad: number, pad = 12) => {
      const sy = maxY - pyCad;
      return (
        px >= minX - pad &&
        px <= maxX + pad &&
        sy >= minSvgY - pad &&
        sy <= maxSvgY + pad
      );
    };

    const localHoles: PatternHole[] = holes
      .filter((h) => insideBox(h.x, h.y))
      .map((h, hi) => ({
        id: `dxf_h_${idx}_${hi}`,
        x: r2(h.x - minX),
        y: r2(maxY - h.y - minSvgY),
        diameterMm: r2(h.r * 2),
        kind: 'stitch',
      }));

    const localFolds: FoldLine[] = foldLineEntities
      .filter((l) => insideBox(l.x1, l.y1) && insideBox(l.x2, l.y2))
      .map((l, fi) => ({
        id: `dxf_f_${idx}_${fi}`,
        x1: r2(l.x1 - minX),
        y1: r2(maxY - l.y1 - minSvgY),
        x2: r2(l.x2 - minX),
        y2: r2(maxY - l.y2 - minSvgY),
      }));

    const localNotches: PatternNotch[] = notchLineEntities
      .filter((l) => insideBox(l.x1, l.y1))
      .map((l, ni) => {
        const dx = l.x2 - l.x1;
        const dy = -(l.y2 - l.y1);
        const len = Math.max(0.5, Math.hypot(dx, dy));
        return {
          id: `dxf_not_${idx}_${ni}`,
          x: r2(l.x1 - minX),
          y: r2(maxY - l.y1 - minSvgY),
          nx: r2(-dx / len),
          ny: r2(-dy / len),
          depthMm: r2(len),
          edgeId: 'perimeter',
        };
      });

    // Restore partCode, name, quantity from matching MARK TEXT
    const labelMark = parsedTexts.find(
      (t) =>
        t.layer === 'MARK' &&
        !t.text.includes('CALIBRATION') &&
        insideBox(t.x, t.y, 15)
    );
    let partCode = `DXF-${idx + 1}`;
    let name = `DXF 导入纸格 #${idx + 1}`;
    let quantity = 1;
    if (labelMark) {
      const parts = labelMark.text.split('|').map((s) => s.trim());
      if (parts.length >= 2) {
        partCode = parts[0] || partCode;
        name = parts[1] || name;
        const qtyMatch = (parts[2] || '').match(/x(\d+)/i);
        if (qtyMatch) quantity = Number.parseInt(qtyMatch[1], 10);
      } else {
        name = labelMark.text;
      }
    }

    // Match seam allowance from corresponding CUT poly if available
    const matchingCut = cutPolys[idx];
    let inferredAllowance = sewPolys.length > 0 ? 5 : 0;
    if (matchingCut && sewPolys[idx]) {
      const cutW =
        Math.max(...matchingCut.points.map((p) => p.x)) -
        Math.min(...matchingCut.points.map((p) => p.x));
      const sewW = maxX - minX;
      const diff = r2((cutW - sewW) / 2);
      if (diff >= 0 && diff <= 20) inferredAllowance = diff;
    }

    return computePieceGeometry({
      id: `dxf_${Date.now()}_${idx}`,
      componentId: `comp_dxf_${idx}`,
      partCode,
      name,
      category: 'body',
      quantity,
      materialId: 'veg_tan_18',
      materialName: '导入裁片 (默认植鞣牛皮)',
      thicknessMm: 1.8,
      canvasX: r2(minX),
      canvasY: r2(minSvgY),
      rotationDeg: 0,
      nodes,
      edges: [
        {
          edgeId: 'perimeter',
          label: '导入轮廓周长',
          nodeStartIdx: 0,
          nodeEndIdx: 0,
          seamType: inferredAllowance > 0 ? 'plain' : 'raw',
          allowanceMm: inferredAllowance,
          foldWidthMm: 0,
          stitchLineOffsetMm: 3.5,
        },
      ],
      seamAllowanceMm: inferredAllowance,
      foldAllowanceMm: 0,
      sewContour: [],
      cutContour: [],
      stitchContour: [],
      foldLines: localFolds,
      holes: localHoles,
      notches: localNotches,
      grainAngleDeg: 90,
      boundingBoxMm: { width: 0, height: 0 },
      perimeterMm: 0,
      areaMm2: 0,
      edgeLengthsMm: {},
      manuallyEdited: true,
      notes: '由 DXF 文件完整回读恢复的可编辑纸格（含缝份、折边与孔位）',
    });
  });

  // Measure round-trip dimensional delta against original CUT contours if supplied
  let maxDimensionDeltaMm = 0;
  if (originalPieces && cutPolys.length === originalPieces.length) {
    for (let k = 0; k < originalPieces.length; k++) {
      const orig = originalPieces[k];
      const cp = cutPolys[k];
      const cw = r2(
        Math.max(...cp.points.map((p) => p.x)) - Math.min(...cp.points.map((p) => p.x))
      );
      const ch = r2(
        Math.max(...cp.points.map((p) => p.y)) - Math.min(...cp.points.map((p) => p.y))
      );
      const dw = Math.abs(r2(cw - orig.boundingBoxMm.width));
      const dh = Math.abs(r2(ch - orig.boundingBoxMm.height));
      maxDimensionDeltaMm = Math.max(maxDimensionDeltaMm, dw, dh);
    }
  }

  const valid =
    sourcePolys.length > 0 &&
    (layersFound.has('CUT') || layersFound.has('SEW') || polylines.length > 0);

  return {
    valid,
    units,
    layersFound: Array.from(layersFound),
    cutContours: cutPolys.length,
    sewContours: sewPolys.length,
    foldLines: foldLineEntities.length,
    holes: holes.length,
    notches: notchLineEntities.length,
    marks: parsedTexts.length,
    maxDimensionDeltaMm: r2(maxDimensionDeltaMm),
    importedPieces,
    summary: valid
      ? `DXF 复检通过：单位 ${units}，图层 [${Array.from(layersFound).join(', ')}]，裁剪轮廓 ${cutPolys.length} 个，缝合线 ${sewPolys.length} 个，折边 ${foldLineEntities.length} 条，孔位 ${holes.length} 个，刀口 ${notchLineEntities.length} 个（尺寸回读最大偏差 ${r2(maxDimensionDeltaMm)} mm）。`
      : 'DXF 解析失败或未检测到闭合轮廓实体。',
  };
}

/**
 * Generates a true 1:1 millimeter SVG file with layered groups.
 */
export function exportProjectToSvg(project: Project): string {
  const { placed, totalWidthMm, totalHeightMm } = layoutPiecesInMillimeters(
    project.patterns
  );

  const cutPaths: string[] = [];
  const sewPaths: string[] = [];
  const foldLines: string[] = [];
  const holeCircles: string[] = [];
  const notchLines: string[] = [];
  const markTexts: string[] = [];

  const toPath = (pts: Point2D[], ox: number, oy: number) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p.x + ox)} ${r2(p.y + oy)}`)
      .join(' ') + ' Z';

  for (const { piece, offsetX, offsetY } of placed) {
    const cut = piece.cutContour.length ? piece.cutContour : piece.sewContour;
    if (cut.length >= 3) {
      cutPaths.push(
        `<path d="${toPath(cut, offsetX, offsetY)}" fill="none" stroke="#141413" stroke-width="0.35" />`
      );
    }
    if (piece.sewContour.length >= 3) {
      sewPaths.push(
        `<path d="${toPath(piece.sewContour, offsetX, offsetY)}" fill="none" stroke="#16A34A" stroke-width="0.25" stroke-dasharray="2.5 1.5" />`
      );
    }
    for (const fl of piece.foldLines) {
      foldLines.push(
        `<line x1="${r2(fl.x1 + offsetX)}" y1="${r2(fl.y1 + offsetY)}" x2="${r2(fl.x2 + offsetX)}" y2="${r2(fl.y2 + offsetY)}" stroke="#0284C7" stroke-width="0.25" stroke-dasharray="4 1.5 1 1.5" />`
      );
    }
    for (const h of piece.holes) {
      holeCircles.push(
        `<circle cx="${r2(h.x + offsetX)}" cy="${r2(h.y + offsetY)}" r="${r2(h.diameterMm / 2)}" fill="none" stroke="#D97706" stroke-width="0.25" />`
      );
    }
    for (const n of piece.notches) {
      notchLines.push(
        `<line x1="${r2(n.x + offsetX)}" y1="${r2(n.y + offsetY)}" x2="${r2(n.x - n.nx * n.depthMm + offsetX)}" y2="${r2(n.y - n.ny * n.depthMm + offsetY)}" stroke="#DC2626" stroke-width="0.3" />`
      );
    }

    const cx = r2(offsetX + piece.boundingBoxMm.width / 2);
    const cy = r2(offsetY + piece.boundingBoxMm.height / 2);
    markTexts.push(
      `<text x="${cx}" y="${cy}" font-family="sans-serif" font-size="4.5" text-anchor="middle" fill="#141413">${piece.partCode} ${piece.name} (x${piece.quantity})</text>`
    );
    markTexts.push(
      `<text x="${cx}" y="${r2(cy + 6)}" font-family="monospace" font-size="3.2" text-anchor="middle" fill="#5C5B57">${piece.boundingBoxMm.width}x${piece.boundingBoxMm.height}mm · ${piece.materialName}</text>`
    );
  }

  const barY = r2(totalHeightMm - 18);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidthMm}mm" height="${totalHeightMm}mm" viewBox="0 0 ${totalWidthMm} ${totalHeightMm}">
  <title>${project.name} - RUDA AI Leather Studio 1:1 CAD Pattern</title>
  <g id="CUT">${cutPaths.join('\n    ')}</g>
  <g id="SEW">${sewPaths.join('\n    ')}</g>
  <g id="FOLD">${foldLines.join('\n    ')}</g>
  <g id="HOLE">${holeCircles.join('\n    ')}</g>
  <g id="NOTCH">${notchLines.join('\n    ')}</g>
  <g id="MARK">
    ${markTexts.join('\n    ')}
    <rect x="20" y="${barY}" width="100" height="5" fill="none" stroke="#141413" stroke-width="0.35" />
    <line x1="70" y1="${barY}" x2="70" y2="${barY + 5}" stroke="#141413" stroke-width="0.35" />
    <text x="20" y="${barY - 2}" font-family="monospace" font-size="3.5" fill="#141413">100mm CALIBRATION RULER (100% 1:1 SCALE) | ${project.name} v${project.currentVersion}</text>
  </g>
</svg>`;
}

export interface PdfExportReport {
  buffer: ArrayBuffer;
  pageFormat: 'A4' | 'A3' | 'LARGE';
  cols: number;
  rows: number;
  totalPages: number;
  printableWidthMm: number;
  printableHeightMm: number;
}

/**
 * Generates a 1:1 scale printable PDF pattern sheet supporting A4, A3, and LARGE format
 * with exact Liang-Barsky tile clipping, alignment crosshairs, 50mm glue ticks,
 * and X/Y dual-axis 100.0mm calibration bars.
 */
export function exportProjectToPdfWithReport(
  project: Project,
  pageFormat: 'A4' | 'A3' | 'LARGE' = 'A4'
): PdfExportReport {
  const pageDims =
    pageFormat === 'A4'
      ? { w: 210, h: 297 }
      : pageFormat === 'A3'
        ? { w: 297, h: 420 }
        : { w: 900, h: 1200 };

  const { placed, totalWidthMm, totalHeightMm } = layoutPiecesInMillimeters(
    project.patterns
  );

  const margin = 12;
  const printableW = pageDims.w - margin * 2;
  const printableH = pageDims.h - margin * 2;

  const cols = Math.max(1, Math.ceil(totalWidthMm / printableW));
  const rows = Math.max(1, Math.ceil(totalHeightMm / printableH));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageFormat === 'LARGE' ? [900, 1200] : pageFormat.toLowerCase(),
  });

  let pageIndex = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (pageIndex > 0) doc.addPage();
      pageIndex++;

      const tileOriginX = col * printableW;
      const tileOriginY = row * printableH;

      // Tile border, 50mm alignment ticks & registration crosshairs
      doc.setDrawColor(190, 190, 185);
      doc.setLineWidth(0.2);
      doc.rect(margin, margin, printableW, printableH);

      for (let xTick = 50; xTick < printableW; xTick += 50) {
        doc.line(margin + xTick, margin, margin + xTick, margin + 2.2);
        doc.line(
          margin + xTick,
          margin + printableH - 2.2,
          margin + xTick,
          margin + printableH
        );
      }
      for (let yTick = 50; yTick < printableH; yTick += 50) {
        doc.line(margin, margin + yTick, margin + 2.2, margin + yTick);
        doc.line(
          margin + printableW - 2.2,
          margin + yTick,
          margin + printableW,
          margin + yTick
        );
      }

      const drawCross = (cx: number, cy: number) => {
        doc.line(cx - 3, cy, cx + 3, cy);
        doc.line(cx, cy - 3, cx, cy + 3);
        doc.circle(cx, cy, 1.4);
      };
      drawCross(margin, margin);
      drawCross(margin + printableW, margin);
      drawCross(margin, margin + printableH);
      drawCross(margin + printableW, margin + printableH);

      // Header mark
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 58);
      doc.text(
        `RUDA STUDIO | ${project.name} v${project.currentVersion} | Tile R${row + 1}-C${col + 1} (${pageIndex}/${rows * cols}) | PRINT AT 100% ACTUAL SIZE`,
        margin + 2,
        margin - 3.2
      );

      // Dual-axis 100.0mm X & Y calibration rulers on Page 1
      if (row === 0 && col === 0) {
        const rx = margin + 4;
        const ry = margin + 5;
        doc.setDrawColor(20, 20, 19);
        doc.setLineWidth(0.35);
        // Horizontal 100.0 mm
        doc.rect(rx, ry, 100, 4.5);
        for (let mm = 10; mm < 100; mm += 10) {
          doc.line(rx + mm, ry, rx + mm, ry + (mm === 50 ? 4.5 : 2.5));
        }
        doc.setFontSize(6.8);
        doc.setTextColor(20, 20, 19);
        doc.text('X: 100.0 mm (1:1)', rx + 102, ry + 3.4);

        // Vertical 100.0 mm
        doc.rect(rx, ry + 7, 4.5, 100);
        for (let mm = 10; mm < 100; mm += 10) {
          doc.line(rx, ry + 7 + mm, rx + (mm === 50 ? 4.5 : 2.5), ry + 7 + mm);
        }
        doc.text('Y: 100.0 mm', rx + 6, ry + 57);
      }

      const drawClippedLine = (
        worldX1: number,
        worldY1: number,
        worldX2: number,
        worldY2: number
      ) => {
        const clipped = clipSegmentToRect(
          worldX1 - tileOriginX,
          worldY1 - tileOriginY,
          worldX2 - tileOriginX,
          worldY2 - tileOriginY,
          0,
          0,
          printableW,
          printableH
        );
        if (clipped) {
          doc.line(
            margin + clipped[0],
            margin + clipped[1],
            margin + clipped[2],
            margin + clipped[3]
          );
        }
      };

      for (const { piece, offsetX, offsetY } of placed) {
        const cut = piece.cutContour.length ? piece.cutContour : piece.sewContour;
        const bboxMinX = offsetX;
        const bboxMaxX = offsetX + piece.boundingBoxMm.width + 20;
        const bboxMinY = offsetY;
        const bboxMaxY = offsetY + piece.boundingBoxMm.height + 20;

        if (
          bboxMaxX < tileOriginX ||
          bboxMinX > tileOriginX + printableW ||
          bboxMaxY < tileOriginY ||
          bboxMinY > tileOriginY + printableH
        ) {
          continue;
        }

        // CUT contour
        if (cut.length >= 3) {
          doc.setDrawColor(20, 20, 19);
          doc.setLineWidth(0.35);
          for (let i = 0; i < cut.length; i++) {
            const a = cut[i];
            const b = cut[(i + 1) % cut.length];
            drawClippedLine(a.x + offsetX, a.y + offsetY, b.x + offsetX, b.y + offsetY);
          }
        }

        // SEW contour
        if (piece.sewContour.length >= 3) {
          doc.setDrawColor(22, 163, 74);
          doc.setLineWidth(0.22);
          doc.setLineDashPattern([2, 1.5], 0);
          for (let i = 0; i < piece.sewContour.length; i++) {
            const a = piece.sewContour[i];
            const b = piece.sewContour[(i + 1) % piece.sewContour.length];
            drawClippedLine(a.x + offsetX, a.y + offsetY, b.x + offsetX, b.y + offsetY);
          }
          doc.setLineDashPattern([], 0);
        }

        // FOLD lines
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.25);
        for (const fl of piece.foldLines) {
          drawClippedLine(
            fl.x1 + offsetX,
            fl.y1 + offsetY,
            fl.x2 + offsetX,
            fl.y2 + offsetY
          );
        }

        // HOLE circles (strictly inside tile)
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.22);
        for (const h of piece.holes) {
          const lx = h.x + offsetX - tileOriginX;
          const ly = h.y + offsetY - tileOriginY;
          if (lx >= 0 && lx <= printableW && ly >= 0 && ly <= printableH) {
            doc.circle(margin + lx, margin + ly, Math.max(0.4, h.diameterMm / 2));
          }
        }

        // NOTCH ticks
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.3);
        for (const n of piece.notches) {
          drawClippedLine(
            n.x + offsetX,
            n.y + offsetY,
            n.x - n.nx * n.depthMm + offsetX,
            n.y - n.ny * n.depthMm + offsetY
          );
        }

        // Part label
        const lx = offsetX + piece.boundingBoxMm.width / 2 - tileOriginX;
        const ly = offsetY + piece.boundingBoxMm.height / 2 - tileOriginY;
        if (lx >= 10 && lx <= printableW - 10 && ly >= 8 && ly <= printableH - 8) {
          doc.setFontSize(8.5);
          doc.setTextColor(20, 20, 19);
          doc.text(`${piece.partCode} | QTY x${piece.quantity}`, margin + lx, margin + ly, {
            align: 'center',
          });
          doc.setFontSize(6.8);
          doc.setTextColor(92, 91, 87);
          doc.text(
            `${piece.boundingBoxMm.width}x${piece.boundingBoxMm.height}mm (${piece.thicknessMm}mm)`,
            margin + lx,
            margin + ly + 4.2,
            { align: 'center' }
          );
        }
      }
    }
  }

  return {
    buffer: doc.output('arraybuffer'),
    pageFormat,
    cols,
    rows,
    totalPages: rows * cols,
    printableWidthMm: printableW,
    printableHeightMm: printableH,
  };
}

export function exportProjectToPdf(
  project: Project,
  pageFormat: 'A4' | 'A3' | 'LARGE' = 'A4'
): ArrayBuffer {
  return exportProjectToPdfWithReport(project, pageFormat).buffer;
}

export function exportProjectToCsv(project: Project): string {
  const header = [
    '部件编号',
    '部件名称',
    '类别',
    '裁剪数量',
    '材料名称',
    '厚度(mm)',
    '成品宽(mm)',
    '成品高(mm)',
    '周长(mm)',
    '单件面积(dm2)',
    '缝份(mm)',
    '折边(mm)',
    '工艺说明',
  ];
  const rows = project.patterns.map((p) => [
    p.partCode,
    `"${p.name}"`,
    p.category,
    String(p.quantity),
    `"${p.materialName}"`,
    String(p.thicknessMm),
    String(p.boundingBoxMm.width),
    String(p.boundingBoxMm.height),
    String(p.perimeterMm),
    String(r2(p.areaMm2 / 10000)),
    String(p.seamAllowanceMm),
    String(p.foldAllowanceMm),
    `"${p.notes ?? ''}"`,
  ]);

  const hwRows = project.hardware.map((h) => [
    h.id.toUpperCase(),
    `"五金: ${h.name}"`,
    'hardware',
    String(h.quantity),
    `"${h.finish}"`,
    '-',
    String(h.mountWidthMm),
    '-',
    '-',
    '-',
    '-',
    '-',
    `"孔径 ${h.holeDiameterMm}mm"`,
  ]);

  return (
    '\uFEFF' +
    [
      header.join(','),
      ...rows.map((r) => r.join(',')),
      ...hwRows.map((r) => r.join(',')),
    ].join('\n')
  );
}

export function exportProjectToJson(project: Project): string {
  return JSON.stringify(
    {
      schema: 'RUDA-CAD-NATIVE-V1',
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2
  );
}
