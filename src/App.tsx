import { useState, useEffect, useMemo } from 'react';
import type { Assignment, FolderNode, Meeting, Project } from './types';
import { getKoreaRegions } from './types';
import { useProjectStore } from './store/projectStore';
import { openInExplorer } from './utils/tauriBridge';
import { useAuthStore } from './store/authStore';
import { useBrandStore } from './store/brandStore';

// Existing Folder Atlas components
import { FolderTree } from './components/FolderTree';
import { MindmapView } from './components/MindmapView';
import { TreemapView } from './components/TreemapView';
import { FolderDetails } from './components/FolderDetails';
import { DashboardStats } from './components/DashboardStats';

// New Project Atlas components
import { DashboardView } from './components/DashboardView';
import { ProjectOverview } from './components/ProjectOverview';
import { ProcessManagement } from './components/ProcessManagement';
import { TaskManagement } from './components/TaskManagement';
import { DocumentManagement } from './components/DocumentManagement';
import { ProjectAnalysis } from './components/ProjectAnalysis';
import { ProjectIssuesView } from './components/ProjectIssuesView';
import { ProjectDesignView } from './components/ProjectDesignView';
import { ReportGeneration } from './components/ReportGeneration';
import { TemplateManagement } from './components/TemplateManagement';
import { FolderTemplateManagement } from './components/FolderTemplateManagement';
import { SettingsView } from './components/SettingsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';

// Auth and User Views
import { LoginView } from './components/LoginView';
import { ForcePasswordChangeView } from './components/ForcePasswordChangeView';
import { UserManagementView } from './components/UserManagementView';
import { AssignmentManagementView } from './components/AssignmentManagementView';
import { ProjectScheduleCalendarView } from './components/ProjectScheduleCalendarView';
import { DocumentLibraryView } from './components/DocumentLibraryView';
import { MeetingsView } from './components/MeetingsView';
import { MyWorkView } from './components/MyWorkView';

import { getAssignments, migrateComments, syncGlobalServerUrl } from './utils/api';
import { getMeetings } from './utils/collaborationApi';
import { PROJECT_RISK_UPDATED_EVENT, readProjectRisksByProjectId, type ProjectRiskItem } from './utils/projectRiskStore';
import { Avatar } from './components/Avatar';
import { FullscreenLoadingOverlay } from './components/ModalOverlay';
import { ProjectHeaderActivityList, type ProjectHeaderActivityItem } from './components/ProjectHeaderActivityList';

import {
  Search,
  Moon,
  Sun,
  LayoutDashboard,
  Calendar,
  FolderOpen,
  Settings,
  Activity,
  ClipboardList,
  Users,
  UserCheck,
  Library,
  LogOut,
  UserCog,
  Bell,
  ChevronDown,
  MoreHorizontal,
  MapPin
} from 'lucide-react';

function App() {
  const { user: currentUser, isLoggedIn, checkSession, logout, serverMode, loading: authLoading } = useAuthStore();
  const brand = useBrandStore();

  useEffect(() => {
    checkSession();
  }, []);

  // 서버 세션 만료/무효(가짜 토큰·만료 JWT 등) 시 안내 토스트 표시.
  // api.ts 의 assertAuthorized 가 자동 로그아웃 후 이 이벤트를 발생시킨다 → 로그인 화면으로 전환됨.
  useEffect(() => {
    const onSessionExpired = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message
        || '세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.';
      const toast = document.createElement('div');
      toast.textContent = `⚠️ ${message}`;
      toast.style.cssText = `
        position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
        background: #b91c1c; color: #fff; padding: 14px 22px;
        border-radius: 12px; font-size: 14px; font-weight: 700;
        z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        max-width: 520px; text-align: center;
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
      }, 4000);
    };
    window.addEventListener('pa:session-expired', onSessionExpired);
    return () => window.removeEventListener('pa:session-expired', onSessionExpired);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const bindNavigationEvent = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('navigate', (event) => {
          if (event.payload) {
            useProjectStore.getState().setView(event.payload);
          }
        });
      } catch {
        // Browser mode has no Tauri event bus.
      }
    };
    bindNavigationEvent();
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    syncGlobalServerUrl().finally(() => {
      useBrandStore.getState().loadFromServer();
    });
  }, [isLoggedIn]);

  const { 
    projects, 
    activeProject, 
    currentView, 
    loading, 
    rootNode, 
    tasks,
    loadProjects, 
    loadTemplates,
    selectProject, 
    setView,
    scanAndSync
  } = useProjectStore();

  const [activeNode, setActiveNode] = useState<FolderNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [isSidebarProjectPickerOpen, setIsSidebarProjectPickerOpen] = useState(false);
  const [isProjectMoreOpen, setIsProjectMoreOpen] = useState(false);
  const [isProjectPeopleOpen, setIsProjectPeopleOpen] = useState(false);
  const [isProjectActivityOpen, setIsProjectActivityOpen] = useState(false);
  const [projectAssignments, setProjectAssignments] = useState<Assignment[]>([]);
  const [projectMeetings, setProjectMeetings] = useState<Meeting[]>([]);
  const [projectRisks, setProjectRisks] = useState<ProjectRiskItem[]>([]);
  const [sidebarProjectRegion, setSidebarProjectRegion] = useState('all');
  const [switcherProjectRegion, setSwitcherProjectRegion] = useState('all');
  
  // Local tab state for the Folder Structure view ('tree' | 'stats' | 'mindmap' | 'treemap')
  const [structureTab, setStructureTab] = useState<'tree' | 'stats' | 'mindmap' | 'treemap'>('tree');
  const projectContextViews = [
    'projects_overview',
    'projects_process',
    'projects_tasks',
    'projects_issues',
    'projects_documents',
    'projects_design',
    'projects_structure',
    'projects_meetings',
    'projects_calendar',
    'projects_reports',
    'projects_analysis'
  ];
  const projectTabs = [
    { label: '개요', view: 'projects_overview' },
    { label: '일정', view: 'projects_calendar' },
    { label: '프로세스', view: 'projects_process', managerOnly: true },
    { label: '작업', view: 'projects_tasks' },
    { label: '이슈', view: 'projects_issues' },
    { label: '디자인', view: 'projects_design' },
    { label: '회의', view: 'projects_meetings' },
    { label: '폴더', view: 'projects_structure' },
    { label: '분석', view: 'projects_analysis' },
    { label: '보고서', view: 'projects_reports' }
  ].filter((tab) => !tab.managerOnly || currentUser?.role !== 'member');
  const showProjectHeader = Boolean(activeProject && projectContextViews.includes(currentView));
  const koreaRegionGroups = useMemo(() => getKoreaRegions(), []);

  const getProjectRegionPath = (project: Project) => {
    const codeMatch = koreaRegionGroups
      .flatMap((group) => group.subRegions.map((subRegion) => ({ province: group.name, subRegion })))
      .sort((a, b) => b.subRegion.code.length - a.subRegion.code.length)
      .find((item) => project.code?.startsWith(item.subRegion.code));

    if (codeMatch) {
      return {
        province: codeMatch.province,
        subRegion: codeMatch.subRegion.name,
      };
    }

    const regionText = project.client_region || '';
    const provinceMatch = koreaRegionGroups.find((group) => regionText.includes(group.name));
    if (provinceMatch) {
      const subMatch = provinceMatch.subRegions.find((subRegion) => regionText.includes(subRegion.name));
      return {
        province: provinceMatch.name,
        subRegion: subMatch?.name || '시군 미지정',
      };
    }

    return { province: '지역 미지정', subRegion: '시군 미지정' };
  };

  const projectRegionSummaries = useMemo(() => {
    const provinceCounts = new Map<string, number>();
    projects.forEach((project) => {
      const region = getProjectRegionPath(project);
      provinceCounts.set(region.province, (provinceCounts.get(region.province) || 0) + 1);
    });

    return Array.from(provinceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
  }, [projects, koreaRegionGroups]);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Sync dark mode class on body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Load initial projects & templates + 댓글 데이터 마이그레이션
  useEffect(() => {
    migrateComments();
    loadProjects();
    loadTemplates();
  }, []);

  // Update activeNode whenever rootNode changes (e.g. after sync scan)
  useEffect(() => {
    if (rootNode) {
      setActiveNode(rootNode);
    }
  }, [rootNode]);

  useEffect(() => {
    if (!activeProject) {
      setProjectAssignments([]);
      setProjectMeetings([]);
      setProjectRisks([]);
      return;
    }

    let cancelled = false;
    const loadHeaderContext = async () => {
      try {
        const [assignmentList, meetingList] = await Promise.all([
          getAssignments(serverMode, currentUser?.role || 'member', currentUser?.id || ''),
          getMeetings(activeProject.id)
        ]);
        if (cancelled) return;
        setProjectAssignments(assignmentList.filter((assignment) => assignment.project_id === activeProject.id));
        setProjectMeetings(meetingList);
        setProjectRisks(readProjectRisksByProjectId(activeProject.id));
      } catch {
        if (cancelled) return;
        setProjectAssignments([]);
        setProjectMeetings([]);
        setProjectRisks([]);
      }
    };

    loadHeaderContext();
    const reloadRisks = () => {
      setProjectRisks(readProjectRisksByProjectId(activeProject.id));
    };
    window.addEventListener(PROJECT_RISK_UPDATED_EVENT, reloadRisks);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECT_RISK_UPDATED_EVENT, reloadRisks);
    };
  }, [activeProject?.id, currentUser?.id, currentUser?.role, serverMode]);

  const closeProjectHeaderPopovers = () => {
    setIsProjectSwitcherOpen(false);
    setIsSidebarProjectPickerOpen(false);
    setIsProjectPeopleOpen(false);
    setIsProjectActivityOpen(false);
    setIsProjectMoreOpen(false);
  };

  useEffect(() => {
    const hasOpenPopover = isProjectSwitcherOpen || isSidebarProjectPickerOpen || isProjectPeopleOpen || isProjectActivityOpen || isProjectMoreOpen;
    if (!hasOpenPopover) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-project-header-popover]')) return;
      closeProjectHeaderPopovers();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isProjectActivityOpen, isProjectMoreOpen, isProjectPeopleOpen, isProjectSwitcherOpen, isSidebarProjectPickerOpen]);

  if (authLoading) {
    return <FullscreenLoadingOverlay message="세션을 확인하는 중입니다." />;
  }

  if (!isLoggedIn) {
    return <LoginView />;
  }

  if (currentUser?.force_password_change === 1) {
    return <ForcePasswordChangeView />;
  }

  const handleOpenFolder = async (path: string) => {
    setOpeningPath(path);
    try {
      await openInExplorer(path);
      showToast(`탐색기에서 폴더를 열었습니다: ${path}`);
    } catch (err) {
      showToast(`폴더 열기 실패: ${err}`);
    } finally {
      setOpeningPath(null);
    }
  };

  const handleOpenProjectInfoEdit = () => {
    setView('projects_overview');
    setIsProjectMoreOpen(false);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('project-overview:open-edit'));
    }, 0);
  };

  const handleSwitchProject = async (project: typeof projects[number]) => {
    await selectProject(project);
    setView('projects_overview');
    closeProjectHeaderPopovers();
  };

  const renderProjectPickerPopover = (
    selectedRegion: string,
    onRegionChange: (region: string) => void,
    className = 'absolute left-0 top-9 z-50'
  ) => {
    const visibleProjects = selectedRegion === 'all'
      ? projects
      : projects.filter((project) => getProjectRegionPath(project).province === selectedRegion);
    const sectionMap = new Map<string, Project[]>();
    visibleProjects.forEach((project) => {
      const region = getProjectRegionPath(project);
      const sectionName = selectedRegion === 'all' ? region.province : region.subRegion;
      sectionMap.set(sectionName, [...(sectionMap.get(sectionName) || []), project]);
    });
    const sections = Array.from(sectionMap.entries())
      .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name, 'ko')) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'ko'));

    return (
      <div data-project-header-popover onClick={(event) => event.stopPropagation()} className={`${className} w-[560px] max-w-[calc(100vw-32px)] max-h-[520px] overflow-hidden rounded-2xl border border-toss-gray-150/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg`}>
        <div className="px-4 py-3 border-b border-toss-gray-100 dark:border-slate-800">
          <p className="text-[11px] font-black text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">지역별 프로젝트 선택</p>
          <p className="mt-1 text-xs font-bold text-toss-gray-600 dark:text-slate-300">왼쪽에서 지역을 선택하고 오른쪽에서 프로젝트를 이동합니다.</p>
        </div>
        <div className="grid grid-cols-[170px_minmax(0,1fr)] min-h-[340px]">
          <div className="border-r border-toss-gray-100 dark:border-slate-800 bg-toss-gray-50/60 dark:bg-slate-900/50 p-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => onRegionChange('all')}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-black cursor-pointer ${
                selectedRegion === 'all' ? 'bg-white dark:bg-slate-950 text-toss-blue shadow-sm' : 'text-toss-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-950/70'
              }`}
            >
              <span>전체 지역</span>
              <span>{projects.length}</span>
            </button>
            <div className="mt-1 flex flex-col gap-1">
              {projectRegionSummaries.map((region) => (
                <button
                  key={region.name}
                  type="button"
                  onClick={() => onRegionChange(region.name)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-black cursor-pointer ${
                    selectedRegion === region.name ? 'bg-white dark:bg-slate-950 text-toss-blue shadow-sm' : 'text-toss-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-950/70'
                  }`}
                >
                  <span className="truncate">{region.name}</span>
                  <span className="shrink-0">{region.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto p-3">
            {sections.length === 0 ? (
              <div className="h-full min-h-[260px] flex items-center justify-center text-xs font-bold text-toss-gray-400">선택한 지역의 프로젝트가 없습니다.</div>
            ) : (
              sections.map((section) => (
                <div key={section.name} className="mb-3 last:mb-0">
                  <div className="px-1.5 pb-1.5 flex items-center justify-between text-[10px] font-black text-toss-gray-400 dark:text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {section.name}
                    </span>
                    <span>{section.items.length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map((project) => {
                      const isCurrentProject = project.id === activeProject?.id;
                      const region = getProjectRegionPath(project);
                      return (
                        <button
                          key={project.id}
                          onClick={() => handleSwitchProject(project)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors cursor-pointer ${
                            isCurrentProject
                              ? 'bg-toss-blue-light/70 text-toss-blue'
                              : 'hover:bg-toss-gray-50 dark:hover:bg-slate-900 text-toss-gray-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              {project.code && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-toss-gray-100 dark:bg-slate-800 text-[10px] font-mono font-black text-toss-gray-500 dark:text-slate-400">
                                  {project.code}
                                </span>
                              )}
                              <p className="text-sm font-black truncate">{project.name}</p>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-toss-gray-400 dark:text-slate-500 truncate">
                              {region.province} · {region.subRegion} · {project.client_name || project.path}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                            isCurrentProject
                              ? 'bg-white/80 text-toss-blue'
                              : 'bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-500 dark:text-slate-400'
                          }`}>
                            {isCurrentProject ? '현재' : project.status || '진행중'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const formatActivityWhen = (value?: string) => {
    if (!value) return '?? ???';
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mi = String(parsed.getMinutes()).padStart(2, '0');
      return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
    }
    return value;
  };

  const projectTaskActivity = Object.values(tasks).flat().slice(-5).reverse().map((task) => {
    const actor = task.assignee_names?.join(', ') || task.assignee || '??? ???';
    return {
      id: `task-${task.id}`,
      tone: 'task',
      label: '??',
      target: task.title,
      action: task.status === '??' ? '?? ??' : '?? ????',
      actor,
      when: formatActivityWhen(task.updated_at || task.created_at)
    };
  });
  const projectMeetingActivity = projectMeetings.slice(-3).reverse().map((meeting) => ({
    id: `meeting-${meeting.id}`,
    tone: 'meeting',
    label: '??',
    target: meeting.title,
    action: '?? ??',
    actor: meeting.attendee_names?.join(', ') || `${meeting.attendees.length}? ?? ??`,
    when: formatActivityWhen(`${meeting.start_date}T${meeting.start_time}`)
  }));
  const projectAssignmentActivity = projectAssignments.slice(-3).reverse().map((assignment) => ({
    id: `assignment-${assignment.id}`,
    tone: 'assignment',
    label: '??',
    target: assignment.role || '?? ???',
    action: `${assignment.allocation_percent}% ??`,
    actor: assignment.user_name || '?? ??',
    when: [assignment.start_date, assignment.end_date].filter(Boolean).join(' ~ ') || '?? ???'
  }));
  const projectRiskActivity = projectRisks.slice(-4).reverse().map((risk) => ({
    id: `risk-${risk.id}`,
    tone: 'risk',
    label: '??',
    target: risk.title,
    action: risk.status === 'resolved' ? '???' : `${risk.level} ???`,
    actor: '?? ??',
    when: formatActivityWhen(risk.created_at)
  }));
  const projectHeaderActivity: ProjectHeaderActivityItem[] = [
    ...projectRiskActivity,
    ...projectTaskActivity,
    ...projectMeetingActivity,
    ...projectAssignmentActivity
  ].slice(0, 8);
  const projectHeaderPeople: Pick<Assignment, 'id' | 'user_name' | 'user_profile_image'>[] = projectAssignments.length
    ? projectAssignments.slice(0, 3)
    : [{
      id: 'me',
      user_name: currentUser?.name || '',
      user_profile_image: currentUser?.profile_image
    }];
  // Render the core active subview
  const renderView = () => {
    // Role-based route protection
    if (currentView === 'users' && currentUser?.role !== 'admin') {
      return <DashboardView />;
    }
    if ((currentView === 'templates' || currentView === 'folder_templates') && currentUser?.role === 'member') {
      return <DashboardView />;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'my_work':
        return <MyWorkView />;
      case 'users':
        return <UserManagementView />;
      case 'assignments':
        return <AssignmentManagementView />;
      case 'doc_library':
        return <DocumentLibraryView />;
      case 'templates':
        return <TemplateManagement />;
      case 'folder_templates':
        return <FolderTemplateManagement />;
      case 'settings':
        return <SettingsView />;
      case 'profile_settings':
        return <ProfileSettingsView />;
      case 'calendar':
        return <ScheduleCalendarView />;
      case 'projects_overview':
        return <ProjectOverview />;
      case 'projects_calendar':
        return <ProjectScheduleCalendarView />;
      case 'projects_meetings':
        return <MeetingsView />;
      case 'projects_process':
        return <ProcessManagement />;
      case 'projects_tasks':
        return <TaskManagement />;
      case 'projects_issues':
        return <ProjectIssuesView />;
      case 'projects_design':
        return <ProjectDesignView />;
      case 'projects_documents':
        return <DocumentManagement />;
      case 'projects_analysis':
        return <ProjectAnalysis />;
      case 'projects_reports':
        return <ReportGeneration />;
      case 'projects_structure':
        return renderStructureView();
      default:
        return <DashboardView />;
    }
  };

  // Render multi-tab Folder Atlas structure visualization
  const renderStructureView = () => {
    if (!rootNode || !activeNode) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-toss-gray-450 dark:text-slate-400 select-none">
          <FolderOpen className="w-12 h-12 text-toss-gray-300 animate-pulse mb-3" />
          <p className="text-sm font-semibold">디렉토리를 스캔하는 중이거나 데이터가 없습니다.</p>
          <button 
            onClick={scanAndSync} 
            className="toss-btn toss-btn-primary px-4 py-2 mt-4 text-xs font-bold rounded-xl"
          >
            지금 동기화 실행
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col gap-6 h-full min-h-0 overflow-hidden">
        
        {/* Structure Sub-tab Pill Navigation */}
        <div className="flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1.5 bg-toss-gray-105 dark:bg-slate-900 p-1 rounded-2xl border border-toss-gray-255 dark:border-slate-800">
            <button
              onClick={() => setStructureTab('tree')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                structureTab === 'tree'
                  ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:hover:text-slate-350'
              }`}
            >
              폴더 트리
            </button>
            <button
              onClick={() => setStructureTab('stats')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                structureTab === 'stats'
                  ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:hover:text-slate-350'
              }`}
            >
              용량 분석
            </button>
            <button
              onClick={() => setStructureTab('mindmap')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                structureTab === 'mindmap'
                  ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:hover:text-slate-350'
              }`}
            >
              마인드맵
            </button>
            <button
              onClick={() => setStructureTab('treemap')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                structureTab === 'treemap'
                  ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
                  : 'text-toss-gray-455 hover:text-toss-gray-800 dark:hover:text-slate-355'
              }`}
            >
              트리맵 (Size)
            </button>
          </div>

          <span className="text-xs font-bold text-toss-gray-400 dark:text-slate-500">
            총 {rootNode.file_count.toLocaleString()}개 파일 및 {rootNode.folder_count.toLocaleString()}개 폴더 스캔됨
          </span>
        </div>

        {/* Tab contents */}
        <div className="flex-1 min-h-0 w-full">
          {structureTab === 'tree' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-0 overflow-hidden text-left">
              <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 lg:col-span-2 flex flex-col h-full min-h-0 overflow-hidden">
                <div className="h-10 border-b border-toss-gray-150 dark:border-slate-800 flex items-center justify-between shrink-0 mb-4 select-none">
                  <span className="text-xs font-extrabold text-toss-gray-400 dark:text-slate-500 uppercase">디렉토리 구조</span>
                  <span className="text-xs font-bold text-toss-gray-500 truncate max-w-[200px]" title={rootNode.path}>{rootNode.name}</span>
                </div>
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  <FolderTree
                    node={rootNode}
                    searchQuery={searchQuery}
                    onNodeSelect={(n) => setActiveNode(n)}
                    selectedNode={activeNode}
                    onShowToast={showToast}
                  />
                </div>
              </div>
              <div className="h-full min-h-0">
                <FolderDetails node={activeNode} onShowToast={showToast} />
              </div>
            </div>
          )}

          {structureTab === 'stats' && (
            <div className="h-full overflow-y-auto pr-1 text-left">
              <DashboardStats activeNode={activeNode} />
            </div>
          )}

          {structureTab === 'mindmap' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-0 overflow-hidden text-left">
              <div className="lg:col-span-2 flex flex-col h-full min-h-0">
                <MindmapView
                  rootNode={rootNode}
                  selectedNode={activeNode}
                  onNodeSelect={(n) => setActiveNode(n)}
                  searchQuery={searchQuery}
                />
              </div>
              <div className="h-full min-h-0">
                <FolderDetails node={activeNode} onShowToast={showToast} />
              </div>
            </div>
          )}

          {structureTab === 'treemap' && (
            <div className="h-full min-h-0">
              <TreemapView
                rootNode={rootNode}
                activeNode={activeNode}
                onNodeSelect={(n) => setActiveNode(n)}
                onShowToast={showToast}
                searchQuery={searchQuery}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen overflow-hidden flex bg-transparent text-toss-gray-900 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* 1. Toss Style Left Sidebar */}
      <aside className="w-64 glass-sidebar flex flex-col py-6 shrink-0 z-40 select-none">
        
        {/* App Branding Logo */}
        <div className="px-6 mb-6 flex items-center gap-2.5 shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm overflow-hidden shrink-0"
            style={{ backgroundColor: brand.logoDataUrl ? 'transparent' : brand.primaryColor + '20' }}
          >
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <Activity className="w-5.5 h-5.5" style={{ color: brand.primaryColor }} />
            )}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-extrabold text-toss-gray-900 dark:text-slate-100 leading-none">{brand.companyName}</span>
            <span className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">{brand.slogan}</span>
          </div>
        </div>

        {/* Project Selector dropdown in Sidebar */}
        {currentUser && (
          <div className="px-5 mb-6 shrink-0 text-left">
            <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">프로젝트</label>
            <div className="relative mt-2" data-project-header-popover>
              <button
                type="button"
                onClick={() => {
                  setIsSidebarProjectPickerOpen((open) => !open);
                  setIsProjectSwitcherOpen(false);
                  setIsProjectPeopleOpen(false);
                  setIsProjectActivityOpen(false);
                  setIsProjectMoreOpen(false);
                }}
                className="w-full rounded-2xl bg-white hover:bg-toss-gray-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-toss-gray-100 dark:border-slate-800 px-3.5 py-3 text-left transition-all cursor-pointer"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-toss-blue shrink-0" />
                    <span className="block text-xs font-black text-toss-gray-800 dark:text-slate-200 truncate">
                      {activeProject ? activeProject.name : '프로젝트 선택'}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-toss-gray-400 shrink-0 transition-transform ${isSidebarProjectPickerOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isSidebarProjectPickerOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" aria-label="프로젝트 선택 닫기" onClick={closeProjectHeaderPopovers} />
                  {renderProjectPickerPopover(sidebarProjectRegion, setSidebarProjectRegion, 'absolute left-0 top-[calc(100%+8px)] z-50')}
                </>
              )}
            </div>
          </div>
        )}

        {/* Navigation Sidebar Menus */}
        <div className="flex-1 flex flex-col gap-6 px-3 overflow-y-auto scrollbar-none text-left">
          
          {/* Global Management Section */}
          <div className="flex flex-col gap-1">
            <span className="px-3 text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Global OS</span>
            
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'dashboard'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>전체 대시보드</span>
            </button>

            <button
              onClick={() => setView('my_work')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'my_work'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <Bell className="w-4.5 h-4.5" />
              <span>내 업무</span>
            </button>

            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'calendar'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <Calendar className="w-4.5 h-4.5" />
              <span>스케줄 캘린더</span>
            </button>

            <button
              onClick={() => setView('assignments')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'assignments'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <UserCheck className="w-4.5 h-4.5" />
              <span>프로젝트 인력 배분</span>
            </button>

            <button
              onClick={() => setView('doc_library')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'doc_library'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <Library className="w-4.5 h-4.5" />
              <span>서류 양식 라이브러리</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setView('users')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'users'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>사용자 계정 관리</span>
              </button>
            )}

            {currentUser?.role !== 'member' && (
              <>
                <button
                  onClick={() => setView('templates')}
                  className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                    currentView === 'templates'
                      ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                      : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                  <span>프로세스 템플릿 보관함</span>
                </button>

                <button
                  onClick={() => setView('folder_templates')}
                  className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                    currentView === 'folder_templates'
                      ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                      : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                  }`}
                >
                  <FolderOpen className="w-4.5 h-4.5" />
                  <span>폴더 양식 라이브러리</span>
                </button>
              </>
            )}

            <button
              onClick={() => setView('settings')}
              className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                currentView === 'settings'
                  ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                  : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              <span>환경 설정</span>
            </button>
          </div>

        </div>

        {/* User Profile and Logout */}
        <div className="mx-4 mb-4 mt-auto p-3 bg-toss-gray-50/50 dark:bg-slate-900/60 border border-toss-gray-150/45 dark:border-slate-800/80 rounded-2xl flex flex-col gap-3 select-none shrink-0 text-left">
          <div className="flex items-center gap-3">
            {/* 아바타 컴포넌트 */}
            <div
              onClick={() => setView('profile_settings')}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/profile"
              title="개인 프로필 설정"
            >
              <Avatar name={currentUser?.name} profileImage={currentUser?.profile_image} className="w-9 h-9 text-xs transition-transform group-hover/profile:scale-105" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-black text-toss-gray-800 dark:text-slate-200 truncate group-hover/profile:text-toss-blue">{currentUser?.name}</span>
                <span className="text-[10px] text-toss-gray-400 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5">
                  {currentUser?.role === 'admin' ? '최고 관리자' : currentUser?.role === 'manager' ? '매니저' : '개발원'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setView('profile_settings')}
              className="p-1.5 hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 hover:text-toss-blue dark:hover:text-toss-blue rounded-lg transition-colors cursor-pointer"
              title="개인 프로필 설정"
            >
              <UserCog className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setView('settings')}
            className={`w-full rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
              serverMode
                ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/70'
                : 'bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/70'
            }`}
            title="저장 모드 설정 보기"
          >
            <span className="block text-[10px] font-black">{serverMode ? '서버 공유 모드' : '로컬 단독 모드'}</span>
            <span className="mt-0.5 block truncate text-[10px] font-bold opacity-75">
              {serverMode ? '중앙 서버에 저장 중' : '이 PC에만 저장 중'}
            </span>
          </button>

          <div className="flex items-center justify-between border-t border-toss-gray-100 dark:border-slate-800/60 pt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-all cursor-pointer"
                title={darkMode ? '라이트 모드' : '다크 모드'}
              >
                {darkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setView('settings')}
                className="p-2 rounded-xl text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-all cursor-pointer"
                title="시스템 설정"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => logout()}
              className="px-2.5 py-1 bg-white dark:bg-slate-850 hover:bg-toss-gray-50 dark:hover:bg-slate-800 text-[10px] font-extrabold text-toss-gray-650 dark:text-slate-350 border border-toss-gray-150/40 dark:border-slate-800 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-soft-sm"
            >
              <LogOut className="w-3 h-3" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
        
        </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Loading overlay */}
        {loading && (
          <FullscreenLoadingOverlay
            message="동기화 진행 및 데이터 처리 중..."
            subMessage="파일이 많을 경우 시간이 다소 소요될 수 있습니다."
          />
        )}
        {openingPath && (
          <FullscreenLoadingOverlay
            message="탐색기에서 폴더를 여는 중입니다."
            subMessage={openingPath}
          />
        )}

        {/* Project Header */}
        {showProjectHeader && activeProject && (
          <header className="min-h-20 px-8 glass-header flex flex-col justify-between sticky top-0 z-30 shrink-0 print:hidden select-none border-b border-toss-gray-150/60 dark:border-slate-800/80">
            <div className="h-12 flex items-center justify-between gap-5">
              <div className="relative flex items-center gap-2 min-w-0">
                <button
                  data-project-header-popover
                  onClick={() => {
                    setIsProjectSwitcherOpen((open) => !open);
                    setIsProjectPeopleOpen(false);
                    setIsProjectActivityOpen(false);
                    setIsProjectMoreOpen(false);
                  }}
                  className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer group"
                  title="프로젝트 전환"
                >
                  <span className="font-black text-sm text-toss-gray-900 dark:text-slate-100 truncate group-hover:text-toss-blue">
                    {activeProject.name}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-toss-gray-400 transition-transform group-hover:text-toss-blue ${isProjectSwitcherOpen ? 'rotate-180' : ''}`} />
                </button>
                <span className="px-2.5 py-1 rounded-full bg-toss-blue-light/70 text-toss-blue text-[11px] font-black">
                  {activeProject.status || '진행중'}
                </span>
                {isProjectSwitcherOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" aria-label="프로젝트 전환 닫기" onClick={closeProjectHeaderPopovers} />
                    {renderProjectPickerPopover(switcherProjectRegion, setSwitcherProjectRegion)}
                  </>
                )}
              </div>

              <div className="relative flex items-center gap-4 shrink-0">
                {currentView === 'projects_structure' && (
                  <div className="relative hidden md:flex items-center w-64">
                    <Search className="absolute left-3.5 w-4 h-4 text-toss-gray-400" />
                    <input
                      type="text"
                      placeholder="폴더 구조 검색"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-150/70 dark:border-slate-800 rounded-full focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all placeholder:text-toss-gray-400 font-semibold text-toss-gray-800 dark:text-slate-200"
                    />
                  </div>
                )}

                <button
                  data-project-header-popover
                  onClick={() => {
                    setIsProjectPeopleOpen((open) => !open);
                    setIsProjectActivityOpen(false);
                    setIsProjectMoreOpen(false);
                    setIsProjectSwitcherOpen(false);
                  }}
                  className="hidden sm:flex items-center -space-x-2 cursor-pointer rounded-full hover:opacity-85 transition-opacity"
                  title="참여 인력"
                >
                  {projectHeaderPeople.map((person) => (
                    <Avatar key={person.id} name={person.user_name} profileImage={person.user_profile_image} className="w-7 h-7 text-[10px] ring-2 ring-white dark:ring-slate-950" />
                  ))}
                  <span className="w-8 h-7 rounded-full bg-toss-gray-100 dark:bg-slate-800 text-[10px] font-black text-toss-gray-500 dark:text-slate-400 flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                    +{Math.max(projectAssignments.length - 3, 0)}
                  </span>
                </button>
                {isProjectPeopleOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" aria-label="참여 인력 닫기" onClick={closeProjectHeaderPopovers} />
                    <div data-project-header-popover onClick={(event) => event.stopPropagation()} className="absolute right-24 top-12 z-50 w-80 rounded-2xl border border-toss-gray-150/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg p-3">
                      <div className="flex items-center justify-between px-1 pb-3 border-b border-toss-gray-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100">참여 인력</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-400">{projectAssignments.length}명 참여중</p>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto py-2">
                        {projectAssignments.length === 0 ? (
                          <p className="py-8 text-center text-xs font-bold text-slate-400">등록된 참여 인력이 없습니다.</p>
                        ) : projectAssignments.map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={assignment.user_name} profileImage={assignment.user_profile_image} className="w-8 h-8 text-[10px]" />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{assignment.user_name || '이름 없음'}</p>
                                <p className="truncate text-[11px] font-bold text-slate-400">{assignment.role || '역할 미지정'}</p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-toss-blue">{assignment.allocation_percent}%</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setIsProjectPeopleOpen(false);
                          setView('assignments');
                        }}
                        className="mt-2 w-full rounded-xl bg-toss-blue px-3 py-2.5 text-xs font-black text-white"
                      >
                        인력 수정
                      </button>
                    </div>
                  </>
                )}

                <button
                  onClick={() => handleOpenFolder(activeProject.path)}
                  className="p-2 rounded-full text-toss-gray-500 hover:text-toss-blue hover:bg-toss-gray-100 dark:hover:bg-slate-850 transition-colors"
                  title="프로젝트 폴더 열기"
                >
                  <FolderOpen className="w-4.5 h-4.5" />
                </button>
                <button
                  data-project-header-popover
                  onClick={() => {
                    setIsProjectActivityOpen((open) => !open);
                    setIsProjectPeopleOpen(false);
                    setIsProjectMoreOpen(false);
                    setIsProjectSwitcherOpen(false);
                  }}
                  className="p-2 rounded-full text-toss-gray-500 hover:text-toss-blue hover:bg-toss-gray-100 dark:hover:bg-slate-850 transition-colors"
                  title="프로젝트 알림"
                >
                  <Bell className="w-4.5 h-4.5" />
                </button>
                {isProjectActivityOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" aria-label="프로젝트 알림 닫기" onClick={closeProjectHeaderPopovers} />
                    <div data-project-header-popover onClick={(event) => event.stopPropagation()} className="absolute right-12 top-12 z-50 w-96 rounded-2xl border border-toss-gray-150/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg p-3">
                      <div className="flex items-center justify-between px-1 pb-3 border-b border-toss-gray-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100">프로젝트 알림</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-400">작업 이력, 회의, 인력 투입 로그</p>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto py-2">
                        <ProjectHeaderActivityList items={projectHeaderActivity} />
                      </div>
                    </div>
                  </>
                )}
                <div className="relative">
                  <button
                    data-project-header-popover
                    onClick={() => {
                      setIsProjectMoreOpen((open) => !open);
                      setIsProjectSwitcherOpen(false);
                      setIsProjectPeopleOpen(false);
                      setIsProjectActivityOpen(false);
                    }}
                    className="px-2 py-1 rounded-full text-lg leading-none text-toss-gray-500 hover:text-toss-gray-900 hover:bg-toss-gray-100 dark:hover:bg-slate-850 transition-colors"
                    title="더보기"
                  >
                    <MoreHorizontal className="w-4.5 h-4.5" />
                  </button>
                  {isProjectMoreOpen && (
                    <>
                      <button className="fixed inset-0 z-40 cursor-default" aria-label="더보기 닫기" onClick={closeProjectHeaderPopovers} />
                      <div data-project-header-popover onClick={(event) => event.stopPropagation()} className="absolute right-0 top-9 z-50 w-48 rounded-2xl border border-toss-gray-150/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg p-2">
                        <button onClick={handleOpenProjectInfoEdit} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-black text-toss-gray-700 dark:text-slate-200 hover:bg-toss-gray-50 dark:hover:bg-slate-900">
                          사업 정보 수정
                        </button>
                        <button onClick={() => { setView('projects_reports'); setIsProjectMoreOpen(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-black text-toss-gray-700 dark:text-slate-200 hover:bg-toss-gray-50 dark:hover:bg-slate-900">
                          보고서 보기
                        </button>
                        <button onClick={() => { setView('projects_analysis'); setIsProjectMoreOpen(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-black text-toss-gray-700 dark:text-slate-200 hover:bg-toss-gray-50 dark:hover:bg-slate-900">
                          건강도 진단
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex items-end gap-4 overflow-x-auto scrollbar-hide">
              {projectTabs.map((tab) => {
                const isActive = currentView === tab.view;
                return (
                  <button
                    key={tab.view}
                    onClick={() => setView(tab.view)}
                    className={`relative h-9 px-3 pb-3 text-xs font-black whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'text-toss-blue'
                        : 'text-toss-gray-500 hover:text-toss-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                    {isActive && <span className="absolute left-0 right-0 bottom-0 h-0.5 rounded-full bg-toss-blue" />}
                  </button>
                );
              })}
            </nav>
          </header>
        )}

        {/* View Switcher Viewport */}
        <div className="flex-1 min-h-0 flex flex-col gap-6 relative p-6 overflow-hidden print:p-0">
          {renderView()}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-toss-lg text-xs font-semibold flex items-center gap-2 animate-slide-up backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-toss-blue animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

export default App;
