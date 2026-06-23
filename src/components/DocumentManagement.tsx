import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  FolderOpen, 
  ExternalLink, 
  Search, 
  FileSpreadsheet, 
  Image, 
  SlidersHorizontal,
  FileCode,
  Info,
  Clock,
  Sparkles,
  Plus,
  FolderSearch
} from 'lucide-react';
import { openFile, openInExplorer } from '../utils/tauriBridge';

export const DocumentManagement: React.FC = () => {
  const { activeProject, documents, discoveredDocs, promoteDiscoveredDoc } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-toss-gray-450 dark:text-slate-400">선택된 프로젝트가 없습니다.</p>
      </div>
    );
  }

  // File size formatter
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper to determine document status
  const isDocPresent = (doc: any) => {
    return doc.size > 0;
  };

  // Filtered documents list
  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentDocs = documents.filter(isDocPresent);
  const missingDocs = documents.filter(doc => !isDocPresent(doc));
  const completionRate = documents.length > 0 
    ? Math.round((presentDocs.length / documents.length) * 100) 
    : 100;

  // Selected document for Drawer
  const activeDoc = documents.find(d => d.id === selectedDocId);

  // File type icon selector
  const getFileIcon = (ext: string) => {
    const lower = ext.toLowerCase();
    if (['xls', 'xlsx', 'csv'].includes(lower)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'psd'].includes(lower)) {
      return <Image className="w-5 h-5 text-amber-500" />;
    }
    if (['html', 'css', 'js', 'ts', 'tsx', 'py', 'rs'].includes(lower)) {
      return <FileCode className="w-5 h-5 text-purple-500" />;
    }
    return <FileText className="w-5 h-5 text-toss-blue" />;
  };

  const handleOpenFile = async (path: string) => {
    try {
      await openFile(path);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      // Find parent directory of file
      const dirPath = path.substring(0, path.lastIndexOf('\\'));
      await openInExplorer(dirPath || activeProject.path);
    } catch (e) {
      console.error(e);
    }
  };

  // 자동 발견된 파일 1건을 필수 산출물로 등록
  const handlePromote = async (file: typeof discoveredDocs[number]) => {
    setRegistering(file.path);
    try {
      await promoteDiscoveredDoc(file);
    } finally {
      setRegistering(null);
    }
  };

  // 자동 발견된 파일 전체를 한 번에 등록
  const handlePromoteAll = async () => {
    setRegistering('__all__');
    try {
      // 스냅샷을 떠서 순차 등록 (각 등록 후 목록이 갱신되므로)
      for (const file of [...discoveredDocs]) {
        await promoteDiscoveredDoc(file);
      }
    } finally {
      setRegistering(null);
    }
  };

  return (
    <div className="w-full flex-1 flex min-h-0 overflow-hidden relative text-left">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 pb-10">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-toss-blue mb-1">{activeProject.name}</span>
            <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">필수 산출물 문서 관리</h1>
          </div>
        </div>

        {/* Documents Completion Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0 select-none">
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-toss-gray-450 dark:text-slate-400 font-bold uppercase">문서 완료율</span>
              <span className="text-3xl font-extrabold text-toss-gray-800 dark:text-slate-100 mt-1">{completionRate}%</span>
            </div>
            <div className="relative w-14 h-14 flex items-center justify-center">
              {/* Circular Progress Bar */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="28" cy="28" r="22" className="stroke-toss-gray-100 dark:stroke-slate-800 fill-none" strokeWidth="4" />
                <circle cx="28" cy="28" r="22" className="stroke-toss-blue fill-none" strokeWidth="4" 
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - completionRate / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-extrabold text-toss-blue">{presentDocs.length}/{documents.length}</span>
            </div>
          </div>

          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-toss-green">
              <CheckCircle className="w-5.5 h-5.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-toss-gray-450 dark:text-slate-400 font-bold uppercase">감지된 문서</span>
              <span className="text-2xl font-extrabold text-toss-gray-800 dark:text-slate-100 mt-0.5">{presentDocs.length}개</span>
            </div>
          </div>

          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center text-toss-red">
              <XCircle className="w-5.5 h-5.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-toss-gray-450 dark:text-slate-400 font-bold uppercase">누락된 문서</span>
              <span className="text-2xl font-extrabold text-toss-gray-800 dark:text-slate-100 mt-0.5">{missingDocs.length}개</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center flex-1">
            <Search className="absolute left-3.5 w-4.5 h-4.5 text-toss-gray-400" />
            <input
              type="text"
              placeholder="문서명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-10.5 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/60 transition-all placeholder:text-toss-gray-400 font-semibold"
            />
          </div>
          <button className="p-2.5 rounded-xl border border-toss-gray-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-toss-gray-600 dark:text-slate-350 hover:bg-toss-gray-50 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* 자동 발견 문서 (폴더 스캔으로 찾은, 아직 등록 안 된 문서 후보) */}
        {discoveredDocs.length > 0 && (
          <div className="toss-card bg-gradient-to-br from-toss-blue-light/30 to-white dark:from-toss-blue/10 dark:to-slate-900 border border-toss-blue/30 dark:border-toss-blue/20 rounded-3xl p-5 shrink-0 select-none">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-toss-blue/15 flex items-center justify-center text-toss-blue">
                  <FolderSearch className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-toss-blue" />
                    폴더에서 자동 발견된 문서
                  </span>
                  <span className="text-[11px] font-semibold text-toss-gray-450 dark:text-slate-500">
                    프로젝트 폴더에 실제로 존재하지만 아직 산출물로 등록되지 않은 파일 {discoveredDocs.length}건
                  </span>
                </div>
              </div>
              <button
                onClick={handlePromoteAll}
                disabled={registering !== null}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-toss-blue hover:bg-toss-blue/90 disabled:opacity-50 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {registering === '__all__' ? '등록 중...' : '전체 등록'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {discoveredDocs.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 bg-white/70 dark:bg-slate-900/50 border border-toss-gray-150 dark:border-slate-800/70 rounded-xl px-3.5 py-2.5"
                >
                  {getFileIcon(file.type)}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-bold text-toss-gray-800 dark:text-slate-200 truncate" title={file.path}>
                      {file.name}
                    </span>
                    <span className="text-[11px] font-semibold text-toss-gray-400 dark:text-slate-500 truncate">
                      {file.folder ? `📁 ${file.folder}` : ''} · {file.type.toUpperCase()} · {formatBytes(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenFile(file.path)}
                    className="p-2 rounded-lg text-toss-gray-500 bg-toss-gray-100 hover:bg-toss-gray-200 dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                    title="파일 열기"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handlePromote(file)}
                    disabled={registering !== null}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-toss-blue bg-toss-blue-light/60 dark:bg-toss-blue/15 hover:bg-toss-blue-light dark:hover:bg-toss-blue/25 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="필수 산출물로 등록"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {registering === file.path ? '등록 중' : '필수 등록'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents Table List */}
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-[300px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-toss-gray-150 dark:border-slate-800/80 bg-toss-gray-50/50 dark:bg-slate-850/50 select-none text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">
                  <th className="py-4.5 px-6">문서명</th>
                  <th className="py-4.5 px-4">구분 / 포맷</th>
                  <th className="py-4.5 px-4">파일 크기</th>
                  <th className="py-4.5 px-4">연동 상태</th>
                  <th className="py-4.5 px-6 text-right">관리 작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-toss-gray-100 dark:divide-slate-800/50 text-sm font-semibold text-toss-gray-700 dark:text-slate-300">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-toss-gray-400 dark:text-slate-500 font-medium">
                      검색 조건에 맞는 필수 문서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => {
                    const present = isDocPresent(doc);
                    return (
                      <tr 
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`cursor-pointer hover:bg-toss-gray-50/60 dark:hover:bg-slate-850/40 transition-colors ${selectedDocId === doc.id ? 'bg-toss-blue-light/10 dark:bg-toss-blue/5 border-l-2 border-toss-blue' : ''}`}
                      >
                        {/* Name */}
                        <td className="py-4 px-6 font-bold text-toss-gray-800 dark:text-slate-200">
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.type)}
                            <span className="truncate max-w-[200px] sm:max-w-[300px]" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="py-4 px-4 font-bold text-xs uppercase text-toss-gray-500 dark:text-slate-450">
                          {doc.type} 파일
                        </td>
                        {/* Size */}
                        <td className="py-4 px-4 text-xs font-semibold text-toss-gray-550 dark:text-slate-400">
                          {present ? formatBytes(doc.size) : '-'}
                        </td>
                        {/* Status */}
                        <td className="py-4 px-4">
                          {present ? (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-toss-green bg-toss-green/10 px-2.5 py-0.5 rounded-full select-none">
                              <CheckCircle className="w-3.5 h-3.5" />
                              있음
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-toss-red bg-toss-red/10 px-2.5 py-0.5 rounded-full select-none">
                              <XCircle className="w-3.5 h-3.5" />
                              누락됨
                            </span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {present ? (
                              <>
                                <button
                                  onClick={() => handleOpenFile(doc.path)}
                                  className="p-2 rounded-xl text-toss-blue bg-toss-blue-light/50 dark:bg-toss-blue/15 hover:bg-toss-blue-light dark:hover:bg-toss-blue/25 transition-colors cursor-pointer"
                                  title="파일 열기"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenFolder(doc.path)}
                                  className="p-2 rounded-xl text-toss-gray-500 bg-toss-gray-100 hover:bg-toss-gray-200 dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                  title="폴더 열기"
                                >
                                  <FolderOpen className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenFolder(doc.path)}
                                className="px-3.5 py-1.5 text-xs font-bold text-toss-gray-550 border border-toss-gray-250 hover:bg-toss-gray-50 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                              >
                                폴더 생성 위치
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Slide-out Sidebar Drawer for Document Metadata */}
      {activeDoc && (
        <div className="w-80 shrink-0 bg-white dark:bg-slate-900 border-l border-toss-gray-200/60 dark:border-slate-800 flex flex-col h-full z-20 shadow-toss-lg select-none animate-slide-right">
          {/* Drawer Header */}
          <div className="h-16 px-6 border-b border-toss-gray-150 dark:border-slate-800/80 flex items-center justify-between shrink-0">
            <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">상세 메타데이터</span>
            <button 
              onClick={() => setSelectedDocId(null)}
              className="text-xs font-bold text-toss-gray-450 hover:text-toss-gray-700 dark:hover:text-slate-200"
            >
              닫기
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* Document Title card */}
            <div className="flex flex-col gap-2">
              <div className="w-12 h-12 rounded-2xl bg-toss-blue-light/30 dark:bg-toss-blue/20 flex items-center justify-center text-toss-blue shrink-0">
                {getFileIcon(activeDoc.type)}
              </div>
              <h2 className="text-lg font-extrabold text-toss-gray-900 dark:text-slate-100 mt-2 break-all">{activeDoc.name}</h2>
              <span className="text-xs uppercase font-bold text-toss-gray-400 bg-toss-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-max">
                {activeDoc.type} 필수문서
              </span>
            </div>

            <hr className="border-t border-toss-gray-100 dark:border-slate-800/60" />

            {/* Properties List */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs font-bold text-toss-gray-400 uppercase">동기화 상태</span>
                {isDocPresent(activeDoc) ? (
                  <span className="text-xs font-extrabold text-toss-green flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> 실제 파일 동기화 완료
                  </span>
                ) : (
                  <span className="text-xs font-extrabold text-toss-red flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> 누락됨 (드라이브에 없음)
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs font-bold text-toss-gray-400 uppercase">파일 경로</span>
                <span className="text-xs font-bold text-toss-gray-700 dark:text-slate-350 break-all select-all">
                  {activeDoc.path}
                </span>
              </div>

              {isDocPresent(activeDoc) && (
                <>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-toss-gray-400 uppercase">용량</span>
                    <span className="text-xs font-bold text-toss-gray-700 dark:text-slate-350">
                      {formatBytes(activeDoc.size)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-toss-gray-400 uppercase">마지막 동기화</span>
                    <span className="text-xs font-semibold text-toss-gray-550 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-toss-gray-400" /> {activeDoc.updated_at}
                    </span>
                  </div>
                </>
              )}
            </div>

            <hr className="border-t border-toss-gray-100 dark:border-slate-800/60" />

            {/* AI Analysis Widget */}
            <div className="toss-card bg-toss-gray-50 dark:bg-slate-850 p-4 rounded-2xl flex flex-col gap-3 text-left">
              <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-toss-blue" />
                문서 자동 검수 로그
              </span>
              <p className="text-xs leading-relaxed text-toss-gray-500 dark:text-slate-400 font-semibold">
                {isDocPresent(activeDoc) 
                  ? '파일의 구조적 형식이 검출되었습니다. 템플릿 정의 기준에 부합하여 가산점 30점 만점이 실시간 반영되었습니다.' 
                  : '프로젝트 디렉토리 내에 명시된 파일명이 감지되지 않았습니다. 파일명을 정확히 매칭하거나 폴더 경로를 생성해 주세요.'}
              </p>
            </div>

            {/* Program Integration launcher */}
            {isDocPresent(activeDoc) && (
              <div className="flex flex-col gap-2.5 mt-auto">
                <button
                  onClick={() => handleOpenFile(activeDoc.path)}
                  className="toss-btn toss-btn-primary py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  기본 프로그램으로 열기
                </button>
                <button
                  onClick={() => handleOpenFolder(activeDoc.path)}
                  className="toss-btn toss-btn-secondary py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  파일 위치 탐색기 열기
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
