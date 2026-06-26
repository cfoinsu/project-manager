import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  FolderOpen, 
  ShieldCheck, 
  Plus, 
  ChevronRight, 
  ChevronDown,
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
  MoreVertical,
  Search,
  Star,
  LayoutGrid,
  List,
  FileSpreadsheet
} from 'lucide-react';
import type { Project } from '../types';
import { getKoreaRegions, getRegionCodes, PROJECT_TYPE_CODES } from '../types';
import { selectFolderNative, isTauri } from '../utils/tauriBridge';
import { generateProjectCode, getProcesses } from '../utils/db';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { RangeDatePicker } from './RangeDatePicker';
import { CustomSelect } from './CustomSelect';
import { RegionPickerModal } from './RegionPickerModal';
import { ModalOverlay } from './ModalOverlay';
import { ProjectBulkImportModal } from './ProjectBulkImportModal';

type ProjectQuickFilter = 'all' | 'active' | 'pending' | 'completed' | 'important' | 'risk' | 'due';
type ProjectSortMode = 'recent' | 'updated' | 'created' | 'due' | 'health' | 'progress' | 'amount' | 'importance';
type ProjectViewMode = 'card' | 'list';
type ProjectPeriodPreset = 'all' | 'thisMonth' | 'lastMonth' | 'recent3Months' | 'thisYear' | 'custom';
type ProjectAmountFilter = 'all' | 'under10m' | '10to50m' | '50to100m' | 'over100m';
type ProjectHealthFilter = 'all' | 'excellent' | 'normal' | 'risk';

interface ProjectAccessMeta {
  pinnedIds: string[];
  recent: Array<{ id: string; at: number }>;
}

const PROJECT_ACCESS_META_KEY = 'pa_project_access_meta';

const readProjectAccessMeta = (): ProjectAccessMeta => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECT_ACCESS_META_KEY) || '{}');
    return {
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  } catch {
    return { pinnedIds: [], recent: [] };
  }
};

const writeProjectAccessMeta = (meta: ProjectAccessMeta) => {
  localStorage.setItem(PROJECT_ACCESS_META_KEY, JSON.stringify(meta));
};

const dateDistance = (date?: string) => {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.abs(new Date(date).getTime() - Date.now());
};

const toDateInput = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseMoneyAmount = (value?: string) => {
  if (!value) return 0;
  return Number(String(value).replace(/[^\d]/g, '')) || 0;
};

const getImportanceScore = (project: Project) => {
  const importanceRank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const priorityRank: Record<string, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
  return Math.max(importanceRank[project.importance || ''] || 0, priorityRank[project.priority || ''] || 0);
};

const getProjectDDay = (date?: string) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

export const DashboardView: React.FC = () => {
  const REGION_CODES = getRegionCodes();
  const { projects, templates, folderTemplates, addProject, removeProject, updateProjectInfo, selectProject, setView, setPendingTab } = useProjectStore();
  const { user: currentUser, serverMode } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState(0);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectQuickFilter, setProjectQuickFilter] = useState<ProjectQuickFilter>('all');
  const [projectProvinceFilter, setProjectProvinceFilter] = useState('all');
  const [projectSubRegionFilter, setProjectSubRegionFilter] = useState('all');
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [projectPeriodPreset, setProjectPeriodPreset] = useState<ProjectPeriodPreset>('all');
  const [projectPeriodStart, setProjectPeriodStart] = useState('');
  const [projectPeriodEnd, setProjectPeriodEnd] = useState('');
  const [projectManagerFilter, setProjectManagerFilter] = useState('');
  const [projectAmountFilter, setProjectAmountFilter] = useState<ProjectAmountFilter>('all');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all');
  const [projectHealthFilter, setProjectHealthFilter] = useState<ProjectHealthFilter>('all');
  const [projectPriorityFilter, setProjectPriorityFilter] = useState('all');
  const [projectClientFilter, setProjectClientFilter] = useState('');
  const [projectSortMode, setProjectSortMode] = useState<ProjectSortMode>('recent');
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('card');
  const [projectAccessMeta, setProjectAccessMeta] = useState<ProjectAccessMeta>(() => readProjectAccessMeta());
  const [showAllFavoriteProjects, setShowAllFavoriteProjects] = useState(false);
  const regionGroups = useMemo(() => getKoreaRegions(), []);

  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [regionPickerTarget, setRegionPickerTarget] = useState<'create' | 'edit'>('create');
  
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

  const getProjectRegionPath = (project: Project) => {
    const codeMatch = regionGroups
      .flatMap((group) => group.subRegions.map((subRegion) => ({ province: group.name, subRegion })))
      .sort((a, b) => b.subRegion.code.length - a.subRegion.code.length)
      .find((item) => project.code?.startsWith(item.subRegion.code));

    if (codeMatch) {
      return {
        province: codeMatch.province,
        subRegion: codeMatch.subRegion.name,
        subRegionCode: codeMatch.subRegion.code,
      };
    }

    const regionText = project.client_region || '';
    const provinceMatch = regionGroups.find((group) => regionText.includes(group.name));
    if (provinceMatch) {
      const subMatch = provinceMatch.subRegions.find((subRegion) => regionText.includes(subRegion.name));
      return {
        province: provinceMatch.name,
        subRegion: subMatch?.name || '시군 미지정',
        subRegionCode: subMatch?.code || '',
      };
    }

    return { province: '지역 미지정', subRegion: '시군 미지정', subRegionCode: '' };
  };

  const projectPeriodRange = useMemo(() => {
    const today = new Date();
    let start = '';
    let end = '';

    if (projectPeriodPreset === 'thisMonth') {
      start = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
      end = toDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    } else if (projectPeriodPreset === 'lastMonth') {
      start = toDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      end = toDateInput(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (projectPeriodPreset === 'recent3Months') {
      start = toDateInput(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      end = toDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    } else if (projectPeriodPreset === 'thisYear') {
      start = toDateInput(new Date(today.getFullYear(), 0, 1));
      end = toDateInput(new Date(today.getFullYear(), 11, 31));
    } else if (projectPeriodPreset === 'custom') {
      start = projectPeriodStart;
      end = projectPeriodEnd;
    }

    return { start, end };
  }, [projectPeriodEnd, projectPeriodPreset, projectPeriodStart]);

  const isProjectInPeriod = (project: Project) => {
    if (!projectPeriodRange.start && !projectPeriodRange.end) return true;
    if (!project.start_date && !project.end_date) return false;
    const start = project.start_date || project.end_date || '';
    const end = project.end_date || project.start_date || '';
    if (projectPeriodRange.start && end < projectPeriodRange.start) return false;
    if (projectPeriodRange.end && start > projectPeriodRange.end) return false;
    return true;
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

  const recentRankMap = useMemo(() => new Map(projectAccessMeta.recent.map((item, index) => [item.id, index])), [projectAccessMeta.recent]);
  const recentAtMap = useMemo(() => new Map(projectAccessMeta.recent.map((item) => [item.id, item.at])), [projectAccessMeta.recent]);
  const pinnedIdSet = useMemo(() => new Set(projectAccessMeta.pinnedIds), [projectAccessMeta.pinnedIds]);

  const pinnedProjects = useMemo(() => {
    return projectAccessMeta.pinnedIds
      .map((id) => projects.find((project) => project.id === id))
      .filter(Boolean) as Project[];
  }, [projectAccessMeta.pinnedIds, projects]);

  const dueSoonProjects = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 14);
    return projects.filter((project) => {
      if (!project.end_date || project.status === '완료') return false;
      const end = new Date(project.end_date);
      return end >= now && end <= limit;
    });
  }, [projects]);

  const riskProjects = useMemo(() => {
    return projects.filter((project) => project.status !== '완료' && (project.health_score < 70 || project.importance === 'Critical'));
  }, [projects]);

  const regionTreeSummaries = useMemo(() => {
    const provinceCounts = new Map<string, number>();
    const subRegionCounts = new Map<string, Map<string, number>>();
    projects.forEach((project) => {
      const region = getProjectRegionPath(project);
      provinceCounts.set(region.province, (provinceCounts.get(region.province) || 0) + 1);
      const childMap = subRegionCounts.get(region.province) || new Map<string, number>();
      childMap.set(region.subRegion, (childMap.get(region.subRegion) || 0) + 1);
      subRegionCounts.set(region.province, childMap);
    });
    return Array.from(provinceCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        subRegions: Array.from(subRegionCounts.get(name)?.entries() || [])
          .map(([subName, subCount]) => ({ name: subName, count: subCount }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
  }, [projects]);

  const projectTypeOptions = useMemo(() => {
    return Array.from(new Set(projects.map((project) => getProjectTypeName(project.code)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [projects]);

  const quickFilterCounts = useMemo(() => {
    return {
      all: projects.length,
      active: projects.filter((project) => (project.status || '진행중') === '진행중').length,
      pending: projects.filter((project) => (project.status || '진행중') === '대기').length,
      completed: projects.filter((project) => (project.status || '진행중') === '완료').length,
      important: projects.filter((project) => getImportanceScore(project) >= 3).length,
      risk: riskProjects.length,
      due: dueSoonProjects.length,
    } satisfies Record<ProjectQuickFilter, number>;
  }, [dueSoonProjects.length, projects, riskProjects.length]);

  const appliedProjectFilterCount = useMemo(() => {
    return [
      projectSearch.trim(),
      projectQuickFilter !== 'all',
      projectProvinceFilter !== 'all',
      projectSubRegionFilter !== 'all',
      projectPeriodPreset !== 'all',
      projectManagerFilter.trim(),
      projectAmountFilter !== 'all',
      projectTypeFilter !== 'all',
      projectHealthFilter !== 'all',
      projectPriorityFilter !== 'all',
      projectClientFilter.trim(),
    ].filter(Boolean).length;
  }, [projectAmountFilter, projectClientFilter, projectHealthFilter, projectManagerFilter, projectPeriodPreset, projectPriorityFilter, projectProvinceFilter, projectQuickFilter, projectSearch, projectSubRegionFilter, projectTypeFilter]);

  const resetProjectFilters = () => {
    setProjectSearch('');
    setProjectQuickFilter('all');
    setProjectProvinceFilter('all');
    setProjectSubRegionFilter('all');
    setProjectPeriodPreset('all');
    setProjectPeriodStart('');
    setProjectPeriodEnd('');
    setProjectManagerFilter('');
    setProjectAmountFilter('all');
    setProjectTypeFilter('all');
    setProjectHealthFilter('all');
    setProjectPriorityFilter('all');
    setProjectClientFilter('');
  };

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectSearch.trim().toLowerCase();

    return projects
      .filter((project) => {
        const region = getProjectRegionPath(project);
        if (projectProvinceFilter !== 'all' && region.province !== projectProvinceFilter) return false;
        if (projectSubRegionFilter !== 'all' && region.subRegion !== projectSubRegionFilter) return false;
        if (!isProjectInPeriod(project)) return false;

        const status = project.status || '진행중';
        if (projectQuickFilter === 'active' && status !== '진행중') return false;
        if (projectQuickFilter === 'pending' && status !== '대기') return false;
        if (projectQuickFilter === 'completed' && status !== '완료') return false;
        if (projectQuickFilter === 'important' && getImportanceScore(project) < 3) return false;
        if (projectQuickFilter === 'risk' && !riskProjects.some((item) => item.id === project.id)) return false;
        if (projectQuickFilter === 'due' && !dueSoonProjects.some((item) => item.id === project.id)) return false;

        if (projectManagerFilter.trim() && !String(project.client_contact_name || '').toLowerCase().includes(projectManagerFilter.trim().toLowerCase())) return false;
        if (projectClientFilter.trim() && !String(project.client_name || '').toLowerCase().includes(projectClientFilter.trim().toLowerCase())) return false;
        if (projectTypeFilter !== 'all' && getProjectTypeName(project.code) !== projectTypeFilter) return false;
        if (projectPriorityFilter !== 'all' && (project.priority || project.importance || '미지정') !== projectPriorityFilter) return false;

        const health = project.health_score || 0;
        if (projectHealthFilter === 'excellent' && health < 90) return false;
        if (projectHealthFilter === 'normal' && (health < 70 || health >= 90)) return false;
        if (projectHealthFilter === 'risk' && health >= 70) return false;

        const amount = parseMoneyAmount(project.contract_amount);
        if (projectAmountFilter === 'under10m' && amount > 10000000) return false;
        if (projectAmountFilter === '10to50m' && (amount < 10000000 || amount > 50000000)) return false;
        if (projectAmountFilter === '50to100m' && (amount < 50000000 || amount > 100000000)) return false;
        if (projectAmountFilter === 'over100m' && amount < 100000000) return false;

        if (!normalizedQuery) return true;

        const haystack = [
          project.name,
          project.code,
          project.path,
          project.status,
          project.client_name,
          project.client_region,
          project.client_department,
          project.client_contact_name,
          region.province,
          region.subRegion,
          getProjectTypeName(project.code),
        ].filter(Boolean).join(' ').toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (pinnedIdSet.has(a.id) !== pinnedIdSet.has(b.id)) {
          return pinnedIdSet.has(a.id) ? -1 : 1;
        }

        if (projectSortMode === 'recent') {
          return (recentRankMap.get(a.id) ?? 9999) - (recentRankMap.get(b.id) ?? 9999);
        }
        if (projectSortMode === 'updated') {
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        }
        if (projectSortMode === 'due') {
          return dateDistance(a.end_date) - dateDistance(b.end_date);
        }
        if (projectSortMode === 'health') {
          return (a.health_score || 0) - (b.health_score || 0);
        }
        if (projectSortMode === 'progress') {
          return (projectProgressMap[b.id] || 0) - (projectProgressMap[a.id] || 0);
        }
        if (projectSortMode === 'amount') {
          return parseMoneyAmount(b.contract_amount) - parseMoneyAmount(a.contract_amount);
        }
        if (projectSortMode === 'importance') {
          return getImportanceScore(b) - getImportanceScore(a);
        }
        if (projectSortMode === 'created') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [dueSoonProjects, pinnedIdSet, projectAmountFilter, projectClientFilter, projectHealthFilter, projectManagerFilter, projectPriorityFilter, projectProgressMap, projectProvinceFilter, projectQuickFilter, projectSearch, projectSortMode, projectSubRegionFilter, projectTypeFilter, projects, recentRankMap, riskProjects, projectPeriodRange]);


  
  // New Project Form state
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedFolderTemplateId, setSelectedFolderTemplateId] = useState('');
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
  const isManagerLike = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const storageModeLabel = serverMode ? '서버 공유 모드' : '로컬 단독 모드';
  const storageModeSub = serverMode ? getApiBaseUrl() : '이 PC에만 저장됩니다';
  const onboardingItems = [
    {
      label: '저장 모드 확인',
      done: true,
      detail: `${storageModeLabel} - ${storageModeSub}`,
      action: '설정 보기',
      onClick: () => setView('settings'),
    },
    {
      label: '프로세스 템플릿 준비',
      done: templates.length > 0,
      detail: templates.length > 0 ? `${templates.length}개 등록됨` : '프로젝트 단계 표준을 먼저 만들어두면 생성 시간이 줄어듭니다',
      action: '템플릿',
      onClick: () => setView('templates'),
      hidden: !isManagerLike,
    },
    {
      label: '폴더 양식 준비',
      done: folderTemplates.length > 0,
      detail: folderTemplates.length > 0 ? `${folderTemplates.length}개 등록됨` : '표준 폴더와 기본 문서를 자동 생성할 수 있습니다',
      action: '폴더 양식',
      onClick: () => setView('folder_templates'),
      hidden: !isManagerLike,
    },
    {
      label: '첫 프로젝트 등록',
      done: projects.length > 0,
      detail: projects.length > 0 ? `${projects.length}개 프로젝트 운영 중` : '실제 업무 폴더를 연결해 시작하세요',
      action: '새 프로젝트',
      onClick: () => setModalOpen(true),
    },
    {
      label: '나의 업무 확인',
      done: projects.length > 0,
      detail: '담당 작업, 회의, 개인 투두를 하루 업무판으로 모읍니다',
      action: '열기',
      onClick: () => setView('my_work'),
    },
  ].filter((item) => !item.hidden);
  const onboardingDoneCount = onboardingItems.filter((item) => item.done).length;
  const createSteps = [
    { title: '기본 정보', ready: Boolean(regionCode && name) },
    { title: '폴더 연결', ready: Boolean(path) },
    { title: '양식 선택', ready: true },
    { title: '생성 확인', ready: Boolean(regionCode && name && path) },
  ];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !path || !regionCode) return;
    
    try {
    const code = generatedCode;
    const project = await addProject(
      name, 
      path, 
      code, 
      selectedTemplateId || undefined, 
      selectedFolderTemplateId || undefined, 
      startDate, 
      endDate
    );

    if (selectedFolderTemplateId) {
      if (isTauri()) {
        alert(`프로젝트가 생성되었습니다!\n폴더 구조와 연동된 문서 양식이 아래 경로에 물리적으로 배포 완료되었습니다:\n${path}`);
      } else {
        alert(`프로젝트가 생성되었습니다!\n\n⚠️ 웹 브라우저 모드 안내:\n물리적인 로컬 폴더 및 파일 작성은 PC 로컬 자원에 접근할 수 있는 '데스크톱 앱' 버전에서만 가능합니다. 현재 웹 브라우저 환경이므로 DB 상의 프로젝트 구조만 자동 설정되었습니다.`);
      }
    } else {
      alert(`프로젝트가 생성되었습니다!`);
    }

    setName('');
    setPath('');
    setSelectedTemplateId('');
    setSelectedFolderTemplateId('');
    setRegionCode('');
    setTypeCode('');
    setStartDate('');
    setEndDate('');
    setModalOpen(false);
    
    // Select the new project and view overview
    setProjectAccessMeta(prev => {
      const next: ProjectAccessMeta = {
        pinnedIds: prev.pinnedIds,
        recent: [
          { id: project.id, at: Date.now() },
          ...prev.recent.filter((item) => item.id !== project.id),
        ].slice(0, 12),
      };
      writeProjectAccessMeta(next);
      return next;
    });
    selectProject(project);
    setView('projects_overview');
    } catch (error: any) {
      alert(error.message || '프로젝트 생성에 실패했습니다.');
    }
  };

  const handleSelectRecent = (project: Project) => {
    if (openMenuId) return; // 메뉴 열린 상태에서는 클릭 무시
    setProjectAccessMeta(prev => {
      const next: ProjectAccessMeta = {
        pinnedIds: prev.pinnedIds,
        recent: [
          { id: project.id, at: Date.now() },
          ...prev.recent.filter((item) => item.id !== project.id),
        ].slice(0, 12),
      };
      writeProjectAccessMeta(next);
      return next;
    });
    selectProject(project);
    setView('projects_overview');
  };

  const handleTogglePinProject = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    setProjectAccessMeta(prev => {
      const pinned = prev.pinnedIds.includes(project.id)
        ? prev.pinnedIds.filter((id) => id !== project.id)
        : [project.id, ...prev.pinnedIds].slice(0, 12);
      const next = { ...prev, pinnedIds: pinned };
      writeProjectAccessMeta(next);
      return next;
    });
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
      setSelectedFolderTemplateId('');
      setRegionCode('');
      setTypeCode('');
      setStartDate('');
      setEndDate('');
      setCreateStep(0);
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
          <span className="mt-1 inline-flex w-fit rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-black text-slate-500 dark:text-slate-400">
            {storageModeLabel}
          </span>
          <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">전체 대시보드</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {isManagerLike && (
            <button
              onClick={() => setShowBulkImport(true)}
              className="toss-btn toss-btn-secondary px-4 py-3 rounded-2xl flex items-center gap-1.5 font-bold cursor-pointer hover:shadow transition-all active:scale-95"
              title="엑셀 양식으로 여러 프로젝트를 한 번에 등록"
            >
              <FileSpreadsheet className="w-4.5 h-4.5" />
              <span>엑셀 일괄 등록</span>
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="toss-btn toss-btn-primary px-5 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-md cursor-pointer hover:shadow-lg transition-all active:scale-95 animate-scale-in"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>새 프로젝트 등록</span>
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-toss-blue" />
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">처음 시작하기</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-toss-blue text-[10px] font-black">
                {onboardingDoneCount}/{onboardingItems.length}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              표준을 먼저 잡고, 실제 폴더를 연결한 뒤, 나의 업무에서 하루 작업을 처리하는 흐름입니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-2 rounded-xl text-xs font-black border ${
              serverMode
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900'
            }`}>
              {storageModeLabel}
            </span>
            <button onClick={() => setView('settings')} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-500 hover:text-toss-blue cursor-pointer">
              저장 설정
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          {onboardingItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`min-h-[92px] rounded-xl border p-3 text-left transition-all cursor-pointer ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/15'
                  : 'border-slate-200 bg-slate-50/70 hover:border-toss-blue dark:border-slate-800 dark:bg-slate-850/40'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{item.label}</span>
                {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </span>
              <span className="mt-2 block text-[11px] leading-relaxed font-bold text-slate-500 dark:text-slate-400">{item.detail}</span>
              <span className="mt-2 inline-flex text-[11px] font-black text-toss-blue">{item.action}</span>
            </button>
          ))}
        </div>
      </section>

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

      {/* ━━━ 메인 레이아웃 ━━━ */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start flex-1 min-h-0">

        <div className="toss-card grid grid-cols-1 2xl:grid-cols-[270px_minmax(0,1fr)] gap-0 overflow-hidden p-0">

        {/* ─── 왼쪽: 지역 탐색 ─── */}
        <div className="flex flex-col gap-4 p-4 min-w-0 border-b 2xl:border-b-0 2xl:border-r border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-toss-gray-900 dark:text-slate-100">지역별 보기</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">도 단위에서 시군으로 좁혀 탐색합니다.</p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-2">
            <button
              onClick={() => {
                setProjectProvinceFilter('all');
                setProjectSubRegionFilter('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${projectProvinceFilter === 'all' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <span>전체 프로젝트</span>
              <span>{projects.length}</span>
            </button>
            <div className="mt-1 flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-1">
              {regionTreeSummaries.map(region => (
                <div key={region.name}>
                  <button
                    onClick={() => {
                      setProjectProvinceFilter(region.name);
                      setProjectSubRegionFilter('all');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${projectProvinceFilter === region.name && projectSubRegionFilter === 'all' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-500 hover:bg-white/70 dark:hover:bg-slate-900/70 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span className="truncate">{region.name}</span>
                    <span className="shrink-0">{region.count}</span>
                  </button>
                  {projectProvinceFilter === region.name && (
                    <div className="mt-1 ml-3 flex flex-col gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                      {region.subRegions.map(subRegion => (
                        <button
                          key={subRegion.name}
                          onClick={() => setProjectSubRegionFilter(subRegion.name)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${projectSubRegionFilter === subRegion.name ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                          <span className="truncate">{subRegion.name}</span>
                          <span className="shrink-0">{subRegion.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold text-amber-600 mb-2">
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> 즐겨찾기 프로젝트
              </span>
              <span>{pinnedProjects.length}</span>
            </div>
            {pinnedProjects.length === 0 ? (
              <p className="text-[11px] font-bold text-amber-600/70 py-2">카드의 별을 눌러 자주 보는 프로젝트를 모아보세요.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {(showAllFavoriteProjects ? pinnedProjects : pinnedProjects.slice(0, 5)).map(project => (
                  <button key={project.id} onClick={() => handleSelectRecent(project)} className="rounded-xl px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-white/70 hover:text-toss-blue dark:text-slate-200 dark:hover:bg-slate-900/60">
                    <span className="block truncate">★ {project.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-extrabold text-slate-400">
                      {project.code || '코드 없음'} · {getProjectTypeName(project.code)}
                    </span>
                  </button>
                ))}
                {pinnedProjects.length > 5 && (
                  <button onClick={() => setShowAllFavoriteProjects((value) => !value)} className="mt-1 text-left text-[11px] font-extrabold text-amber-600 hover:text-amber-700">
                    {showAllFavoriteProjects ? '접기' : '전체 보기'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-3">
            <div className="text-[11px] font-extrabold text-slate-500 mb-2">전체 요약</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400">진행중</p>
                <p className="text-lg font-black text-toss-blue">{quickFilterCounts.active}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">위험</p>
                <p className="text-lg font-black text-rose-500">{quickFilterCounts.risk}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">마감임박</p>
                <p className="text-lg font-black text-orange-500">{quickFilterCounts.due}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">완료</p>
                <p className="text-lg font-black text-emerald-500">{quickFilterCounts.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 가운데: 프로젝트 목록 ─── */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-toss-gray-800 dark:text-slate-200">
                  프로젝트 목록
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  {filteredProjects.length}개 표시 / 전체 {projects.length}개
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-toss-gray-100 dark:bg-slate-800/80 p-1 rounded-xl select-none">
                  <button
                    onClick={() => setProjectViewMode('card')}
                    className={`p-2 rounded-lg cursor-pointer ${projectViewMode === 'card' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-400'}`}
                    title="카드 보기"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setProjectViewMode('list')}
                    className={`p-2 rounded-lg cursor-pointer ${projectViewMode === 'list' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-400'}`}
                    title="리스트 보기"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <select value={projectSortMode} onChange={(event) => setProjectSortMode(event.target.value as ProjectSortMode)} className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-xs font-extrabold text-slate-600 dark:text-slate-300 outline-none">
                  <option value="recent">최근 접근순</option>
                  <option value="updated">최근 수정순</option>
                  <option value="created">최근 생성순</option>
                  <option value="due">마감일 가까운 순</option>
                  <option value="health">건강도 낮은 순</option>
                  <option value="progress">진행률 높은 순</option>
                  <option value="amount">계약금액 높은 순</option>
                  <option value="importance">중요도 높은 순</option>
                </select>
                <button
                  onClick={() => setAdvancedFilterOpen((value) => !value)}
                  className={`h-10 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${advancedFilterOpen ? 'bg-toss-blue text-white border-toss-blue shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-toss-blue'}`}
                >
                  고급 필터
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="프로젝트명, 코드, 발주처 검색"
                className="w-full h-12 pl-11 pr-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-sm font-bold outline-none focus:border-toss-blue/50"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', `전체 ${quickFilterCounts.all}`],
                ['active', `진행중 ${quickFilterCounts.active}`],
                ['pending', `대기 ${quickFilterCounts.pending}`],
                ['completed', `완료 ${quickFilterCounts.completed}`],
                ['important', `중요 ${quickFilterCounts.important}`],
                ['risk', `위험 ${quickFilterCounts.risk}`],
                ['due', `마감임박 ${quickFilterCounts.due}`],
              ] as Array<[ProjectQuickFilter, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setProjectQuickFilter(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${projectQuickFilter === key ? 'bg-toss-blue text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {appliedProjectFilterCount > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-400 mr-1">적용 필터:</span>
                {projectProvinceFilter !== 'all' && (
                  <button onClick={() => { setProjectProvinceFilter('all'); setProjectSubRegionFilter('all'); }} className="px-2.5 py-1 rounded-full bg-sky-50 text-toss-blue border border-sky-100 text-[11px] font-extrabold"> {projectProvinceFilter} ×</button>
                )}
                {projectSubRegionFilter !== 'all' && (
                  <button onClick={() => setProjectSubRegionFilter('all')} className="px-2.5 py-1 rounded-full bg-sky-50 text-toss-blue border border-sky-100 text-[11px] font-extrabold"> {projectSubRegionFilter} ×</button>
                )}
                {projectQuickFilter !== 'all' && (
                  <button onClick={() => setProjectQuickFilter('all')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">빠른 필터 ×</button>
                )}
                {projectSearch.trim() && (
                  <button onClick={() => setProjectSearch('')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">검색어 ×</button>
                )}
                {projectPeriodPreset !== 'all' && (
                  <button onClick={() => { setProjectPeriodPreset('all'); setProjectPeriodStart(''); setProjectPeriodEnd(''); }} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">기간 ×</button>
                )}
                {projectManagerFilter.trim() && <button onClick={() => setProjectManagerFilter('')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">담당자 ×</button>}
                {projectAmountFilter !== 'all' && <button onClick={() => setProjectAmountFilter('all')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">금액 ×</button>}
                {projectTypeFilter !== 'all' && <button onClick={() => setProjectTypeFilter('all')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">유형 ×</button>}
                {projectHealthFilter !== 'all' && <button onClick={() => setProjectHealthFilter('all')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">건강도 ×</button>}
                {projectPriorityFilter !== 'all' && <button onClick={() => setProjectPriorityFilter('all')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">우선순위 ×</button>}
                {projectClientFilter.trim() && <button onClick={() => setProjectClientFilter('')} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-extrabold">발주처 ×</button>}
                {appliedProjectFilterCount >= 2 && (
                  <button onClick={resetProjectFilters} className="ml-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[11px] font-extrabold">필터 초기화</button>
                )}
              </div>
            ) : (
              <p className="text-[11px] font-bold text-slate-400">전체 프로젝트 표시 중</p>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="toss-card flex flex-col items-center justify-center py-16 text-center bg-white/70 dark:bg-slate-900/70 border border-dashed border-gray-200 dark:border-slate-800 gap-3">
              <FolderOpen className="w-12 h-12 text-toss-gray-300" />
              <p className="text-sm font-semibold text-toss-gray-455 dark:text-slate-400">등록된 프로젝트가 없습니다.</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="toss-card flex flex-col items-center justify-center py-10 text-center border border-dashed border-gray-200 dark:border-slate-800 gap-2">
              <FolderOpen className="w-8 h-8 text-toss-gray-300" />
              <p className="text-xs font-semibold text-slate-400">현재 검색/필터 조건에 맞는 프로젝트가 없습니다.</p>
            </div>
          ) : projectViewMode === 'card' ? (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
              {filteredProjects.map((proj) => {
                const isCompleted = proj.status === '완료';
                const isPending = proj.status === '대기';
                const typeName = getProjectTypeName(proj.code);
                const progressPercent = projectProgressMap[proj.id] || 0;
                const isPinned = pinnedIdSet.has(proj.id);
                const isRisk = proj.status !== '완료' && (proj.health_score < 70 || proj.importance === 'Critical');
                const dDay = getProjectDDay(proj.end_date);
                const isDueSoon = dDay !== null && dDay >= 0 && dDay <= 14 && proj.status !== '완료';
                const healthTone = proj.health_score >= 90
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                  : proj.health_score >= 70
                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : 'text-rose-600 bg-rose-50 border-rose-200';
                const statusTone = isCompleted
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                  : isPending
                  ? 'text-slate-500 bg-slate-100 border-slate-200'
                  : 'text-toss-blue bg-sky-50 border-sky-200';
                const progressTone = isCompleted ? 'bg-emerald-500' : isPending ? 'bg-slate-300' : 'bg-toss-blue';

                return (
                  <div
                    key={proj.id}
                    onClick={() => handleSelectRecent(proj)}
                    className={`toss-card p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${isRisk ? 'border-l-4 border-l-rose-500' : ''} ${isCompleted ? 'opacity-80' : isPending ? 'opacity-90' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {proj.code && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 font-mono border border-slate-200/50">{proj.code}</span>}
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{proj.name}</h3>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium truncate mt-1">{proj.client_name || proj.path}</p>
                      </div>
                      <button onClick={(event) => handleTogglePinProject(proj, event)} className={`p-1.5 rounded-lg cursor-pointer ${isPinned ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`} title={isPinned ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
                        <Star className={`w-4 h-4 ${isPinned ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold border border-slate-200/40">{typeName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusTone}`}>{isCompleted ? '완료 ✓' : proj.status || '진행중'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${healthTone}`}>{proj.health_score}점</span>
                      {(proj.priority || proj.importance) && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold border border-violet-100">{proj.priority || proj.importance}</span>
                      )}
                      {isDueSoon && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100">D-{dDay}</span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>진행도</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${progressTone}`} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3 text-[11px] font-bold text-slate-400">
                      <span className="truncate">{proj.start_date || '시작일 미정'} ~ {proj.end_date || '종료일 미정'}</span>
                      {recentAtMap.has(proj.id) && <span>최근 열람</span>}
                    </div>
                  </div>
                );
              })}
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
                      <button onClick={(event) => handleTogglePinProject(proj, event)} className={`p-1 rounded-lg cursor-pointer ${pinnedIdSet.has(proj.id) ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} title={pinnedIdSet.has(proj.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
                        <Star className={`w-3.5 h-3.5 ${pinnedIdSet.has(proj.id) ? 'fill-amber-400' : ''}`} />
                      </button>
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
        </div>

        {/* ─── 오른쪽: 3단 스택 ─── */}
        <div className="flex flex-col gap-4 min-w-0">

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


      {/* ─── Advanced Project Filter Modal ─── */}
      {advancedFilterOpen && (
        <ModalOverlay onClose={() => setAdvancedFilterOpen(false)} zIndex={80}>
          <div
            className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-toss-lg max-w-3xl w-full text-left animate-scale-in flex flex-col gap-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">고급 필터</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">필요할 때만 세부 조건을 조합해 프로젝트를 좁힙니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedFilterOpen(false)}
                className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 transition-colors cursor-pointer"
                aria-label="고급 필터 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">기간</span>
                <CustomSelect
                  value={projectPeriodPreset}
                  onChange={(event) => setProjectPeriodPreset(event.target.value as ProjectPeriodPreset)}
                  className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                >
                  <option value="all">전체 기간</option>
                  <option value="thisMonth">이번 달</option>
                  <option value="lastMonth">지난 달</option>
                  <option value="recent3Months">최근 3개월</option>
                  <option value="thisYear">올해</option>
                  <option value="custom">직접 선택</option>
                </CustomSelect>
              </label>

              {projectPeriodPreset === 'custom' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">직접 선택 기간</span>
                  <RangeDatePicker
                    startDate={projectPeriodStart}
                    endDate={projectPeriodEnd}
                    onChange={(start, end) => {
                      setProjectPeriodStart(start);
                      setProjectPeriodEnd(end);
                    }}
                    placeholder="시작일 ~ 종료일"
                    className="w-full"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">담당자</span>
                <input
                  value={projectManagerFilter}
                  onChange={(event) => setProjectManagerFilter(event.target.value)}
                  placeholder="담당자명"
                  className="toss-input text-xs"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">계약금액</span>
                <CustomSelect
                  value={projectAmountFilter}
                  onChange={(event) => setProjectAmountFilter(event.target.value as ProjectAmountFilter)}
                  className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                >
                  <option value="all">전체 금액</option>
                  <option value="under10m">1천만원 이하</option>
                  <option value="10to50m">1천만원 ~ 5천만원</option>
                  <option value="50to100m">5천만원 ~ 1억원</option>
                  <option value="over100m">1억원 이상</option>
                </CustomSelect>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">프로젝트 유형</span>
                <CustomSelect
                  value={projectTypeFilter}
                  onChange={(event) => setProjectTypeFilter(event.target.value)}
                  className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                >
                  <option value="all">전체 유형</option>
                  {projectTypeOptions.map((typeName) => <option key={typeName} value={typeName}>{typeName}</option>)}
                </CustomSelect>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">건강도</span>
                <CustomSelect
                  value={projectHealthFilter}
                  onChange={(event) => setProjectHealthFilter(event.target.value as ProjectHealthFilter)}
                  className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                >
                  <option value="all">전체</option>
                  <option value="excellent">우수</option>
                  <option value="normal">보통</option>
                  <option value="risk">위험</option>
                </CustomSelect>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">우선순위</span>
                <CustomSelect
                  value={projectPriorityFilter}
                  onChange={(event) => setProjectPriorityFilter(event.target.value)}
                  className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer"
                >
                  <option value="all">전체 우선순위</option>
                  {['P1', 'P2', 'P3', 'P4', 'Critical', 'High', 'Medium', 'Low'].map((value) => <option key={value} value={value}>{value}</option>)}
                </CustomSelect>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">발주처</span>
                <input
                  value={projectClientFilter}
                  onChange={(event) => setProjectClientFilter(event.target.value)}
                  placeholder="발주처명"
                  className="toss-input text-xs"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetProjectFilters}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                필터 초기화
              </button>
              <button
                type="button"
                onClick={() => setAdvancedFilterOpen(false)}
                className="toss-btn toss-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold"
              >
                적용하기
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}


      {/* ─── 엑셀 일괄 등록 모달 ─── */}
      {showBulkImport && (
        <ProjectBulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={(count) => {
            setBulkToast(`${count}개 프로젝트가 일괄 등록되었습니다.`);
            window.setTimeout(() => setBulkToast(null), 3500);
          }}
        />
      )}

      {/* 일괄 등록 토스트 */}
      {bulkToast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl shadow-xl flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {bulkToast}
        </div>
      )}

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
            
            <div className="grid grid-cols-4 gap-1.5">
              {createSteps.map((step, index) => {
                const active = createStep === index;
                const done = step.ready && index < createStep;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => setCreateStep(index)}
                    className={`rounded-xl border px-2 py-2 text-left transition-all cursor-pointer ${
                      active
                        ? 'border-toss-blue bg-blue-50 dark:bg-blue-950/30 text-toss-blue'
                        : done
                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="block text-[10px] font-black">STEP {index + 1}</span>
                    <span className="mt-0.5 block text-[11px] font-black truncate">{step.title}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col gap-4 overflow-y-auto max-h-[75vh] pr-1.5 scrollbar-thin">
              
              {/* ─── 1. Project Code Section ─── */}
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
                    <button
                      type="button"
                      onClick={() => {
                        setRegionPickerTarget('create');
                        setIsRegionPickerOpen(true);
                      }}
                      className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer flex items-center justify-between text-toss-gray-800 dark:text-slate-355 hover:bg-gray-50/50 dark:hover:bg-slate-800/80 text-left h-[38px]"
                    >
                      <span className="truncate">
                        {regionCode 
                          ? `${REGION_CODES.find(r => r.code === regionCode)?.name || regionCode} (${regionCode})`
                          : '선택'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-toss-gray-400 shrink-0" />
                    </button>
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

              {/* ─── 2. Project Name ─── */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">프로젝트 명</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="프로젝트명을 입력해 주세요"
                  required
                  className="toss-input text-xs"
                />
              </div>

              {/* ─── 3. Project Period ─── */}
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

              {/* ─── 4. Folder Path ─── */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">스캔할 로컬 폴더 경로</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="예: C:\Projects\Hongcheon"
                    required
                    className="toss-input flex-1 text-xs"
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

              {/* ─── 5. Folder Template ─── */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">적용할 폴더 양식 (폴더/서류 자동 생성)</label>
                <CustomSelect
                  value={selectedFolderTemplateId}
                  onChange={(e) => setSelectedFolderTemplateId(e.target.value)}
                  className="toss-input cursor-pointer text-xs"
                >
                  <option value="">적용할 폴더 양식 선택 (선택사항)</option>
                  {folderTemplates.map(ft => (
                    <option key={ft.id} value={ft.id}>{ft.name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* ─── 6. Process Template ─── */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">적용할 프로세스 템플릿 (공정 및 일정 연동)</label>
                <CustomSelect
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="toss-input cursor-pointer text-xs"
                >
                  <option value="">적용할 프로세스 템플릿 선택 (선택사항)</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </CustomSelect>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">현재 단계: {createSteps[createStep]?.title}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                      {generatedCode || '코드 미정'} · {name || '프로젝트명 미입력'} · {path || '폴더 미연결'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${regionCode && name && path ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {regionCode && name && path ? '생성 가능' : '필수값 필요'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span>폴더 양식: {selectedFolderTemplateId ? folderTemplates.find((item) => item.id === selectedFolderTemplateId)?.name || '선택됨' : '없음'}</span>
                  <span>프로세스 템플릿: {selectedTemplateId ? templates.find((item) => item.id === selectedTemplateId)?.name || '선택됨' : '없음'}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => createStep === 0 ? setModalOpen(false) : setCreateStep((step) => Math.max(0, step - 1))}
                  className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type={createStep < createSteps.length - 1 ? 'button' : 'submit'}
                  onClick={() => {
                    if (createStep < createSteps.length - 1) {
                      setCreateStep((step) => Math.min(createSteps.length - 1, step + 1));
                    }
                  }}
                  disabled={createStep === 0 ? !createSteps[0].ready : createStep === createSteps.length - 1 ? (!regionCode || !name || !path) : false}
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
                    <button
                      type="button"
                      onClick={() => {
                        setRegionPickerTarget('edit');
                        setIsRegionPickerOpen(true);
                      }}
                      className="text-xs px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all font-bold cursor-pointer flex items-center justify-between text-toss-gray-800 dark:text-slate-355 hover:bg-gray-50/50 dark:hover:bg-slate-800/80 text-left h-[38px]"
                    >
                      <span className="truncate">
                        {editRegionCode 
                          ? `${REGION_CODES.find(r => r.code === editRegionCode)?.name || editRegionCode} (${editRegionCode})`
                          : '유지'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-toss-gray-400 shrink-0" />
                    </button>
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

      <RegionPickerModal
        isOpen={isRegionPickerOpen}
        onClose={() => setIsRegionPickerOpen(false)}
        onSelect={(code) => {
          if (regionPickerTarget === 'create') {
            setRegionCode(code);
          } else {
            setEditRegionCode(code);
          }
        }}
      />
    </div>
  );
};
