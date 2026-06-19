import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Heart, 
  AlertTriangle, 
  FolderX, 
  Files, 
  HardDrive, 
  FolderOpen, 
  CheckCircle,
  Info,
  Calendar,
TrendingUp,
  Clock
} from 'lucide-react';
import { openInExplorer } from '../utils/tauriBridge';

export const ProjectAnalysis: React.FC = () => {
  const { 
    activeProject, 
    processes, 
    documents, 
    emptyFoldersList, 
    duplicateFilesList, 
    largeFilesList 
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'directory' | 'schedule'>('schedule');

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-toss-gray-455 dark:text-slate-400">선택된 프로젝트가 없습니다.</p>
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

  // 1. Directory Health Score calculations
  const presentDocsCount = documents.filter(doc => doc.size > 0).length;
  const docCompletenessRate = documents.length > 0 ? (presentDocsCount / documents.length) : 1.0;
  const docScore = Math.round(docCompletenessRate * 30);

  const totalProgressSum = processes.reduce((acc, p) => acc + p.progress, 0);
  const avgProgress = processes.length > 0 ? totalProgressSum / processes.length : 1.0;
  const processScore = Math.round(avgProgress * 40);

  const emptyFolderDeduction = Math.min(emptyFoldersList.length * 2, 5);
  const duplicateDeduction = Math.min(duplicateFilesList.length * 2, 5);
  const cleanlinessScore = Math.max(10 - emptyFolderDeduction - duplicateDeduction, 0);

  const structureScore = Math.max(
    0, 
    Math.min(20, activeProject.health_score - processScore - docScore - cleanlinessScore)
  );

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: '매우 우수', color: 'text-toss-green bg-toss-green/10 border-toss-green/30' };
    if (score >= 75) return { label: '양호함', color: 'text-toss-blue bg-toss-blue/10 border-toss-blue/30' };
    if (score >= 50) return { label: '주의 필요', color: 'text-toss-yellow bg-toss-yellow/10 border-toss-yellow/30' };
    return { label: '조치 긴급', color: 'text-toss-red bg-toss-red/10 border-toss-red/30' };
  };

  const directoryStatus = getHealthStatus(activeProject.health_score);

  // 2. Schedule Risk Analysis Calculations
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Project Level schedule info
  const projectTimeMetrics = useMemo(() => {
    if (!activeProject.start_date || !activeProject.end_date) return null;
    const start = new Date(activeProject.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(activeProject.end_date);
    end.setHours(0, 0, 0, 0);
    
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    
    const elapsedPercent = total <= 0 ? 0 : elapsed < 0 ? 0 : elapsed > total ? 100 : Math.round((elapsed / total) * 100);
    const overallProgressPercent = Math.round(avgProgress * 100);
    const gap = elapsedPercent - overallProgressPercent;
    
    return {
      elapsedPercent,
      progressPercent: overallProgressPercent,
      gap,
    };
  }, [activeProject.start_date, activeProject.end_date, avgProgress]);

  // Process level schedule info
  const processAnalysisList = useMemo(() => {
    return processes.map(proc => {
      if (!proc.start_date || !proc.end_date) {
        return {
          ...proc,
          isScheduled: false,
          elapsedPercent: 0,
          progressPercent: Math.round(proc.progress * 100),
          gap: 0,
          riskScore: 0,
          statusLabel: '일정 미설정',
          statusColor: 'text-toss-gray-400 bg-toss-gray-150/40 dark:bg-slate-800 dark:text-slate-500 border-transparent',
        };
      }
      
      const start = new Date(proc.start_date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(proc.end_date);
      end.setHours(0, 0, 0, 0);
      
      const total = end.getTime() - start.getTime();
      const elapsed = today.getTime() - start.getTime();
      
      const elapsedPercent = total <= 0 ? 0 : elapsed < 0 ? 0 : elapsed > total ? 100 : Math.round((elapsed / total) * 100);
      const progressPercent = Math.round(proc.progress * 100);
      const gap = elapsedPercent - progressPercent;
      
      // Difficulty weights
      let weight = 1.2; // 보통
      if (proc.difficulty === '낮음') weight = 1.0;
      else if (proc.difficulty === '높음') weight = 1.5;
      else if (proc.difficulty === '매우높음') weight = 2.0;
      
      const riskScore = gap <= 0 ? 0 : Math.round(gap * weight);
      
      let statusLabel = '원활';
      let statusColor = 'text-toss-green bg-toss-green/10 border-toss-green/20';
      
      if (today < start) {
        statusLabel = '대기중';
        statusColor = 'text-toss-blue bg-toss-blue/10 border-toss-blue/20';
      } else if (riskScore > 30) {
        statusLabel = '위험';
        statusColor = 'text-toss-red bg-toss-red/10 border-toss-red/20';
      } else if (riskScore > 15) {
        statusLabel = '경고';
        statusColor = 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-500/20';
      } else if (riskScore > 0) {
        statusLabel = '주의';
        statusColor = 'text-toss-yellow bg-toss-yellow/10 border-toss-yellow/20';
      }
      
      return {
        ...proc,
        isScheduled: true,
        elapsedPercent,
        progressPercent,
        gap,
        riskScore,
        statusLabel,
        statusColor,
      };
    });
  }, [processes]);

  // Overall schedule status report
  const overallScheduleReport = useMemo(() => {
    if (!projectTimeMetrics) {
      return {
        score: 0,
        label: '분석 보류',
        color: 'text-toss-gray-450 bg-toss-gray-100 dark:bg-slate-800 dark:text-slate-500 border-toss-gray-200/40',
        desc: '프로젝트 전체 일정(시작일 및 종료일) 설정이 완료되면, 종합 위험도 계산이 작동합니다.',
      };
    }
    
    const scheduledProcs = processAnalysisList.filter(p => p.isScheduled);
    const avgWeight = scheduledProcs.length > 0
      ? scheduledProcs.reduce((acc, p) => {
          let w = 1.2;
          if (p.difficulty === '낮음') w = 1.0;
          else if (p.difficulty === '높음') w = 1.5;
          else if (p.difficulty === '매우높음') w = 2.0;
          return acc + w;
        }, 0) / scheduledProcs.length
      : 1.2;
      
    const overallRiskScore = projectTimeMetrics.gap <= 0 ? 0 : Math.round(projectTimeMetrics.gap * avgWeight);
    
    let label = '원활';
    let color = 'text-toss-green bg-toss-green/10 border-toss-green/30';
    let desc = '모든 프로세스가 현재 계획 범위 내에서 원활하게 진행되고 있습니다.';
    
    if (overallRiskScore > 30) {
      label = '진행 위험';
      color = 'text-toss-red bg-toss-red/10 border-toss-red/30';
      desc = '경과된 기간 대비 진척율 지연이 심각하며, 고난이도 업무 일정 압박이 큽니다. 즉각적인 투입 공수 보강이나 일정 재조정이 권장됩니다.';
    } else if (overallRiskScore > 15) {
      label = '지연 경고';
      color = 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-500/30';
      desc = '일부 핵심 프로세스 단계에서 지연 경향이 확인되었습니다. 병목 구간 해소 및 진척도 촉진이 필요합니다.';
    } else if (overallRiskScore > 0) {
      label = '주의 요망';
      color = 'text-toss-yellow bg-toss-yellow/10 border-toss-yellow/30';
      desc = '소모된 일정 대비 진행 속도가 소폭 지연되고 있습니다. 세부 마일스톤 관리를 독려해 주십시오.';
    }
    
    return {
      score: overallRiskScore,
      label,
      color,
      desc,
    };
  }, [projectTimeMetrics, processAnalysisList]);

  const handleOpenFolder = async (path: string) => {
    try {
      await openInExplorer(path);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-6 text-left select-none animate-slide-up pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-toss-blue mb-1">{activeProject.name}</span>
          <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">종합 정밀 분석 및 진단</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-toss-gray-100 dark:bg-slate-900 p-1 rounded-2xl border border-toss-gray-200/60 dark:border-slate-800/80 w-fit shrink-0">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
              : 'text-toss-gray-450 hover:text-toss-gray-800 dark:hover:text-slate-350'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>일정 진행 위험도 분석</span>
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'directory'
              ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
              : 'text-toss-gray-455 hover:text-toss-gray-800 dark:hover:text-slate-355'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>디렉토리 정합성/청결도</span>
        </button>
      </div>

      {/* ─── Tab Content 1: Directory Cleanliness ─── */}
      {activeTab === 'directory' && (
        <>
          {/* Main Health Card & Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left: Overall Score Card */}
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-toss-gray-300 dark:text-slate-700">
                <Heart className="w-10 h-10 animate-pulse fill-rose-500/10 text-rose-500" />
              </div>
              <span className="text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">프로젝트 종합 건강도</span>
              <div className="flex items-baseline justify-center mt-2">
                <span className="text-7xl font-black text-toss-gray-800 dark:text-slate-100 tracking-tighter">{activeProject.health_score}</span>
                <span className="text-xl font-bold text-toss-gray-400 dark:text-slate-500">/ 100</span>
              </div>
              <span className={`px-4.5 py-1.5 rounded-full text-xs font-extrabold border ${directoryStatus.color}`}>
                상태: {directoryStatus.label}
              </span>
              <p className="text-xs leading-relaxed text-toss-gray-400 dark:text-slate-500 max-w-[200px] mt-2 font-semibold">
                실제 디렉토리 청결도, 파일 누락도, 진척 비율을 총합 연동 계산한 종합 스코어입니다.
              </p>
            </div>

            {/* Right: Breakdown list */}
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl lg:col-span-2 flex flex-col justify-between gap-5">
              <h3 className="text-sm font-extrabold text-toss-gray-850 dark:text-slate-350 border-b border-toss-gray-100 dark:border-slate-800/80 pb-3 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-toss-blue" />
                평가 지표 항목별 세부 배점 (100점 만점)
              </h3>
              
              <div className="flex flex-col gap-4.5">
                {/* Process progress */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-toss-gray-750 dark:text-slate-355">
                    <span>1. 프로세스 완료도 (40점)</span>
                    <span className="text-toss-blue">{processScore}점</span>
                  </div>
                  <div className="w-full h-2.5 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-toss-blue rounded-full transition-all" style={{ width: `${(processScore / 40) * 100}%` }}></div>
                  </div>
                </div>

                {/* Document Completeness */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-toss-gray-750 dark:text-slate-355">
                    <span>2. 필수 산출물 문서 준수율 (30점)</span>
                    <span className="text-emerald-500">{docScore}점</span>
                  </div>
                  <div className="w-full h-2.5 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-550 rounded-full transition-all" style={{ width: `${(docScore / 30) * 100}%` }}></div>
                  </div>
                </div>

                {/* Structure Suitability */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-toss-gray-750 dark:text-slate-355">
                    <span>3. 폴더 구조 적합도 (20점)</span>
                    <span className="text-purple-500">{structureScore}점</span>
                  </div>
                  <div className="w-full h-2.5 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(structureScore / 20) * 100}%` }}></div>
                  </div>
                </div>

                {/* Cleanliness */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-toss-gray-750 dark:text-slate-355">
                    <span>4. 디렉토리 청결도 (10점)</span>
                    <span className="text-amber-500">{cleanlinessScore}점</span>
                  </div>
                  <div className="w-full h-2.5 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(cleanlinessScore / 10) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Directory Check Issues section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* 1. Empty folders */}
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4 min-h-[300px]">
              <div className="flex items-center gap-2 border-b border-toss-gray-100 dark:border-slate-800/80 pb-3">
                <FolderX className="w-5 h-5 text-toss-red" />
                <h4 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">빈 폴더 감지 ({emptyFoldersList.length})</h4>
              </div>
              
              {emptyFoldersList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-2">
                  <CheckCircle className="w-8 h-8 text-toss-green/70" />
                  <p className="text-xs font-bold text-toss-gray-400 dark:text-slate-500">감지된 빈 폴더가 없습니다. 깨끗합니다!</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {emptyFoldersList.map((folder, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/60 flex items-center justify-between"
                    >
                      <div className="flex flex-col overflow-hidden text-left pr-2">
                        <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 truncate">{folder.name}</span>
                        <span className="text-xs text-toss-gray-450 dark:text-slate-500 truncate mt-0.5" title={folder.path}>{folder.path}</span>
                      </div>
                      <button
                        onClick={() => handleOpenFolder(folder.path)}
                        className="p-1.5 rounded-lg hover:bg-toss-gray-200 dark:hover:bg-slate-700 text-toss-gray-500 dark:text-slate-400 shrink-0 cursor-pointer"
                        title="탐색기 열기"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Duplicate Files */}
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4 min-h-[300px]">
              <div className="flex items-center gap-2 border-b border-toss-gray-100 dark:border-slate-800/80 pb-3">
                <Files className="w-5 h-5 text-purple-500" />
                <h4 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">중복 파일명 감지 ({duplicateFilesList.length})</h4>
              </div>
              
              {duplicateFilesList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-2">
                  <CheckCircle className="w-8 h-8 text-toss-green/70" />
                  <p className="text-xs font-bold text-toss-gray-400 dark:text-slate-500">감지된 중복 파일이 없습니다.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {duplicateFilesList.map((filename, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/60 flex items-center justify-between"
                    >
                      <div className="flex flex-col text-left overflow-hidden pr-2">
                        <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 truncate">{filename}</span>
                        <span className="text-xs text-toss-red font-semibold mt-0.5">※ 프로젝트 하위 여러 디렉토리에 동명 존재</span>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-toss-yellow shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Large Files */}
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4 min-h-[300px]">
              <div className="flex items-center gap-2 border-b border-toss-gray-100 dark:border-slate-800/80 pb-3">
                <HardDrive className="w-5 h-5 text-toss-yellow" />
                <h4 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">대용량 파일 리포트 ({largeFilesList.length})</h4>
              </div>
              
              {largeFilesList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-2">
                  <CheckCircle className="w-8 h-8 text-toss-green/70" />
                  <p className="text-xs font-bold text-toss-gray-400 dark:text-slate-500">100MB 초과 대용량 파일이 없습니다.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {largeFilesList.map((file, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/60 flex items-center justify-between"
                    >
                      <div className="flex flex-col text-left overflow-hidden pr-2">
                        <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 truncate">{file.name}</span>
                        <span className="text-xs text-toss-gray-450 mt-0.5">크기: <b className="text-toss-yellow">{formatBytes(file.size)}</b></span>
                      </div>
                      <button
                        onClick={() => handleOpenFolder(file.path)}
                        className="p-1.5 rounded-lg hover:bg-toss-gray-200 dark:hover:bg-slate-700 text-toss-gray-550 dark:text-slate-400 shrink-0 cursor-pointer"
                        title="탐색기에서 파일 위치 찾기"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Tab Content 2: Schedule Risk Analysis ─── */}
      {activeTab === 'schedule' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Top Overall Status Card */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-xl text-left">
              <span className="text-xs font-bold text-toss-gray-400 uppercase tracking-wider">프로젝트 전체 일정 진행 상태</span>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-extrabold text-toss-gray-800 dark:text-slate-100">
                  {projectTimeMetrics ? `진행 일정 대비 지연 GAP: ${projectTimeMetrics.gap}%` : '일정 정보 없음'}
                </h2>
                <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${overallScheduleReport.color}`}>
                  {overallScheduleReport.label}
                </span>
              </div>
              <p className="text-xs text-toss-gray-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                {overallScheduleReport.desc}
              </p>
            </div>
            
            {projectTimeMetrics && (
              <div className="flex items-center gap-6 shrink-0 bg-toss-gray-50 dark:bg-slate-850 p-4.5 rounded-2xl border border-toss-gray-200/10 dark:border-slate-800/40">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-toss-gray-400 font-bold">기간 경과</span>
                  <span className="text-xl font-extrabold text-toss-gray-800 dark:text-slate-200 mt-1">{projectTimeMetrics.elapsedPercent}%</span>
                </div>
                <div className="w-px h-8 bg-toss-gray-200 dark:bg-slate-800"></div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-toss-gray-400 font-bold">전체 진행률</span>
                  <span className="text-xl font-extrabold text-toss-blue mt-1">{projectTimeMetrics.progressPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Processes Risk Table List */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between border-b border-toss-gray-100 dark:border-slate-800/80 pb-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-toss-blue" />
                <h3 className="text-base font-extrabold text-toss-gray-800 dark:text-slate-200">단계별 일정 진행 분석 리스트</h3>
              </div>
              <span className="text-xs font-bold text-toss-gray-450 dark:text-slate-500">
                가중 위험 점수 = 지연 GAP * 난이도 가중치
              </span>
            </div>

            <div className="flex flex-col gap-3.5">
              {processAnalysisList.map((proc, idx) => (
                <div 
                  key={proc.id}
                  className="p-4 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Info & Period */}
                  <div className="flex items-start gap-3.5 min-w-[280px]">
                    <div className="w-8 h-8 rounded-xl bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-550 dark:text-slate-450 flex items-center justify-center font-extrabold shrink-0 text-xs">
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-toss-gray-850 dark:text-slate-200">{proc.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0 border ${proc.statusColor}`}>
                          {proc.statusLabel}
                        </span>
                      </div>
                      
                      {/* Dates / Difficulty display */}
                      <div className="flex items-center gap-2.5 text-xs text-toss-gray-400 dark:text-slate-500 mt-1 font-semibold">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {proc.start_date && proc.end_date 
                              ? `${proc.start_date} ~ ${proc.end_date}`
                              : '일정 미지정'}
                          </span>
                        </div>
                        <span>•</span>
                        <div>
                          <span>난이도: </span>
                          <span className="font-extrabold text-toss-gray-600 dark:text-slate-400">{proc.difficulty || '보통'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress comparing bar */}
                  {proc.isScheduled ? (
                    <div className="flex-1 flex flex-col gap-1 max-w-md">
                      <div className="flex justify-between items-center text-xs font-bold text-toss-gray-450">
                        <span>기간 소모율: {proc.elapsedPercent}%</span>
                        <span className="text-toss-blue">진행도: {proc.progressPercent}%</span>
                      </div>
                      <div className="relative w-full h-3 bg-toss-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        {/* Time elapsed bar (dashed background or secondary color) */}
                        <div 
                          className="absolute top-0 bottom-0 left-0 bg-toss-gray-300 dark:bg-slate-700 opacity-60" 
                          style={{ width: `${proc.elapsedPercent}%` }}
                        ></div>
                        {/* Progress bar (foreground blue/green) */}
                        <div 
                          className="absolute top-0 bottom-0 left-0 bg-toss-blue rounded-full transition-all" 
                          style={{ 
                            width: `${proc.progressPercent}%`,
                            backgroundColor: proc.statusLabel === '위험' ? '#F04452' : proc.statusLabel === '경고' ? '#FFB020' : '#3182F6'
                          }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-toss-gray-400 font-semibold max-w-md py-2 bg-toss-gray-100 dark:bg-slate-800 rounded-xl">
                      기간 설정을 해야 차트 비교가 지원됩니다.
                    </div>
                  )}

                  {/* Right: Risk score badge */}
                  <div className="flex items-center gap-3 shrink-0 justify-end">
                    {proc.isScheduled && (
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-toss-gray-400 font-bold uppercase">지연 GAP</span>
                        <span className={`text-xs font-extrabold ${proc.gap > 0 ? 'text-toss-red' : 'text-toss-green'}`}>
                          {proc.gap > 0 ? `+${proc.gap}%` : `${proc.gap}%`}
                        </span>
                      </div>
                    )}
                    <div className="px-3.5 py-2 rounded-xl bg-toss-gray-100 dark:bg-slate-800 text-center min-w-[70px]">
                      <span className="text-xs text-toss-gray-400 dark:text-slate-500 block font-bold">위험 지수</span>
                      <span className={`text-sm font-black block mt-0.5 ${
                        proc.riskScore > 30 
                          ? 'text-toss-red' 
                          : proc.riskScore > 15 
                            ? 'text-amber-500' 
                            : proc.riskScore > 0 
                              ? 'text-toss-yellow' 
                              : 'text-toss-green'
                      }`}>
                        {proc.riskScore}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
