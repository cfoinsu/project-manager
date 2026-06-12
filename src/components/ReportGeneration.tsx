import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Printer, 
  ShieldCheck, 
  Calendar,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const ReportGeneration: React.FC = () => {
  const { activeProject, processes, documents, emptyFoldersList, duplicateFilesList } = useProjectStore();

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-toss-gray-450 dark:text-slate-400">선택된 프로젝트가 없습니다.</p>
      </div>
    );
  }

  // Format date
  const reportDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-6 text-left select-none pb-10">
      
      {/* Action buttons (Hidden during printing) */}
      <div className="flex justify-between items-center shrink-0 print:hidden select-none">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-toss-blue mb-1">인쇄 및 보고서</span>
          <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">프로젝트 요약 리포트</h1>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handlePrint}
            className="toss-btn toss-btn-primary px-5 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-md cursor-pointer hover:shadow-lg transition-all active:scale-95"
          >
            <Printer className="w-4.5 h-4.5" />
            <span>보고서 인쇄 (PDF 저장)</span>
          </button>
        </div>
      </div>

      {/* Styled Printable Container */}
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-8 sm:p-12 rounded-3xl shadow-sm flex flex-col gap-8 max-w-4xl mx-auto w-full print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        
        {/* Printable CSS overrides */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .toss-card {
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              padding: 0 !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:text-black {
              color: black !important;
            }
            .print\\:border-gray {
              border-color: #e5e7eb !important;
            }
          }
        `}} />

        {/* Report Document Title */}
        <div className="flex flex-col gap-2 border-b border-toss-gray-200 print:border-gray pb-6 text-left">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-toss-blue print:text-black tracking-widest uppercase">Project Atlas Audit Report</span>
              <h2 className="text-3xl font-black text-toss-gray-900 dark:text-slate-100 tracking-tight">프로젝트 운영 건강도 리포트</h2>
            </div>
            <div className="flex flex-col items-end text-right select-none">
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {reportDate}
              </span>
              <span className="text-xs text-toss-gray-400 dark:text-slate-500 mt-1">발행처: Project Atlas OS</span>
            </div>
          </div>
        </div>

        {/* Meta Grid info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-extrabold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">프로젝트 개요</h4>
            <div className="flex flex-col gap-2.5 text-xs text-toss-gray-700 dark:text-slate-350">
              <div className="flex">
                <span className="w-24 font-bold text-toss-gray-450 dark:text-slate-500 shrink-0">프로젝트명:</span>
                <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">{activeProject.name}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-toss-gray-450 dark:text-slate-500 shrink-0">경로:</span>
                <span className="font-semibold break-all text-toss-gray-750 dark:text-slate-300">{activeProject.path}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-toss-gray-450 dark:text-slate-500 shrink-0">생성 일자:</span>
                <span className="font-semibold">{activeProject.created_at}</span>
              </div>
            </div>
          </div>

          {/* Health Score Summary Card */}
          <div className="bg-toss-gray-50 dark:bg-slate-850 p-5 rounded-2xl flex items-center justify-between print:border print:border-gray">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-toss-gray-400 uppercase">종합 건강도 점수</span>
              <span className="text-4xl font-black text-toss-gray-800 dark:text-slate-100 tracking-tight mt-1">{activeProject.health_score}점</span>
              <span className="text-xs text-toss-gray-505 dark:text-slate-400 font-semibold mt-1">※ 4대 지표 통합 분석 결과</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-toss-blue-light/50 dark:bg-toss-blue/20 flex items-center justify-center text-toss-blue print:text-black">
              <ShieldCheck className="w-6.5 h-6.5" />
            </div>
          </div>
        </div>

        {/* Process timelines */}
        <div className="flex flex-col gap-4 text-left">
          <h4 className="text-xs font-extrabold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">1. 하위 프로세스 진행 현황</h4>
          <div className="flex flex-col gap-3">
            {processes.map((proc, index) => {
              const isCompleted = proc.status === '완료';
              const isActive = proc.status === '진행중';
              return (
                <div 
                  key={proc.id}
                  className="p-4 rounded-xl border border-toss-gray-150 dark:border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-toss-gray-100 dark:bg-slate-800 flex items-center justify-center font-bold text-toss-gray-600 dark:text-slate-400">
                      {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-toss-gray-800 dark:text-slate-200">{proc.name}</span>
                      <span className="text-xs text-toss-gray-450 dark:text-slate-505 truncate max-w-xs">{proc.description || '설명 없음'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-toss-gray-455 dark:text-slate-500 font-semibold">진행률:</span>
                      <span className="font-extrabold text-toss-blue">{Math.round(proc.progress * 100)}%</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-xs ${
                      isCompleted 
                        ? 'text-toss-green bg-toss-green/10' 
                        : isActive 
                          ? 'text-toss-blue bg-toss-blue/10' 
                          : 'text-toss-gray-400 bg-toss-gray-100 dark:bg-slate-800'
                    }`}>
                      {proc.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Document completeness check */}
        <div className="flex flex-col gap-4 text-left">
          <h4 className="text-xs font-extrabold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">2. 필수 산출물 증적 확인</h4>
          
          <div className="border border-toss-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-toss-gray-50/50 dark:bg-slate-850/50 border-b border-toss-gray-150 dark:border-slate-800/80 font-bold text-toss-gray-455 dark:text-slate-500 uppercase">
                  <th className="py-3 px-4">필수 산출물명</th>
                  <th className="py-3 px-4">포맷</th>
                  <th className="py-3 px-4">용량</th>
                  <th className="py-3 px-4 text-right">증적 여부</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-toss-gray-100 dark:divide-slate-800/60 font-semibold text-toss-gray-700 dark:text-slate-300">
                {documents.map((doc) => {
                  const present = doc.size > 0;
                  return (
                    <tr key={doc.id}>
                      <td className="py-3 px-4 font-bold text-toss-gray-800 dark:text-slate-200">{doc.name}</td>
                      <td className="py-3 px-4 uppercase text-toss-gray-450 text-xs">{doc.type}</td>
                      <td className="py-3 px-4">{present ? `${parseFloat((doc.size / 1024).toFixed(1))} KB` : '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {present ? (
                          <span className="text-toss-green font-extrabold">감지됨 (OK)</span>
                        ) : (
                          <span className="text-toss-red font-extrabold">누락 (Action Required)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit checklist warnings */}
        <div className="flex flex-col gap-4 text-left">
          <h4 className="text-xs font-extrabold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">3. 디렉토리 구조 검제 진단</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Empty Folders summary */}
            <div className="p-4.5 rounded-2xl bg-toss-gray-50 dark:bg-slate-850 flex flex-col gap-2 border border-toss-gray-150 dark:border-slate-800/40">
              <span className="text-xs font-bold text-toss-gray-400 uppercase">빈 디렉토리 감지</span>
              {emptyFoldersList.length === 0 ? (
                <span className="text-xs font-extrabold text-toss-green flex items-center gap-1.5 mt-1">
                  <CheckCircle className="w-4 h-4" /> 감지된 빈 디렉토리 없음 (안정)
                </span>
              ) : (
                <span className="text-xs font-extrabold text-toss-red flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-4 h-4 text-toss-yellow" /> 빈 폴더 {emptyFoldersList.length}개 발견 (감점 요인)
                </span>
              )}
            </div>

            {/* Duplicate Files summary */}
            <div className="p-4.5 rounded-2xl bg-toss-gray-50 dark:bg-slate-850 flex flex-col gap-2 border border-toss-gray-150 dark:border-slate-800/40">
              <span className="text-xs font-bold text-toss-gray-400 uppercase">중복 파일명 존재 여부</span>
              {duplicateFilesList.length === 0 ? (
                <span className="text-xs font-extrabold text-toss-green flex items-center gap-1.5 mt-1">
                  <CheckCircle className="w-4 h-4" /> 중복 파일명 미검출 (안정)
                </span>
              ) : (
                <span className="text-xs font-extrabold text-toss-red flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-4 h-4 text-toss-yellow" /> 중복 파일명 {duplicateFilesList.length}개 발견 (관리 필요)
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Report Footer */}
        <div className="mt-8 border-t border-toss-gray-150 print:border-gray pt-6 flex justify-between items-center text-xs text-toss-gray-400 select-none">
          <span>Project Atlas © 2026. All rights reserved.</span>
          <span>이 문서는 로컬 디바이스의 실제 파일 시스템 검사 데이터를 바탕으로 자동 컴파일되었습니다.</span>
        </div>

      </div>

    </div>
  );
};
