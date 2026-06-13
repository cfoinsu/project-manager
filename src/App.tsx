import { useState, useEffect } from 'react';
import type { FolderNode } from './types';
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
import { ReportGeneration } from './components/ReportGeneration';
import { TemplateManagement } from './components/TemplateManagement';
import { FolderTemplateManagement } from './components/FolderTemplateManagement';
import { SettingsView } from './components/SettingsView';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';

// Auth and User Views
import { LoginView } from './components/LoginView';
import { ForcePasswordChangeView } from './components/ForcePasswordChangeView';
import { UserManagementView } from './components/UserManagementView';
import { AssignmentManagementView } from './components/AssignmentManagementView';
import { ProjectScheduleCalendarView } from './components/ProjectScheduleCalendarView';
import { DocumentLibraryView } from './components/DocumentLibraryView';

import { CustomSelect } from './components/CustomSelect';
import { migrateComments } from './utils/api';

import {
  Search,
  Moon,
  Sun,
  LayoutDashboard,
  Calendar,
  GitFork,
  ShieldCheck,
  FolderOpen,
  Settings,
  Activity,
  FileText,
  CheckSquare,
  Printer,
  ClipboardList,
  Compass,
  Users,
  UserCheck,
  Library,
  LogOut
} from 'lucide-react';

function App() {
  const { user: currentUser, isLoggedIn, checkSession, logout } = useAuthStore();
  const brand = useBrandStore();

  useEffect(() => {
    checkSession();
  }, []);

  const { 
    projects, 
    activeProject, 
    currentView, 
    loading, 
    rootNode, 
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
  
  // Local tab state for the Folder Structure view ('tree' | 'stats' | 'mindmap' | 'treemap')
  const [structureTab, setStructureTab] = useState<'tree' | 'stats' | 'mindmap' | 'treemap'>('tree');

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

  if (!isLoggedIn) {
    return <LoginView />;
  }

  if (currentUser?.force_password_change === 1) {
    return <ForcePasswordChangeView />;
  }

  const handleOpenFolder = async (path: string) => {
    try {
      await openInExplorer(path);
      showToast(`탐색기에서 폴더를 열었습니다: ${path}`);
    } catch (err) {
      showToast(`폴더 열기 실패: ${err}`);
    }
  };

  // Render the core active subview
  const renderView = () => {
    // Role-based route protection
    if (currentView === 'users' && currentUser?.role !== 'admin') {
      return <DashboardView />;
    }
    if ((currentView === 'templates' || currentView === 'folder_templates') && currentUser?.role === 'member') {
      return <DashboardView />;
    }

    switch (currentView as any) {
      case 'dashboard':
        return <DashboardView />;
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
      case 'calendar':
        return <ScheduleCalendarView />;
      case 'projects_overview':
        return <ProjectOverview />;
      case 'projects_calendar':
        return <ProjectScheduleCalendarView />;
      case 'projects_process':
        return <ProcessManagement />;
      case 'projects_tasks':
        return <TaskManagement />;
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
        {currentUser?.role !== 'member' && (
          <div className="px-5 mb-6 shrink-0 text-left">
            <label className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">활성 프로젝트</label>
            <div className="relative mt-1">
              <CustomSelect
                value={activeProject?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    selectProject(null);
                    setView('dashboard');
                  } else {
                    const found = projects.find(p => p.id === e.target.value);
                    if (found) {
                      selectProject(found);
                      setView('projects_overview');
                    }
                  }
                }}
                className="w-full text-xs font-bold pl-3.5 pr-8 py-3 bg-toss-gray-50 hover:bg-toss-gray-100 dark:bg-slate-850 dark:hover:bg-slate-800 border-none rounded-2xl focus:outline-none transition-all font-semibold cursor-pointer appearance-none text-toss-gray-800 dark:text-slate-200"
              >
                <option value="">프로젝트 선택 안 함</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                ))}
              </CustomSelect>
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

          {/* Project-specific Management Section */}
          {activeProject && currentUser?.role !== 'member' && (
            <div className="flex flex-col gap-1 border-t border-toss-gray-100 dark:border-slate-800/80 pt-4">
              <span className="px-3 text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Project OS</span>
              
              <button
                onClick={() => setView('projects_overview')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_overview'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <Activity className="w-4.5 h-4.5" />
                <span>종합 개요</span>
              </button>

              <button
                onClick={() => setView('projects_calendar')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_calendar'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <Calendar className="w-4.5 h-4.5" />
                <span>상세 일정 캘린더</span>
              </button>

              <button
                onClick={() => setView('projects_process')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_process'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <GitFork className="w-4.5 h-4.5" />
                <span>프로세스 편집</span>
              </button>

              <button
                onClick={() => setView('projects_tasks')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_tasks'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <CheckSquare className="w-4.5 h-4.5" />
                <span>작업 칸반 보드</span>
              </button>

              <button
                onClick={() => setView('projects_documents')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_documents'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <FileText className="w-4.5 h-4.5" />
                <span>산출물 관리</span>
              </button>

              <button
                onClick={() => setView('projects_structure')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_structure'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <FolderOpen className="w-4.5 h-4.5" />
                <span>폴더 구조 탐색</span>
              </button>

              <button
                onClick={() => setView('projects_analysis')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_analysis'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>건강도 진단</span>
              </button>

              <button
                onClick={() => setView('projects_reports')}
                className={`flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer w-full ${
                  currentView === 'projects_reports'
                    ? 'bg-toss-blue-light/50 text-toss-blue dark:bg-toss-blue/20 dark:text-toss-blue'
                    : 'text-toss-gray-500 hover:bg-toss-gray-50 dark:text-slate-400 dark:hover:bg-slate-850'
                }`}
              >
                <Printer className="w-4.5 h-4.5" />
                <span>리포트 출력</span>
              </button>
            </div>
          )}

        </div>

        {/* User Profile and Logout */}
        <div className="px-5 mb-1 mt-auto border-t border-toss-gray-100 dark:border-slate-800/80 pt-4 flex flex-col gap-2 select-none shrink-0 text-left">
          <div className="flex items-center justify-between">
            <div className="flex flex-col text-left">
              <span className="text-xs font-extrabold text-toss-gray-800 dark:text-slate-200">{currentUser?.name}</span>
              <span className="text-[10px] text-toss-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                {currentUser?.role === 'admin' ? '관리자' : currentUser?.role === 'manager' ? '매니저' : '개발원'}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="px-2 py-1 bg-toss-gray-105 hover:bg-toss-gray-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-[10px] font-black text-toss-gray-650 dark:text-slate-350 rounded-lg cursor-pointer transition-all flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        {/* Bottom utility icons */}
        <div className="flex items-center justify-between px-6 shrink-0 select-none border-t border-toss-gray-100 dark:border-slate-800/80 pt-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-all cursor-pointer"
            title={darkMode ? '라이트 모드' : '다크 모드'}
          >
            {darkMode ? <Sun className="w-4.5 h-4.5 text-yellow-500" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          
          <button
            onClick={() => setView('settings')}
            className="p-2.5 rounded-xl text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-all cursor-pointer"
            title="설정"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center select-none">
            <div className="w-14 h-14 border-4 border-toss-blue border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold text-white">동기화 진행 및 데이터 처리 중...</p>
            <span className="text-xs text-slate-300 dark:text-slate-550 mt-2">파일이 많을 경우 시간이 다소 소요될 수 있습니다.</span>
          </div>
        )}

        {/* Unified Header (Visible only when an active project is selected & we are inside a project subview) */}
        {activeProject && currentView.startsWith('projects_') && (
          <header className="h-16 px-6 glass-header flex items-center justify-between sticky top-0 z-30 shrink-0 print:hidden select-none">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-toss-gray-800 dark:text-slate-200">Project OS</span>
              <div className="w-px h-3.5 bg-toss-gray-300 dark:bg-slate-700 mx-2.5"></div>
              
              {/* Breadcrumb Path Dropdown */}
              <button 
                onClick={() => handleOpenFolder(activeProject.path)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-toss-gray-100 hover:bg-toss-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-toss-gray-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="탐색기로 경로 열기"
              >
                <Compass className="w-3.5 h-3.5 text-toss-blue" />
                <span>{activeProject.name}</span>
              </button>
            </div>

            {/* Header Search Bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center w-60 sm:w-80">
                <Search className="absolute left-3.5 w-4.5 h-4.5 text-toss-gray-400" />
                <input
                  type="text"
                  placeholder="폴더 및 산출물 구조 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-10.5 pr-4 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all placeholder:text-toss-gray-400 font-semibold text-toss-gray-800 dark:text-slate-200"
                />
              </div>

              <button 
                onClick={() => handleOpenFolder(activeProject.path)}
                className="p-2.5 rounded-xl border border-toss-gray-200/50 dark:border-slate-850 hover:bg-toss-gray-50 dark:hover:bg-slate-850 transition-colors cursor-pointer text-toss-gray-500 dark:text-slate-400"
                title="프로젝트 폴더 열기"
              >
                <FolderOpen className="w-4.5 h-4.5" />
              </button>
            </div>
          </header>
        )}

        {/* View Switcher Viewport */}
        <div className="flex-1 min-h-0 flex flex-col gap-6 relative p-6 overflow-hidden print:p-0">
          {renderView()}
        </div>
      </div>

      {/* global Toast message portal */}
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
