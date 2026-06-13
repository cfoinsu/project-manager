import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  FolderOpen, 
  ShieldCheck, 
  Plus, 
  ChevronRight, 
  Activity, 
  PlayCircle, 
  CheckCircle,
  Hash,
  MapPin,
  Briefcase,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  MoreVertical
} from 'lucide-react';
import type { Project } from '../types';
import { REGION_CODES, PROJECT_TYPE_CODES } from '../types';
import { selectFolderNative, isTauri } from '../utils/tauriBridge';
import { generateProjectCode, getProcesses } from '../utils/db';
import { RangeDatePicker } from './RangeDatePicker';
import { CustomSelect } from './CustomSelect';

export const DashboardView: React.FC = () => {
  const { projects, templates, addProject, removeProject, updateProjectInfo, selectProject, setView, setPendingTab } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState<'전체' | '대기' | '진행중' | '완료'>('전체');
  
  // 로드된 각 프로젝트의 진행도 상태
  const [projectProgressMap, setProjectProgressMap] = useState<Record<string, number>>({});
  
  // 프로젝트별 진행도(프로세스 평균 진행률) 계산 로드
  useEffect(() => {
    const fetchProgress = async () => {
      const map: Record<string, number> = {};
      for (const proj of projects) {
        try {
          const procs = await getProcesses(proj.id);
          if (procs.length > 0) {
            const avg = procs.reduce((acc, p) => acc + p.progress, 0) / procs.length;
            map[proj.id] = Math.round(avg * 100);
          } else {
            map[proj.id] = 0;
          }
        } catch (e) {
          console.error(e);
          map[proj.id] = 0;
        }
      }
      setProjectProgressMap(map);
    };
    
    if (projects.length > 0) {
      fetchProgress();
    }
  }, [projects]);
  
  // 프로젝트 코드를 기준으로 유형 한글명 반환
  const getProjectTypeName = (code: string) => {
    if (!code || code.length < 8) return '미지정';
    const typeChar = code.charAt(4);
    const found = PROJECT_TYPE_CODES.find(t => t.code === typeChar);
    return found ? found.name : '기타';
  };
  
  // 금주의 날짜들 계산 (일~토)
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push({
        dateStr: `${d.getFullYear()}-${mm}-${dd}`,
        dayNum: d.getDate(),
        dayName: ['일', '월', '화', '수', '목', '금', '토'][i],
        isToday: d.getDate() === today.getDate() && d.getMonth() === today.getMonth()
      });
    }
    return days;
  }, []);
  
  // 이번 주 일요일과 토요일 날짜 문자열
  const sundayStr = useMemo(() => currentWeekDays[0]?.dateStr || '', [currentWeekDays]);
  const saturdayStr = useMemo(() => currentWeekDays[6]?.dateStr || '', [currentWeekDays]);

  // 이번 주 스케줄 프로젝트 간트 차트 데이터 (레인 배분 포함)
  const weekProjects = useMemo(() => {
    if (projects.length === 0 || !sundayStr || !saturdayStr) return [];
    
    // 이번 주 범위에 포함되는 프로젝트 필터링
    const list = projects.filter(p => {
      if (!p.start_date || !p.end_date) return false;
      return p.start_date <= saturdayStr && p.end_date >= sundayStr;
    });
    
    // 시작일 빠른 순, 기간이 긴 순 정렬
    const sorted = [...list].sort((a, b) => {
      const startA = a.start_date || '';
      const startB = b.start_date || '';
      if (startA !== startB) return startA.localeCompare(startB);
      
      const durationA = new Date(a.end_date || '').getTime() - new Date(a.start_date || '').getTime();
      const durationB = new Date(b.end_date || '').getTime() - new Date(b.start_date || '').getTime();
      return durationB - durationA;
    });

    // 레인 배분
    const lanes: number[] = []; // lane index별로 이번 주 내에서의 마지막 종료 인덱스 기록
    return sorted.map(p => {
      const startStr = p.start_date || '';
      const endStr = p.end_date || '';
      
      // 이번 주 7일 중 시작 요일(0~6)과 종료 요일(0~6) 인덱스 계산
      const startIdx = startStr < sundayStr ? 0 : currentWeekDays.findIndex(d => d.dateStr === startStr);
      const endIdx = endStr > saturdayStr ? 6 : currentWeekDays.findIndex(d => d.dateStr === endStr);

      let assignedLane = 0;
      while (true) {
        const lastEndIdx = lanes[assignedLane];
        // 겹치지 않는 경우 (해당 레인의 마지막 일정이 이 일정의 시작 전에 끝나야 함)
        if (lastEndIdx === undefined || lastEndIdx < startIdx) {
          lanes[assignedLane] = endIdx;
          break;
        }
        assignedLane++;
      }

      return {
        project: p,
        startIdx,
        endIdx,
        lane: assignedLane
      };
    });
  }, [projects, sundayStr, saturdayStr, currentWeekDays]);

  // 필요한 레인 개수
  const maxLane = useMemo(() => {
    if (weekProjects.length === 0) return 0;
    return Math.max(...weekProjects.map(wp => wp.lane)) + 1;
  }, [weekProjects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (projectStatusFilter === '전체') return true;
      return (p.status || '진행중') === projectStatusFilter;
    });
  }, [projects, projectStatusFilter]);


  
  // New Project Form state
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit Project Modal state
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRegionCode, setEditRegionCode] = useState('');
  const [editTypeCode, setEditTypeCode] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Dropdown open state (프로젝트 카드 컨텍스트 메뉴)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auto-generated project code preview (new project)
  const generatedCode = useMemo(() => {
    if (!regionCode) return '';
    return generateProjectCode(regionCode, typeCode, projects);
  }, [regionCode, typeCode, projects]);

  // Auto-generated code preview (edit project)
  const editGeneratedCode = useMemo(() => {
    if (!editRegionCode) return editCode;
    return generateProjectCode(editRegionCode, editTypeCode, projects.filter(p => p.id !== editProject?.id));
  }, [editRegionCode, editTypeCode, projects, editProject]);

  // Current year for display
  const currentYear = new Date().getFullYear();
  const yearShort = currentYear.toString().slice(-2);

  // Calculations
  const activeCount = projects.filter(p => p.status === '진행중').length;
  const completedCount = projects.filter(p => p.status === '완료').length;
  const avgHealth = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + p.health_score, 0) / projects.length) 
    : 100;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !path || !regionCode) return;
    
    const code = generatedCode;
    const project = await addProject(name, path, code, selectedTemplateId || undefined, startDate, endDate);

    if (selectedTemplateId) {
      if (isTauri()) {
        alert(`프로젝트가 생성되었습니다!\n폴더 구조와 연동된 문서 양식이 아래 경로에 물리적으로 배포 완료되었습니다:\n${path}`);
      } else {
        alert(`프로젝트가 생성되었습니다!\n\n⚠️ 웹 브라우저 모드 안내:\n물리적인 로컬 폴더 및 파일 작성은 PC 로컬 자원에 접근할 수 있는 '데스크톱 앱' 버전에서만 가능합니다. 현재 웹 브라우저 환경이므로 DB 상의 프로젝트 구조만 자동 설정되었습니다.`);
      }
    }

    setName('');
    setPath('');
    setSelectedTemplateId('');
    setRegionCode('');
    setTypeCode('');
    setStartDate('');
    setEndDate('');
    setModalOpen(false);
    
    // Select the new project and view overview
    selectProject(project);
    setView('projects_overview');
  };

  const handleSelectRecent = (project: Project) => {
    if (openMenuId) return; // 메뉴 열린 상태에서는 클릭 무시
    selectProject(project);
    setView('projects_overview');
  };

  const handleSelectFolder = async () => {
    try {
      const selectedPath = await selectFolderNative();
      if (selectedPath) {
        setPath(selectedPath);
        if (!name) {
          const pathName = selectedPath.split('\\').pop() || selectedPath;
          setName(pathName);
        }
      }
    } catch (e) {
      console.error('Failed to select native folder:', e);
    }
  };

  // Open edit modal for a project
  const handleOpenEdit = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProject(proj);
    setEditName(proj.name);
    setEditCode(proj.code || '');
    setEditStatus(proj.status);
    setEditRegionCode('');
    setEditTypeCode('');
    setEditStartDate(proj.start_date || '');
    setEditEndDate(proj.end_date || '');
    setOpenMenuId(null);
  };

  // Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject || !editName) return;

    if (editStartDate && editEndDate) {
      if (editStartDate > editEndDate) {
        alert('프로젝트 시작일은 종료일보다 늦을 수 없습니다.');
        return;
      }

      const { processes } = useProjectStore.getState();
      const projectProcesses = processes.filter(p => p.project_id === editProject.id);

      for (const proc of projectProcesses) {
        if (proc.start_date && proc.start_date < editStartDate) {
          alert(`프로세스 '${proc.name}'의 시작일(${proc.start_date})이 변경할 프로젝트 시작일(${editStartDate})보다 빠릅니다.\n하위 일정을 먼저 조정해 주세요.`);
          return;
        }
        if (proc.end_date && proc.end_date > editEndDate) {
          alert(`프로세스 '${proc.name}'의 종료일(${proc.end_date})이 변경할 프로젝트 종료일(${editEndDate})보다 늦습니다.\n하위 일정을 먼저 조정해 주세요.`);
          return;
        }
      }
    }

    const finalCode = editRegionCode ? editGeneratedCode : editCode;
    await updateProjectInfo(editProject.id, {
      name: editName,
      code: finalCode,
      status: editStatus,
      start_date: editStartDate,
      end_date: editEndDate,
    });
    setEditProject(null);
  };

  // Delete project
  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    await removeProject(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  // Toggle project status (진행중 ↔ 완료)
  const handleToggleStatus = async (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = proj.status === '진행중' ? '완료' : '진행중';
    await updateProjectInfo(proj.id, { status: newStatus });
    setOpenMenuId(null);
  };

  // Reset form when modal opens
  useEffect(() => {
    if (modalOpen) {
      setName('');
      setPath('');
      setSelectedTemplateId('');
      setRegionCode('');
      setTypeCode('');
      setStartDate('');
      setEndDate('');
    }
  }, [modalOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handler);
    }
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);


  // ─── 최근 댓글 (localStorage + 컨텍스트 enriched) ──────────
  const [recentComments, setRecentComments] = useState<any[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
      const sorted = [...stored]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 5);
      setRecentComments(sorted);
    } catch {}
  }, []);

  // ─── KPI: 전체 작업 수 / 완료율 ─────────────────────────────
  const { tasks: tasksMap, processes } = useProjectStore();
  const allTasks = useMemo(() => Object.values(tasksMap).flat() as any[], [tasksMap]);
  const doneTasks  = allTasks.filter(t => t.status === '완료').length;
  const taskDoneRate = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  // ─── 댓글 컨텍스트 라벨 (프로젝트명 / 프로세스명 or 작업명) ──
  const getCommentContext = (cmt: any): { projName: string; subLabel: string; icon: string } => {
    const proj = cmt.project_id ? projects.find(p => p.id === cmt.project_id) : null;
    const projName = proj?.name || cmt.project_id || '알 수 없음';

    if (cmt.context_type === 'task' && cmt.task_id) {
      // task_id로 작업 찾기
      const task = allTasks.find(t => t.id === cmt.task_id);
      if (task) {
        const proc = processes.find(p => p.id === task.process_id);
        return { projName, subLabel: proc ? `${proc.name} · ${task.title}` : task.title, icon: '✅' };
      }
      return { projName, subLabel: '작업', icon: '✅' };
    }
    if (cmt.context_type === 'assignment' && cmt.assignment_id) {
      return { projName, subLabel: '인력배분', icon: '👥' };
    }
    return { projName, subLabel: '프로젝트', icon: '📁' };
  };

  // 아바타 유틸
  const AVCOLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-pink-500','bg-indigo-500','bg-teal-500','bg-rose-500'];
  const avBg = (name: string) => AVCOLORS[(name?.charCodeAt(0) || 0) % AVCOLORS.length];
  const avInit = (name: string) => name?.slice(0, 2) || '?';

  // ─── 클릭 네비게이션 핸들러 ─────────────────────────────────
  const handleTaskClick = (task: any) => {
    const proc = processes.find(p => p.id === task.process_id);
    const proj = proc ? projects.find(p => p.id === proc.project_id) : null;
    if (proj) {
      selectProject(proj);
      setView('projects_tasks');
    }
  };

  const handleCommentClick = (cmt: any) => {
    const proj = cmt.project_id ? projects.find(p => p.id === cmt.project_id) : null;
    if (proj) selectProject(proj);

    switch (cmt.context_type) {
      case 'task':
        // 해당 작업이 있는 프로세스·프로젝트로 → 작업관리 뷰
        setView('projects_tasks');
        break;
      case 'assignment':
        setPendingTab('comments');
        setView('assignments');
        break;
      default:
        // 'project' or 미마이그레이션 댓글
        setPendingTab('comments');
        setView('assignments');
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-6 text-left select-none animate-slide-up pb-10">

      {/* ━━━ 상단 헤더 ━━━ */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-toss-blue mb-1 uppercase tracking-wider font-mono">Project Operating System</span>
          <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">전체 대시보드</h1>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="toss-btn toss-btn-primary px-5 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-md cursor-pointer hover:shadow-lg transition-all active:scale-95 animate-scale-in"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>새 프로젝트 등록</span>
        </button>
      </div>

      {/* ━━━ KPI 행 (상단 전체 폭) ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        {/* 진행중 프로젝트 */}
        <div className="toss-card flex items-center gap-4 py-5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center shrink-0 border border-sky-100/30">
            <PlayCircle className="w-6 h-6 text-toss-blue" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[11px] text-toss-gray-450 dark:text-slate-400 font-bold uppercase tracking-wider">진행중 프로젝트</span>
            <span className="text-2xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{activeCount}<span className="text-sm ml-1 font-bold text-slate-400">건</span></span>
          </div>
        </div>

        {/* 완료 프로젝트 */}
        <div className="toss-card flex items-center gap-4 py-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 border border-emerald-100/30">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[11px] text-toss-gray-450 dark:text-slate-400 font-bold uppercase tracking-wider">완료된 프로젝트</span>
            <span className="text-2xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{completedCount}<span className="text-sm ml-1 font-bold text-slate-400">건</span></span>
          </div>
        </div>

        {/* 평균 건강도 */}
        <div className="toss-card flex items-center gap-4 py-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0 border border-amber-100/30">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[11px] text-toss-gray-450 dark:text-slate-400 font-bold uppercase tracking-wider">평균 건강도</span>
            <span className="text-2xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{avgHealth}<span className="text-sm ml-1 font-bold text-slate-400">점</span></span>
          </div>
        </div>

        {/* 작업 완료율 */}
        <div className="toss-card flex items-center gap-4 py-5">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0 border border-violet-100/30">
            <Activity className="w-6 h-6 text-violet-500" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[11px] text-toss-gray-450 dark:text-slate-400 font-bold uppercase tracking-wider">전체 작업 완료율</span>
            <span className="text-2xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{taskDoneRate}<span className="text-sm ml-1 font-bold text-slate-400">%</span></span>
            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${taskDoneRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ 메인 2단 레이아웃 ━━━ */}
      <div className="flex gap-6 items-start flex-1 min-h-0">

        {/* ─── 왼쪽: 프로젝트 목록 ─── */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-toss-gray-800 dark:text-slate-200">
              프로젝트 목록 <span className="text-sm font-bold text-slate-400 ml-1">({projects.length})</span>
            </h2>
            {/* 탭 필터 */}
            <div className="flex gap-0.5 bg-toss-gray-100 dark:bg-slate-800/80 p-0.5 rounded-xl select-none">
              {(['전체', '대기', '진행중', '완료'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setProjectStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    projectStatusFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-toss-blue dark:text-sky-400 shadow-sm'
                      : 'text-toss-gray-455 hover:text-toss-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="toss-card flex flex-col items-center justify-center py-16 text-center bg-white/70 dark:bg-slate-900/70 border border-dashed border-gray-200 dark:border-slate-800 gap-3">
              <FolderOpen className="w-12 h-12 text-toss-gray-300" />
              <p className="text-sm font-semibold text-toss-gray-455 dark:text-slate-400">등록된 프로젝트가 없습니다.</p>
              <button onClick={() => setModalOpen(true)} className="toss-btn toss-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold">
                첫 프로젝트 만들기
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="toss-card flex flex-col items-center justify-center py-10 text-center border border-dashed border-gray-200 dark:border-slate-800 gap-2">
              <FolderOpen className="w-8 h-8 text-toss-gray-300" />
              <p className="text-xs font-semibold text-slate-400">'{projectStatusFilter}' 상태의 프로젝트가 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-3 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">프로젝트</span>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">유형</span>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">상태</span>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">진행도</span>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">건강도</span>
              </div>

              {/* 행 목록 */}
              {filteredProjects.map((proj) => {
                const isCompleted = proj.status === '완료';
                const isPending = proj.status === '대기';
                const typeName = getProjectTypeName(proj.code);
                const progressPercent = projectProgressMap[proj.id] || 0;
                const healthColor = proj.health_score >= 90
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200'
                  : proj.health_score >= 70
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200'
                  : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200';

                return (
                  <div
                    key={proj.id}
                    onClick={() => handleSelectRecent(proj)}
                    className={`grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-3 px-5 py-3.5 items-center border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
                      isCompleted ? 'opacity-60' : isPending ? 'opacity-75' : ''
                    }`}
                  >
                    {/* 프로젝트 정보 */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {proj.code && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 font-mono border border-slate-200/50 dark:border-slate-700/50">
                            {proj.code}
                          </span>
                        )}
                        <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200 truncate">{proj.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate font-medium">{proj.path}</span>
                    </div>

                    {/* 유형 */}
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200/40 dark:border-slate-700/40 truncate">
                      {typeName}
                    </span>

                    {/* 상태 */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border w-fit ${
                      isCompleted ? 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      : isPending ? 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      : 'text-toss-blue bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800/40'
                    }`}>
                      {proj.status || '진행중'}
                    </span>

                    {/* 진행도 */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-slate-400' : 'bg-toss-blue'}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* 건강도 + 메뉴 */}
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${healthColor}`}>
                        {proj.health_score}점
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === proj.id ? null : proj.id); }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {openMenuId === proj.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 flex flex-col gap-0.5 p-1.5 min-w-[160px] animate-scale-in">
                            <button onClick={(e) => handleOpenEdit(proj, e)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer w-full text-left">
                              <Pencil className="w-3.5 h-3.5 text-toss-blue" />정보 수정
                            </button>
                            <button onClick={(e) => handleToggleStatus(proj, e)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer w-full text-left">
                              <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? 'text-toss-blue' : 'text-emerald-500'}`} />
                              {isCompleted ? '진행중으로 변경' : '완료로 표시'}
                            </button>
                            <hr className="border-slate-100 dark:border-slate-800 my-0.5" />
                            <button onClick={(e) => handleDeleteProject(proj.id, e)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-toss-red hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer w-full text-left">
                              <Trash2 className="w-3.5 h-3.5" />프로젝트 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── 오른쪽: 3단 스택 ─── */}
        <div className="flex-[2] flex flex-col gap-4 min-w-0">

          {/* 1) 프로젝트 간소 캘린더 (주간 간트) */}
          <div className="toss-card flex flex-col gap-3 py-4 px-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-toss-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-toss-blue" />
                프로젝트 간소 캘린더
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">{sundayStr} ~ {saturdayStr}</span>
            </div>

            {/* 7일 헤더 */}
            <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800/60">
              {currentWeekDays.map((d) => (
                <div
                  key={d.dateStr}
                  className={`py-1.5 flex flex-col items-center justify-center border-r border-slate-100/60 last:border-r-0 dark:border-slate-800/40 text-[10px] ${
                    d.isToday ? 'bg-toss-blue text-white' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="font-bold">{d.dayName}</span>
                  <span className="font-extrabold">{d.dayNum}</span>
                </div>
              ))}
            </div>

            {/* 간트 바 */}
            <div className="relative w-full overflow-hidden rounded-lg" style={{ height: `${Math.max(maxLane * 32 + 8, 48)}px` }}>
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`h-full border-r border-slate-100/30 last:border-r-0 dark:border-slate-800/20 ${currentWeekDays[i].isToday ? 'bg-sky-500/5' : ''}`} />
                ))}
              </div>
              {weekProjects.map(({ project, startIdx, endIdx, lane }) => (
                <div
                  key={project.id}
                  onClick={() => handleSelectRecent(project)}
                  style={{ left: `${(startIdx * 100) / 7 + 0.3}%`, width: `${((endIdx - startIdx + 1) * 100) / 7 - 0.6}%`, top: `${lane * 32 + 4}px` }}
                  className={`absolute h-6 rounded-full text-[10px] font-bold flex items-center px-2.5 truncate border cursor-pointer transition-all hover:scale-[1.01] ${
                    project.status === '완료' ? 'bg-slate-100/70 text-slate-500 border-slate-200/40 dark:bg-slate-800/40 dark:text-slate-400'
                    : project.status === '대기' ? 'bg-slate-100/40 text-slate-400 border-slate-100/40 dark:bg-slate-800/20'
                    : 'bg-sky-50 text-sky-600 border-sky-200/50 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/30'
                  }`}
                  title={`${project.name} (${project.start_date} ~ ${project.end_date})`}
                >
                  <span className="truncate">{project.code ? `[${project.code}]` : ''} {project.name}</span>
                </div>
              ))}
              {weekProjects.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400 font-semibold">
                  이번 주 예정 일정 없음
                </div>
              )}
            </div>
          </div>

          {/* 2) 직원들의 최근 작업한 업무 */}
          <div className="toss-card flex flex-col gap-3 py-4 px-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-toss-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                직원들의 최근 작업한 업무
              </span>
              <span className="text-[10px] font-bold text-slate-400">{allTasks.length}개 전체</span>
            </div>

            {allTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-5 text-slate-300 dark:text-slate-600 select-none">
                <CheckCircle className="w-7 h-7" />
                <p className="text-[11px] font-semibold">등록된 작업이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
                {allTasks.slice(0, 5).map((task: any, idx) => {
                  const proc = processes.find(p => p.id === task.process_id);
                  const proj = projects.find(p => p.id === proc?.project_id);
                  const assigneeName = (task.assignee_names?.[0]) || task.assignee || null;
                  const statusColor = task.status === '완료'
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                    : task.status === '진행중'
                    ? 'text-toss-blue bg-sky-50 border-sky-200'
                    : 'text-slate-500 bg-slate-100 border-slate-200';
                  return (
                    <div
                      key={task.id || idx}
                      onClick={() => handleTaskClick(task)}
                      className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-1 -mx-1 transition-colors group"
                    >
                      {assigneeName ? (
                        <div className={`w-7 h-7 rounded-full ${avBg(assigneeName)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                          {avInit(assigneeName)}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-toss-blue transition-colors">{task.title}</p>
                        <p className="text-[11px] text-slate-400 font-medium truncate">{proj?.name || '—'}</p>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                        {task.status || '대기'}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-toss-blue shrink-0 transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3) 직원들의 최근 댓글 */}
          <div className="toss-card flex flex-col gap-3 py-4 px-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-toss-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-violet-500 rotate-90" />
                직원들의 최근 댓글
              </span>
              <span className="text-[10px] font-bold text-slate-400">{recentComments.length}건</span>
            </div>

            {recentComments.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-5 text-slate-300 dark:text-slate-600 select-none">
                <Activity className="w-7 h-7" />
                <p className="text-[11px] font-semibold">최근 댓글이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentComments.map((cmt: any, idx) => {
                  const ctx = getCommentContext(cmt);
                  return (
                    <div
                      key={cmt.id || idx}
                      onClick={() => handleCommentClick(cmt)}
                      className="flex gap-2.5 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-1 -mx-1 transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-full ${avBg(cmt.author_name || '?')} flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5`}>
                        {avInit(cmt.author_name || '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 작성자 + 부서 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-toss-blue transition-colors">{cmt.author_name || '알 수 없음'}</span>
                          {cmt.author_department && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-semibold border border-slate-200/50">
                              {cmt.author_department}
                            </span>
                          )}
                        </div>
                        {/* 프로젝트 / 컨텍스트 브레드크럼 */}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-toss-blue/70 dark:text-sky-400/70 font-bold truncate">{ctx.projName}</span>
                          {ctx.subLabel !== '프로젝트' && (
                            <>
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">›</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">{ctx.icon} {ctx.subLabel}</span>
                            </>
                          )}
                        </div>
                        {/* 댓글 내용 */}
                        <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{cmt.content}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-toss-blue shrink-0 mt-1 transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>


      {/* ─── New Project Registration Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-7 shadow-toss-lg max-w-lg w-full text-left animate-scale-in flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">새 프로젝트 등록</h3>
              {generatedCode && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 rounded-full border border-sky-500/10">
                  <Hash className="w-3.5 h-3.5 text-toss-blue" />
                  <span className="text-xs font-extrabold text-toss-blue font-mono tracking-widest">{generatedCode}</span>
                </div>
              )}
            </div>
            
            <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
              
              {/* ─── Project Code Section ─── */}
              <div className="bg-gray-50/50 dark:bg-slate-950/45 rounded-2xl p-4 flex flex-col gap-3.5 border border-gray-100 dark:border-slate-800/40">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-toss-blue" />
                  <span className="text-xs font-bold text-toss-gray-700 dark:text-slate-300">프로젝트 코드 설정</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Region Code */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 지역 코드
                    </label>
                    <CustomSelect
                      value={regionCode}
                      onChange={(e) => setRegionCode(e.target.value)}
                      required
                      className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                    >
                      <option value="">선택</option>
                      {REGION_CODES.map(r => (
                        <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                      ))}
                    </CustomSelect>
                  </div>

                  {/* Project Type */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> 프로젝트 유형
                    </label>
                    <CustomSelect
                      value={typeCode}
                      onChange={(e) => setTypeCode(e.target.value)}
                      className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                    >
                      <option value="">선택 (선택사항)</option>
                      {PROJECT_TYPE_CODES.map(t => (
                        <option key={t.code} value={t.code}>{t.code} - {t.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                </div>

                {/* Code Preview */}
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-0.5 text-xs font-bold text-toss-gray-500 dark:text-slate-400">
                    <span className={`px-1.5 py-0.5 rounded ${regionCode ? 'bg-sky-500/10 text-toss-blue' : 'bg-gray-100 dark:bg-slate-850 text-toss-gray-400'} font-mono font-extrabold transition-colors`}>
                      {regionCode || '??'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-extrabold`}>
                      {yearShort}
                    </span>
                    {typeCode && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-extrabold">
                        {typeCode}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded ${regionCode ? 'bg-emerald-500/10 text-emerald-600' : 'bg-toss-gray-200 dark:bg-slate-800 text-toss-gray-400'} font-mono font-extrabold transition-colors`}>
                      {regionCode ? generatedCode.slice(-(generatedCode.length - (regionCode + yearShort + (typeCode || '')).length)) : '???'}
                    </span>
                  </div>
                  <span className="text-[11px] text-toss-gray-400 dark:text-slate-500">
                    = 지역 + 년도{typeCode ? ' + 유형' : ''} + 순번
                  </span>
                </div>
              </div>

              {/* Project Period */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">프로젝트 기간</label>
                <RangeDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  placeholder="프로젝트 일정 선택"
                />
              </div>

              {/* Local Folder path with designated button */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">스캔할 로컬 폴더 경로</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="예: C:\Projects\Hongcheon"
                    required
                    className="toss-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="toss-btn toss-btn-secondary px-4 py-2 text-xs h-[42px]"
                  >
                    폴더 선택
                  </button>
                </div>
                <span className="text-[11px] text-toss-gray-400 leading-tight">
                  ※ 브라우저 데모 모드에서는 <b>"demo"</b> 또는 <b>"C:\Projects\Folder-Atlas-Demo"</b> 입력 시 데모 데이터 구조로 로드됩니다.
                </span>
              </div>

              {/* Select template */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">적용할 폴더 양식 (폴더/서류 자동 생성)</label>
                <CustomSelect
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  required
                  className="toss-input cursor-pointer"
                >
                  <option value="">적용할 폴더 양식 선택</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!regionCode || !name || !path}
                  className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  프로젝트 생성
                </button>
              </div>
            </form>
          </div>
        </div>

      )}

      {/* ─── Edit Project Modal ─── */}
      {editProject && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditProject(null)}>
          <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-7 shadow-toss-lg max-w-md w-full text-left animate-scale-in flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">프로젝트 정보 수정</h3>
              <button onClick={() => setEditProject(null)} className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {/* Project name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">프로젝트 이름</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="toss-input"
                />
              </div>

              {/* Project Period */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">프로젝트 기간</label>
                <RangeDatePicker
                  startDate={editStartDate}
                  endDate={editEndDate}
                  onChange={(start, end) => {
                    setEditStartDate(start);
                    setEditEndDate(end);
                  }}
                  placeholder="프로젝트 일정 선택"
                />
              </div>

              {/* Current Code Display */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">현재 프로젝트 코드</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs px-3.5 py-2.5 bg-gray-50 dark:bg-slate-950/45 border border-gray-100 dark:border-slate-800/40 rounded-xl font-mono font-extrabold text-toss-blue">
                    {editRegionCode ? editGeneratedCode : (editCode || '(없음)')}
                  </div>
                </div>
              </div>

              {/* Recode Section */}
              <div className="bg-gray-50/50 dark:bg-slate-950/45 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100 dark:border-slate-800/40">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-toss-blue" />
                  <span className="text-xs font-bold text-toss-gray-650 dark:text-slate-400">코드 재발급 (선택사항)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 새 지역 코드
                    </label>
                    <CustomSelect
                      value={editRegionCode}
                      onChange={(e) => setEditRegionCode(e.target.value)}
                      className="text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 font-bold cursor-pointer"
                    >
                      <option value="">유지</option>
                      {REGION_CODES.map(r => (
                        <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> 새 유형 코드
                    </label>
                    <CustomSelect
                      value={editTypeCode}
                      onChange={(e) => setEditTypeCode(e.target.value)}
                      disabled={!editRegionCode}
                      className="text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 font-bold cursor-pointer disabled:opacity-50"
                    >
                      <option value="">없음</option>
                      {PROJECT_TYPE_CODES.map(t => (
                        <option key={t.code} value={t.code}>{t.code} - {t.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                </div>
                {editRegionCode && (
                  <p className="text-xs text-toss-blue font-bold">
                    → 새 코드: <span className="font-mono">{editGeneratedCode}</span>로 재발급됩니다
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">프로젝트 상태</label>
                <div className="flex gap-2">
                  {['진행중', '완료'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                        editStatus === s
                          ? s === '완료'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-toss-blue text-white border-toss-blue'
                          : 'bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-500 dark:text-slate-400 border-transparent hover:border-toss-gray-250'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setEditProject(null)}
                  className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!editName}
                  className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─── */}
      {deleteConfirmId && (() => {
        const target = projects.find(p => p.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-7 shadow-toss-lg max-w-sm w-full text-left animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-rose-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">프로젝트 삭제</h3>
                  <p className="text-sm text-toss-gray-500 dark:text-slate-400 font-semibold">
                    <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">{target?.name}</span>을(를) 삭제하시겠습니까?<br />
                    <span className="text-xs mt-1 block">모든 프로세스, 작업, 산출물 데이터가 함께 삭제됩니다.</span>
                  </p>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-2xl cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-3 bg-toss-red hover:bg-rose-600 text-white font-extrabold rounded-2xl cursor-pointer transition-colors"
                  >
                    삭제 확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
