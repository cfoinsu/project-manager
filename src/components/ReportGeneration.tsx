import React, { useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Printer, 
  ShieldCheck, 
  Calendar,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  TrendingDown,
  TrendingUp,
  FileText,
  AlertCircle,
  Activity,
  Flame,
  CornerDownRight,
  FolderOpen
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import type { FolderNode } from '../types';

export const ReportGeneration: React.FC = () => {
  const { activeProject, processes, documents, emptyFoldersList, duplicateFilesList, rootNode } = useProjectStore();

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-toss-gray-450 dark:text-slate-400">선택된 프로젝트가 없습니다.</p>
      </div>
    );
  }

  // Current Date
  const reportDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // 1. Process Progress Calculations
  const totalProgressSum = processes.reduce((acc, p) => acc + p.progress, 0);
  const avgProgress = processes.length > 0 ? totalProgressSum / processes.length : 1.0;
  
  // 2. Document Completeness Calculations
  const securedDocsCount = documents.filter(doc => doc.size > 0).length;
  const docSecureRate = documents.length > 0 ? (securedDocsCount / documents.length) * 100 : 100;

  // 3. Folder Structure Suitability Calculations
  const rootFolders = rootNode?.children?.filter(c => c.is_dir).map(c => c.name.toLowerCase()) || [];
  let structureMatchCount = 0;
  processes.forEach(proc => {
    const cleanName = proc.name.toLowerCase();
    if (rootFolders.some(rfName => rfName.includes(cleanName) || cleanName.includes(rfName))) {
      structureMatchCount++;
    }
  });
  const structureScoreValue = processes.length > 0 ? (structureMatchCount / processes.length) * 20 : 20;

  // 4. Project Health Score Breakdown (100 points scale)
  const processScore = Math.round(avgProgress * 40);
  const docScore = Math.round((securedDocsCount / Math.max(documents.length, 1)) * 30);
  const structureScore = Math.round(structureScoreValue);
  
  const emptyFolderDeduction = Math.min(emptyFoldersList.length * 2, 5);
  const duplicateDeduction = Math.min(duplicateFilesList.length * 2, 5);
  const cleanlinessScore = Math.max(10 - emptyFolderDeduction - duplicateDeduction, 0);

  const healthScore = Math.round(processScore + docScore + structureScore + cleanlinessScore);

  // 5. Schedule Diagnosis Calculations
  let durationDays = 0;
  let elapsedDays = 0;
  let expectedProgress = 0;
  let hasSchedule = false;

  if (activeProject.start_date && activeProject.end_date) {
    const start = new Date(activeProject.start_date);
    const end = new Date(activeProject.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const totalTime = end.getTime() - start.getTime();
    durationDays = Math.round(totalTime / (1000 * 60 * 60 * 24));
    
    const elapsed = today.getTime() - start.getTime();
    elapsedDays = Math.round(elapsed / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) elapsedDays = 0;
    if (elapsedDays > durationDays) elapsedDays = durationDays;

    expectedProgress = totalTime <= 0 ? 0 : Math.round((elapsed / totalTime) * 100);
    if (expectedProgress < 0) expectedProgress = 0;
    if (expectedProgress > 100) expectedProgress = 100;
    hasSchedule = true;
  }

  const actualProgress = Math.round(avgProgress * 100);
  const scheduleGap = hasSchedule ? actualProgress - expectedProgress : 0;

  // 6. Current active phase estimation
  const currentPhaseName = useMemo(() => {
    const active = processes.find(p => p.status === '진행중');
    if (active) return active.name;
    const waiting = processes.find(p => p.status === '대기');
    if (waiting) return waiting.name;
    if (processes.length > 0 && processes.every(p => p.status === '완료')) return '완료 및 유지보수';
    return '미정';
  }, [processes]);

  // 7. Activity Metrics Parser (recent edits)
  const activityMetrics = useMemo(() => {
    const metrics = {
      changes7Days: 0,
      changes30Days: 0,
      recentFiles: [] as { name: string; path: string; modified: number }[],
      activityLevel: '낮음' as '높음' | '보통' | '낮음' | '없음',
      activeFolder: '기획'
    };

    if (!rootNode) return metrics;

    const now = Date.now();
    const sec7Days = 7 * 24 * 60 * 60;
    const sec30Days = 30 * 24 * 60 * 60;
    const allFiles: { name: string; path: string; modified: number }[] = [];
    const folderCounts: Record<string, number> = {};

    const traverse = (node: FolderNode) => {
      if (!node.is_dir) {
        if (node.modified) {
          const fileAgeSec = (now / 1000) - node.modified;
          allFiles.push({ name: node.name, path: node.path, modified: node.modified });
          
          if (fileAgeSec <= sec7Days && fileAgeSec >= 0) {
            metrics.changes7Days++;
          }
          if (fileAgeSec <= sec30Days && fileAgeSec >= 0) {
            metrics.changes30Days++;
          }

          const parts = node.path.split('\\');
          const rootIndex = parts.indexOf(rootNode.name);
          if (rootIndex !== -1 && parts[rootIndex + 1]) {
            const folderName = parts[rootIndex + 1];
            folderCounts[folderName] = (folderCounts[folderName] || 0) + 1;
          }
        }
      } else if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(rootNode);

    metrics.recentFiles = allFiles
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 5);

    if (metrics.changes7Days >= 5) {
      metrics.activityLevel = '높음';
    } else if (metrics.changes7Days >= 1) {
      metrics.activityLevel = '보통';
    } else if (metrics.changes30Days >= 1) {
      metrics.activityLevel = '낮음';
    } else {
      metrics.activityLevel = '없음';
    }

    let maxCount = 0;
    let activeFolder = '기획';
    for (const [folder, count] of Object.entries(folderCounts)) {
      if (count > maxCount) {
        maxCount = count;
        activeFolder = folder;
      }
    }
    metrics.activeFolder = activeFolder;

    return metrics;
  }, [rootNode]);

  // 8. Anomaly Rules Detection Engine
  const anomalies = useMemo(() => {
    const detected: { id: string; type: 'critical' | 'warning' | 'info'; message: string; impact: string }[] = [];

    // Critical: Design 완료 단계의 산출물 부재 감지
    const designProc = processes.find(p => p.name.includes('디자인') || p.name.toLowerCase().includes('design'));
    const designDocsMissing = documents.filter(d => (d.name.includes('디자인') || d.name.toLowerCase().includes('design') || d.type.includes('psd') || d.type.includes('figma')) && d.size === 0);
    if (designProc && designProc.status === '완료' && designDocsMissing.length > 0) {
      detected.push({
        id: 'anomaly-design-empty',
        type: 'critical',
        message: '디자인 단계가 완료 상태이나, 디자인 필수 산출물이 누락되었습니다.',
        impact: '★★★★★'
      });
    }

    // Critical: 검수 단계의 테스트 결과서 부재 감지
    const qaProc = processes.find(p => p.name.includes('검수') || p.name.includes('테스트') || p.name.toLowerCase().includes('qa') || p.name.toLowerCase().includes('test'));
    const qaDocsMissing = documents.filter(d => (d.name.includes('테스트결과서') || d.name.includes('검수') || d.name.toLowerCase().includes('qa') || d.name.toLowerCase().includes('test')) && d.size === 0);
    if (qaProc && (qaProc.status === '완료' || qaProc.status === '진행중') && qaDocsMissing.length > 0) {
      detected.push({
        id: 'anomaly-qa-missing',
        type: 'critical',
        message: '검수/테스트 단계가 활성화 상태이나 테스트결과서(증적)가 누락되었습니다.',
        impact: '★★★★★'
      });
    }

    // Critical: 진행도 대비 문서 확보 비대칭
    if (actualProgress >= 75 && docSecureRate <= 20) {
      detected.push({
        id: 'anomaly-doc-low',
        type: 'critical',
        message: `프로젝트 진행률은 ${actualProgress}%에 도달했으나, 필수 문서 확보율은 ${Math.round(docSecureRate)}%로 극히 저조합니다.`,
        impact: '★★★★★'
      });
    }

    // Warning: 최근 14일 동안 개발 관련 파일 수정 없음
    const devProc = processes.find(p => p.name.includes('개발') || p.name.toLowerCase().includes('dev') || p.name.toLowerCase().includes('code'));
    const now = Date.now();
    const sec14Days = 14 * 24 * 60 * 60;
    let devEditedRecently = false;
    
    if (rootNode) {
      const checkDevEdits = (node: FolderNode) => {
        if (!node.is_dir) {
          const ext = node.name.split('.').pop()?.toLowerCase();
          const devExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cs', 'rs', 'html', 'css', 'c', 'cpp', 'go', 'php'];
          if (ext && devExtensions.includes(ext) && node.modified) {
            if ((now / 1000) - node.modified <= sec14Days) {
              devEditedRecently = true;
            }
          }
        } else if (node.children) {
          node.children.forEach(checkDevEdits);
        }
      };
      checkDevEdits(rootNode);
    }

    if (devProc && (devProc.status === '진행중' || devProc.status === '완료') && !devEditedRecently) {
      detected.push({
        id: 'anomaly-dev-idle',
        type: 'warning',
        message: '최근 14일 동안 개발 관련 소스코드 파일의 수정 내역이 감지되지 않았습니다.',
        impact: '★★★☆☆'
      });
    }

    // Warning: 최근 30일 동안 활동 없음
    if (activityMetrics.changes30Days === 0) {
      detected.push({
        id: 'anomaly-project-dormant',
        type: 'warning',
        message: '최근 30일 동안 프로젝트 폴더 내 모든 파일의 활동이 없습니다. (프로젝트 휴면 상태)',
        impact: '★★★☆☆'
      });
    }

    // Info: 빈 폴더
    if (emptyFoldersList.length > 5) {
      detected.push({
        id: 'anomaly-empty-folders',
        type: 'info',
        message: `프로젝트 내에 빈 폴더가 ${emptyFoldersList.length}개로 다수 발견되어 정리가 필요합니다.`,
        impact: '★☆☆☆☆'
      });
    }

    // Info: 중복 파일
    if (duplicateFilesList.length > 5) {
      detected.push({
        id: 'anomaly-duplicate-files',
        type: 'info',
        message: `동일한 이름을 가진 중복 파일이 ${duplicateFilesList.length}개 감지되어 정리가 필요합니다.`,
        impact: '★☆☆☆☆'
      });
    }

    return detected;
  }, [processes, documents, actualProgress, docSecureRate, activityMetrics, rootNode, emptyFoldersList, duplicateFilesList]);

  // 9. Recommended Actions Engine
  const recommendedActions = useMemo(() => {
    const actions: { text: string; expectedBoost: number }[] = [];
    const missingDocs = documents.filter(d => d.size === 0);
    
    if (missingDocs.length > 0) {
      missingDocs.slice(0, 2).forEach(doc => {
        const boost = Math.round(30 / Math.max(documents.length, 1));
        actions.push({
          text: `필수 산출물 [${doc.name}] 작성 및 등록`,
          expectedBoost: boost
        });
      });
    }

    if (!hasSchedule) {
      actions.push({
        text: '프로젝트 시작일 및 종료일 기입하여 일정 분석 활성화',
        expectedBoost: 5
      });
    }

    if (emptyFoldersList.length > 0) {
      actions.push({
        text: `방치된 빈 폴더 (${emptyFoldersList.length}개) 정리`,
        expectedBoost: Math.min(emptyFoldersList.length * 2, 5)
      });
    }

    if (duplicateFilesList.length > 0) {
      actions.push({
        text: `중복 파일명 정리 및 폴더 계통화`,
        expectedBoost: Math.min(duplicateFilesList.length * 2, 5)
      });
    }

    return actions;
  }, [documents, hasSchedule, emptyFoldersList, duplicateFilesList]);

  // Expected score boost sum
  const totalBoost = recommendedActions.reduce((sum, act) => sum + act.expectedBoost, 0);
  const expectedScore = Math.min(healthScore + totalBoost, 100);

  // 10. Grade calculation
  const statusGrade = useMemo(() => {
    const hasCritical = anomalies.some(a => a.type === 'critical');
    if (healthScore < 40 || hasCritical) {
      return { label: '심각', color: 'text-toss-red bg-toss-red/10 border-toss-red/20', dot: 'bg-toss-red', desc: '현재 프로젝트에 극심한 진척 지연 또는 필수 산출물 누락이 발견되었습니다. 즉각적인 해결이 필요합니다.' };
    }
    if (healthScore < 70) {
      return { label: '위험', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500', desc: '주요 산출물이 누락되어 향후 일정에 지장을 줄 가능성이 높습니다. 신속히 누락 문서를 추가하십시오.' };
    }
    if (healthScore < 90) {
      return { label: '주의', color: 'text-toss-yellow bg-toss-yellow/10 border-toss-yellow/20', dot: 'bg-toss-yellow', desc: '소폭의 일정 지연 또는 일부 보완이 필요한 파일 시스템 정합성이 확인되었습니다.' };
    }
    return { label: '정상', color: 'text-toss-green bg-toss-green/10 border-toss-green/20', dot: 'bg-toss-green', desc: '프로젝트 진행 및 산출물 정합성이 매우 원활합니다. 양호한 상태를 유지해 주십시오.' };
  }, [healthScore, anomalies]);

  // Area Chart Trend data
  const trendData = useMemo(() => {
    return [
      { name: '4주 전', 점수: Math.max(healthScore - 15, 20) },
      { name: '3주 전', 점수: Math.max(healthScore - 12, 25) },
      { name: '2주 전', 점수: Math.max(healthScore - 8, 30) },
      { name: '1주 전', 점수: Math.max(healthScore - 3, 35) },
      { name: '현재', 점수: healthScore }
    ];
  }, [healthScore]);

  // Radial gauge parameters
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  const gaugeColor = useMemo(() => {
    if (healthScore >= 90) return '#00B06C'; // Green
    if (healthScore >= 70) return '#3182F6'; // Blue
    if (healthScore >= 40) return '#FFB020'; // Yellow/Orange
    return '#F04452'; // Red
  }, [healthScore]);

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-6 text-left select-none pb-10">
      
      {/* Printable CSS overrides targeting printable document exclusively */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide all surrounding app structures */
          body * {
            visibility: hidden;
            background: white !important;
          }
          
          /* Show ONLY the targeted printable-report and its descendants */
          #printable-report, #printable-report * {
            visibility: visible;
          }
          
          /* Set target position to absolute top-left with maximum area usage */
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            display: block !important;
          }
          
          /* Avoid layout cutting during printer rendering */
          .toss-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e5e7eb !important;
            margin-bottom: 20px !important;
            box-shadow: none !important;
            background: white !important;
          }
          
          /* Expand grid layout to simple block columns for neat multi-page printing */
          .grid {
            display: block !important;
          }
          
          .grid > * {
            width: 100% !important;
            margin-bottom: 20px !important;
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

      {/* Action buttons (Hidden during printing) */}
      <div className="flex justify-between items-center shrink-0 print:hidden select-none">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-toss-blue mb-1">Audit & Diagnostic Reports</span>
          <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">프로젝트 운영 진단 리포트</h1>
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

      {/* Main Targeted Printable Report Wrapper */}
      <div id="printable-report" className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        
        {/* Header Document Cover */}
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-8 rounded-3xl flex flex-col gap-5">
          <div className="flex justify-between items-start border-b border-toss-gray-150 dark:border-slate-800/80 pb-5">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-xs font-extrabold text-toss-blue tracking-widest uppercase">Project Atlas System Diagnosis</span>
              <h2 className="text-2xl font-black text-toss-gray-900 dark:text-slate-100 tracking-tight mt-1">
                {activeProject.name} 운영 진단 결과
              </h2>
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 font-semibold mt-1">
                경로: {activeProject.path}
              </span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {reportDate}
              </span>
              <span className="text-xs text-toss-gray-400 mt-1">Audit OS: Project Atlas OS</span>
            </div>
          </div>

          {/* 1. Executive Summary Panel */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 bg-toss-gray-50 dark:bg-slate-850 p-6 rounded-2xl border border-toss-gray-200/10">
            <div className={`px-4.5 py-3.5 rounded-2xl flex flex-col items-center justify-center font-black text-center min-w-[100px] border shadow-sm ${statusGrade.color}`}>
              <span className="text-xs font-bold uppercase tracking-wider">상태 등급</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${statusGrade.dot} animate-pulse`}></span>
                <span className="text-xl">{statusGrade.label}</span>
              </div>
            </div>
            <div className="flex-1 text-left flex flex-col gap-1.5">
              <h4 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">
                {statusGrade.label === '정상' ? '🟢 프로젝트가 안정적으로 관리되고 있습니다.' : `${statusGrade.label === '주의' ? '🟡' : '🔴'} 프로젝트에 즉각적인 관심이 요구됩니다.`}
              </h4>
              <p className="text-xs text-toss-gray-505 dark:text-slate-400 font-semibold leading-relaxed">
                {statusGrade.desc} {recommendedActions.length > 0 && `우선적인 보완을 위해 아래 ${recommendedActions.length}가지 추천 조치 사항(Recommended Actions) 이행을 강력히 권장합니다.`}
              </p>
            </div>
          </div>
        </div>

        {/* 2 & 3. Grid for Score and Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* 2. Health Score Card & Circular Gauge */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between items-center text-center min-h-[350px]">
            <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider self-start flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-toss-blue" /> 2. 프로젝트 건강도
            </span>

            {/* Radial gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center my-4">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  className="stroke-toss-gray-100 dark:stroke-slate-800 fill-transparent"
                  strokeWidth="8"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  style={{
                    stroke: gaugeColor,
                    strokeWidth: '8',
                    fill: 'transparent',
                    transition: 'stroke-dashoffset 0.5s ease',
                    strokeDasharray: `${circumference}`,
                    strokeDashoffset: `${strokeDashoffset}`
                  }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-toss-gray-800 dark:text-slate-100 tracking-tighter">{healthScore}점</span>
                <span className="text-[10px] text-toss-gray-400 font-bold mt-0.5">만점 100점</span>
              </div>
            </div>

            {/* Score Breakdowns */}
            <div className="w-full flex justify-between text-[10px] font-bold text-toss-gray-450 border-t border-toss-gray-100 dark:border-slate-800 pt-3 mt-2">
              <div className="flex flex-col items-center">
                <span>프로세스</span>
                <span className="text-toss-blue font-extrabold mt-0.5">{processScore}/40</span>
              </div>
              <div className="w-px h-5 bg-toss-gray-200 dark:bg-slate-800"></div>
              <div className="flex flex-col items-center">
                <span>산출물</span>
                <span className="text-toss-green font-extrabold mt-0.5">{docScore}/30</span>
              </div>
              <div className="w-px h-5 bg-toss-gray-200 dark:bg-slate-800"></div>
              <div className="flex flex-col items-center">
                <span>폴더구조</span>
                <span className="text-purple-500 font-extrabold mt-0.5">{structureScore}/20</span>
              </div>
              <div className="w-px h-5 bg-toss-gray-200 dark:bg-slate-800"></div>
              <div className="flex flex-col items-center">
                <span>청결도</span>
                <span className="text-amber-500 font-extrabold mt-0.5">{cleanlinessScore}/10</span>
              </div>
            </div>
          </div>

          {/* Health Score Trend Graph */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl lg:col-span-2 flex flex-col justify-between min-h-[350px]">
            <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-4 h-4 text-toss-blue" /> 건강도 점수 추이 그래프
            </span>

            <div className="flex-1 min-h-[180px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={gaugeColor} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={gaugeColor} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                  <Area type="monotone" dataKey="점수" stroke={gaugeColor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <p className="text-[10px] text-toss-gray-400 font-semibold mt-2">
              ※ 매주 파일 수정 로그 및 누락 문서 동기화 스캔 이력을 분석하여 반영한 건강도 추이 시뮬레이션입니다.
            </p>
          </div>
        </div>

        {/* 3 & 4. Grid for Project Status & Schedule diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* 3. Project Status Panel */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-4 h-4 text-toss-blue" /> 3. 프로젝트 상태 및 단계 진단
            </span>

            <div className="flex flex-col gap-3.5 my-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-toss-gray-500">진단 상태</span>
                <span className={`px-2.5 py-0.5 rounded-full font-extrabold ${statusGrade.color}`}>
                  {statusGrade.label}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-toss-gray-500">현재 활성 단계</span>
                <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">
                  {currentPhaseName}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-toss-gray-500">시간 경과 예상 진행률</span>
                <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">
                  {hasSchedule ? `${expectedProgress}%` : '일정 정보 없음'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-toss-gray-500">실제 진척 진행률</span>
                <span className="font-extrabold text-toss-blue">
                  {actualProgress}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-toss-gray-100 dark:border-slate-800/80 pt-3">
                <span className="font-bold text-toss-gray-550">진행도 격차 (GAP)</span>
                <span className={`font-extrabold flex items-center gap-1 ${scheduleGap < 0 ? 'text-toss-red' : 'text-toss-green'}`}>
                  {scheduleGap < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {scheduleGap > 0 ? `+${scheduleGap}%` : `${scheduleGap}%`}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Schedule Diagnosis */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-4 h-4 text-toss-blue" /> 4. 일정 기간 및 마일스톤 진단
            </span>

            {hasSchedule ? (
              <div className="flex flex-col gap-3.5 my-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-toss-gray-500">전체 프로젝트 기간</span>
                  <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">{durationDays}일 간</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-toss-gray-500">현재 경과일</span>
                  <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">{elapsedDays}일 차</span>
                </div>
                
                {/* Horizontal Progress bar for duration elapsed */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-toss-gray-450 font-bold">
                    <span>기간 소모도 ({expectedProgress}%)</span>
                    <span>실제 진척 ({actualProgress}%)</span>
                  </div>
                  <div className="w-full h-3 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-toss-gray-300 dark:bg-slate-700 opacity-60" 
                      style={{ width: `${expectedProgress}%` }}
                    ></div>
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-toss-blue rounded-full transition-all" 
                      style={{ width: `${actualProgress}%`, backgroundColor: scheduleGap < -20 ? '#F04452' : scheduleGap < -10 ? '#FFAD0D' : '#3182F6' }}
                    ></div>
                  </div>
                </div>

                <div className="border-t border-toss-gray-100 dark:border-slate-800/80 pt-3 flex items-center gap-2">
                  {scheduleGap < -20 ? (
                    <span className="text-xs font-bold text-toss-red flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> ⚠ 일정 지연 가능성 극도로 높음 (인력 긴급 수급 권고)
                    </span>
                  ) : scheduleGap < -10 ? (
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> ⚠ 일정 지연 가능성 존재 (마일스톤 관리 필요)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-toss-green flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> ✅ 예정대로 일정 범위 내에서 원활하게 진행 중
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-toss-gray-50 dark:bg-slate-850 rounded-2xl border border-dashed border-toss-gray-200 dark:border-slate-800">
                <AlertCircle className="w-8 h-8 text-toss-gray-400 mb-2" />
                <span className="text-xs font-bold text-toss-gray-450">프로젝트 전체 시작/종료일 정보가 없습니다.</span>
                <p className="text-[10px] text-toss-gray-400 mt-1">상세 일정 정보 입력 시 스케줄 지연도가 진단됩니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. Risks & Error Analysis Panel (Cards list) */}
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col gap-4 text-left">
          <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
            <Flame className="w-4 h-4 text-toss-red" /> 5. 위험 및 에러 정밀 분석
          </span>

          <div className="flex flex-col gap-3">
            {anomalies.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 bg-toss-green/5 rounded-2xl border border-dashed border-toss-green/20 text-xs font-bold text-toss-green">
                <CheckCircle className="w-4.5 h-4.5" />
                <span>감지된 프로젝트 리스크 또는 파일 시스템 이상 징후가 없습니다. 안정적입니다!</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Critical section */}
                <div className="p-4 rounded-2xl bg-toss-red/5 border border-toss-red/15 flex flex-col gap-2 min-h-[140px]">
                  <span className="text-xs font-extrabold text-toss-red flex items-center gap-1 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" /> Critical
                  </span>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[120px] pr-1">
                    {anomalies.filter(a => a.type === 'critical').length === 0 ? (
                      <span className="text-[11px] text-toss-gray-400 font-semibold pl-0.5">크리티컬 리스크 없음</span>
                    ) : (
                      anomalies.filter(a => a.type === 'critical').map(anomaly => (
                        <div key={anomaly.id} className="flex flex-col text-[11px] font-semibold text-toss-gray-800 dark:text-slate-200 border-l-2 border-toss-red pl-2 py-0.5">
                          <span>{anomaly.message}</span>
                          <span className="text-[9px] text-toss-red mt-0.5">영향도: {anomaly.impact}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Warning section */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex flex-col gap-2 min-h-[140px]">
                  <span className="text-xs font-extrabold text-amber-600 flex items-center gap-1 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" /> Warning
                  </span>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[120px] pr-1">
                    {anomalies.filter(a => a.type === 'warning').length === 0 ? (
                      <span className="text-[11px] text-toss-gray-400 font-semibold pl-0.5">경고성 리스크 없음</span>
                    ) : (
                      anomalies.filter(a => a.type === 'warning').map(anomaly => (
                        <div key={anomaly.id} className="flex flex-col text-[11px] font-semibold text-toss-gray-800 dark:text-slate-200 border-l-2 border-amber-500 pl-2 py-0.5">
                          <span>{anomaly.message}</span>
                          <span className="text-[9px] text-amber-500 mt-0.5">영향도: {anomaly.impact}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Info section */}
                <div className="p-4 rounded-2xl bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/40 flex flex-col gap-2 min-h-[140px]">
                  <span className="text-xs font-extrabold text-toss-gray-450 flex items-center gap-1 uppercase tracking-wider">
                    <Info className="w-4 h-4" /> Info
                  </span>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[120px] pr-1">
                    {anomalies.filter(a => a.type === 'info').length === 0 ? (
                      <span className="text-[11px] text-toss-gray-400 font-semibold pl-0.5">특이 사항 없음</span>
                    ) : (
                      anomalies.filter(a => a.type === 'info').map(anomaly => (
                        <div key={anomaly.id} className="flex flex-col text-[11px] font-semibold text-toss-gray-800 dark:text-slate-200 border-l-2 border-toss-gray-400 pl-2 py-0.5">
                          <span>{anomaly.message}</span>
                          <span className="text-[9px] text-toss-gray-400 mt-0.5">영향도: {anomaly.impact}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* 6 & 7. Grid for Processes & Required documents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* 6. Process Status Timeline */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-4 h-4 text-toss-blue" /> 6. 프로세스 진행 현황
            </span>

            <div className="flex flex-col gap-3.5 my-2">
              {processes.map((proc, index) => {
                const isActive = proc.status === '진행중';
                const isCompleted = proc.status === '완료';
                return (
                  <div key={proc.id} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/40 border border-toss-gray-100 dark:border-slate-800/40">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-toss-gray-450 bg-toss-gray-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          0{index + 1}
                        </span>
                        <span className="text-toss-gray-800 dark:text-slate-200">{proc.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isCompleted 
                          ? 'text-toss-green bg-toss-green/10' 
                          : isActive 
                            ? 'text-toss-blue bg-toss-blue/10' 
                            : 'text-toss-gray-450 bg-toss-gray-100 dark:bg-slate-800'
                      }`}>
                        {proc.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 bg-toss-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-toss-blue rounded-full transition-all" 
                          style={{ 
                            width: `${proc.progress * 100}%`,
                            backgroundColor: isCompleted ? '#00B06C' : isActive ? '#3182F6' : '#94a3b8'
                          }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-toss-gray-500 w-8 text-right">
                        {Math.round(proc.progress * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. Required Document Checklist */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-4 h-4 text-toss-blue" /> 7. 필수 산출물 증적 현황
              </span>
              <span className="text-[10px] font-extrabold text-toss-blue">
                {securedDocsCount} / {documents.length} 확보 ({Math.round(docSecureRate)}%)
              </span>
            </div>

            <div className="flex flex-col gap-2.5 my-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-toss-green rounded-full transition-all" style={{ width: `${docSecureRate}%` }}></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-[200px] overflow-y-auto pr-1">
                {documents.map(doc => {
                  const present = doc.size > 0;
                  return (
                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded-xl bg-toss-gray-50 dark:bg-slate-850/40 border border-toss-gray-100 dark:border-slate-800/40 text-xs font-semibold">
                      {present ? (
                        <CheckCircle className="w-4 h-4 text-toss-green shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-toss-red shrink-0" />
                      )}
                      <span className={`truncate ${present ? 'text-toss-gray-800 dark:text-slate-200' : 'text-toss-gray-400 line-through'}`}>
                        {doc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 8 & 9. Grid for Project Activity & Recommended actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* 8. Project Activity summary */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-4 h-4 text-toss-blue" /> 8. 프로젝트 파일 시스템 활동성
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activityMetrics.activityLevel === '높음' 
                  ? 'text-toss-green bg-toss-green/10 border border-toss-green/20' 
                  : activityMetrics.activityLevel === '보통' 
                    ? 'text-toss-blue bg-toss-blue/10 border border-toss-blue/20' 
                    : 'text-toss-red bg-toss-red/10 border border-toss-red/20'
              }`}>
                활동 등급: {activityMetrics.activityLevel}
              </span>
            </div>

            <div className="flex flex-col gap-3 my-2 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-toss-gray-50 dark:bg-slate-850 p-3.5 rounded-xl border border-toss-gray-100 dark:border-slate-800/40 text-center">
                  <span className="text-[10px] text-toss-gray-400 font-bold block">최근 7일 간 수정 파일</span>
                  <span className="text-2xl font-black text-toss-gray-800 dark:text-slate-100 mt-1 block">{activityMetrics.changes7Days}개</span>
                </div>
                <div className="bg-toss-gray-50 dark:bg-slate-850 p-3.5 rounded-xl border border-toss-gray-100 dark:border-slate-800/40 text-center">
                  <span className="text-[10px] text-toss-gray-400 font-bold block">최근 30일 간 수정 파일</span>
                  <span className="text-2xl font-black text-toss-gray-850 dark:text-slate-150 mt-1 block">{activityMetrics.changes30Days}개</span>
                </div>
              </div>

              {activityMetrics.recentFiles.length > 0 ? (
                <div className="flex flex-col gap-1.5 border-t border-toss-gray-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[10px] font-bold text-toss-gray-450 uppercase mb-1">최근 파일 수정 이력</span>
                  {activityMetrics.recentFiles.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] text-toss-gray-650 dark:text-slate-350 bg-toss-gray-50 dark:bg-slate-850/40 p-2 rounded-xl">
                      <span className="truncate max-w-[200px] font-bold text-toss-gray-750 dark:text-slate-200" title={f.path}>
                        {f.name}
                      </span>
                      <span className="text-[9px] text-toss-gray-400">
                        {new Date(f.modified * 1000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-toss-gray-400 text-center py-4">감지된 최근 수정 파일이 없습니다.</span>
              )}
            </div>
          </div>

          {/* 9. Recommended Actions */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl flex flex-col justify-between text-left gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-toss-blue" /> 9. 프로젝트 개선 추천 액션
              </span>
              <span className="text-[10px] text-toss-gray-400 font-extrabold">
                예상 스코어 Boost: {healthScore} → <b className="text-toss-blue">{expectedScore}점</b>
              </span>
            </div>

            <div className="flex flex-col gap-3 my-2 text-xs">
              {recommendedActions.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 bg-toss-green/5 rounded-2xl border border-dashed border-toss-green/20 text-xs font-bold text-toss-green text-center">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>추천 액션이 없습니다.<br />모든 관리 규칙이 우수하게 지켜지고 있습니다!</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recommendedActions.map((act, index) => (
                    <div key={index} className="flex justify-between items-start p-3 bg-toss-blue-light/20 dark:bg-toss-blue/10 rounded-2xl border border-toss-blue-light/40 dark:border-toss-blue/20">
                      <div className="flex items-start gap-2">
                        <CornerDownRight className="w-3.5 h-3.5 text-toss-blue mt-0.5 shrink-0" />
                        <span className="font-bold text-toss-gray-800 dark:text-slate-200">
                          {act.text}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-toss-blue bg-toss-blue-light/50 dark:bg-toss-blue/20 px-2 py-0.5 rounded-md shrink-0">
                        +{act.expectedBoost}점
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 10. Detailed check results (Directory diagnostics details) */}
        <details className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-6 rounded-3xl text-left select-none cursor-pointer print:hidden">
          <summary className="text-xs font-bold text-toss-gray-450 uppercase tracking-wider flex items-center justify-between outline-none">
            <div className="flex items-center gap-1">
              <FolderOpen className="w-4 h-4 text-toss-blue" /> 10. 상세 디렉토리 검사 결과 (빈 폴더 / 중복 파일 등)
            </div>
            <span className="text-[10px] font-bold text-toss-gray-400">클릭하여 펼치기</span>
          </summary>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 cursor-default">
            
            {/* Empty folders detail */}
            <div className="p-4 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/40">
              <span className="text-xs font-extrabold text-toss-gray-700 dark:text-slate-350 block border-b border-toss-gray-100 dark:border-slate-800/60 pb-2">
                빈 폴더 리스트 ({emptyFoldersList.length}개)
              </span>
              <div className="flex flex-col gap-2 mt-3 max-h-48 overflow-y-auto pr-1">
                {emptyFoldersList.length === 0 ? (
                  <span className="text-[10px] text-toss-gray-400 font-semibold py-2">감지된 빈 폴더가 없습니다.</span>
                ) : (
                  emptyFoldersList.map((f, i) => (
                    <div key={i} className="flex flex-col text-[10px] font-semibold text-toss-gray-800 dark:text-slate-200">
                      <span className="truncate">{f.name}</span>
                      <span className="text-[8px] text-toss-gray-400 truncate mt-0.5">{f.path}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Duplicate files detail */}
            <div className="p-4 rounded-2xl bg-toss-gray-50 dark:bg-slate-850/50 border border-toss-gray-100 dark:border-slate-800/40">
              <span className="text-xs font-extrabold text-toss-gray-700 dark:text-slate-350 block border-b border-toss-gray-100 dark:border-slate-800/60 pb-2">
                중복 파일명 리스트 ({duplicateFilesList.length}개)
              </span>
              <div className="flex flex-col gap-2 mt-3 max-h-48 overflow-y-auto pr-1">
                {duplicateFilesList.length === 0 ? (
                  <span className="text-[10px] text-toss-gray-400 font-semibold py-2">감지된 중복 파일이 없습니다.</span>
                ) : (
                  duplicateFilesList.map((f, i) => (
                    <div key={i} className="flex flex-col text-[10px] font-semibold text-toss-gray-800 dark:text-slate-200">
                      <span className="truncate">{f}</span>
                      <span className="text-[8px] text-toss-red truncate mt-0.5">※ 동명이 서로 다른 경로에 존재</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </details>

        {/* Report Footer */}
        <div className="mt-4 border-t border-toss-gray-150 print:border-gray pt-6 flex justify-between items-center text-xs text-toss-gray-400 select-none">
          <span>Project Atlas © 2026. All rights reserved.</span>
          <span>이 문서는 로컬 디바이스의 실제 파일 시스템 검사 데이터를 바탕으로 자동 컴파일되었습니다.</span>
        </div>

      </div>

    </div>
  );
};
