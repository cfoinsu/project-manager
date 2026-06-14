import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../utils/api';
import * as db from '../utils/db';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import type { Assignment, User, Workload } from '../types';
import { WorkloadGridView } from './WorkloadGridView';
import { CommentPanel } from './CommentPanel';
import { CustomSelect } from './CustomSelect';
import { Avatar } from './Avatar';
import { RangeDatePicker } from './RangeDatePicker';
import { 
  Users, 
  Calendar, 
  Percent, 
  Plus, 
  Trash2, 
  Edit2, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Sliders,
  Sparkles,
  BarChart2,
  MessageSquare,
  Search,
  Clock
} from 'lucide-react';

export const AssignmentManagementView: React.FC = () => {
  const { user: currentUser, serverMode } = useAuthStore();
  const { projects, loadProjects, updateProjectInfo, pendingTab, setPendingTab } = useProjectStore();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom states for department grouping & quick assignment revamp
  const [orgInfo, setOrgInfo] = useState<api.OrgInfo>({ departments: [], positions: [], jobRoles: [] });
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedCardProjectId, setSelectedCardProjectId] = useState<string | null>(null);
  const [projectProgressMap, setProjectProgressMap] = useState<Record<string, number>>({});
  const [projectStatusFilter, setProjectStatusFilter] = useState<'전체' | '대기' | '진행중' | '완료'>('전체');

  // Quick Add state per project ID
  const [quickAddUser, setQuickAddUser] = useState<Record<string, string>>({});
  const [quickAddRole, setQuickAddRole] = useState<Record<string, string>>({});
  const [quickAddAlloc, setQuickAddAlloc] = useState<Record<string, number>>({});

  // Tab state
  const [activeTab, setActiveTab] = useState<'assignments' | 'workload' | 'comments'>('assignments');

  // Selected context for comments
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // Currently selected project for workload/comments
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // 대시보드에서 댓글 탭으로 바로 이동 요청 처리
  useEffect(() => {
    if (pendingTab === 'comments') {
      setActiveTab('comments');
      setPendingTab(null); // 소비 후 초기화
    }
  }, [pendingTab]);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('');
  const [allocationPercent, setAllocationPercent] = useState<number>(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtering
  const [filterProjectId, setFilterProjectId] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  const isEditable = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!currentUser) return;
      
      // Fetch assignments
      const assignData = await api.getAssignments(serverMode, currentUser.role, currentUser.id);
      setAssignments(assignData);

      // Fetch org info for department grouping
      const orgData = await api.getOrgInfo(serverMode);
      setOrgInfo(orgData);

      // Reload project list to get fresh statuses
      await loadProjects();
      const projectList = useProjectStore.getState().projects;

      // Fetch progress for all projects in parallel
      const progressMap: Record<string, number> = {};
      await Promise.all(
        projectList.map(async (p) => {
          try {
            const procs = await db.getProcesses(p.id);
            if (procs.length === 0) {
              progressMap[p.id] = 100;
            } else {
              const sum = procs.reduce((acc, pr) => acc + pr.progress, 0);
              progressMap[p.id] = Math.round((sum / procs.length) * 100);
            }
          } catch (e) {
            console.error('Failed to get processes for ' + p.id, e);
            progressMap[p.id] = 0;
          }
        })
      );
      setProjectProgressMap(progressMap);

      // Set default selectedCardProjectId if not set or invalid
      if (projectList.length > 0) {
        setSelectedCardProjectId(prev => {
          if (prev && projectList.some(p => p.id === prev)) {
            return prev;
          }
          return projectList[0].id;
        });
        setSelectedProjectId(prev => {
          if (prev && projectList.some(p => p.id === prev)) {
            return prev;
          }
          return projectList[0].id;
        });
      } else {
        setSelectedCardProjectId(null);
      }

      // Managers and Admins can also load all users and projects for assignment dropdowns
      if (isEditable) {
        const userData = await api.getUsers(serverMode);
        setUsers(userData);
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [serverMode, currentUser]);

  const openCreateModal = (uId?: string) => {
    setError(null);
    setEditingId(null);
    setUserId(uId || users[0]?.id || '');
    setProjectId(projects[0]?.id || '');
    setRole('');
    setAllocationPercent(100);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 90 days
    setIsModalOpen(true);
  };

  const openEditModal = (a: Assignment) => {
    setError(null);
    setEditingId(a.id);
    setUserId(a.user_id);
    setProjectId(a.project_id);
    setRole(a.role);
    setAllocationPercent(a.allocation_percent);
    setStartDate(a.start_date);
    setEndDate(a.end_date);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId || !projectId || !role || !startDate || !endDate) {
      setError('모든 필수 입력 필드를 채워주세요.');
      return;
    }

    if (allocationPercent < 0 || allocationPercent > 100) {
      setError('투입 비율은 0%에서 100% 사이여야 합니다.');
      return;
    }

    try {
      if (editingId) {
        // Edit Mode
        await api.updateAssignment(serverMode, editingId, {
          role,
          allocation_percent: allocationPercent,
          start_date: startDate,
          end_date: endDate
        });
      } else {
        // Create Mode
        await api.createAssignment(serverMode, {
          user_id: userId,
          project_id: projectId,
          role,
          allocation_percent: allocationPercent,
          start_date: startDate,
          end_date: endDate
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || '인력 배정 처리 중 오류가 발생했습니다.');
    }
  };

  const handleQuickAdd = async (pId: string) => {
    const uId = quickAddUser[pId];
    const roleVal = quickAddRole[pId];
    const allocVal = quickAddAlloc[pId] !== undefined ? quickAddAlloc[pId] : 100;
    
    if (!uId || !roleVal) {
      alert('투입 인력과 역할을 입력해 주세요.');
      return;
    }
    
    // Find project dates as default, or fallback to current dates
    const project = projects.find(p => p.id === pId);
    const startDateVal = project?.start_date || new Date().toISOString().split('T')[0];
    const endDateVal = project?.end_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      setError(null);
      await api.createAssignment(serverMode, {
        user_id: uId,
        project_id: pId,
        role: roleVal,
        allocation_percent: allocVal,
        start_date: startDateVal,
        end_date: endDateVal
      });
      
      // Clear inputs for this project
      setQuickAddUser(prev => ({ ...prev, [pId]: '' }));
      setQuickAddRole(prev => ({ ...prev, [pId]: '' }));
      setQuickAddAlloc(prev => ({ ...prev, [pId]: 100 }));
      
      fetchData();
    } catch (err: any) {
      alert(err.message || '인력 배정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 인력 배정 내역을 해제하시겠습니까?')) {
      return;
    }
    setError(null);
    try {
      await api.deleteAssignment(serverMode, id);
      fetchData();
    } catch (err: any) {
      setError(err.message || '인력 배정 해제에 실패했습니다.');
    }
  };

  // Total allocation per user across active assignments (excluding completed projects)
  const userAllocations = assignments.reduce((acc, a) => {
    const proj = projects.find(p => p.id === a.project_id);
    if (proj?.status !== '완료') {
      acc[a.user_id] = (acc[a.user_id] || 0) + a.allocation_percent;
    }
    return acc;
  }, {} as Record<string, number>);

  const overallocatedUsersCount = Object.values(userAllocations).filter(v => v > 100).length;
  const uniqueUsersCount = Object.keys(userAllocations).length;

  const filteredAssignments = filterProjectId 
    ? assignments.filter(a => a.project_id === filterProjectId)
    : assignments;

  // 테이블 뷰 실시간 검색 필터링
  const searchedAssignments = useMemo(() => {
    if (!tableSearchQuery.trim()) return filteredAssignments;
    const q = tableSearchQuery.toLowerCase();
    return filteredAssignments.filter(a =>
      (a.user_name || '').toLowerCase().includes(q) ||
      (a.user_email || '').toLowerCase().includes(q) ||
      (a.project_name || '').toLowerCase().includes(q) ||
      (a.project_code || '').toLowerCase().includes(q) ||
      (a.role || '').toLowerCase().includes(q)
    );
  }, [filteredAssignments, tableSearchQuery]);

  const unavailableAssignments = searchedAssignments.filter(a => (userAllocations[a.user_id] || 0) >= 100);
  const availableAssignments = searchedAssignments.filter(a => (userAllocations[a.user_id] || 0) < 100);

  const filteredProjects = projects.filter(p => {
    if (projectStatusFilter === '전체') return true;
    return (p.status || '진행중') === projectStatusFilter;
  });

  // Assignments for selected project (workload tab)
  const projectAssignments = selectedProjectId
    ? assignments.filter(a => a.project_id === selectedProjectId)
    : [];

  const handleWorkloadCellClick = (wl: Workload) => {
    setSelectedWorkload(wl);
    setSelectedAssignment(null);
  };

  const handleAssignmentCommentClick = (a: Assignment) => {
    setSelectedAssignment(a);
    setSelectedWorkload(null);
    setActiveTab('comments');
  };

  // Group users by department for Left Panel
  const groupedUsers: Record<string, User[]> = {};
  if (orgInfo && orgInfo.departments) {
    orgInfo.departments.forEach(d => {
      groupedUsers[d.name] = [];
    });
  }
  groupedUsers['미지정'] = [];

  users.forEach(u => {
    const dept = u.department || '미지정';
    if (!groupedUsers[dept]) {
      groupedUsers[dept] = [];
    }
    groupedUsers[dept].push(u);
  });

  const departmentsWithUsers = Object.keys(groupedUsers).filter(deptName => 
    groupedUsers[deptName].length > 0
  );
  if (departmentsWithUsers.length === 0) {
    departmentsWithUsers.push('미지정');
  }

  return (
    <div className="flex-1 flex flex-col gap-5 text-left h-full min-h-0 overflow-y-auto pr-1">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 select-none">
        <div>
          <h1 className="text-xl font-black text-toss-gray-900 dark:text-slate-100">프로젝트 인력 배분</h1>
          <p className="text-xs text-toss-gray-400 dark:text-slate-500 font-bold mt-1.5">
            팀원 투입률 · 기간별 작업량 · 업무 커뮤니케이션을 통합 관리합니다.
            {serverMode ? (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-toss-blue/10 text-toss-blue text-xs font-black">Express DB 모드</span>
            ) : (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black">Local DB 모드</span>
            )}
          </p>
        </div>
        {isEditable && (
          <button
            onClick={() => openCreateModal()}
            className="toss-btn toss-btn-primary px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all self-start sm:self-auto select-none"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>신규 인력 배정</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none shrink-0">
        <div className="toss-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-[18px] bg-sky-500/10 flex items-center justify-center text-toss-blue border border-sky-500/10">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">투입 참여 인원</p>
            <p className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{uniqueUsersCount}명</p>
          </div>
        </div>
        <div className="toss-card flex items-center gap-4">
          <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center border ${
            overallocatedUsersCount > 0 
              ? 'bg-rose-500/10 text-rose-500 border-rose-500/10' 
              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'
          }`}>
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">초과 배정 인원</p>
            <p className={`text-xl font-extrabold mt-0.5 ${overallocatedUsersCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{overallocatedUsersCount}명</p>
          </div>
        </div>
        <div className="toss-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-[18px] bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-500/10">
            <Percent className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">전체 활성 배정</p>
            <p className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">{assignments.length}건</p>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1.5 bg-gray-150/70 dark:bg-slate-800/60 p-1.5 rounded-full w-fit select-none shrink-0 border border-gray-200/20">
        {[
          { key: 'assignments', label: '인력 배정 목록', icon: Users },
          { key: 'workload',    label: '주간 작업량 그리드', icon: BarChart2 },
          { key: 'comments',   label: '댓글 패널', icon: MessageSquare },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
              activeTab === key
                ? 'bg-white text-toss-blue shadow-sm dark:bg-slate-900'
                : 'text-toss-gray-455 hover:text-toss-gray-800 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key === 'comments' && (selectedWorkload || selectedAssignment) && (
              <span className="w-1.5 h-1.5 rounded-full bg-toss-blue" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: 인력 배정 목록 ── */}
      {activeTab === 'assignments' && (
        <div className="flex flex-col flex-1 gap-4 min-h-[400px]">
          {/* Controls Header */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-toss-gray-400 dark:text-slate-500 uppercase">배정 현황 ({filteredAssignments.length}건)</span>
              
              {/* View Mode Toggle */}
              <div className="flex bg-toss-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-toss-gray-200 dark:border-slate-700 text-xs font-bold">
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'card'
                      ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                      : 'text-toss-gray-400 hover:text-toss-gray-700 dark:hover:text-slate-350'
                  }`}
                >
                  카드 대시보드
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                      : 'text-toss-gray-400 hover:text-toss-gray-700 dark:hover:text-slate-350'
                  }`}
                >
                  목록 테이블
                </button>
              </div>
            </div>

            {viewMode === 'table' && (
              <div className="flex flex-wrap items-center gap-3">
                {/* 실시간 검색창 */}
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-3.5 h-3.5 text-toss-gray-400" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="배정 인원, 프로젝트 검색..."
                    className="pl-9 pr-8 py-1.5 text-xs font-bold bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-toss-blue transition-all text-toss-gray-800 dark:text-slate-200 placeholder-toss-gray-400 w-44 focus:w-56"
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery('')}
                      className="absolute right-2.5 text-toss-gray-400 hover:text-rose-500 cursor-pointer p-0.5 border-none bg-transparent"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-toss-gray-400" />
                  <CustomSelect
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                    className="text-xs font-bold px-3 py-1.5 bg-toss-gray-105 dark:bg-slate-850 border border-toss-gray-200 dark:border-slate-800 rounded-xl focus:outline-none transition-all cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="">모든 프로젝트</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200/60 rounded-xl flex items-start gap-2.5 text-red-600 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex-1 flex flex-col items-center justify-center py-20 text-toss-gray-400">
              <span className="w-8 h-8 border-2 border-toss-blue border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold">불러오는 중...</p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start flex-1 min-h-0">
              {/* Left Panel: 부서별 인력 현황 */}
              <div className="xl:col-span-1 toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-4.5 flex flex-col gap-3 h-full max-h-[680px] min-h-[500px]">
                <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-2.5 mb-1 flex flex-col gap-2">
                  <span className="text-sm font-black text-toss-gray-800 dark:text-slate-200">부서별 인력 현황</span>
                  <input
                    type="text"
                    placeholder="인력 검색..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-bold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {departmentsWithUsers.map(deptName => {
                    const deptUsers = groupedUsers[deptName] || [];
                    const filteredDeptUsers = deptUsers.filter(u => 
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                      (u.position && u.position.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    );
                    
                    if (filteredDeptUsers.length === 0 && userSearchQuery !== '') return null;
                    
                    return (
                      <div key={deptName} className="space-y-2">
                        <span className="text-xs font-black text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                          {deptName} ({filteredDeptUsers.length}명)
                        </span>
                        <div className="space-y-1.5">
                          {filteredDeptUsers.map(u => {
                            const totalAlloc = userAllocations[u.id] || 0;
                            const isOverallocated = totalAlloc > 100;
                            
                            // Find all assignments for this user
                            const userAssigns = assignments.filter(a => a.user_id === u.id);
                            
                            return (
                              <div key={u.id} className="flex flex-col p-2.5 bg-toss-gray-50/50 dark:bg-slate-850/30 border border-toss-gray-100/50 dark:border-slate-850/80 rounded-2xl hover:bg-toss-gray-50 dark:hover:bg-slate-800/60 transition-all font-semibold gap-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col min-w-0 text-left">
                                    <span className="text-sm font-bold text-toss-gray-800 dark:text-slate-200 truncate">
                                      {u.name} {u.position && <span className="text-xs text-toss-gray-400 font-semibold">({u.position})</span>}
                                    </span>
                                    <span className="text-xs text-toss-gray-400 font-mono truncate">{u.email}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-black uppercase ${
                                      totalAlloc === 0
                                        ? 'bg-toss-gray-100 text-toss-gray-400 dark:bg-slate-800'
                                        : isOverallocated
                                        ? 'bg-rose-500/10 text-rose-500'
                                        : 'bg-toss-blue/10 text-toss-blue'
                                    }`}>
                                      {totalAlloc}%
                                    </span>
                                    {isEditable && (
                                      <button
                                        onClick={() => openCreateModal(u.id)}
                                        className="p-1 rounded bg-white hover:bg-toss-gray-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-toss-gray-400 hover:text-toss-blue border border-toss-gray-200/50 dark:border-slate-700/80 transition-all cursor-pointer inline-flex"
                                        title="배정 추가"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* List of assigned projects for this user */}
                                {userAssigns.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-0.5 border-t border-toss-gray-100/50 dark:border-slate-800/50 pt-1.5">
                                    {userAssigns.map(a => {
                                      const proj = projects.find(p => p.id === a.project_id);
                                      const isCompleted = proj?.status === '완료';
                                      const isPending = proj?.status === '대기';
                                      const statusClass = isCompleted
                                        ? 'bg-toss-gray-100 text-toss-gray-400 dark:bg-slate-800 dark:text-slate-500'
                                        : isPending
                                        ? 'bg-amber-500/10 text-amber-500'
                                        : 'bg-toss-blue/5 text-toss-blue border-toss-blue/10';
                                      
                                      return (
                                        <span 
                                          key={a.id} 
                                          className={`px-1 py-0.5 rounded text-xs font-bold border border-transparent select-none leading-none ${statusClass}`}
                                          title={`${a.project_name} | ${a.role} (${a.allocation_percent}%)`}
                                        >
                                          {a.project_code || 'PROJ'} ({a.allocation_percent}%)
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-xs text-toss-gray-455 italic mt-0.5 block border-t border-toss-gray-100/50 dark:border-slate-800/50 pt-1.5 pl-0.5">배정된 프로젝트 없음</span>
                                )}
                              </div>
                            );
                          })}
                          {filteredDeptUsers.length === 0 && (
                            <span className="text-xs text-toss-gray-400 italic block pl-1">소속 인력 없음</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Middle Panel: 프로젝트 목록 */}
              <div className="xl:col-span-1 toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-4.5 flex flex-col gap-3 h-full max-h-[680px] min-h-[500px]">
                <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-2.5 mb-1 flex flex-col gap-2">
                  <span className="text-sm font-black text-toss-gray-800 dark:text-slate-200">프로젝트 목록</span>
                  <span className="text-xs text-toss-gray-400 font-bold">진행률과 투입 인원수를 조회합니다.</span>
                </div>
                
                {/* 탭 필터 */}
                <div className="flex gap-1 bg-toss-gray-100 dark:bg-slate-800/80 p-1 rounded-xl mb-1 shrink-0 select-none">
                  {(['전체', '대기', '진행중', '완료'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setProjectStatusFilter(tab)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        projectStatusFilter === tab
                          ? 'bg-white dark:bg-slate-900 text-toss-blue dark:text-sky-400 shadow-sm'
                          : 'text-toss-gray-455 hover:text-toss-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {filteredProjects.map(p => {
                    const projAssigns = assignments.filter(a => a.project_id === p.id);
                    const progress = projectProgressMap[p.id] !== undefined ? projectProgressMap[p.id] : 0;
                    const isSelected = p.id === selectedCardProjectId;
                    
                    const statusText = p.status || '진행중';
                    // 채도 최적화: 완료/대기는 슬레이트(회색) 계열로 변경하여 시각적 복잡도 제거
                    const statusClass = statusText === '완료'
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : statusText === '대기'
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-toss-blue/10 text-toss-blue';

                    const isProjCompleted = statusText === '완료';
                    const cardMutedClass = isProjCompleted ? 'opacity-75' : '';

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedCardProjectId(p.id)}
                        className={`p-3 border rounded-2xl transition-all cursor-pointer flex flex-col gap-2 ${
                          isSelected
                            ? 'border-toss-blue bg-toss-blue/5 dark:bg-slate-850/40 shadow-sm'
                            : 'border-toss-gray-100/80 dark:border-slate-850/80 hover:bg-toss-gray-50 dark:hover:bg-slate-800/40 bg-toss-gray-50/20 dark:bg-slate-850/10'
                        } ${cardMutedClass}`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-toss-blue uppercase tracking-wider font-mono truncate">{p.code || 'CODE'}</span>
                            <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200 truncate mt-0.5" title={p.name}>{p.name}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-black shrink-0 ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>
                        
                        {/* Progress and members */}
                        <div className="flex items-center justify-between text-xs font-bold text-toss-gray-455 dark:text-slate-400 mt-0.5">
                          <span className="shrink-0">투입인원: <strong className="text-toss-gray-700 dark:text-slate-200">{projAssigns.length}명</strong></span>
                          <span className="shrink-0">진행률: <strong className="text-toss-blue">{progress}%</strong></span>
                        </div>
                        <div className="w-full h-1 bg-toss-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-toss-blue transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {projects.length === 0 && (
                    <div className="text-center py-10 text-toss-gray-400 italic text-xs font-semibold">
                      등록된 프로젝트가 없습니다.
                    </div>
                  )}
                  {projects.length > 0 && filteredProjects.length === 0 && (
                    <div className="text-center py-10 text-toss-gray-400 italic text-xs font-semibold">
                      선택한 상태의 프로젝트가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: 선택 프로젝트 상세 */}
              <div className="xl:col-span-2 flex flex-col gap-5 h-full max-h-[680px]">
                {(() => {
                  const p = projects.find(proj => proj.id === selectedCardProjectId);
                  if (!p) {
                    return (
                      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex-1 flex flex-col items-center justify-center text-toss-gray-400 min-h-[500px]">
                        <Users className="w-10 h-10 mb-3 opacity-25" />
                        <p className="text-sm font-bold">프로젝트를 선택하시면 우측에 상세 투입 인력 및 간편 추가/삭제 창이 나타납니다.</p>
                      </div>
                    );
                  }

                  const projAssigns = assignments.filter(a => a.project_id === p.id);
                  const assignedUserIds = projAssigns.map(a => a.user_id);
                  const unassignedUsers = users.filter(u => !assignedUserIds.includes(u.id));

                  return (
                    <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col h-full min-h-[500px] gap-4.5 overflow-y-auto">
                      {/* Project Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-toss-gray-100 dark:border-slate-800 pb-3 gap-3">
                        <div className="flex flex-col text-left min-w-0">
                          <span className="text-sm font-black text-toss-blue uppercase tracking-wider block font-mono">{p.code || 'CODE'}</span>
                          <span className="text-lg font-extrabold text-toss-gray-800 dark:text-slate-200 truncate mt-0.5" title={p.name}>{p.name}</span>
                          <span className="text-xs text-toss-gray-400 font-semibold mt-1">경로: {p.path}</span>
                        </div>
                        
                        {/* Project Status Management */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto select-none">
                          <span className="text-sm font-bold text-toss-gray-455 dark:text-slate-400">상태 관리</span>
                          <CustomSelect
                            value={p.status || '진행중'}
                            onChange={async (e) => {
                              try {
                                await updateProjectInfo(p.id, { status: e.target.value });
                                await fetchData(); // refresh data
                              } catch (err: any) {
                                alert(err.message || '상태 변경에 실패했습니다.');
                              }
                            }}
                            className="text-sm font-black px-2.5 py-1.5 bg-toss-gray-50 border border-toss-gray-200 rounded-xl focus:outline-none cursor-pointer text-toss-gray-800 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-800 w-28"
                          >
                            <option value="대기">대기</option>
                            <option value="진행중">진행중</option>
                            <option value="완료">완료</option>
                          </CustomSelect>
                        </div>
                      </div>

                      {/* Project Meta Dates */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-toss-gray-50/50 dark:bg-slate-850/20 border border-toss-gray-100/50 dark:border-slate-850/50 rounded-2xl text-sm text-toss-gray-700 dark:text-slate-300 font-semibold select-none">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-toss-gray-400" />
                          <span>시작일: <strong>{p.start_date || '미지정'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-toss-gray-400" />
                          <span>종료일: <strong>{p.end_date || '미지정'}</strong></span>
                        </div>
                      </div>

                      {/* Assigned Members List */}
                      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                        <span className="text-xs font-black text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1">투입 인원 현황 ({projAssigns.length}명)</span>
                        {projAssigns.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-14 text-toss-gray-400 border border-dashed border-toss-gray-200/60 dark:border-slate-800 rounded-2xl">
                            <Users className="w-8 h-8 mb-2 opacity-25" />
                            <p className="text-xs font-semibold italic text-center">투입 인력이 없습니다. 아래에서 추가해 보세요.</p>
                          </div>
                        ) : (
                          projAssigns.map(a => {
                            return (
                              <div key={a.id} className="flex items-center justify-between p-3 bg-toss-gray-50/50 dark:bg-slate-850/40 border border-toss-gray-100/50 dark:border-slate-850/70 rounded-2xl hover:bg-toss-gray-50 dark:hover:bg-slate-800/60 transition-all font-semibold text-sm text-toss-gray-800 dark:text-slate-200">
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <Avatar name={a.user_name} profileImage={a.user_profile_image} className="w-8.5 h-8.5 text-xs font-black" />
                                  <div className="flex flex-col text-left min-w-0">
                                    <span className="font-extrabold truncate text-toss-gray-800 dark:text-slate-200">
                                      {a.user_name} <span className="font-semibold text-toss-gray-550 dark:text-slate-400 text-xs">| {a.role}</span>
                                    </span>
                                    <span className="text-xs text-toss-gray-400 font-mono mt-0.5 leading-none">
                                      {a.start_date} ~ {a.end_date}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-black text-toss-gray-900 dark:text-slate-100 text-base">{a.allocation_percent}%</span>
                                  {isEditable && (
                                    <button
                                      onClick={() => handleDelete(a.id)}
                                      className="p-1 rounded text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors inline-flex"
                                      title="투입 해제"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Quick Add Form */}
                      {isEditable && (
                        <div className="border-t border-toss-gray-100 dark:border-slate-800 pt-4 flex flex-col gap-2.5 shrink-0">
                          <span className="text-xs font-black text-toss-gray-450 dark:text-slate-550 uppercase tracking-wider block">간편 인력 편입</span>
                          <div className="flex gap-2 items-center">
                            <div className="flex-[1.5] min-w-0">
                              <CustomSelect
                                value={quickAddUser[p.id] || ''}
                                onChange={(e) => setQuickAddUser(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="w-full px-2 py-1.5 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-sm cursor-pointer text-toss-gray-800 dark:text-slate-200"
                              >
                                <option value="">+ 인력 편입...</option>
                                {unassignedUsers.map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.position || '개발원'})
                                  </option>
                                ))}
                              </CustomSelect>
                            </div>
                            <div className="flex-1 min-w-0">
                              <CustomSelect
                                value={quickAddRole[p.id] || ''}
                                onChange={(e) => setQuickAddRole(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="w-full px-2 py-1.5 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-sm cursor-pointer text-toss-gray-800 dark:text-slate-200 font-bold"
                              >
                                <option value="">역할...</option>
                                {orgInfo?.jobRoles?.map(jr => (
                                  <option key={jr.id} value={jr.name}>{jr.name}</option>
                                ))}
                                {quickAddRole[p.id] && orgInfo?.jobRoles && !orgInfo.jobRoles.some(jr => jr.name === quickAddRole[p.id]) && (
                                  <option value={quickAddRole[p.id]}>{quickAddRole[p.id]}</option>
                                )}
                              </CustomSelect>
                            </div>
                            <button
                              onClick={() => handleQuickAdd(p.id)}
                              className="p-1.5 bg-toss-blue hover:bg-toss-blue-dark text-white rounded-lg cursor-pointer transition-colors inline-flex shrink-0 shadow-sm"
                              title="투입 등록"
                            >
                              <Plus className="w-4.5 h-4.5" />
                            </button>
                          </div>
                          
                          {/* Grouped Allocation Slider & Presets Box */}
                          <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col gap-2 mt-0.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-toss-gray-450 dark:text-slate-400 font-extrabold">투입 비율 설정</span>
                              <div className="relative flex items-center w-16">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={quickAddAlloc[p.id] !== undefined ? quickAddAlloc[p.id] : 100}
                                  onChange={(e) => setQuickAddAlloc(prev => ({ ...prev, [p.id]: Math.min(Math.max(parseInt(e.target.value, 10) || 0, 0), 100) }))}
                                  className="w-full text-xs text-right pr-5 py-0.5 bg-white dark:bg-slate-900 border border-toss-gray-200 dark:border-slate-800 rounded-md focus:outline-none font-bold text-toss-gray-800 dark:text-slate-100"
                                />
                                <span className="absolute right-1.5 text-[9px] text-toss-gray-400 font-bold select-none">%</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 select-none">
                              <span className="text-[9px] font-bold text-toss-gray-455 dark:text-slate-550 shrink-0">0%</span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={quickAddAlloc[p.id] !== undefined ? quickAddAlloc[p.id] : 100}
                                onChange={(e) => setQuickAddAlloc(prev => ({ ...prev, [p.id]: parseInt(e.target.value, 10) || 0 }))}
                                className="premium-slider flex-1"
                                style={{
                                  background: `linear-gradient(to right, #3182f6 0%, #3182f6 ${quickAddAlloc[p.id] !== undefined ? quickAddAlloc[p.id] : 100}%, var(--slider-bg) ${quickAddAlloc[p.id] !== undefined ? quickAddAlloc[p.id] : 100}%)`
                                }}
                              />
                              <span className="text-[9px] font-bold text-toss-gray-455 dark:text-slate-550 shrink-0">100%</span>
                            </div>

                            <div className="flex gap-1 justify-between">
                              {[0, 25, 50, 75, 100].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setQuickAddAlloc(prev => ({ ...prev, [p.id]: val }))}
                                  className={`flex-1 py-0.5 rounded text-[9px] font-extrabold transition-all cursor-pointer text-center ${
                                    (quickAddAlloc[p.id] !== undefined ? quickAddAlloc[p.id] : 100) === val
                                      ? 'bg-toss-blue text-white shadow-soft-sm'
                                      : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-150 dark:border-slate-800'
                                  }`}
                                >
                                  {val}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : filteredAssignments.length === 0 ? (
            /* ──── TABLE MODE (EMPTY) ──── */
            <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex-1 flex flex-col items-center justify-center py-24 text-toss-gray-400 text-center">
              <Sparkles className="w-10 h-10 text-toss-gray-300 mb-2" />
              <p className="text-xs font-bold">등록된 인력 배정 내역이 없습니다.</p>
              {isEditable && (
                <button onClick={() => openCreateModal()} className="toss-btn toss-btn-primary px-3 py-1.5 mt-4 text-xs font-bold rounded-xl">
                  첫 인력 배정 추가하기
                </button>
              )}
            </div>
          ) : (
            /* ──── TABLE MODE (LIST) ──── */
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-w-0 items-start select-none">
              {/* 🟢 투입 가능 인원 배정 현황 (누적 100% 미만) */}
              <div className="flex flex-col gap-2.5 flex-1 min-w-0 w-full lg:w-1/2">
                <div className="flex items-center gap-2 select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">
                    투입 가능 인원 배정 현황 (누적 투입률 100% 미만) ({availableAssignments.length}건)
                  </h3>
                </div>
                {availableAssignments.length === 0 ? (
                  <div className="p-8 text-center text-xs font-semibold text-toss-gray-400 bg-toss-gray-50/20 dark:bg-slate-900/10 border border-dashed border-toss-gray-200/60 dark:border-slate-800 rounded-2xl">
                    투입 가능 상태인 배정 내역이 없습니다.
                  </div>
                ) : (
                  <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-0 overflow-x-auto rounded-[24px]">
                    <table className="w-full text-sm text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-toss-gray-100 dark:border-slate-850 text-toss-gray-450 dark:text-slate-500 font-bold select-none text-xs bg-slate-50/50 dark:bg-slate-850/20">
                          <th className="py-3 px-3">인원 정보</th>
                          <th className="py-3 px-3">프로젝트 / 역할</th>
                          <th className="py-3 px-3 text-center">배정 및 누적률</th>
                          <th className="py-3 px-3 text-right pr-4">기간 및 관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableAssignments.map((a) => {
                          const totalAlloc = userAllocations[a.user_id] || 0;
                          
                          // 타 프로젝트 배정 상세정보 (툴팁용)
                          const otherAssignsText = assignments
                            .filter(other => other.user_id === a.user_id && other.id !== a.id)
                            .map(other => `${other.project_name || '미지정'}(${other.allocation_percent}%)`)
                            .join(', ');
                          const tooltipText = otherAssignsText
                            ? `현재 배정 외 추가 투입 프로젝트: ${otherAssignsText}`
                            : '추가 투입 프로젝트 없음';

                          return (
                            <tr key={a.id} className="border-b border-toss-gray-50/50 dark:border-slate-850 hover:bg-toss-gray-50/50 dark:hover:bg-slate-850/30 transition-colors font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                              {/* 1. 인원 정보 */}
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar name={a.user_name} profileImage={a.user_profile_image} className="w-8 h-8 text-[10px] shrink-0" />
                                  <div className="flex flex-col text-left min-w-0">
                                    <span className="font-extrabold text-toss-gray-850 dark:text-slate-200 truncate">
                                      {a.user_name || '알 수 없는 사용자'}
                                    </span>
                                    <span className="text-[10px] text-toss-gray-400 font-mono mt-0.5 truncate max-w-[120px]" title={a.user_email}>
                                      {a.user_email}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              {/* 2. 프로젝트 / 역할 */}
                              <td className="py-3.5 px-3">
                                <div className="flex flex-col text-left min-w-0">
                                  <span className="font-extrabold text-toss-gray-850 dark:text-slate-250 truncate max-w-[150px]" title={a.project_name}>
                                    {a.project_name || '미지정'}
                                  </span>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-650 dark:text-slate-400 text-[9.5px] font-black shrink-0">
                                      {a.role}
                                    </span>
                                    {a.project_code && (
                                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-toss-blue text-[9px] font-bold shrink-0 font-mono">
                                        {a.project_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {/* 3. 배정 및 누적 투입률 */}
                              <td className="py-3.5 px-3">
                                <div className="flex flex-col items-center justify-center">
                                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                    <span className="font-extrabold text-toss-gray-850 dark:text-slate-100">
                                      배정 {a.allocation_percent}%
                                    </span>
                                    <span 
                                      title={tooltipText}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-help ${
                                        totalAlloc > 100
                                          ? 'bg-rose-500/10 text-rose-500'
                                          : totalAlloc === 100
                                          ? 'bg-toss-blue/10 text-toss-blue'
                                          : 'bg-emerald-500/10 text-emerald-500'
                                      }`}
                                    >
                                      누적 {totalAlloc}%
                                    </span>
                                  </div>
                                  <div className="w-16 h-1 bg-toss-gray-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full ${
                                        totalAlloc > 100 
                                          ? 'bg-rose-500' 
                                          : totalAlloc === 100 
                                          ? 'bg-toss-blue' 
                                          : 'bg-sky-400'
                                      }`} 
                                      style={{ width: `${Math.min(totalAlloc, 100)}%` }} 
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* 4. 기간 및 관리 */}
                              <td className="py-3.5 px-3 text-right pr-4">
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-toss-gray-450 dark:text-slate-400 font-medium font-mono">
                                    <Calendar className="w-3 h-3 text-toss-gray-400" />
                                    <span>{a.start_date} ~ {a.end_date}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignmentCommentClick(a)}
                                      className="p-1 rounded-md text-toss-gray-400 hover:text-toss-blue hover:bg-toss-blue/5 transition-all cursor-pointer inline-flex border-none bg-transparent"
                                      title="댓글 보기"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                    {isEditable && (
                                      <>
                                        <button 
                                          type="button"
                                          onClick={() => openEditModal(a)} 
                                          className="p-1 rounded-md text-toss-gray-400 hover:text-toss-blue hover:bg-toss-blue/5 transition-all cursor-pointer inline-flex border-none bg-transparent" 
                                          title="수정"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDelete(a.id)} 
                                          className="p-1 rounded-md text-toss-gray-400 hover:text-red-500 hover:bg-rose-50 transition-all cursor-pointer inline-flex border-none bg-transparent" 
                                          title="해제"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 🔴 투입 불가 인원 배정 현황 (누적 100% 이상) */}
              <div className="flex flex-col gap-2.5 flex-1 min-w-0 w-full lg:w-1/2">
                <div className="flex items-center gap-2 select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">
                    투입 불가 인원 배정 현황 (누적 투입률 100% 이상) ({unavailableAssignments.length}건)
                  </h3>
                </div>
                {unavailableAssignments.length === 0 ? (
                  <div className="p-8 text-center text-xs font-semibold text-toss-gray-400 bg-toss-gray-50/20 dark:bg-slate-900/10 border border-dashed border-toss-gray-200/60 dark:border-slate-800 rounded-2xl">
                    투입 불가 상태인 배정 내역이 없습니다.
                  </div>
                ) : (
                  <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-0 overflow-x-auto rounded-[24px]">
                    <table className="w-full text-sm text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-toss-gray-100 dark:border-slate-850 text-toss-gray-450 dark:text-slate-500 font-bold select-none text-xs bg-slate-50/50 dark:bg-slate-850/20">
                          <th className="py-3 px-3">인원 정보</th>
                          <th className="py-3 px-3">프로젝트 / 역할</th>
                          <th className="py-3 px-3 text-center">배정 및 누적률</th>
                          <th className="py-3 px-3 text-right pr-4">기간 및 관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unavailableAssignments.map((a) => {
                          const totalAlloc = userAllocations[a.user_id] || 0;
                          
                          // 타 프로젝트 배정 상세정보 (툴팁용)
                          const otherAssignsText = assignments
                            .filter(other => other.user_id === a.user_id && other.id !== a.id)
                            .map(other => `${other.project_name || '미지정'}(${other.allocation_percent}%)`)
                            .join(', ');
                          const tooltipText = otherAssignsText
                            ? `현재 배정 외 추가 투입 프로젝트: ${otherAssignsText}`
                            : '추가 투입 프로젝트 없음';

                          return (
                            <tr key={a.id} className="border-b border-toss-gray-50/50 dark:border-slate-850 hover:bg-toss-gray-50/50 dark:hover:bg-slate-850/30 transition-colors font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                              {/* 1. 인원 정보 */}
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar name={a.user_name} profileImage={a.user_profile_image} className="w-8 h-8 text-[10px] shrink-0" />
                                  <div className="flex flex-col text-left min-w-0">
                                    <span className="font-extrabold text-toss-gray-850 dark:text-slate-200 truncate">
                                      {a.user_name || '알 수 없는 사용자'}
                                    </span>
                                    <span className="text-[10px] text-toss-gray-400 font-mono mt-0.5 truncate max-w-[120px]" title={a.user_email}>
                                      {a.user_email}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              {/* 2. 프로젝트 / 역할 */}
                              <td className="py-3.5 px-3">
                                <div className="flex flex-col text-left min-w-0">
                                  <span className="font-extrabold text-toss-gray-850 dark:text-slate-250 truncate max-w-[150px]" title={a.project_name}>
                                    {a.project_name || '미지정'}
                                  </span>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-650 dark:text-slate-400 text-[9.5px] font-black shrink-0">
                                      {a.role}
                                    </span>
                                    {a.project_code && (
                                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-toss-blue text-[9px] font-bold shrink-0 font-mono">
                                        {a.project_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {/* 3. 배정 및 누적 투입률 */}
                              <td className="py-3.5 px-3">
                                <div className="flex flex-col items-center justify-center">
                                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                    <span className="font-extrabold text-toss-gray-850 dark:text-slate-100">
                                      배정 {a.allocation_percent}%
                                    </span>
                                    <span 
                                      title={tooltipText}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-help ${
                                        totalAlloc > 100
                                          ? 'bg-rose-500/10 text-rose-500'
                                          : totalAlloc === 100
                                          ? 'bg-toss-blue/10 text-toss-blue'
                                          : 'bg-emerald-500/10 text-emerald-500'
                                      }`}
                                    >
                                      누적 {totalAlloc}%
                                    </span>
                                  </div>
                                  <div className="w-16 h-1 bg-toss-gray-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full ${
                                        totalAlloc > 100 
                                          ? 'bg-rose-500' 
                                          : totalAlloc === 100 
                                          ? 'bg-toss-blue' 
                                          : 'bg-sky-400'
                                      }`} 
                                      style={{ width: `${Math.min(totalAlloc, 100)}%` }} 
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* 4. 기간 및 관리 */}
                              <td className="py-3.5 px-3 text-right pr-4">
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-toss-gray-450 dark:text-slate-400 font-medium font-mono">
                                    <Calendar className="w-3 h-3 text-toss-gray-400" />
                                    <span>{a.start_date} ~ {a.end_date}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignmentCommentClick(a)}
                                      className="p-1 rounded-md text-toss-gray-400 hover:text-toss-blue hover:bg-toss-blue/5 transition-all cursor-pointer inline-flex border-none bg-transparent"
                                      title="댓글 보기"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                    {isEditable && (
                                      <>
                                        <button 
                                          type="button"
                                          onClick={() => openEditModal(a)} 
                                          className="p-1 rounded-md text-toss-gray-400 hover:text-toss-blue hover:bg-toss-blue/5 transition-all cursor-pointer inline-flex border-none bg-transparent" 
                                          title="수정"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDelete(a.id)} 
                                          className="p-1 rounded-md text-toss-gray-400 hover:text-red-500 hover:bg-rose-50 transition-all cursor-pointer inline-flex border-none bg-transparent" 
                                          title="해제"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 주간 작업량 그리드 ── */}
      {activeTab === 'workload' && (
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col flex-1 min-h-[400px]">
          {/* 프로젝트 선택 */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
            <BarChart2 className="w-4 h-4 text-toss-blue" />
            <span className="text-xs font-black text-gray-800">프로젝트 선택</span>
            <CustomSelect
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl focus:outline-none transition-all cursor-pointer text-gray-800"
            >
              <option value="">-- 프로젝트를 선택하세요 --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </CustomSelect>
          </div>

          {selectedProjectId ? (
            <div className="flex flex-col gap-4 flex-1">
              <WorkloadGridView
                projectId={selectedProjectId}
                assignments={projectAssignments}
                onSelectCell={wl => handleWorkloadCellClick(wl)}
                selectedWorkloadId={selectedWorkload?.id}
              />
              
              {/* 선택된 셀 정보 및 댓글 연동 패널 */}
              {selectedWorkload && (() => {
                const assign = assignments.find(a => a.id === selectedWorkload.assignment_id);
                return (
                  <div className="toss-card bg-slate-50/50 dark:bg-slate-850/20 border border-gray-150/45 dark:border-slate-850/60 p-4 rounded-[20px] flex flex-col sm:flex-row items-center justify-between gap-4 select-none animate-fade-in mt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-toss-blue/10 flex items-center justify-center text-toss-blue">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">선택된 주간 작업량 상세</p>
                        <p className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200 mt-0.5">
                          {assign?.user_name || '알 수 없음'} ({assign?.role || '담당자'}) · {selectedWorkload.week_start} 주차 · 투입 비율 {selectedWorkload.work_ratio}%
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('comments')}
                      className="toss-btn toss-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>댓글 작성 및 피드백 패널로 이동</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20">
              <BarChart2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">프로젝트를 선택하면 주간 작업량 그리드가 표시됩니다.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 댓글 패널 ── */}
      {activeTab === 'comments' && (
        <div className="flex-1 flex flex-col min-h-[500px] w-full">
          <CommentPanel
            projectId={selectedProjectId}
            assignments={projectAssignments}
            selectedWorkload={selectedWorkload}
            selectedAssignment={selectedAssignment}
            onProjectChange={id => {
              setSelectedProjectId(id);
              setSelectedAssignment(null);
              setSelectedWorkload(null);
            }}
            onClose={() => {
              setSelectedWorkload(null);
              setSelectedAssignment(null);
            }}
          />
        </div>
      )}

      {/* ── Modal: 인력 배정 등록/수정 ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center select-none p-4 animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-[480px] bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-toss-lg text-left backdrop-blur-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-slate-800/40 pb-4 mb-5">
              <span className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">
                {editingId ? '인력 배정 수정' : '신규 인력 배정 등록'}
              </span>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 transition-colors cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-toss-gray-450 uppercase tracking-wider">투입 인력 선택</label>
                <CustomSelect
                  disabled={!!editingId}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="toss-input"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email}) [{u.role === 'admin' ? '관리자' : u.role === 'manager' ? '매니저' : '개발원'}]</option>
                  ))}
                </CustomSelect>
              </div>
              <div className="space-y-1">
                <label className="text-toss-gray-455 uppercase tracking-wider">배정 프로젝트</label>
                <CustomSelect
                  disabled={!!editingId}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="toss-input"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? "[" + p.code + "] " : ""}{p.name}</option>
                  ))}
                </CustomSelect>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-toss-gray-450 uppercase tracking-wider">업무 역할 (Role)</label>
                  <CustomSelect
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="toss-input font-bold"
                  >
                    <option value="">역할 선택</option>
                    {orgInfo?.jobRoles?.map(jr => (
                      <option key={jr.id} value={jr.name}>{jr.name}</option>
                    ))}
                    {role && orgInfo?.jobRoles && !orgInfo.jobRoles.some(jr => jr.name === role) && (
                      <option value={role}>{role}</option>
                    )}
                  </CustomSelect>
                </div>
                <div className="space-y-1">
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-toss-gray-455 dark:text-slate-400 uppercase tracking-wider">투입 비율</label>
                      <div className="relative flex items-center w-20">
                        <input
                          type="number" required min={0} max={100} value={allocationPercent}
                          onChange={(e) => setAllocationPercent(Math.min(Math.max(parseInt(e.target.value, 10) || 0, 0), 100))}
                          className="w-full text-xs font-black px-2.5 py-1 bg-white dark:bg-slate-900 border border-toss-gray-200 dark:border-slate-800 rounded-lg focus:outline-none text-right pr-6 text-toss-gray-800 dark:text-slate-100"
                        />
                        <span className="absolute right-2 text-[10px] text-toss-gray-400 font-bold select-none">%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[10px] font-bold text-toss-gray-400 shrink-0">0%</span>
                      <input
                        type="range" min={0} max={100} value={allocationPercent}
                        onChange={(e) => setAllocationPercent(parseInt(e.target.value, 10) || 0)}
                        className="premium-slider"
                        style={{
                          background: `linear-gradient(to right, #3182f6 0%, #3182f6 ${allocationPercent}%, var(--slider-bg) ${allocationPercent}%)`
                        }}
                      />
                      <span className="text-[10px] font-bold text-toss-gray-400 shrink-0">100%</span>
                    </div>

                    <div className="flex gap-1">
                      {[0, 25, 50, 75, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAllocationPercent(val)}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                            allocationPercent === val
                              ? 'bg-toss-blue text-white shadow-soft-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-150 dark:border-slate-800'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-toss-gray-450 uppercase tracking-wider text-left block text-xs font-bold mb-1">투입 기간</label>
                <RangeDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  placeholder="투입 기간 선택"
                />
              </div>
              <div className="flex items-center gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">
                  취소
                </button>
                <button type="submit"
                  className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>{editingId ? '수정완료' : '배정등록'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};