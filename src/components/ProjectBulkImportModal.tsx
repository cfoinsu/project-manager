import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useProjectStore } from '../store/projectStore';
import type { BulkProjectRow, BulkProjectResult } from '../utils/db';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle,
  RefreshCw, Table2,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: (created: number) => void;
}

// ─── 엑셀 헤더(한글) → DB 필드 매핑 ──────────────────────────────
// 양식 다운로드/파싱이 동일한 정의를 공유하도록 한 곳에서 관리한다.
interface ColumnDef {
  header: string;       // 엑셀 헤더(한글)
  field: keyof BulkProjectRow;
  required?: boolean;
  example: string;
  hint?: string;
}

const COLUMNS: ColumnDef[] = [
  { header: '프로젝트명', field: 'name', required: true, example: '홍천 스마트팜 구축', hint: '필수' },
  { header: '프로젝트코드', field: 'code', example: '', hint: '비우면 자동생성' },
  { header: '지역코드', field: 'regionCode', example: 'HC', hint: '코드 자동생성용(예: HC)' },
  { header: '유형코드', field: 'typeCode', example: 'W', hint: '선택(W/M/S/D/C/R/O/E)' },
  { header: '시작일', field: 'start_date', example: '2026-07-01', hint: 'YYYY-MM-DD' },
  { header: '종료일', field: 'end_date', example: '2026-12-31', hint: 'YYYY-MM-DD' },
  { header: '폴더경로', field: 'path', example: 'C:\\Projects\\Hongcheon' },
  { header: '설명', field: 'description', example: '스마트팜 통합관제 시스템' },
  { header: '계약금액', field: 'contract_amount', example: '350,000,000' },
  { header: '중요도', field: 'importance', example: 'High', hint: 'Critical/High/Medium/Low' },
  { header: '우선순위', field: 'priority', example: 'P2', hint: 'P1/P2/P3/P4' },
  { header: '발주처명', field: 'client_name', example: '홍천군청' },
  { header: '발주처지역', field: 'client_region', example: '강원 홍천' },
  { header: '담당부서', field: 'client_department', example: '스마트도시과' },
  { header: '담당자', field: 'client_contact_name', example: '김담당' },
  { header: '연락처', field: 'client_contact_phone', example: '033-000-0000' },
  { header: '이메일', field: 'client_contact_email', example: 'contact@hc.go.kr' },
  { header: '사업목적', field: 'business_purpose', example: '농가 생산성 향상' },
  { header: '주요범위', field: 'major_scope', example: '센서·관제·앱 개발' },
  { header: '특이사항', field: 'special_notes', example: '' },
];

const HEADER_TO_FIELD: Record<string, keyof BulkProjectRow> = COLUMNS.reduce((acc, c) => {
  acc[c.header] = c.field;
  return acc;
}, {} as Record<string, keyof BulkProjectRow>);

// 엑셀 셀 값을 문자열로 정규화 (날짜 직렬값/Date 처리 포함)
function cellToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

interface ParsedRow extends BulkProjectRow {
  __rowNo: number;
  __errors: string[];
}

export const ProjectBulkImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { addProjectsBulk } = useProjectStore();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkProjectResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 양식(.xlsx) 다운로드 ──────────────────────────
  const handleDownloadTemplate = () => {
    const headers = COLUMNS.map(c => c.header);
    const hintRow = COLUMNS.map(c => (c.hint ? `(${c.hint})` : ''));
    const exampleRow = COLUMNS.map(c => c.example);
    const ws = XLSX.utils.aoa_to_sheet([headers, hintRow, exampleRow]);
    ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.header.length * 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '프로젝트');
    XLSX.writeFile(wb, '프로젝트_일괄등록_양식.xlsx');
  };

  // ── 파일 파싱 ─────────────────────────────────────
  const parseFile = async (file: File) => {
    setParsing(true);
    setParseError(null);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      if (matrix.length === 0) throw new Error('빈 파일입니다.');

      const headerRow = matrix[0].map((h: any) => cellToString(h));
      // 헤더 → 컬럼 인덱스 매핑
      const colIndex: Partial<Record<keyof BulkProjectRow, number>> = {};
      headerRow.forEach((h, idx) => {
        const field = HEADER_TO_FIELD[h];
        if (field) colIndex[field] = idx;
      });
      if (colIndex.name === undefined) {
        throw new Error("'프로젝트명' 헤더를 찾을 수 없습니다. 제공된 양식을 사용해 주세요.");
      }

      const seenCodes = new Set<string>();
      const parsed: ParsedRow[] = [];

      for (let i = 1; i < matrix.length; i++) {
        const raw = matrix[i];
        // 힌트 안내행(예: "(필수)"로 시작) 스킵
        const firstCell = cellToString(raw[colIndex.name!]);
        if (i === 1 && firstCell.startsWith('(')) continue;

        const row: ParsedRow = { name: '', __rowNo: i + 1, __errors: [] };
        (Object.keys(colIndex) as (keyof BulkProjectRow)[]).forEach(field => {
          const idx = colIndex[field]!;
          (row as any)[field] = cellToString(raw[idx]);
        });

        // 완전 빈 행 스킵
        const hasAny = COLUMNS.some(c => (row as any)[c.field]);
        if (!hasAny) continue;

        // 검증
        if (!row.name) row.__errors.push('프로젝트명 누락');
        const code = (row.code || '').trim();
        if (code) {
          if (seenCodes.has(code)) row.__errors.push('파일 내 코드 중복');
          seenCodes.add(code);
        } else if (!(row.regionCode || '').trim()) {
          row.__errors.push('코드/지역코드 모두 없음(자동생성 불가)');
        }
        parsed.push(row);
      }

      if (parsed.length === 0) throw new Error('데이터 행이 없습니다.');
      setRows(parsed);
      setFileName(file.name);
    } catch (err: any) {
      setParseError(err?.message || '파일을 읽을 수 없습니다.');
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter(r => r.__errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const payload: BulkProjectRow[] = validRows.map(({ __rowNo, __errors, ...rest }) => rest);
      const res = await addProjectsBulk(payload);
      setResult(res);
      if (res.created.length > 0) onSuccess(res.created.length);
    } catch (err: any) {
      setParseError(err?.message || '등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-[860px] max-h-[90vh] bg-white/95 dark:bg-slate-900/95 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-toss-lg overflow-hidden backdrop-blur-md flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100/50 dark:border-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-left">
              <span className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100 block">엑셀 일괄 등록</span>
              <span className="text-[11px] text-toss-gray-400 font-bold">양식을 내려받아 작성한 뒤 업로드하면 한 번에 등록됩니다.</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors cursor-pointer border-none bg-transparent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin space-y-4">
          {/* 결과 화면 */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 px-4 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-400 font-bold">
                <CheckCircle className="w-5 h-5" />
                <span>{result.created.length}건이 등록되었습니다.{result.errors.length > 0 ? ` (${result.errors.length}건 실패)` : ''}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="border border-rose-500/20 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-500/10 text-rose-600 text-xs font-black">실패 내역</div>
                  <div className="max-h-48 overflow-y-auto scrollbar-thin divide-y divide-gray-100 dark:divide-slate-800">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2 text-xs font-semibold text-toss-gray-700 dark:text-slate-300 flex gap-3">
                        <span className="text-rose-500 font-black shrink-0">{e.row}행</span>
                        <span>{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={onClose} className="toss-btn toss-btn-primary px-5 py-2.5 rounded-xl font-bold cursor-pointer">닫기</button>
              </div>
            </div>
          ) : (
            <>
              {/* 1단계: 양식 다운로드 + 업로드 */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />엑셀 양식 다운로드
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-toss-blue/30 bg-sky-500/5 hover:bg-sky-500/10 text-toss-blue font-bold text-sm transition-colors cursor-pointer"
                >
                  {parsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {fileName ? '다른 파일 선택' : '작성한 엑셀 업로드'}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; }}
                />
              </div>

              {parseError && (
                <div className="flex items-center gap-2 px-3.5 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" /><span>{parseError}</span>
                </div>
              )}

              {/* 2단계: 미리보기 */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-toss-gray-600 dark:text-slate-400">
                    <Table2 className="w-4 h-4 text-toss-blue" />
                    <span>{fileName}</span>
                    <span className="text-toss-gray-400">·</span>
                    <span className="text-emerald-600">정상 {validRows.length}건</span>
                    {invalidCount > 0 && <><span className="text-toss-gray-400">·</span><span className="text-rose-500">오류 {invalidCount}건</span></>}
                  </div>
                  <div className="border border-gray-150 dark:border-slate-800 rounded-2xl overflow-auto max-h-[42vh] scrollbar-thin">
                    <table className="w-full text-xs text-left border-collapse min-w-[640px]">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-850/80 backdrop-blur">
                        <tr className="text-toss-gray-450 dark:text-slate-500 font-bold">
                          <th className="py-2 px-3 w-10">#</th>
                          <th className="py-2 px-3">프로젝트명</th>
                          <th className="py-2 px-3">코드</th>
                          <th className="py-2 px-3">기간</th>
                          <th className="py-2 px-3">발주처</th>
                          <th className="py-2 px-3">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const bad = r.__errors.length > 0;
                          return (
                            <tr key={i} className={`border-t border-gray-100 dark:border-slate-850 font-semibold ${bad ? 'bg-rose-500/5' : ''}`}>
                              <td className="py-2 px-3 text-toss-gray-400">{r.__rowNo}</td>
                              <td className="py-2 px-3 text-toss-gray-800 dark:text-slate-200">{r.name || <span className="text-rose-400">(없음)</span>}</td>
                              <td className="py-2 px-3 text-toss-gray-600 dark:text-slate-400 font-mono">
                                {r.code || <span className="text-toss-blue/70">{(r.regionCode || '').toUpperCase() ? '자동생성' : '-'}</span>}
                              </td>
                              <td className="py-2 px-3 text-toss-gray-500 dark:text-slate-500">{[r.start_date, r.end_date].filter(Boolean).join(' ~ ') || '-'}</td>
                              <td className="py-2 px-3 text-toss-gray-600 dark:text-slate-400">{r.client_name || '-'}</td>
                              <td className="py-2 px-3">
                                {bad ? (
                                  <span className="inline-flex items-center gap-1 text-rose-500" title={r.__errors.join(', ')}>
                                    <AlertTriangle className="w-3 h-3" />{r.__errors[0]}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3 h-3" />정상</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        {!result && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100/50 dark:border-slate-800/40 shrink-0">
            <button onClick={onClose} className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">취소</button>
            <button
              onClick={handleSubmit}
              disabled={validRows.length === 0 || submitting}
              className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" />등록 중...</> : <>{validRows.length}건 등록</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
