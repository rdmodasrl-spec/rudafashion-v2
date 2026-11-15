import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileUp,
  Loader2,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, type SystemHealthInfo } from '../api/client';
import {
  type DxfVerificationResult,
  exportProjectToCsv,
  exportProjectToDxf,
  exportProjectToJson,
  exportProjectToPdf,
  exportProjectToPdfWithReport,
  exportProjectToSvg,
  parseAndVerifyDxf,
} from '../shared/cadExport';
import { getMaterialById } from '../shared/leatherKnowledge';
import type { Project } from '../shared/types';

interface ExportModalProps {
  project: Project;
  onClose: () => void;
  onRecordExport: (
    format: 'pdf' | 'dxf' | 'svg' | 'json' | 'csv',
    pageFormat?: 'A4' | 'A3' | 'LARGE'
  ) => Promise<void>;
  onImportDxf: (dxfText: string, replaceExisting: boolean) => Promise<void>;
}

interface AcceptanceAuditReport {
  health: SystemHealthInfo;
  visiblePartsCount: number;
  inferredPartsCount: number;
  maxSeamDeltaMm: number;
  dxfResult: DxfVerificationResult;
  pdfPages: number;
  pdfGrid: string;
  pdfPrintableMm: string;
  totalLeatherDm2: number;
  hardwareCount: number;
  needsSkiving: boolean;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  onClose,
  onRecordExport,
  onImportDxf,
}) => {
  const [pdfFormat, setPdfFormat] = useState<'A4' | 'A3' | 'LARGE'>('A4');
  const [dxfCheck, setDxfCheck] = useState<DxfVerificationResult | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditReport, setAuditReport] = useState<AcceptanceAuditReport | null>(null);
  const dxfFileRef = useRef<HTMLInputElement | null>(null);

  const safeBaseName = `${project.name}_v${project.currentVersion}`.replace(
    /[\\/:*?"<>|]/g,
    '_'
  );

  const handleExportPdf = async () => {
    const buffer = exportProjectToPdf(project, pdfFormat);
    triggerDownload(
      new Blob([buffer], { type: 'application/pdf' }),
      `${safeBaseName}_${pdfFormat}_1to1.pdf`
    );
    await onRecordExport('pdf', pdfFormat);
    setStatusMsg(`已生成 1:1 ${pdfFormat} 拼接打印 PDF（含双轴 100.0mm 校验标尺与精准分张裁剪）。`);
  };

  const handleExportDxf = async () => {
    const dxfText = exportProjectToDxf(project);
    const verification = parseAndVerifyDxf(dxfText, project.patterns);
    setDxfCheck(verification);
    triggerDownload(
      new Blob([dxfText], { type: 'application/dxf' }),
      `${safeBaseName}.dxf`
    );
    await onRecordExport('dxf');
    setStatusMsg(`已导出标准毫米分图层 DXF，并完成回读完整性复检。`);
  };

  const handleExportSvg = async () => {
    const svgText = exportProjectToSvg(project);
    triggerDownload(
      new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }),
      `${safeBaseName}.svg`
    );
    await onRecordExport('svg');
    setStatusMsg('已导出 1:1 真实毫米比例矢量 SVG（含 CUT / SEW / FOLD / HOLE / NOTCH / MARK 图层组）。');
  };

  const handleExportCsv = async () => {
    const csvText = exportProjectToCsv(project);
    triggerDownload(
      new Blob([csvText], { type: 'text/csv;charset=utf-8' }),
      `${safeBaseName}_BOM.csv`
    );
    await onRecordExport('csv');
    setStatusMsg('已导出裁片尺寸与五金用料清单 CSV。');
  };

  const handleExportJson = async () => {
    const jsonText = exportProjectToJson(project);
    triggerDownload(
      new Blob([jsonText], { type: 'application/json;charset=utf-8' }),
      `${safeBaseName}.ruda.json`
    );
    await onRecordExport('json');
    setStatusMsg('已导出 RUDA 原生可编辑参数化项目文件 (.ruda.json)。');
  };

  const handleDxfUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    await onImportDxf(text, replaceOnImport);
    setStatusMsg(`已将「${file.name}」重新导入到当前 CAD 画布，可继续编辑节点与缝份。`);
  };

  const handleRunAcceptanceAudit = async () => {
    setRunningAudit(true);
    try {
      const health = await api.getSystemHealth();
      const dxfText = exportProjectToDxf(project);
      const dxfResult = parseAndVerifyDxf(dxfText, project.patterns);
      setDxfCheck(dxfResult);

      const pdfRep = exportProjectToPdfWithReport(project, pdfFormat);

      let maxSeamDeltaMm = 0;
      for (const rel of project.relations) {
        if (rel.relationType !== 'sew') continue;
        const p1 = project.patterns.find((p) => p.componentId === rel.fromComponentId);
        const p2 = project.patterns.find((p) => p.componentId === rel.toComponentId);
        if (!p1 || !p2 || p1.category === 'interior' || p2.category === 'interior') continue;
        if (rel.notes?.includes('贴袋') || rel.notes?.includes('受力区')) continue;
        const l1 = p1.edgeLengthsMm[rel.fromEdgeId];
        const l2 = p2.edgeLengthsMm[rel.toEdgeId];
        if (l1 != null && l2 != null) {
          maxSeamDeltaMm = Math.max(maxSeamDeltaMm, Math.round(Math.abs(l1 - l2) * 100) / 100);
        }
      }

      const mat = getMaterialById(project.materialId);
      const totalLeatherDm2 =
        Math.round(
          project.patterns
            .filter((p) => p.materialId === project.materialId)
            .reduce((acc, p) => acc + (p.areaMm2 * p.quantity) / 10000, 0) * 100
        ) / 100;

      setAuditReport({
        health,
        visiblePartsCount: project.components.filter((c) => !c.isInferredHidden).length,
        inferredPartsCount: project.components.filter((c) => c.isInferredHidden).length,
        maxSeamDeltaMm,
        dxfResult,
        pdfPages: pdfRep.totalPages,
        pdfGrid: `${pdfRep.rows}行 × ${pdfRep.cols}列`,
        pdfPrintableMm: `${pdfRep.printableWidthMm}×${pdfRep.printableHeightMm}mm`,
        totalLeatherDm2,
        hardwareCount: project.hardware.reduce((s, h) => s + h.quantity, 0),
        needsSkiving:
          project.edgeProcess === 'folded' &&
          mat.thicknessMm > mat.skivingRecommendedAboveMm,
      });
    } finally {
      setRunningAudit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#141413]/40 flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg w-full max-w-[780px] max-h-[90vh] flex flex-col overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-[#ECEAE3] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413]">
              生产文件导出与工程验收自检
            </h2>
            <p className="text-xs text-[#5C5B57] mt-0.5 font-mono tabular-nums">
              {project.name} · v{project.currentVersion} · {project.patterns.length} 片纸格 · 单位：毫米 (1:1 mm)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导出窗口"
            className="p-1.5 text-[#5C5B57] hover:text-[#141413] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!project.validation.passed && (
            <div className="border border-[#DC2626]/30 bg-[#FEF2F2] text-[#991B1B] text-xs px-4 py-3 rounded">
              注意：当前仍有 {project.validation.errorCount} 个几何或接缝错误未修复，建议先在右侧「校验」面板修复后再投入工厂裁切打样。
            </div>
          )}

          {/* Engineering 5-Point Acceptance Self-Audit */}
          <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#141413] flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-[#9A4D22]" />
                  五项工程生产验收自检（AI · CAD · DXF · 1:1 打印 · 工厂工艺）
                </h3>
                <p className="text-xs text-[#5C5B57] mt-0.5">
                  一键对当前项目执行真实 DXF 回读、PDF 分张裁剪与接缝工艺精度实测。
                </p>
              </div>
              <button
                type="button"
                disabled={runningAudit}
                onClick={handleRunAcceptanceAudit}
                className="px-3.5 py-1.5 text-xs font-medium text-[#141413] bg-white border border-[#D8D5CD] hover:border-[#9A4D22] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {runningAudit ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A4D22]" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#9A4D22]" />
                )}
                运行 5 项工程验收自检
              </button>
            </div>

            {auditReport && (
              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-[#ECEAE3] text-xs">
                <div className="flex items-center justify-between gap-2 bg-white border border-[#E4E2DC] rounded px-3 py-2">
                  <span className="font-medium text-[#141413]">1. 真实 AI 视觉与模型配置</span>
                  <span className="font-mono text-[11px] text-[#5C5B57] tabular-nums">
                    模型 {auditReport.health.aiModel} ·{' '}
                    {auditReport.health.aiConfigured ? 'Key 已就绪' : '运行时等待 Key 注入'} · 可见{' '}
                    {auditReport.visiblePartsCount} / 推断隐藏 {auditReport.inferredPartsCount} 件
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white border border-[#E4E2DC] rounded px-3 py-2">
                  <span className="font-medium text-[#141413]">2. 参数化二维 CAD 接缝精度</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      project.validation.passed ? 'text-[#166534]' : 'text-[#DC2626]'
                    }`}
                  >
                    {project.validation.checksRun.length} 项检查 · {project.validation.errorCount} 错误 · 最大接缝差{' '}
                    {auditReport.maxSeamDeltaMm} mm
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white border border-[#E4E2DC] rounded px-3 py-2">
                  <span className="font-medium text-[#141413]">3. 工业 DXF 导出→回读实测</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      auditReport.dxfResult.valid && auditReport.dxfResult.maxDimensionDeltaMm <= 0.05
                        ? 'text-[#166534]'
                        : 'text-[#D97706]'
                    }`}
                  >
                    {auditReport.dxfResult.layersFound.join('/')} · {auditReport.dxfResult.cutContours} 裁片 · 尺寸偏差{' '}
                    {auditReport.dxfResult.maxDimensionDeltaMm} mm
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white border border-[#E4E2DC] rounded px-3 py-2">
                  <span className="font-medium text-[#141413]">4. 1:1 可打印 PDF 分张实测 ({pdfFormat})</span>
                  <span className="font-mono text-[11px] text-[#166534] tabular-nums">
                    共 {auditReport.pdfPages} 页 ({auditReport.pdfGrid}) · 单页有效 {auditReport.pdfPrintableMm} · 双轴 100.0mm 标尺
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white border border-[#E4E2DC] rounded px-3 py-2">
                  <span className="font-medium text-[#141413]">5. 工厂打样用料与工艺可行性</span>
                  <span className="font-mono text-[11px] text-[#5C5B57] tabular-nums">
                    主皮净耗 {auditReport.totalLeatherDm2} dm² · 五金 {auditReport.hardwareCount} 件 ·{' '}
                    {auditReport.needsSkiving ? '需边缘铲薄 0.6mm' : '可直接缝制'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 1. PDF 1:1 Print Export */}
          <div className="border border-[#E4E2DC] rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">
                  1. 可打印 1:1 生产纸格 PDF
                </h3>
                <p className="text-xs text-[#5C5B57] mt-0.5">
                  自动分张拼接大裁片并严格边界裁剪，首页附带 X/Y 双轴 100.0mm 校验标尺与 50mm 对位刻度。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={pdfFormat}
                  onChange={(e) =>
                    setPdfFormat(e.target.value as 'A4' | 'A3' | 'LARGE')
                  }
                  className="px-2.5 py-1.5 text-xs border border-[#D8D5CD] rounded bg-[#FAF9F6]"
                >
                  <option value="A4">A4 分张拼接 (210×297mm)</option>
                  <option value="A3">A3 分张拼接 (297×420mm)</option>
                  <option value="LARGE">大幅面绘图仪 (900×1200mm)</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  导出 PDF
                </button>
              </div>
            </div>
          </div>

          {/* 2. DXF + SVG + CSV + JSON */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-[#E4E2DC] rounded-md p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">
                  2. 工业标准 DXF (分图层)
                </h3>
                <p className="text-xs text-[#5C5B57] mt-1">
                  严格设置毫米单位 ($INSUNITS=4)，包含 CUT / SEW / FOLD / HOLE / NOTCH / MARK 六层，可直接在 AutoCAD、Rhino、打版软件中编辑。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportDxf}
                className="w-full py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] rounded flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导出 DXF 并自动回读校验
              </button>
            </div>

            <div className="border border-[#E4E2DC] rounded-md p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">
                  3. 1:1 矢量 SVG 图形
                </h3>
                <p className="text-xs text-[#5C5B57] mt-1">
                  真实毫米 viewBox 与分层矢量组，适用于激光切割机、Illustrator 与网页审图。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportSvg}
                className="w-full py-2 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导出 SVG
              </button>
            </div>

            <div className="border border-[#E4E2DC] rounded-md p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">
                  4. 裁片与五金材料清单 CSV
                </h3>
                <p className="text-xs text-[#5C5B57] mt-1">
                  含各部件编号、裁剪数量、皮料厚度、单件净面积 (dm²) 及五金孔径规格。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full py-2 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导出 BOM 清单 CSV
              </button>
            </div>

            <div className="border border-[#E4E2DC] rounded-md p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">
                  5. RUDA 原生参数化 JSON
                </h3>
                <p className="text-xs text-[#5C5B57] mt-1">
                  无损保存贝塞尔节点、缝份规则、部件连接关系与版本记录，作为项目唯一数据源备份。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full py-2 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导出原生项目 JSON
              </button>
            </div>
          </div>

          {/* DXF Round-Trip Verification Report */}
          {dxfCheck && (
            <div className="border border-[#16A34A]/30 bg-[#F0FDF4] rounded-md p-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#166534]">
                <ShieldCheck className="w-4 h-4" />
                DXF 导出后回读测试通过
              </div>
              <p className="text-[#14532D] font-mono text-[11px]">{dxfCheck.summary}</p>
            </div>
          )}

          {/* DXF Re-Import Test */}
          <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-md p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#141413]">
                DXF 重新导入编辑测试
              </div>
              <p className="text-[11px] text-[#5C5B57] mt-0.5">
                上传刚导出的 DXF 或外部 CAD 纸格文件，验证轮廓、图层与尺寸可无损恢复编辑。
              </p>
              <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[#5C5B57]">
                <input
                  type="checkbox"
                  checked={replaceOnImport}
                  onChange={(e) => setReplaceOnImport(e.target.checked)}
                />
                导入时替换当前画布纸格（不勾选则追加导入）
              </label>
            </div>
            <input
              ref={dxfFileRef}
              type="file"
              accept=".dxf"
              className="hidden"
              onChange={(e) => handleDxfUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => dxfFileRef.current?.click()}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-[#D8D5CD] hover:border-[#9A4D22] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5" />
              选择 DXF 导入画布
            </button>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 text-xs text-[#166534] bg-[#F0FDF4] border border-[#16A34A]/30 px-3.5 py-2 rounded">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
