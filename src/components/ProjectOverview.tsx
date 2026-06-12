import React, { useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import * as api from '../utils/api';
import type { Assignment, User } from '../types';
import { 
  Activity, 
  AlertCircle, 
  Clock, 
  Compass, 
  ArrowRight,
  Users,
  FileText
} from 'lucide-react';
import { openInExplorer } from '../utils/tauriBridge';

export const ProjectOverview: React.FC = () => {
  const { 
    activeProject, 
    processes, 
    tasks, 
    documents, 
    rootNode, 
    scanAndSync, 
    setView, 
    updateProjectInfo, 
    duplicateFilesList, 
    largeFilesList 
  } = useProjectStore();

  const { user, serverMode } = useAuthStore();

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingAssigns, setLoadingAssigns] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setDescInput(activeProject.description || '');
    }
  }, [activeProject]);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProject) return;
      setLoadingAssigns(true);
      try {
        const [allAssigns, allUsers] = await Promise.all([
          api.getAssignments(serverMode, user?.role || 'member', user?.id || ''),
          api.getUsers(serverMode)
        ]);
        const projectAssigns = allAssigns.filter(a => a.project_id === activeProject.id);
        setAssignments(projectAssigns);
        setUsers(allUsers);
      } catch (e) {
        console.error('Failed to fetch project overview data:', e);
      } finally {
        setLoadingAssigns(false);
      }
    };
    fetchData();
  }, [activeProject, serverMode, user]);

  const handleOpenFolder = async (path: string) => {
    try {
      await openInExplorer(path);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDescription = async () => {
    if (!activeProject) return;
    try {
      await updateProjectInfo(activeProject.id, { description: descInput });
      setIsEditingDesc(false);
    } catch (e) {
      console.error('Failed to update project description:', e);
    }
  };

  // 이름의 이니셜 추출 및 그라디언트 색상 결정
  const getAvatarInfo = (name: string) => {
    const cleanName = name.trim();
    const initial = cleanName ? cleanName.charAt(0) : '?';
    
    // 이름 문자열 해시를 이용한 일관된 그라디언트 매핑
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 5;
    const gradients = [
      'from-blue-500 to-indigo-600 text-white',
      'from-emerald-400 to-teal-600 text-white',
      'from-purple-500 to-pink-600 text-white',
      'from-amber-400 to-orange-600 text-white',
      'from-rose-500 to-red-600 text-white'
    ];
    return {
      initial,
      gradient: gradients[index]
    };
  };

  // D-Day 계산
  const dDayMetrics = useMemo(() => {
    if (!activeProject?.end_date) return null;
    
    const end = new Date(activeProject.end_date);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let label = '';
    let color = '';
    
    if (diffDays > 0) {
      label = `D-${diffDays}`;
      color = diffDays <= 7 ? 'text-toss-red bg-toss-red/10 border-toss-red/25' : 'text-toss-blue bg-toss-blue/10 border-toss-blue/25';
    } else if (diffDays === 0) {
      label = 'D-Day';
      color = 'text-white bg-toss-red border-toss-red ring-4 ring-toss-red/20 animate-pulse';
    } else {
      label = `종료 (D+${Math.abs(diffDays)})`;
      color = 'text-toss-gray-455 bg-toss-gray-100 border-toss-gray-200 dark:bg-slate-800 dark:border-slate-700';
    }
    
    return { days: diffDays, label, color };
  }, [activeProject?.end_date]);

  // 작업 D-Day 계산 헬퍼
  const getTaskDDay = (endDate?: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return { label: `D-${diffDays}`, color: 'text-toss-blue bg-toss-blue/5 dark:bg-blue-955/20' };
    } else if (diffDays === 0) {
      return { label: 'D-Day', color: 'text-toss-red bg-toss-red/5 dark:bg-rose-955/20 font-extrabold animate-pulse' };
    } else {
      return { label: `만료`, color: 'text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500' };
    }
  };

  // 기간 소모율 계산
  const timeElapsedPercent = useMemo(() => {
    if (!activeProject?.start_date || !activeProject?.end_date) return null;
    
    const start = new Date(activeProject.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(activeProject.end_date);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    
    if (total <= 0) return 0;
    if (elapsed < 0) return 0;
    if (elapsed > total) return 100;
    
    return Math.round((elapsed / total) * 100);
  }, [activeProject?.start_date, activeProject?.end_date]);

  // 1. Calculate Document metrics
  const documentMetrics = useMemo(() => {
    if (documents.length === 0) return { percent: 100, missing: [] };
    const missing = documents.filter(d => d.size === 0);
    const matchedCount = documents.length - missing.length;
    return {
      percent: Math.round((matchedCount / documents.length) * 100),
      missing
    };
  }, [documents]);

  // 2. Calculate Structure metrics
  const structureMetrics = useMemo(() => {
    if (processes.length === 0 || !rootNode) return { percent: 100, matched: 0 };
    const rootFolders = rootNode.children?.filter(c => c.is_dir).map(c => c.name.toLowerCase()) || [];
    let matched = 0;
    processes.forEach(proc => {
      const cleanName = proc.name.toLowerCase();
      if (rootFolders.some(rfName => rfName.includes(cleanName) || cleanName.includes(rfName))) {
        matched++;
      }
    });
    return {
      percent: Math.round((matched / processes.length) * 100),
      matched
    };
  }, [processes, rootNode]);

  // 3. Overall progress
  const totalProgress = useMemo(() => {
    if (processes.length === 0) return 0;
    const sum = processes.reduce((acc, p) => acc + p.progress, 0);
    return Math.round((sum / processes.length) * 100);
  }, [processes]);

  // 4. Flattened recent tasks (show up to 4 tasks currently in progress/review)
  const recentTasks = useMemo(() => {
    const list = Object.values(tasks).flat();
    return list
      .filter(t => t.status === '진행중' || t.status === '검토중')
      .slice(0, 4);
  }, [tasks]);

  if (!activeProject) {
    return (
      <div className="cds--flex-1 cds--column-flex items-center justify-center text-toss-gray-455 dark:text-slate-400">
        프로젝트를 로드할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="cds--overview-container animate-slide-up select-none text-left p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Overview Top bar */}
      <div className="cds--overview-header select-none mb-6">
        <div className="cds--column-flex text-left">
          <span className="text-sm font-bold text-toss-blue mb-1">Project Overview</span>
          <div className="cds--row-flex gap-3">
            {activeProject.code && (
              <span className="cds--pill-badge bg-toss-blue/10 text-toss-blue border border-toss-blue/20 font-mono tracking-widest">
                {activeProject.code}
              </span>
            )}
            <h1 className="cds--overview-header-title">{activeProject.name} 개요</h1>
            {dDayMetrics && (
              <span className={`cds--pill-badge border shadow-sm ${dDayMetrics.color}`}>
                {dDayMetrics.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={scanAndSync}
          className="cds--btn cds--btn-secondary cds--overview-sync-btn"
        >
          <Activity className="w-4.5 h-4.5 text-toss-blue animate-pulse" />
          <span>폴더 동기화 및 진단</span>
        </button>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* KPI 1: Overall Progress */}
        <div className="p-5 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[120px] shadow-sm hover:shadow-md transition-all duration-300 group">
          <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400 text-left block">전체 진행률</span>
          <div className="flex items-baseline justify-between mt-2.5 mb-2.5">
            <span className="text-2xl font-black text-toss-gray-900 dark:text-gray-100">{totalProgress}%</span>
            <span className="text-[10px] font-extrabold text-toss-blue">완료 목표</span>
          </div>
          <div className="w-full h-2 rounded-full bg-toss-gray-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-toss-blue rounded-full transition-all duration-500" style={{ width: `${totalProgress}%` }}></div>
          </div>
        </div>

        {/* KPI 2: Project Health Score */}
        <div className="p-5 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[120px] shadow-sm hover:shadow-md transition-all duration-300 group">
          <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400 text-left block">건강도 지수</span>
          <div className="flex items-baseline justify-between mt-2.5 mb-2.5">
            <span className="text-2xl font-black text-toss-gray-900 dark:text-gray-100">{activeProject.health_score}점</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
              activeProject.health_score >= 90 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-400' :
              activeProject.health_score >= 70 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-400' :
              'bg-rose-50 text-toss-red dark:bg-rose-955/35 dark:text-toss-red'
            }`}>
              {activeProject.health_score >= 90 ? '안전' : activeProject.health_score >= 70 ? '주의' : '위험'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-toss-gray-100 dark:bg-slate-800 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${activeProject.health_score}%`,
                backgroundColor: activeProject.health_score >= 90 ? '#00B06C' : activeProject.health_score >= 70 ? '#FFAD0D' : '#F04452'
              }}
            ></div>
          </div>
        </div>

        {/* KPI 3: Time Elapsed */}
        <div className="p-5 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[120px] shadow-sm hover:shadow-md transition-all duration-300 group">
          <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400 text-left block">일정 소모율</span>
          <div className="flex items-baseline justify-between mt-2.5 mb-2.5">
            <span className="text-2xl font-black text-toss-gray-900 dark:text-gray-100">
              {timeElapsedPercent !== null ? `${timeElapsedPercent}%` : '미지정'}
            </span>
            {dDayMetrics && (
              <span className="text-[10px] font-black text-toss-red">
                {dDayMetrics.label}
              </span>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-toss-gray-100 dark:bg-slate-800 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${timeElapsedPercent || 0}%`,
                backgroundColor: timeElapsedPercent !== null && timeElapsedPercent > 90 ? '#F04452' : '#3182F6'
              }}
            ></div>
          </div>
        </div>

        {/* KPI 4: Document Status */}
        <div className="p-5 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[120px] shadow-sm hover:shadow-md transition-all duration-300 group">
          <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400 text-left block">필수 문서 완료율</span>
          <div className="flex items-baseline justify-between mt-2.5 mb-2.5">
            <span className="text-2xl font-black text-toss-gray-900 dark:text-gray-100">{documentMetrics.percent}%</span>
            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">검증 완료</span>
          </div>
          <div className="w-full h-2 rounded-full bg-toss-gray-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${documentMetrics.percent}%` }}></div>
          </div>
        </div>

        {/* KPI 5: Structure Suitability */}
        <div className="p-5 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[120px] shadow-sm hover:shadow-md transition-all duration-300 group">
          <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400 text-left block">구조 적합도</span>
          <div className="flex items-baseline justify-between mt-2.5 mb-2.5">
            <span className="text-2xl font-black text-toss-gray-900 dark:text-gray-100">{structureMetrics.percent}%</span>
            <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400">규칙 매칭</span>
          </div>
          <div className="w-full h-2 rounded-full bg-toss-gray-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${structureMetrics.percent}%` }}></div>
          </div>
        </div>
      </div>

      {/* 3-Column Section: Project Description & Details Summary & Resource Status Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Project Description */}
        <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[240px] shadow-sm hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-3">
              <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200">프로젝트 설명</span>
              {!isEditingDesc && (
                <button 
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer"
                >
                  설명 수정
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="프로젝트의 개요, 목표, 특이사항 등을 상세히 기술해 주세요."
                  className="w-full h-24 p-3 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-850/50 text-toss-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-toss-blue resize-none scrollbar-thin text-left"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setIsEditingDesc(false);
                      setDescInput(activeProject.description || '');
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-toss-gray-600 dark:bg-slate-800 dark:text-slate-400 border-none cursor-pointer"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSaveDescription}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-toss-blue hover:bg-toss-blue-hover text-white border-none cursor-pointer"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-toss-gray-600 dark:text-slate-355 leading-relaxed whitespace-pre-wrap text-left min-h-[140px] flex items-start justify-start pt-1 overflow-y-auto max-h-[160px] scrollbar-thin">
                {activeProject.description || '등록된 프로젝트 설명이 없습니다. 우측 상단의 "설명 수정"을 통해 세부 설명을 기록해 주세요.'}
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Project Details Card */}
        <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[240px] shadow-sm hover:shadow-md transition-all duration-300">
          <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200 border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-3 text-left block">프로젝트 요약 정보</span>
          <div className="flex flex-col gap-2.5 text-xs font-bold text-toss-gray-700 dark:text-slate-300">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-toss-gray-400 dark:text-slate-500">프로젝트명</span>
              <span className="truncate max-w-[150px]" title={activeProject.name}>{activeProject.name}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-toss-gray-400 dark:text-slate-500">시작일</span>
              <span>{activeProject.start_date || '미지정'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-toss-gray-400 dark:text-slate-500">종료일</span>
              <span>{activeProject.end_date || '미지정'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-toss-gray-400 dark:text-slate-500">상태</span>
              <span className="text-toss-blue font-bold">{activeProject.status}</span>
            </div>
            <div className="flex flex-col gap-1 pt-1.5 border-t border-gray-100 dark:border-slate-800/50">
              <span className="text-toss-gray-400 dark:text-slate-500 text-left text-[10px]">로컬 경로</span>
              <span className="font-mono bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-xl text-[10px] text-toss-gray-650 dark:text-slate-400 break-all select-all text-left">
                {activeProject.path}
              </span>
            </div>
            <button
              onClick={() => handleOpenFolder(activeProject.path)}
              className="w-full py-2.5 mt-1 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 hover:bg-slate-100/60 dark:bg-slate-900/30 dark:hover:bg-slate-800/40 text-toss-gray-700 dark:text-slate-300 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-toss-blue" />
              <span>탐색기 폴더 열기</span>
            </button>
          </div>
        </div>

        {/* Card 3: Project Assigned Personnel (투입 인력 현황판) */}
        <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 flex flex-col justify-between min-h-[240px] shadow-sm hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-toss-blue" />
                <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200">투입 인력 현황</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-toss-blue/10 text-toss-blue border border-toss-blue/15">
                {assignments.length}명
              </span>
            </div>

            {loadingAssigns ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-xs text-toss-gray-400">
                <Activity className="w-5 h-5 text-toss-blue animate-spin" />
                <span>데이터 불러오는 중...</span>
              </div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
                <Users className="w-8 h-8 text-toss-gray-350 dark:text-slate-700" />
                <p className="text-xs text-toss-gray-400 font-bold">배정된 투입 인력이 없습니다.</p>
                <p className="text-[10px] text-toss-gray-455 dark:text-slate-500">배정 관리에서 리소스를 등록해 주세요.</p>
              </div>
            ) : (
              <div className="flex flex-col max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
                {assignments.map(assign => {
                  const userDetail = users.find(u => u.id === assign.user_id);
                  const avatar = getAvatarInfo(assign.user_name || 'U');
                  
                  // 투입률에 따른 색상 정의
                  let pctColor = 'text-toss-gray-500 bg-toss-gray-100 dark:bg-slate-800 dark:text-slate-400';
                  if (assign.allocation_percent >= 100) {
                    pctColor = 'text-rose-600 bg-rose-50 dark:bg-rose-955/35 dark:text-rose-455';
                  } else if (assign.allocation_percent >= 80) {
                    pctColor = 'text-toss-blue bg-toss-blue/10 dark:bg-blue-955/35 dark:text-blue-400';
                  } else if (assign.allocation_percent >= 50) {
                    pctColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-955/35 dark:text-emerald-400';
                  }

                  return (
                    <div 
                      key={assign.id} 
                      className="flex items-center justify-between py-2.5 border-b border-gray-100/50 dark:border-slate-800/30 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-855/10 px-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Circle Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 bg-gradient-to-br ${avatar.gradient}`}>
                          {avatar.initial}
                        </div>
                        {/* Name and Position */}
                        <div className="flex flex-col text-left min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-black text-toss-gray-800 dark:text-gray-250 truncate">
                              {assign.user_name}
                            </span>
                            {userDetail?.position && (
                              <span className="text-[9px] text-toss-gray-400 dark:text-slate-500 font-bold">
                                {userDetail.position}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-toss-gray-455 dark:text-slate-400 truncate">
                            {assign.role || '담당자'}
                          </span>
                        </div>
                      </div>

                      {/* Allocation Rate Badge */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${pctColor}`}>
                          {assign.allocation_percent}%
                        </span>
                        {userDetail?.department && (
                          <span className="text-[8.5px] text-toss-gray-400 dark:text-slate-500 font-medium mt-0.5">
                            {userDetail.department}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Process Roadmap & Task Lists (Middle Section) */}
      <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-toss-blue"></span>
            <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200">프로세스 단계 로드맵 및 작업 현황</span>
          </div>
          <button 
            onClick={() => setView('projects_process')}
            className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
          >
            단계 편집 <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        {processes.length === 0 ? (
          <div className="py-12 text-center text-toss-gray-400 dark:text-slate-500 text-sm font-bold">
            정의된 프로세스가 없습니다. 상단 '단계 편집'에서 프로세스를 추가해 주세요.
          </div>
        ) : (
          <div className="flex overflow-x-auto pb-2 gap-4 scrollbar-thin">
            {processes.map((proc, index) => {
              const procTasks = tasks[proc.id] || [];
              const isActive = proc.status === '진행중';
              const isCompleted = proc.status === '완료';

              let cardBorder = 'border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-900/20';
              if (isActive) {
                cardBorder = 'border-toss-blue/30 ring-1 ring-toss-blue/15 bg-blue-50/5 dark:bg-blue-955/10';
              } else if (isCompleted) {
                cardBorder = 'border-emerald-400/20 bg-emerald-50/5 dark:bg-emerald-955/10';
              }

              return (
                <div 
                  key={proc.id}
                  className={`w-64 shrink-0 rounded-2xl border p-4 flex flex-col gap-3.5 min-h-[250px] transition-all hover:shadow-sm ${cardBorder}`}
                >
                  {/* Process Header */}
                  <div className="flex items-start justify-between gap-2 text-left">
                    <div className="flex flex-col gap-0.5 text-left overflow-hidden w-full">
                      <span className="text-[9px] text-toss-gray-400 dark:text-slate-500 uppercase tracking-widest font-black text-left block">
                        STEP 0{index + 1}
                      </span>
                      <span className="text-xs font-black text-toss-gray-800 dark:text-gray-255 truncate text-left block" title={proc.name}>
                        {proc.name}
                      </span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isCompleted ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-955/40 dark:text-emerald-450' :
                      isActive ? 'bg-blue-50 text-toss-blue dark:bg-blue-955/40 dark:text-blue-400' :
                      'bg-gray-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {Math.round(proc.progress * 100)}%
                    </span>
                  </div>

                  {/* Task Kanban items under this process */}
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-48 scrollbar-none pr-0.5">
                    {procTasks.length === 0 ? (
                      <span className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold text-center py-8 block">
                        등록된 작업 없음
                      </span>
                    ) : (
                      procTasks.map(task => {
                        const dday = getTaskDDay(task.end_date);
                        let statusColor = 'bg-slate-100 text-slate-500';
                        if (task.status === '진행중') statusColor = 'bg-blue-50 text-toss-blue dark:bg-blue-955/40 dark:text-blue-400';
                        else if (task.status === '검토중') statusColor = 'bg-amber-50 text-amber-600 dark:bg-amber-955/40 dark:text-amber-400';
                        else if (task.status === '완료') statusColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-955/40 dark:text-emerald-450';

                        return (
                          <div 
                            key={task.id}
                            onClick={() => setView('projects_tasks')}
                            className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.015)] border border-slate-100/80 dark:border-slate-800/30 hover:border-toss-blue/20 dark:hover:border-toss-blue/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col gap-1.5 cursor-pointer text-left group"
                          >
                            <span className="text-xs font-black text-toss-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-toss-blue transition-colors text-left">
                              {task.title}
                            </span>
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-black ${statusColor}`}>
                                {task.status}
                              </span>
                              {dday && (
                                <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-black ${dday.color}`}>
                                  {dday.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2-Column Bottom Section: Ongoing Tasks & Compact Documents Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ongoing Tasks (Left Column) */}
        <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-3.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-toss-blue" />
              <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200">진행중인 작업 ({recentTasks.length})</span>
            </div>
            <button onClick={() => setView('projects_tasks')} className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5">
              작업 더보기 <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>

          <div className="flex flex-col max-h-64 overflow-y-auto pr-0.5 scrollbar-thin">
            {recentTasks.length === 0 ? (
              <p className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold py-16 text-center">진행 중인 작업이 없습니다.</p>
            ) : (
              <div className="flex flex-col">
                {recentTasks.map(task => {
                  let priorityColor = 'text-toss-gray-500 bg-toss-gray-100 dark:bg-slate-855/30 dark:text-slate-400';
                  if (task.priority === '긴급') priorityColor = 'text-toss-red bg-toss-red/10 dark:bg-rose-955/30 dark:text-toss-red';
                  else if (task.priority === '높음') priorityColor = 'text-toss-yellow bg-toss-yellow/10 dark:bg-amber-955/30 dark:text-toss-yellow';
                  
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between py-3 border-b border-gray-100/50 dark:border-slate-800/30 last:border-b-0 hover:bg-slate-50/30 dark:hover:bg-slate-850/10 px-2 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden w-full">
                        <Clock className="w-4.5 h-4.5 text-toss-blue shrink-0" />
                        <div className="flex flex-col overflow-hidden text-left w-full">
                          <span className="text-xs font-extrabold text-toss-gray-800 dark:text-gray-255 truncate">{task.title}</span>
                          <span className="text-[9.5px] text-toss-gray-450 dark:text-slate-500 truncate mt-0.5">{task.description || '설명 없음'}</span>
                        </div>
                      </div>
                      <span className={`text-[9.5px] px-2 py-0.5 rounded font-black shrink-0 ${priorityColor}`}>{task.priority}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact Documents & Analysis (Right Column) */}
        <div className="p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[280px]">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-3.5">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-toss-blue" />
                <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200">산출물 및 폴더 구조 진단</span>
              </div>
              <button onClick={() => setView('projects_documents')} className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5">
                산출물 관리 <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex flex-col">
              {/* Document Check Overview */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100/50 dark:border-slate-800/30 text-xs font-bold">
                <span className="text-toss-gray-500 dark:text-slate-400">누락된 필수 문서 파일</span>
                <span className={`px-2 py-0.5 rounded-full font-black ${
                  documentMetrics.missing.length === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-toss-red dark:bg-rose-955/40'
                }`}>
                  {documentMetrics.missing.length}건
                </span>
              </div>

              {/* Duplicate & Large Files Check */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100/50 dark:border-slate-800/30 text-xs font-bold">
                <span className="text-toss-gray-500 dark:text-slate-400">중복 파일 및 대용량 파일 감지</span>
                <span className="text-toss-gray-750 dark:text-slate-300">
                  중복 {duplicateFilesList.length}건 / 대용량 {largeFilesList.length}건
                </span>
              </div>

              {/* Diagnostic Quick Link */}
              <div className="mt-4 flex items-start gap-3 p-3.5 rounded-2xl bg-purple-50/40 dark:bg-purple-950/15 border border-purple-100/40 dark:border-purple-900/10">
                <AlertCircle className="w-4.5 h-4.5 text-purple-500 shrink-0 mt-0.5" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black text-purple-700 dark:text-purple-300">구조 규칙 자동 진단 완료</span>
                  <span className="text-[10px] text-toss-gray-455 dark:text-slate-400 mt-1 leading-normal">
                    물리 폴더 트리 구조가 정의된 프로세스 단계와 {structureMetrics.percent}% 일치합니다.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setView('projects_analysis')}
            className="w-full py-2.5 mt-4 rounded-xl flex items-center justify-center gap-1 font-bold text-xs cursor-pointer border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 hover:bg-purple-100/60 text-purple-750 dark:bg-purple-950/20 dark:text-purple-400 transition-colors"
          >
            <span>상세 규칙 진단 및 파일 분석 리포트 보기</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
