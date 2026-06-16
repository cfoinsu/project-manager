import React, { useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import * as api from '../utils/api';
import type { Assignment, User, Workload } from '../types';
import { 
  Activity, 
  Clock, 
  ArrowRight,
  Users,
  FileText,
  Database,
  Edit,
  X
} from 'lucide-react';
import { openInExplorer } from '../utils/tauriBridge';
import { RangeDatePicker } from './RangeDatePicker';
import { getRegionCodes } from '../types';
import { RegionPickerModal } from './RegionPickerModal';
import { Avatar } from './Avatar';
import { ModalOverlay } from './ModalOverlay';

export const ProjectOverview: React.FC = () => {
  const REGION_CODES = getRegionCodes();
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

  const [isEditingDates, setIsEditingDates] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // Edit modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [editContractAmount, setEditContractAmount] = useState('');
  const [editImportance, setEditImportance] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientRegion, setEditClientRegion] = useState('');
  const [editClientDepartment, setEditClientDepartment] = useState('');
  const [editClientContactName, setEditClientContactName] = useState('');
  const [editClientContactPhone, setEditClientContactPhone] = useState('');
  const [editClientContactEmail, setEditClientContactEmail] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBusinessPurpose, setEditBusinessPurpose] = useState('');
  const [editMajorScope, setEditMajorScope] = useState('');
  const [editSpecialNotes, setEditSpecialNotes] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loadingAssigns, setLoadingAssigns] = useState(false);
  const [workloadTab, setWorkloadTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    if (activeProject) {
      setStartDateInput(activeProject.start_date || '');
      setEndDateInput(activeProject.end_date || '');
    }
  }, [activeProject]);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProject) return;
      setLoadingAssigns(true);
      try {
        const [allAssigns, allUsers, wlData] = await Promise.all([
          api.getAssignments(serverMode, user?.role || 'member', user?.id || ''),
          api.getUsers(serverMode),
          api.getWorkloads(serverMode, { project_id: activeProject.id })
        ]);
        const projectAssigns = allAssigns.filter(a => a.project_id === activeProject.id);
        setAssignments(projectAssigns);
        setUsers(allUsers);
        setWorkloads(wlData);
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

  const handleOpenEditModal = () => {
    if (!activeProject) return;
    setEditContractAmount(activeProject.contract_amount || '');
    setEditImportance(activeProject.importance || 'Medium');
    setEditPriority(activeProject.priority || 'P3');
    setEditClientName(activeProject.client_name || '');
    setEditClientRegion(activeProject.client_region || '');
    setEditClientDepartment(activeProject.client_department || '');
    setEditClientContactName(activeProject.client_contact_name || '');
    setEditClientContactPhone(activeProject.client_contact_phone || '');
    setEditClientContactEmail(activeProject.client_contact_email || '');
    setEditDescription(activeProject.description || '');
    setEditBusinessPurpose(activeProject.business_purpose || '');
    setEditMajorScope(activeProject.major_scope || '');
    setEditSpecialNotes(activeProject.special_notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveAllInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await updateProjectInfo(activeProject.id, {
        contract_amount: editContractAmount,
        importance: editImportance,
        priority: editPriority,
        client_name: editClientName,
        client_region: editClientRegion,
        client_department: editClientDepartment,
        client_contact_name: editClientContactName,
        client_contact_phone: editClientContactPhone,
        client_contact_email: editClientContactEmail,
        description: editDescription,
        business_purpose: editBusinessPurpose,
        major_scope: editMajorScope,
        special_notes: editSpecialNotes,
      });
      setIsEditModalOpen(false);
    } catch (e) {
      console.error('Failed to save project details:', e);
      alert('프로젝트 개요 정보 수정에 실패했습니다.');
    }
  };

  const handleSaveDates = async () => {
    if (!activeProject) return;
    try {
      await updateProjectInfo(activeProject.id, { 
        start_date: startDateInput, 
        end_date: endDateInput 
      });
      setIsEditingDates(false);
    } catch (e) {
      console.error('Failed to update project dates:', e);
    }
  };

  const formatCurrency = (val?: string) => {
    if (!val) return '등록 안 됨';
    const cleanNum = val.replace(/[^0-9]/g, '');
    if (!cleanNum) return val;
    const num = parseInt(cleanNum, 10);
    return `${num.toLocaleString()}원`;
  };

  // getAvatarInfo removed to satisfy compiler

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
      color = 'text-toss-gray-455 bg-toss-gray-105 border-toss-gray-200 dark:bg-slate-800 dark:border-slate-700';
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

  // ─── 차트 데이터 연산 ─────────────────────────────────────────

  // 일간 작업량 (향후 7일간 진행 중인 태스크 건수)
  const dailyChartData = useMemo(() => {
    const list = Object.values(tasks).flat();
    const result: { label: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateString = d.toISOString().split('T')[0];
      const label = `${d.getMonth() + 1}/${d.getDate()}`;

      const count = list.filter(t => {
        if (t.status === '완료') return false;
        if (!t.start_date && !t.end_date) return false;
        const start = t.start_date || t.end_date || '';
        const end = t.end_date || t.start_date || '';
        return start <= dateString && dateString <= end;
      }).length;

      result.push({ label, count });
    }
    return result;
  }, [tasks]);

  // 주간 자원 투입량 (주차별 누적 투입량 비율 합계)
  const weeklyChartData = useMemo(() => {
    const weekMap: Record<string, number> = {};
    workloads.forEach(w => {
      weekMap[w.week_start] = (weekMap[w.week_start] || 0) + (w.work_ratio || 0);
    });

    return Object.entries(weekMap)
      .map(([week, ratio]) => ({
        label: week.slice(5) + ' 주',
        ratio
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 5);
  }, [workloads]);

  // 월간 작업량 (월별 완료/진행/대기 작업량)
  const monthlyChartData = useMemo(() => {
    const list = Object.values(tasks).flat();
    const monthMap: Record<string, { completed: number; ongoing: number; pending: number }> = {};

    list.forEach(t => {
      const dateStr = t.end_date || t.created_at || '';
      if (!dateStr) return;
      const month = dateStr.slice(0, 7); // YYYY-MM
      if (!monthMap[month]) {
        monthMap[month] = { completed: 0, ongoing: 0, pending: 0 };
      }

      if (t.status === '완료') {
        monthMap[month].completed++;
      } else if (t.status === '진행중' || t.status === '검토중') {
        monthMap[month].ongoing++;
      } else {
        monthMap[month].pending++;
      }
    });

    return Object.entries(monthMap)
      .map(([month, data]) => ({
        label: month.slice(5) + '월',
        ...data
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 6);
  }, [tasks]);

  // 동심원 링 차트 데이터 연산
  const rings = useMemo(() => {
    const timeVal = timeElapsedPercent || 0;
    const docVal = documentMetrics.percent || 0;
    
    // Circumference = 2 * pi * r
    // Outer: r=65, c=408.4
    // Middle: r=50, c=314.16
    // Inner: r=35, c=219.9
    return {
      progress: {
        val: totalProgress,
        offset: 408.4 * (1 - totalProgress / 100),
        color: '#3182F6',
        bg: '#3182F615'
      },
      time: {
        val: timeVal,
        offset: 314.16 * (1 - timeVal / 100),
        color: timeVal > 90 ? '#F04452' : '#FFAD0D',
        bg: timeVal > 90 ? '#F0445215' : '#FFAD0D15'
      },
      docs: {
        val: docVal,
        offset: 219.9 * (1 - docVal / 100),
        color: '#00B06C',
        bg: '#00B06C15'
      }
    };
  }, [totalProgress, timeElapsedPercent, documentMetrics.percent]);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20 select-none">
        <p className="text-sm text-toss-gray-455 dark:text-slate-500 font-bold">선택된 프로젝트가 없습니다.</p>
      </div>
    );
  }

  const healthScore = activeProject.health_score || 0;
  const healthRating = healthScore >= 90 ? '안전' : healthScore >= 70 ? '주의' : '위험';
  const healthColor = 
    healthScore >= 90 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 
    healthScore >= 70 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 
    'text-toss-red bg-toss-red/10 border-toss-red/20';

  return (
    <div className="cds--overview-container animate-slide-up select-none text-left w-full h-full overflow-y-auto pr-3 space-y-6 scrollbar-thin p-1 pb-12">
      {/* Overview Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 select-none shrink-0 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div className="flex flex-col text-left">
          <span className="text-xs font-black text-toss-blue uppercase tracking-widest">Dashboard Overview</span>
          <div className="flex items-center gap-2.5 mt-1">
            {activeProject.code && (
              <span className="px-2.5 py-0.5 rounded-lg bg-toss-blue/10 text-toss-blue border border-toss-blue/20 font-mono text-xs font-black tracking-widest shrink-0">
                {activeProject.code}
              </span>
            )}
            <h1 className="text-xl font-extrabold text-slate-850 dark:text-slate-100">{activeProject.name} 개요</h1>
            {dDayMetrics && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border shadow-sm shrink-0 ${dDayMetrics.color}`}>
                {dDayMetrics.label}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenEditModal}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-855 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>정보 수정</span>
          </button>

          <button
            onClick={scanAndSync}
            className="px-4 py-2.5 rounded-xl bg-toss-blue text-white hover:bg-blue-600 transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            <Activity className="w-4.5 h-4.5 text-white animate-pulse" />
            <span>폴더 구조 동기화 및 건강도 진단</span>
          </button>
        </div>
      </div>

      {/* 1. 최상단 중요도 지표 3열 그리드 (시각화 링 대시보드 포함) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Card A: 프로젝트 상태 */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col items-center justify-between gap-6 group hover:shadow-md transition-shadow xl:col-span-1 min-h-[380px]">
          {/* Radial Activity Rings SVG */}
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
              {/* Outer Track & Ring (Overall Progress) */}
              <circle cx="80" cy="80" r="65" fill="none" stroke={rings.progress.bg} strokeWidth="10" />
              <circle 
                cx="80" cy="80" r="65" fill="none" 
                stroke={rings.progress.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray="408.4" strokeDashoffset={rings.progress.offset}
                className="transition-all duration-700 ease-out"
              />

              {/* Middle Track & Ring (Timeline Elapsed) */}
              <circle cx="80" cy="80" r="50" fill="none" stroke={rings.time.bg} strokeWidth="10" />
              <circle 
                cx="80" cy="80" r="50" fill="none" 
                stroke={rings.time.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray="314.16" strokeDashoffset={rings.time.offset}
                className="transition-all duration-700 ease-out"
              />

              {/* Inner Track & Ring (Required Docs Complete) */}
              <circle cx="80" cy="80" r="35" fill="none" stroke={rings.docs.bg} strokeWidth="10" />
              <circle 
                cx="80" cy="80" r="35" fill="none" 
                stroke={rings.docs.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray="219.9" strokeDashoffset={rings.docs.offset}
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Center Information labels */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center pt-2">
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                {healthScore}
              </span>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">HEALTH INDEX</span>
              <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border mt-1.5 ${healthColor}`}>
                {healthRating}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-2.5 w-full text-left min-w-0">
            <div className="flex justify-between items-center border-b border-gray-100/50 dark:border-slate-800/50 pb-2">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">프로젝트 상태</span>
              {!isEditingDates && (
                <button 
                  onClick={() => setIsEditingDates(true)}
                  className="text-[10px] font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                >
                  일정 변경
                </button>
              )}
            </div>
            
            {isEditingDates ? (
              <div className="flex flex-col gap-2.5 text-xs font-bold pt-1">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-toss-gray-455 dark:text-slate-500 text-[9px] font-bold">계약 수행 기간</span>
                  <RangeDatePicker
                    startDate={startDateInput}
                    endDate={endDateInput}
                    onChange={(start, end) => {
                      setStartDateInput(start);
                      setEndDateInput(end);
                    }}
                    placeholder="프로젝트 기간 선택"
                  />
                </div>
                <div className="flex justify-end gap-1.5 mt-1">
                  <button 
                    onClick={() => {
                      setIsEditingDates(false);
                      setStartDateInput(activeProject.start_date || '');
                      setEndDateInput(activeProject.end_date || '');
                    }}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-gray-100 hover:bg-gray-250 text-toss-gray-655 dark:bg-slate-850 dark:text-slate-450 border-none cursor-pointer"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSaveDates}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-toss-blue hover:bg-blue-600 text-white border-none cursor-pointer"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-xs font-bold text-slate-650 dark:text-slate-350">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                  <span className="text-slate-400 dark:text-slate-550 font-medium">상태</span>
                  <span className="text-slate-800 dark:text-slate-150 font-black">{activeProject.status}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                  <span className="text-slate-400 dark:text-slate-550 font-medium">진행률</span>
                  <span className="text-toss-blue dark:text-sky-400 font-black">{totalProgress}%</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                  <span className="text-slate-400 dark:text-slate-550 font-medium">수행 기간</span>
                  <span className="text-slate-800 dark:text-slate-150 font-black text-[10.5px]">
                    {activeProject.start_date || '미지정'} ~ {activeProject.end_date || '미지정'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pt-1.5">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1">
                    <Database className="w-3 h-3 text-toss-blue" /> 로컬 디렉토리 경로
                  </span>
                  <span className="font-mono bg-slate-50/50 dark:bg-slate-950 px-2 py-1.5 rounded-xl text-[9px] text-slate-500 dark:text-slate-400 break-all select-all text-left border border-slate-100 dark:border-slate-800/40 leading-tight">
                    {activeProject.path}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card B: 사업 정보 */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col justify-between min-h-[380px] hover:shadow-md transition-shadow text-left">
          <div className="w-full">
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-3.5">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">사업 정보</span>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">계약금액</span>
                <span className="text-base font-extrabold text-slate-850 dark:text-slate-100 leading-snug">
                  {formatCurrency(activeProject.contract_amount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">중요도</span>
                  <div className="flex">
                    {activeProject.importance ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                        activeProject.importance === 'Critical' ? 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-955/25 dark:border-rose-900/50' :
                        activeProject.importance === 'High' ? 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-955/25 dark:border-amber-900/50' :
                        activeProject.importance === 'Medium' ? 'text-toss-blue bg-blue-50 border-blue-100 dark:bg-blue-955/25 dark:border-blue-900/50' :
                        'text-slate-600 bg-slate-50 border-slate-150 dark:bg-slate-800/40 dark:border-slate-700/50'
                      }`}>
                        {activeProject.importance}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold italic">미지정</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">우선순위</span>
                  <div className="flex">
                    {activeProject.priority ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                        activeProject.priority === 'P1' ? 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-955/25 dark:border-rose-900/50' :
                        activeProject.priority === 'P2' ? 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-955/25 dark:border-orange-900/50' :
                        activeProject.priority === 'P3' ? 'text-toss-blue bg-blue-50 border-blue-100 dark:bg-blue-955/25 dark:border-blue-900/50' :
                        'text-slate-600 bg-slate-50 border-slate-150 dark:bg-slate-800/40 dark:border-slate-700/50'
                      }`}>
                        {activeProject.priority}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold italic">미지정</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card C: 발주처 정보 */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col justify-between min-h-[380px] hover:shadow-md transition-shadow text-left">
          <div className="w-full">
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-3.5">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">발주처 정보</span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs font-bold text-slate-750 dark:text-slate-300">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                <span className="text-slate-400 dark:text-slate-500 font-medium">발주처명</span>
                <span className="text-slate-800 dark:text-slate-150 font-black">
                  {activeProject.client_name || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                <span className="text-slate-400 dark:text-slate-500 font-medium">지역</span>
                <span className="text-slate-800 dark:text-slate-150 font-black">
                  {activeProject.client_region || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                <span className="text-slate-400 dark:text-slate-500 font-medium">담당 부서</span>
                <span className="text-slate-800 dark:text-slate-150 font-black">
                  {activeProject.client_department || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                <span className="text-slate-400 dark:text-slate-500 font-medium">담당자</span>
                <span className="text-slate-800 dark:text-slate-150 font-black">
                  {activeProject.client_contact_name || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-800/20">
                <span className="text-slate-400 dark:text-slate-500 font-medium">연락처</span>
                <span className="text-slate-800 dark:text-slate-150 font-black">
                  {activeProject.client_contact_phone || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 dark:text-slate-500 font-medium">이메일</span>
                <span className="text-slate-800 dark:text-slate-150 font-black select-all text-[11px] truncate max-w-[150px] md:max-w-none">
                  {activeProject.client_contact_email || <span className="text-slate-400 font-bold italic">미지정</span>}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 프로젝트 개요 (설명, 사업 목적, 주요 범위, 특이사항) */}
      <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow text-left">
        <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0"></span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">프로젝트 개요 및 범위</span>
          </div>
          <button
            onClick={() => handleOpenFolder(activeProject.path)}
            className="text-[10px] font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
          >
            폴더 열기
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">프로젝트 설명</span>
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 p-4.5 rounded-2xl text-xs font-semibold text-slate-650 dark:text-slate-350 min-h-[80px] whitespace-pre-wrap leading-relaxed">
              {activeProject.description || <span className="text-slate-400 italic">등록된 프로젝트 설명이 없습니다.</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">사업 목적</span>
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 p-4.5 rounded-2xl text-xs font-semibold text-slate-650 dark:text-slate-355 min-h-[80px] whitespace-pre-wrap leading-relaxed">
              {activeProject.business_purpose || <span className="text-slate-400 italic">등록된 사업 목적이 없습니다.</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">주요 범위</span>
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 p-4.5 rounded-2xl text-xs font-semibold text-slate-650 dark:text-slate-355 min-h-[80px] whitespace-pre-wrap leading-relaxed">
              {activeProject.major_scope || <span className="text-slate-400 italic">등록된 주요 범위가 없습니다.</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">특이사항</span>
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 p-4.5 rounded-2xl text-xs font-semibold text-slate-650 dark:text-slate-355 min-h-[80px] whitespace-pre-wrap leading-relaxed">
              {activeProject.special_notes || <span className="text-slate-400 italic">등록된 특이사항이 없습니다.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 프로젝트 개요 정보 수정 모달 */}
      {isEditModalOpen && (
        <ModalOverlay onClose={() => setIsEditModalOpen(false)} zIndex={9000}>
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 shadow-toss-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto text-left animate-scale-in flex flex-col gap-5 scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-toss-blue">Project Information Settings</span>
                <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">프로젝트 정보 수정</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAllInfo} className="flex flex-col gap-5">
              {/* 사업 정보 */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black text-toss-blue uppercase tracking-wider text-left">■ 사업 정보</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">계약금액 (원)</label>
                    <input 
                      type="text" 
                      value={editContractAmount} 
                      onChange={e => setEditContractAmount(e.target.value)} 
                      placeholder="예: 45,000,000"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">중요도</label>
                    <select 
                      value={editImportance} 
                      onChange={e => setEditImportance(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">우선순위</label>
                    <select 
                      value={editPriority} 
                      onChange={e => setEditPriority(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    >
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                      <option value="P3">P3</option>
                      <option value="P4">P4</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 발주처 정보 */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black text-toss-blue uppercase tracking-wider text-left">■ 발주처 정보</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">발주처명</label>
                    <input 
                      type="text" 
                      value={editClientName} 
                      onChange={e => setEditClientName(e.target.value)} 
                      placeholder="예: 홍천군청"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">지역</label>
                    <button
                      type="button"
                      onClick={() => setIsRegionPickerOpen(true)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-[38px] cursor-pointer"
                    >
                      <span>{editClientRegion || '지역 선택'}</span>
                      <span className="text-slate-400 text-[10px]">선택</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">담당 부서</label>
                    <input 
                      type="text" 
                      value={editClientDepartment} 
                      onChange={e => setEditClientDepartment(e.target.value)} 
                      placeholder="예: 관광과"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">담당자</label>
                    <input 
                      type="text" 
                      value={editClientContactName} 
                      onChange={e => setEditClientContactName(e.target.value)} 
                      placeholder="예: 홍길동 주무관"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">연락처</label>
                    <input 
                      type="text" 
                      value={editClientContactPhone} 
                      onChange={e => setEditClientContactPhone(e.target.value)} 
                      placeholder="예: 033-430-1234"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">이메일</label>
                    <input 
                      type="email" 
                      value={editClientContactEmail} 
                      onChange={e => setEditClientContactEmail(e.target.value)} 
                      placeholder="예: abc@korea.kr"
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* 프로젝트 개요 */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black text-toss-blue uppercase tracking-wider text-left">■ 프로젝트 개요</h4>
                <div className="flex flex-col gap-3.5 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">프로젝트 설명</label>
                    <textarea 
                      value={editDescription} 
                      onChange={e => setEditDescription(e.target.value)} 
                      placeholder="프로젝트 요건 및 기본 설명을 작성해 주세요."
                      rows={2}
                      className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue/15 resize-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">사업 목적</label>
                    <textarea 
                      value={editBusinessPurpose} 
                      onChange={e => setEditBusinessPurpose(e.target.value)} 
                      placeholder="사업의 주요 추진 배경 및 목적을 작성해 주세요."
                      rows={2}
                      className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue/15 resize-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">주요 범위</label>
                    <textarea 
                      value={editMajorScope} 
                      onChange={e => setEditMajorScope(e.target.value)} 
                      placeholder="수행할 업무 과업 및 설계 범위를 기술해 주세요."
                      rows={2}
                      className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue/15 resize-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500">특이사항</label>
                    <textarea 
                      value={editSpecialNotes} 
                      onChange={e => setEditSpecialNotes(e.target.value)} 
                      placeholder="추가 약정이나 사업 특수 조건 등의 특이사항을 명시해 주세요."
                      rows={2}
                      className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue/15 resize-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* 저장 / 취소 버튼 */}
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-extrabold hover:bg-blue-600 cursor-pointer"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      <RegionPickerModal
        isOpen={isRegionPickerOpen}
        onClose={() => setIsRegionPickerOpen(false)}
        zIndex={10000}
        onSelect={(code) => {
          const selectedRegionName = REGION_CODES.find(r => r.code === code)?.name || code;
          setEditClientRegion(selectedRegionName);
        }}
      />

      {/* 2. 대시보드 중앙: 일간 / 주간 / 월간 작업량 통합 분석 차트 (SVG 시각화) */}
      <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow">
        {/* 차트 헤더 & 탭 스위치 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2 text-left">
            <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0"></span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">프로젝트 작업량 및 자원 할당 시각화</span>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/40 dark:border-slate-700 text-xs font-black">
            {[
              { key: 'daily', label: '일간 작업 (7일)' },
              { key: 'weekly', label: '주간 자원 (누적비율)' },
              { key: 'monthly', label: '월간 작업 (스택)' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setWorkloadTab(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  workloadTab === tab.key
                    ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 차트 프레임 렌더러 */}
        <div className="w-full flex flex-col md:flex-row items-center gap-8 py-2 justify-center">
          
          {/* SVG 차트 바디 */}
          <div className="w-full max-w-[620px] h-[190px] flex items-center justify-center shrink-0">
            {workloadTab === 'daily' && (() => {
              const maxVal = Math.max(...dailyChartData.map(d => d.count), 4);
              const points = dailyChartData.map((d, i) => {
                const x = 50 + i * 85;
                const y = 140 - (d.count / maxVal) * 100;
                return { x, y, val: d.count, label: d.label };
              });
              
              const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const areaD = `${pathD} L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z`;

              return (
                <svg className="w-full h-full" viewBox="0 0 600 180">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = 140 - pct;
                    return (
                      <line key={pct} x1="40" y1={y} x2="570" y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-slate-800/60" />
                    );
                  })}
                  
                  {/* Gradient Fill under line */}
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3182F6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3182F6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={areaD} fill="url(#chartGradient)" />

                  {/* Curve Path Line */}
                  <path d={pathD} fill="none" stroke="#3182F6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Interactive Points and Labels */}
                  {points.map((p, i) => (
                    <g key={i} className="group cursor-pointer">
                      <circle cx={p.x} cy={p.y} r="5.5" fill="#FFFFFF" stroke="#3182F6" strokeWidth="3" className="hover:scale-125 transition-transform" />
                      {/* Value label above the node */}
                      <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[10px] font-black fill-current text-slate-800 dark:text-slate-200">
                        {p.val}건
                      </text>
                      {/* X-axis labels */}
                      <text x={p.x} y="160" textAnchor="middle" className="text-[10px] font-bold fill-current text-slate-400 dark:text-slate-500">
                        {p.label}
                      </text>
                    </g>
                  ))}
                  
                  {/* Y-axis values */}
                  <text x="25" y="143" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">0</text>
                  <text x="25" y="43" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">{maxVal}</text>
                </svg>
              );
            })()}

            {workloadTab === 'weekly' && (() => {
              if (weeklyChartData.length === 0) {
                return <span className="text-xs text-slate-400 dark:text-slate-500 py-12">현재 주간 배정된 자원 데이터가 없습니다.</span>;
              }
              
              const maxVal = Math.max(...weeklyChartData.map(d => d.ratio), 100);
              return (
                <svg className="w-full h-full" viewBox="0 0 600 180">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = 140 - pct;
                    return (
                      <line key={pct} x1="40" y1={y} x2="570" y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-slate-800/60" />
                    );
                  })}

                  <defs>
                    <linearGradient id="blueBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3182F6" /><stop offset="100%" stopColor="#1E58C1" />
                    </linearGradient>
                    <linearGradient id="orangeBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFAD0D" /><stop offset="100%" stopColor="#CA7F00" />
                    </linearGradient>
                    <linearGradient id="redBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F04452" /><stop offset="100%" stopColor="#B5222E" />
                    </linearGradient>
                  </defs>

                  {/* Render Bars */}
                  {weeklyChartData.map((d, i) => {
                    const x = 70 + i * 105;
                    const h = (d.ratio / maxVal) * 100;
                    const y = 140 - h;
                    const barWidth = 32;

                    let gradient = 'url(#blueBar)';
                    if (d.ratio > 200) gradient = 'url(#redBar)';
                    else if (d.ratio > 100) gradient = 'url(#orangeBar)';

                    return (
                      <g key={i} className="group">
                        <rect 
                          x={x} y={y} width={barWidth} height={h} rx="6" 
                          fill={gradient} className="hover:opacity-90 transition-all cursor-pointer" 
                        />
                        {/* Value above the bar */}
                        <text x={x + barWidth/2} y={y - 8} textAnchor="middle" className="text-[10px] font-black fill-current text-slate-800 dark:text-slate-200">
                          {d.ratio}%
                        </text>
                        {/* X-axis labels */}
                        <text x={x + barWidth/2} y="160" textAnchor="middle" className="text-[10px] font-bold fill-current text-slate-400 dark:text-slate-500">
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                  {/* Y-axis values */}
                  <text x="25" y="143" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">0%</text>
                  <text x="25" y="43" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">{maxVal}%</text>
                </svg>
              );
            })()}

            {workloadTab === 'monthly' && (() => {
              if (monthlyChartData.length === 0) {
                return <span className="text-xs text-slate-400 dark:text-slate-500 py-12">현재 등록된 프로젝트 태스크가 없습니다.</span>;
              }

              const maxVal = Math.max(...monthlyChartData.map(d => d.completed + d.ongoing + d.pending), 4);
              return (
                <svg className="w-full h-full" viewBox="0 0 600 180">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = 140 - pct;
                    return (
                      <line key={pct} x1="40" y1={y} x2="570" y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" className="dark:stroke-slate-800/60" />
                    );
                  })}

                  {/* Render Stacked Bars */}
                  {monthlyChartData.map((d, i) => {
                    const x = 70 + i * 105;
                    const barWidth = 32;

                    // Scaling heights
                    const hPending = (d.pending / maxVal) * 100;
                    const hOngoing = (d.ongoing / maxVal) * 100;
                    const hCompleted = (d.completed / maxVal) * 100;
                    
                    const yPending = 140 - hPending;
                    const yOngoing = yPending - hOngoing;
                    const yCompleted = yOngoing - hCompleted;

                    return (
                      <g key={i}>
                        {/* Pending (Gray) */}
                        {hPending > 0 && (
                          <rect x={x} y={yPending} width={barWidth} height={hPending} fill="#94A3B8" rx="2" className="hover:opacity-90" />
                        )}
                        {/* Ongoing (Blue) */}
                        {hOngoing > 0 && (
                          <rect x={x} y={yOngoing} width={barWidth} height={hOngoing} fill="#3182F6" rx="2" className="hover:opacity-90" />
                        )}
                        {/* Completed (Green) */}
                        {hCompleted > 0 && (
                          <rect x={x} y={yCompleted} width={barWidth} height={hCompleted} fill="#00B06C" rx="2" className="hover:opacity-90" />
                        )}

                        {/* Total Count Label on top of stack */}
                        <text x={x + barWidth/2} y={yCompleted - 8} textAnchor="middle" className="text-[10px] font-black fill-current text-slate-800 dark:text-slate-200">
                          {d.completed + d.ongoing + d.pending}건
                        </text>
                        {/* X-axis labels */}
                        <text x={x + barWidth/2} y="160" textAnchor="middle" className="text-[10px] font-bold fill-current text-slate-400 dark:text-slate-500">
                          {d.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Y-axis values */}
                  <text x="25" y="143" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">0</text>
                  <text x="25" y="43" textAnchor="end" className="text-[9px] font-bold fill-current text-slate-400">{maxVal}</text>
                </svg>
              );
            })()}
          </div>

          {/* 차트 가이드 및 인사이트 설명 */}
          <div className="flex-1 text-left min-w-0 flex flex-col justify-center gap-3 bg-slate-50/50 dark:bg-slate-850/25 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 w-full">
            <span className="text-[11px] font-black text-toss-blue uppercase tracking-widest">차트 해석 & 실시간 분석</span>
            
            {workloadTab === 'daily' && (
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="font-extrabold text-slate-850 dark:text-slate-150">향후 7일 일간 미완료 작업량 추이</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11.5px]">
                  매일 진행 및 검토 대기 중인 잔여 작업량의 누계 분포 곡선입니다. 특정 일자에 곡선이 솟아오른다면, 해당 일정 만료일에 작업이 집중되어 병목현상이 발생함을 암시합니다.
                </p>
              </div>
            )}

            {workloadTab === 'weekly' && (
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="font-extrabold text-slate-850 dark:text-slate-150">주차별 투입 인력 총 리소스 부하</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11.5px]">
                  본 프로젝트에 할당된 주차별 작업 할당 비율(Workload Ratio) 총합입니다. 누적 배율이 100%를 초과하는 주차가 지속될 경우 자원 과부하(Overload)가 발생하므로 인력 조정 또는 일정 조정이 필요합니다.
                </p>
                {/* 범례 */}
                <div className="flex items-center gap-3 text-[10px] font-bold mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-toss-blue" /> 보통 (100%이하)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> 경고 (100%~200%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-toss-red" /> 과부하 (200%초과)</span>
                </div>
              </div>
            )}

            {workloadTab === 'monthly' && (
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="font-extrabold text-slate-850 dark:text-slate-150">월별 마일스톤 누적 진행 통계</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11.5px]">
                  프로젝트 내 전체 태스크를 마일스톤(월 단위)으로 분류해 상태별 비율을 비교하는 스택 막대 그래프입니다. 녹색의 완료 비율이 높을수록 안정적으로 마일스톤을 준수하고 있는 것입니다.
                </p>
                {/* 범례 */}
                <div className="flex items-center gap-3 text-[10px] font-bold mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> 완료</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-toss-blue" /> 진행/검토 중</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-400" /> 대기 중</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 3. 프로세스 로드맵 단계 & 투입인력 현황 좌우 2열 배치 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 로드맵 (Width: 2/3) */}
        <div className="lg:col-span-2 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0"></span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">프로세스 단계 로드맵 및 작업 현황</span>
            </div>
            <button 
              onClick={() => setView('projects_process')}
              className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
            >
              단계 편집 <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>

          {processes.length === 0 ? (
            <div className="py-12 text-center text-toss-gray-450 dark:text-slate-500 text-sm font-bold">
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
                    className={`w-60 shrink-0 rounded-2xl border p-4 flex flex-col gap-3 min-h-[220px] transition-all hover:shadow-sm ${cardBorder}`}
                  >
                    {/* Process Header */}
                    <div className="flex items-start justify-between gap-2 text-left">
                      <div className="flex flex-col gap-0.5 text-left overflow-hidden w-full">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black text-left block">
                          STEP 0{index + 1}
                        </span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-150 truncate text-left block" title={proc.name}>
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
                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-40 scrollbar-none pr-0.5">
                      {procTasks.length === 0 ? (
                        <span className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold text-center py-6 block">
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
                              className="bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-slate-100 dark:border-slate-800/30 hover:border-toss-blue/20 dark:hover:border-toss-blue/30 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 flex flex-col gap-1.5 cursor-pointer text-left group"
                            >
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-toss-blue transition-colors text-left">
                                {task.title}
                              </span>
                              <div className="flex items-center justify-between gap-1.5">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${statusColor}`}>
                                  {task.status}
                                </span>
                                {dday && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${dday.color}`}>
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

        {/* 투입 인력 현황 (Width: 1/3) */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-3.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-toss-blue shrink-0" />
                <span className="text-sm font-black text-slate-800 dark:text-slate-200">투입 인력 현황</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-toss-blue/10 text-toss-blue border border-toss-blue/15">
                {assignments.length}명
              </span>
            </div>

            {loadingAssigns ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-toss-gray-400">
                <Activity className="w-5 h-5 text-toss-blue animate-spin" />
                <span>데이터 불러오는 중...</span>
              </div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-1.5">
                <Users className="w-8 h-8 text-toss-gray-350 dark:text-slate-700" />
                <p className="text-xs text-slate-400 font-bold">배정된 투입 인력이 없습니다.</p>
                <p className="text-[10px] text-slate-455 dark:text-slate-500">배정 관리에서 리소스를 등록해 주세요.</p>
              </div>
            ) : (
              <div className="flex flex-col max-h-56 overflow-y-auto pr-0.5 scrollbar-thin">
                {assignments.map(assign => {
                  const userDetail = users.find(u => u.id === assign.user_id);
                  
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
                      className="flex items-center justify-between py-2.5 border-b border-gray-100/50 dark:border-slate-800/20 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-855/10 px-1 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Circle Avatar */}
                        <Avatar
                          name={assign.user_name}
                          profileImage={userDetail?.profile_image || assign.user_profile_image}
                          className="w-7 h-7 text-[11px] font-black shrink-0"
                        />
                        {/* Name and Position */}
                        <div className="flex flex-col text-left min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-black text-slate-800 dark:text-gray-250 truncate">
                              {assign.user_name}
                            </span>
                            {userDetail?.position && (
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                                {userDetail.position}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                            {assign.role || '담당자'}
                          </span>
                        </div>
                      </div>

                      {/* Allocation Rate Badge */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${pctColor}`}>
                          {assign.allocation_percent}%
                        </span>
                        {userDetail?.department && (
                          <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
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

      {/* 4. 하단 태스크 리스트 & 폴더 구조 진단 좌우 2열 배치 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ongoing Tasks */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-3.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-toss-blue shrink-0" />
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">실시간 진행중인 작업 ({recentTasks.length})</span>
            </div>
            <button onClick={() => setView('projects_tasks')} className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5">
              작업 전체보기 <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>

          <div className="flex flex-col max-h-56 overflow-y-auto pr-0.5 scrollbar-thin">
            {recentTasks.length === 0 ? (
              <p className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold py-14 text-center">진행 중인 작업이 없습니다.</p>
            ) : (
              <div className="flex flex-col">
                {recentTasks.map(task => {
                  let priorityColor = 'text-toss-gray-500 bg-toss-gray-100 dark:bg-slate-850/40 dark:text-slate-400';
                  if (task.priority === '긴급') priorityColor = 'text-toss-red bg-toss-red/10 dark:bg-rose-955/30 dark:text-toss-red';
                  else if (task.priority === '높음') priorityColor = 'text-toss-yellow bg-toss-yellow/10 dark:bg-amber-955/30 dark:text-toss-yellow';
                  
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/20 last:border-b-0 hover:bg-slate-50/30 dark:hover:bg-slate-850/10 px-1 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden w-full">
                        <Clock className="w-4.5 h-4.5 text-toss-blue shrink-0" />
                        <div className="flex flex-col overflow-hidden text-left w-full">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{task.title}</span>
                          <span className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{task.description || '작업 세부 설명이 기록되지 않았습니다.'}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black shrink-0 ${priorityColor}`}>{task.priority}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact Documents & Analysis with Visual bar chart */}
        <div className="p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[260px]">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/50 pb-3.5 mb-3.5">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-toss-blue shrink-0" />
                <span className="text-sm font-black text-slate-800 dark:text-slate-200">산출물 및 폴더 구조 진단</span>
              </div>
              <button onClick={() => setView('projects_documents')} className="text-xs font-bold text-toss-blue hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5">
                산출물 관리 <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Horizontal Bar Chart (SVG) */}
              <div className="flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-950 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-left">구조 및 문서 매칭율 비교</span>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-650 dark:text-slate-350">
                    <span>폴더 트리 적합도</span>
                    <span className="font-extrabold">{structureMetrics.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${structureMetrics.percent}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-650 dark:text-slate-355 mt-1">
                    <span>필수 산출물 확보율</span>
                    <span className="font-extrabold">{documentMetrics.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${documentMetrics.percent}%` }} />
                  </div>
                </div>
              </div>

              {/* Status summary list */}
              <div className="grid grid-cols-2 gap-3 text-xs font-bold mt-1">
                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                  <span className="text-slate-450 dark:text-slate-500">누락된 필수 파일</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    documentMetrics.missing.length === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-toss-red'
                  }`}>
                    {documentMetrics.missing.length}건
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                  <span className="text-slate-450 dark:text-slate-500">중복 및 대용량</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {duplicateFilesList.length} / {largeFilesList.length}건
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setView('projects_analysis')}
            className="w-full py-2.5 mt-4 rounded-xl flex items-center justify-center gap-1 font-bold text-xs cursor-pointer border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 hover:bg-purple-100/60 text-purple-750 dark:bg-purple-950/20 dark:text-purple-400 transition-colors"
          >
            <span>상세 규칙 진단 및 파일 분석 리포트 확인</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
