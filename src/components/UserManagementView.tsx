import React, { useState, useEffect } from 'react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';
import { requestDeleteConfirmation } from '../utils/deleteConfirm';
import { 
  Trash2, UserPlus, Shield, Search, Mail, UserCheck, AlertCircle, 
  Settings2, UserCog, KeyRound, Laptop, Key, RefreshCw, Layers, Phone,
  Building2, GripVertical, Pencil, Save, X, UserRound
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { Avatar } from './Avatar';
import { OrgChartView } from './OrgChartView';

type OrgItemType = 'departments' | 'positions' | 'job-roles';
type DepartmentTreeNode = api.OrgItem & {
  children: DepartmentTreeNode[];
  depth: number;
  path: string;
};

const buildDepartmentTree = (departments: api.OrgItem[]): DepartmentTreeNode[] => {
  const sorted = [...departments].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'ko');
  });
  const byId = new Map<string, DepartmentTreeNode>();
  sorted.forEach((department) => {
    byId.set(department.id, { ...department, parent_id: department.parent_id || null, children: [], depth: 0, path: department.name });
  });
  const roots: DepartmentTreeNode[] = [];
  sorted.forEach((department) => {
    const node = byId.get(department.id);
    if (!node) return;
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });

  const assignMeta = (nodes: DepartmentTreeNode[], depth: number, parentPath = ''): DepartmentTreeNode[] => nodes.map((node) => {
    node.depth = depth;
    node.path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    node.children = assignMeta(node.children, depth + 1, node.path);
    return node;
  });

  return assignMeta(roots, 0);
};

const flattenDepartmentTree = (nodes: DepartmentTreeNode[]): DepartmentTreeNode[] =>
  nodes.flatMap((node) => [node, ...flattenDepartmentTree(node.children)]);

export const UserManagementView: React.FC = () => {
  const { user: currentUser, serverMode } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab state: 'users' | 'departments' | 'org'
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'org'>('users');

  // Org Info Master list state
  const [orgInfo, setOrgInfo] = useState<api.OrgInfo>({ departments: [], positions: [], jobRoles: [] });
  const [orgAddNames, setOrgAddNames] = useState({ departments: '', positions: '', jobRoles: '' });
  const [editingOrgItem, setEditingOrgItem] = useState<{ type: OrgItemType; id: string; name: string } | null>(null);
  const [draggingOrgItem, setDraggingOrgItem] = useState<{ type: OrgItemType; id: string } | null>(null);
  const [dragOverOrgItem, setDragOverOrgItem] = useState<{ type: OrgItemType; id: string } | null>(null);
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const [dragOverDepartmentId, setDragOverDepartmentId] = useState<string | null>(null);

  // Register form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'member' | 'user'>('member');
  const [dept, setDept] = useState('');
  const [pos, setPos] = useState('');
  const [jr, setJr] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Edit user modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'manager' | 'member' | 'user'>('member');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editDept, setEditDept] = useState('');
  const [editPos, setEditPos] = useState('');
  const [editJr, setEditJr] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  // Admin Double-Verification Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminModalError, setAdminModalError] = useState<string | null>(null);
  const [adminModalLoading, setAdminModalLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    description: string;
    execute: (pwd: string) => Promise<void>;
  } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers(serverMode);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || '사용자 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgInfo = async () => {
    try {
      const data = await api.getOrgInfo(serverMode);
      setOrgInfo(data);
    } catch (err: any) {
      console.error('Failed to fetch org info', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrgInfo();
  }, [serverMode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegisterSuccess(null);

    if (!name || !username || !password || !role) {
      setError('필수 항목(* 표시)을 입력해 주세요.');
      return;
    }

    try {
      await api.addUser(serverMode, {
        username,
        name,
        email: email || null,
        phone: phone || null,
        password,
        role,
        status: 'active',
        force_password_change: 1,
        department: dept || null,
        position: pos || null,
        job_role: jr || null
      });

      setRegisterSuccess(`'${name}' 사용자가 등록되었습니다. (최초 로그인 시 비밀번호 변경 필요)`);
      setName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole('member');
      setDept('');
      setPos('');
      setJr('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '사용자 등록에 실패했습니다.');
    }
  };

  // Open Admin Double Verification Modal
  const requestAdminApproval = (description: string, action: (pwd: string) => Promise<void>) => {
    setAdminPassword('');
    setAdminModalError(null);
    setPendingAction({ description, execute: action });
    setShowAdminModal(true);
  };

  const handleAdminModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword || !pendingAction) return;

    setAdminModalLoading(true);
    setAdminModalError(null);
    try {
      // 1. Verify admin password
      const isVerified = await api.verifyAdminPassword(serverMode, adminPassword);
      if (!isVerified) {
        throw new Error('관리자 비밀번호가 일치하지 않습니다.');
      }
      
      // 2. Execute pending action
      await pendingAction.execute(adminPassword);
      
      // 3. Cleanup & Close
      setShowAdminModal(false);
      setPendingAction(null);
      setAdminPassword('');
      fetchUsers();
    } catch (err: any) {
      setAdminModalError(err.message || '인증 오류가 발생했습니다.');
    } finally {
      setAdminModalLoading(false);
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditDept(u.department || '');
    setEditPos(u.position || '');
    setEditJr(u.job_role || '');
    setTempPassword('');
  };

  const closeEditModal = () => {
    setSelectedUser(null);
  };

  // 1. Action: Update User Info
  const handleUpdateUserInfo = () => {
    if (!selectedUser) return;
    
    requestAdminApproval(`'${editName}' 사용자 정보 수정`, async (pwd) => {
      await api.updateUser(serverMode, selectedUser.id, {
        name: editName,
        email: editEmail || null,
        phone: editPhone || null,
        role: editRole,
        status: editStatus,
        department: editDept || null,
        position: editPos || null,
        job_role: editJr || null,
        adminPassword: pwd
      });
      closeEditModal();
    });
  };

  // 2. Action: Reset Device Lock
  const handleResetDevice = () => {
    if (!selectedUser) return;

    requestAdminApproval(`'${selectedUser.name}' 등록 기기(PC) 초기화`, async (pwd) => {
      await api.resetUserDevice(serverMode, selectedUser.id, pwd);
      alert('기기가 성공적으로 초기화되었습니다.');
      // Refresh modal status if open
      setSelectedUser(prev => prev ? { ...prev, device_hash: null } : null);
    });
  };

  // 3. Action: Reset Password
  const handleResetPassword = () => {
    if (!selectedUser || !tempPassword) {
      alert('초기화할 새 비밀번호를 입력하세요.');
      return;
    }
    if (tempPassword.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    requestAdminApproval(`'${selectedUser.name}' 비밀번호 초기화`, async (pwd) => {
      await api.resetUserPassword(serverMode, selectedUser.id, tempPassword, pwd);
      alert('비밀번호가 초기화되었습니다. 다음 로그인 시 해당 사용자는 비밀번호를 반드시 변경해야 합니다.');
      setTempPassword('');
    });
  };

  // 4. Action: Delete User
  const handleDeleteUser = (id: string, name: string) => {
    if (id === currentUser?.id) {
      alert('본인 계정은 삭제할 수 없습니다.');
      return;
    }

    requestAdminApproval(`'${name}' 계정 완전 삭제`, async (pwd) => {
      await api.deleteUser(serverMode, id, pwd);
      closeEditModal();
    });
  };

  // Org Info Master CRUD Handlers
  const handleAddOrgItem = async (type: OrgItemType, parentId?: string | null, nameOverride?: string) => {
    const key = type === 'job-roles' ? 'jobRoles' : type;
    const val = nameOverride ?? orgAddNames[key];
    if (!val.trim()) return;

    try {
      await api.addOrgInfoItem(serverMode, type, val.trim(), type === 'departments' ? parentId || null : null);
      if (!nameOverride) setOrgAddNames(prev => ({ ...prev, [key]: '' }));
      fetchOrgInfo();
    } catch (err: any) {
      alert(err.message || '추가에 실패했습니다.');
    }
  };

  const handleDeleteOrgItem = async (type: OrgItemType, id: string) => {
    const source = type === 'departments' ? orgInfo.departments : type === 'positions' ? orgInfo.positions : orgInfo.jobRoles;
    const target = source.find((item) => item.id === id);
    if (!requestDeleteConfirmation({
      title: '조직 기준 항목 삭제',
      targetName: target?.name,
      description: '관련 사용자 정보에는 영향이 없지만 더 이상 연동 선택이 불가능해집니다.',
    })) {
      return;
    }

    try {
      await api.deleteOrgInfoItem(serverMode, type, id);
      fetchOrgInfo();
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  };

  const handleUpdateOrgItem = async () => {
    if (!editingOrgItem || !editingOrgItem.name.trim()) return;
    try {
      await api.updateOrgInfoItem(serverMode, editingOrgItem.type, editingOrgItem.id, editingOrgItem.name.trim());
      setEditingOrgItem(null);
      fetchOrgInfo();
    } catch (err: any) {
      alert(err.message || '수정에 실패했습니다.');
    }
  };

  const getOrgItems = (type: OrgItemType) => {
    if (type === 'departments') return orgInfo.departments;
    if (type === 'positions') return orgInfo.positions;
    return orgInfo.jobRoles;
  };

  const handleReorderOrgItem = async (type: OrgItemType, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const items = getOrgItems(type);
    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    try {
      await api.reorderOrgInfoItems(serverMode, type, next.map((item) => item.id));
      setOrgInfo((prev) => ({
        ...prev,
        departments: type === 'departments' ? next : prev.departments,
        positions: type === 'positions' ? next : prev.positions,
        jobRoles: type === 'job-roles' ? next : prev.jobRoles,
      }));
    } catch (err: any) {
      alert(err.message || '순서 저장에 실패했습니다.');
      fetchOrgInfo();
    }
  };

  const handleMoveUserDepartment = async (userId: string, departmentName: string | null) => {
    const targetUser = users.find((item) => item.id === userId);
    if (!targetUser || (targetUser.department || null) === departmentName) return;

    const previousUsers = users;
    setUsers((prev) => prev.map((item) => item.id === userId ? { ...item, department: departmentName } : item));
    try {
      await api.moveUserDepartment(serverMode, userId, departmentName);
      fetchUsers();
    } catch (err: any) {
      setUsers(previousUsers);
      alert(err.message || '부서 이동에 실패했습니다.');
    }
  };

  const handleMoveDepartmentParent = async (departmentId: string, parentId: string | null) => {
    const target = orgInfo.departments.find((item) => item.id === departmentId);
    if (!target || (target.parent_id || null) === (parentId || null)) return;
    const nextParent = parentId ? orgInfo.departments.find((item) => item.id === parentId) : null;
    if (!window.confirm(`'${target.name}'을(를) '${nextParent?.name || '최상위 조직'}' 아래로 이동할까요?`)) return;

    const previous = orgInfo.departments;
    setOrgInfo((prev) => ({
      ...prev,
      departments: prev.departments.map((item) => item.id === departmentId ? { ...item, parent_id: parentId || null } : item),
    }));
    try {
      await api.moveDepartmentParent(serverMode, departmentId, parentId || null);
      fetchOrgInfo();
    } catch (err: any) {
      setOrgInfo((prev) => ({ ...prev, departments: previous }));
      alert(err.message || '조직 이동에 실패했습니다.');
    }
  };

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const departmentTree = buildDepartmentTree(orgInfo.departments);
  const departmentOptions = flattenDepartmentTree(departmentTree);

  return (
    <div className="flex-1 flex flex-col gap-6 text-left h-full min-h-0 overflow-y-auto pr-1">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 select-none">
        <div>
          <h1 className="text-xl font-black text-toss-gray-900 dark:text-slate-100">사용자 및 조직 관리</h1>
          <p className="text-sm text-toss-gray-400 dark:text-slate-500 font-bold mt-1.5">
            시스템 사용자들의 계정을 생성 및 초기화하고, 부서/직급/직무 마스터 정보를 관리합니다.
            {serverMode ? (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-toss-blue/10 text-toss-blue text-xs font-black">Express DB 모드</span>
            ) : (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black">Local DB 모드</span>
            )}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 bg-toss-gray-100 dark:bg-slate-900 p-1 rounded-2xl border border-toss-gray-200 dark:border-slate-800 w-fit select-none">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
              : 'text-toss-gray-500 hover:text-toss-gray-800 dark:hover:text-slate-350'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>사용자 계정 관리</span>
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'departments'
              ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
              : 'text-toss-gray-500 hover:text-toss-gray-800 dark:hover:text-slate-350'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>부서관리</span>
        </button>
        <button
          onClick={() => setActiveTab('org')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'org'
              ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
              : 'text-toss-gray-500 hover:text-toss-gray-800 dark:hover:text-slate-350'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>조직 마스터 설정</span>
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start shrink-0">
          
          {/* Left/Middle: User List */}
          <div className="xl:col-span-2 toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-toss-gray-100 dark:border-slate-800 pb-4 mb-4 select-none">
              <span className="text-sm font-black text-toss-gray-400 dark:text-slate-500 uppercase">
                가입된 계정 ({filteredUsers.length}명)
              </span>
              
              {/* Search Input */}
              <div className="relative flex items-center w-full sm:w-64">
                <Search className="absolute left-3.5 w-4 h-4 text-toss-gray-400" />
                <input
                  type="text"
                  placeholder="이름, 아이디, 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-200"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-xl flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-toss-gray-400">
                <span className="w-8 h-8 border-3 border-toss-blue border-t-transparent rounded-full animate-spin mb-3"></span>
                <p className="text-sm font-bold">사용자 정보를 불러오고 있습니다...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-toss-gray-400">
                <UserCheck className="w-10 h-10 text-toss-gray-300 mb-2" />
                <p className="text-sm font-bold">검색어와 일치하는 사용자가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-toss-gray-100 dark:border-slate-850 text-toss-gray-400 dark:text-slate-500 font-bold select-none">
                      <th className="py-3 px-3">이름 (아이디)</th>
                      <th className="py-3 px-3">소속 (부서/직급/직무)</th>
                      <th className="py-3 px-3">권한</th>
                      <th className="py-3 px-3">보안 상태</th>
                      <th className="py-3 px-3 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-toss-gray-50/50 dark:border-slate-850 hover:bg-toss-gray-50/50 dark:hover:bg-slate-850/30 transition-colors font-semibold">
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-toss-gray-800 dark:text-slate-200">{u.name}</span>
                            <span className="text-[11px] text-toss-gray-400 dark:text-slate-500 font-mono mt-0.5">{u.username}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-toss-gray-600 dark:text-slate-350">
                          {u.department || u.position || u.job_role ? (
                            <span className="text-xs font-bold bg-toss-gray-105 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              {[u.department, u.position, u.job_role].filter(Boolean).join(' / ')}
                            </span>
                          ) : (
                            <span className="text-xs text-toss-gray-300 dark:text-slate-700">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {u.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded-full bg-toss-blue/10 text-toss-blue text-[11px] font-extrabold flex items-center gap-1 w-fit">
                              <Shield className="w-3.5 h-3.5" />
                              <span>관리자</span>
                            </span>
                          ) : u.role === 'manager' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-extrabold flex items-center gap-1 w-fit">
                              <Shield className="w-3.5 h-3.5" />
                              <span>매니저</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-toss-gray-100 text-toss-gray-600 dark:bg-slate-800 dark:text-slate-400 text-[11px] font-extrabold w-fit block text-center">
                              개발원
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 select-none">
                          <div className="flex items-center gap-1.5">
                            {u.status === 'inactive' ? (
                              <span className="w-2 h-2 rounded-full bg-red-500" title="비활성 계정"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="활성 계정"></span>
                            )}
                            <span className="text-xs text-toss-gray-600 dark:text-slate-400">
                              {u.status === 'inactive' ? '비활성' : '활성'}
                            </span>
                            {u.device_hash ? (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-toss-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-black uppercase ml-1 flex items-center gap-0.5">
                                <Laptop className="w-2.5 h-2.5" />
                                <span>PC 등록됨</span>
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase ml-1">
                                기기 미등록
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-3.5 py-1.5 bg-toss-gray-100 hover:bg-toss-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-toss-gray-700 dark:text-slate-300 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>상세/수정</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Register New User */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col">
            <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-4 mb-4 select-none">
              <span className="text-sm font-black text-toss-gray-400 dark:text-slate-500 uppercase">신규 계정 등록</span>
            </div>

            {registerSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/65 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>{registerSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">사용자 이름 *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">로그인 아이디 (ID) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="예: gildong"
                  className="w-full px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">이메일 주소 (선택)</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-4 h-4 text-toss-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gildong@atlas.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">연락처 (선택)</label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 w-4 h-4 text-toss-gray-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">초기 비밀번호 *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  className="w-full px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">역할 (Role) *</label>
                <CustomSelect
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none transition-all font-semibold cursor-pointer text-toss-gray-800 dark:text-slate-200"
                >
                  <option value="member">일반 개발원 (member)</option>
                  <option value="manager">프로젝트 매니저 (manager)</option>
                  <option value="admin">최고 관리자 (admin)</option>
                </CustomSelect>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">부서</label>
                  <CustomSelect
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="w-full px-2 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="">미지정</option>
                    {departmentOptions.map(d => (
                      <option key={d.id} value={d.path}>{`${'　'.repeat(d.depth)}${d.depth > 0 ? '└ ' : ''}${d.name}`}</option>
                    ))}
                  </CustomSelect>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">직급</label>
                  <CustomSelect
                    value={pos}
                    onChange={(e) => setPos(e.target.value)}
                    className="w-full px-2 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="">미지정</option>
                    {orgInfo.positions.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </CustomSelect>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">직무</label>
                  <CustomSelect
                    value={jr}
                    onChange={(e) => setJr(e.target.value)}
                    className="w-full px-2 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="">미지정</option>
                    {orgInfo.jobRoles.map(jrItem => (
                      <option key={jrItem.id} value={jrItem.name}>{jrItem.name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>

              <button
                type="submit"
                className="w-full toss-btn toss-btn-primary py-3.5 mt-4 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <UserPlus className="w-4 h-4" />
                <span>계정 등록하기</span>
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'departments' ? (
        <div className="flex flex-col gap-0" style={{ height: 'calc(100vh - 260px)', minHeight: '560px' }}>
          <OrgChartView
            departments={orgInfo.departments}
            users={users}
            addValue={orgAddNames.departments}
            onAddValueChange={(value) => setOrgAddNames(prev => ({ ...prev, departments: value }))}
            onAdd={(parentId, nameOverride) => handleAddOrgItem('departments', parentId, nameOverride)}
            onDelete={(id) => handleDeleteOrgItem('departments', id)}
            editingItem={editingOrgItem}
            setEditingItem={setEditingOrgItem}
            onSaveEdit={handleUpdateOrgItem}
            draggingItem={draggingOrgItem}
            setDraggingItem={setDraggingOrgItem}
            dragOverItem={dragOverOrgItem}
            setDragOverItem={setDragOverOrgItem}
            onDropDepartment={handleReorderOrgItem}
            draggingUserId={draggingUserId}
            setDraggingUserId={setDraggingUserId}
            dragOverDepartmentId={dragOverDepartmentId}
            setDragOverDepartmentId={setDragOverDepartmentId}
            onMoveUser={handleMoveUserDepartment}
            onMoveDepartmentParent={handleMoveDepartmentParent}
            onGoToUsers={() => setActiveTab('users')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch shrink-0 select-none">
          <OrgMasterList title="부서" subtitle="Departments" type="departments" items={orgInfo.departments} addValue={orgAddNames.departments} onAddValueChange={(value) => setOrgAddNames(prev => ({ ...prev, departments: value }))} onAdd={() => handleAddOrgItem('departments')} onDelete={(id) => handleDeleteOrgItem('departments', id)} editingItem={editingOrgItem} setEditingItem={setEditingOrgItem} onSaveEdit={handleUpdateOrgItem} draggingItem={draggingOrgItem} setDraggingItem={setDraggingOrgItem} dragOverItem={dragOverOrgItem} setDragOverItem={setDragOverOrgItem} onDropItem={handleReorderOrgItem} />
          <OrgMasterList title="직급" subtitle="Positions" type="positions" items={orgInfo.positions} addValue={orgAddNames.positions} onAddValueChange={(value) => setOrgAddNames(prev => ({ ...prev, positions: value }))} onAdd={() => handleAddOrgItem('positions')} onDelete={(id) => handleDeleteOrgItem('positions', id)} editingItem={editingOrgItem} setEditingItem={setEditingOrgItem} onSaveEdit={handleUpdateOrgItem} draggingItem={draggingOrgItem} setDraggingItem={setDraggingOrgItem} dragOverItem={dragOverOrgItem} setDragOverItem={setDragOverOrgItem} onDropItem={handleReorderOrgItem} />
          <OrgMasterList title="직무/역할" subtitle="Job Roles" type="job-roles" items={orgInfo.jobRoles} addValue={orgAddNames.jobRoles} onAddValueChange={(value) => setOrgAddNames(prev => ({ ...prev, jobRoles: value }))} onAdd={() => handleAddOrgItem('job-roles')} onDelete={(id) => handleDeleteOrgItem('job-roles', id)} editingItem={editingOrgItem} setEditingItem={setEditingOrgItem} onSaveEdit={handleUpdateOrgItem} draggingItem={draggingOrgItem} setDraggingItem={setDraggingOrgItem} dragOverItem={dragOverOrgItem} setDragOverItem={setDragOverOrgItem} onDropItem={handleReorderOrgItem} />
        </div>
      )}

      {/* MODAL: USER DETAILS & EDIT */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-toss-gray-200/40 dark:border-slate-800 rounded-3xl p-6.5 max-w-2xl w-full shadow-toss-lg text-left select-none animate-scale-up max-h-[90vh] overflow-y-auto scrollbar-none">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-toss-gray-100 dark:border-slate-800 pb-3 mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-toss-blue/10 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-toss-blue" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-100">사용자 상세 정보 및 제어</h3>
                  <p className="text-[10px] text-toss-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Edit Account Profile</p>
                </div>
              </div>
              <button 
                onClick={closeEditModal}
                className="text-xs font-bold text-toss-gray-400 hover:text-toss-gray-700 dark:hover:text-slate-350 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: Basic Edit Form */}
              <div className="space-y-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">사용자 이름</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">로그인 아이디 (ID)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedUser.username}
                    className="w-full px-3 py-2 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-mono text-toss-gray-700 cursor-not-allowed select-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">이메일 주소</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">연락처</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">역할 (Role)</label>
                  <CustomSelect
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="member">일반 개발원 (member)</option>
                    <option value="manager">프로젝트 매니저 (manager)</option>
                    <option value="admin">최고 관리자 (admin)</option>
                  </CustomSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-toss-gray-400 dark:text-slate-500 uppercase">계정 활성화 상태</label>
                  <CustomSelect
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold cursor-pointer text-toss-gray-800 dark:text-slate-200"
                  >
                    <option value="active">활성 (Active)</option>
                    <option value="inactive">비활성 (Inactive)</option>
                  </CustomSelect>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-toss-gray-400 dark:text-slate-550 uppercase">부서</label>
                    <CustomSelect
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      className="w-full px-2 py-1.5 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                    >
                      <option value="">미지정</option>
                      {departmentOptions.map(d => (
                        <option key={d.id} value={d.path}>{`${'　'.repeat(d.depth)}${d.depth > 0 ? '└ ' : ''}${d.name}`}</option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-toss-gray-400 dark:text-slate-550 uppercase">직급</label>
                    <CustomSelect
                      value={editPos}
                      onChange={(e) => setEditPos(e.target.value)}
                      className="w-full px-2 py-1.5 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                    >
                      <option value="">미지정</option>
                      {orgInfo.positions.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-toss-gray-400 dark:text-slate-550 uppercase">직무</label>
                    <CustomSelect
                      value={editJr}
                      onChange={(e) => setEditJr(e.target.value)}
                      className="w-full px-2 py-1.5 bg-toss-gray-100 dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer text-toss-gray-800 dark:text-slate-200"
                    >
                      <option value="">미지정</option>
                      {orgInfo.jobRoles.map(jrItem => (
                        <option key={jrItem.id} value={jrItem.name}>{jrItem.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleUpdateUserInfo}
                    className="w-full py-2.5 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>사용자 정보 수정 저장</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Security Controls */}
              <div className="space-y-5 border-t md:border-t-0 md:border-l border-toss-gray-100 dark:border-slate-800 pt-5 md:pt-0 md:pl-5 text-xs font-bold flex flex-col justify-between h-full">
                
                {/* Device Reset Lock */}
                <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/40 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 text-toss-gray-850 dark:text-slate-200 font-extrabold text-xs">
                    <Laptop className="w-4 h-4 text-toss-blue" />
                    <span className="text-toss-gray-800 dark:text-slate-200">기기(PC) 접근 보안 관리</span>
                  </div>
                  <p className="text-[10.5px] text-toss-gray-400 dark:text-slate-550 leading-relaxed font-semibold">
                    이 계정에 고정 등록된 PC 식별값을 제거하여 접근 권한을 해제합니다. 다음 로그인 시 이 계정은 다시 신규 PC 등록 절차를 밟아야 합니다.
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 text-toss-gray-500 dark:text-slate-400 px-2 py-0.5 rounded font-black uppercase">
                      {selectedUser.device_hash ? 'PC 등록됨' : '미등록 상태'}
                    </span>
                  </div>

                  <button
                    onClick={handleResetDevice}
                    disabled={!selectedUser.device_hash}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer mt-1 ${
                      selectedUser.device_hash 
                        ? 'bg-toss-gray-100 hover:bg-toss-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-toss-gray-700 dark:text-slate-350'
                        : 'bg-toss-gray-100/50 text-toss-gray-300 dark:bg-slate-800/50 dark:text-slate-650 cursor-not-allowed'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>등록 PC 기기 강제 초기화</span>
                  </button>
                </div>

                {/* Password Reset */}
                <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/40 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 text-toss-gray-800 dark:text-slate-200 font-extrabold text-xs">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>임시 비밀번호 설정 (초기화)</span>
                  </div>
                  <p className="text-[10.5px] text-toss-gray-400 dark:text-slate-550 leading-relaxed font-semibold">
                    해당 계정의 비밀번호를 임시 값으로 강제 변경합니다. 초기화 직후 사용자는 <strong>다음 로그인 시 비밀번호 변경 화면에 의무 강제 노출</strong>됩니다.
                  </p>

                  <div className="flex gap-2 items-center mt-2.5">
                    <input
                      type="password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="초기화할 임시 비번 입력"
                      className="flex-1 min-w-0 text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-toss-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                    />
                    <button
                      onClick={handleResetPassword}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>재설정</span>
                    </button>
                  </div>
                </div>

                {/* Delete Account */}
                {selectedUser.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name)}
                    className="w-full py-2.5 border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1 mt-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>이 사용자 계정 완전히 삭제</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* DOUBLE-VERIFICATION ADMIN PASSWORD MODAL */}
      {showAdminModal && pendingAction && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-slate-900 border border-toss-gray-200/40 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-toss-lg text-left animate-scale-up">
            <div className="flex items-center gap-3 mb-4.5">
              <div className="w-9 h-9 rounded-xl bg-toss-blue/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-toss-blue" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-100">관리자 2차 인증</h3>
                <p className="text-[10px] text-toss-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Double Authentication</p>
              </div>
            </div>

            <p className="text-xs font-semibold text-toss-gray-500 dark:text-slate-400 mb-4 leading-relaxed">
              민감 보안 동작 (<strong>{pendingAction.description}</strong>) 실행을 위해 현재 로그인한 관리자 계정의 비밀번호를 재입력해 주세요.
            </p>

            {adminModalError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adminModalError}</span>
              </div>
            )}

            <form onSubmit={handleAdminModalSubmit} className="space-y-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-toss-gray-400 dark:text-slate-500 uppercase">관리자 비밀번호</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3.5 w-4 h-4 text-toss-gray-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="관리자 비번 입력"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 bg-toss-gray-100 hover:bg-toss-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-toss-gray-700 dark:text-slate-300 rounded-xl cursor-pointer transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={adminModalLoading}
                  className="px-5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {adminModalLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>승인 및 실행</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface OrgMasterListProps {
  title: string;
  subtitle: string;
  type: OrgItemType;
  items: api.OrgItem[];
  addValue: string;
  onAddValueChange: (value: string) => void;
  onAdd: (parentId?: string | null, nameOverride?: string) => void;
  onDelete: (id: string) => void;
  editingItem: { type: OrgItemType; id: string; name: string } | null;
  setEditingItem: (item: { type: OrgItemType; id: string; name: string } | null) => void;
  onSaveEdit: () => void;
  draggingItem: { type: OrgItemType; id: string } | null;
  setDraggingItem: (item: { type: OrgItemType; id: string } | null) => void;
  dragOverItem: { type: OrgItemType; id: string } | null;
  setDragOverItem: (item: { type: OrgItemType; id: string } | null) => void;
  onDropItem: (type: OrgItemType, draggedId: string, targetId: string) => void;
}

const OrgMasterList: React.FC<OrgMasterListProps> = ({
  title,
  subtitle,
  type,
  items,
  addValue,
  onAddValueChange,
  onAdd,
  onDelete,
  editingItem,
  setEditingItem,
  onSaveEdit,
  draggingItem,
  setDraggingItem,
  dragOverItem,
  setDragOverItem,
  onDropItem,
}) => (
  <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col min-h-[400px]">
    <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
      <div>
        <span className="text-sm font-black text-toss-gray-700 dark:text-slate-200">{title}</span>
        <p className="mt-1 text-[11px] font-bold text-toss-gray-400">{subtitle}</p>
      </div>
      <span className="text-xs text-toss-gray-400 font-bold">{items.length}개</span>
    </div>

    <div className="flex gap-2 mb-4 shrink-0">
      <input
        type="text"
        value={addValue}
        onChange={(e) => onAddValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd();
        }}
        placeholder={`새 ${title} 입력`}
        className="flex-1 min-w-0 text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
      />
      <button
        onClick={() => onAdd()}
        className="px-3.5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all"
      >
        추가
      </button>
    </div>

    <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
      {items.length === 0 ? (
        <p className="text-center text-xs text-toss-gray-400 py-10 font-bold">등록된 항목이 없습니다.</p>
      ) : (
        items.map((item) => {
          const isEditing = editingItem?.type === type && editingItem.id === item.id;
          const isDragging = draggingItem?.type === type && draggingItem.id === item.id;
          const isDropTarget = dragOverItem?.type === type && dragOverItem.id === item.id && !isDragging;
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDraggingItem({ type, id: item.id })}
              onDragEnter={() => setDragOverItem({ type, id: item.id })}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverItem({ type, id: item.id });
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget as HTMLElement | null;
                if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                  setDragOverItem(null);
                }
              }}
              onDrop={() => {
                if (draggingItem?.type === type) onDropItem(type, draggingItem.id, item.id);
                setDraggingItem(null);
                setDragOverItem(null);
              }}
              onDragEnd={() => {
                setDraggingItem(null);
                setDragOverItem(null);
              }}
              className={`relative flex items-center gap-2 px-3 py-2.5 bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all font-semibold text-xs text-toss-gray-800 dark:text-slate-200 ${
                isDragging ? 'opacity-45 scale-[0.99] ring-2 ring-toss-blue/20' : ''
              } ${isDropTarget ? 'bg-blue-50 dark:bg-blue-950/20 ring-1 ring-toss-blue/25 translate-y-0.5' : ''}`}
            >
              {isDropTarget && (
                <span className="absolute -top-1 left-3 right-3 h-0.5 rounded-full bg-toss-blue shadow-[0_0_0_3px_rgba(49,130,246,0.12)]" />
              )}
              <GripVertical className="w-3.5 h-3.5 text-toss-gray-300 cursor-grab shrink-0" />
              {isEditing ? (
                <input
                  value={editingItem.name}
                  onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSaveEdit();
                    if (event.key === 'Escape') setEditingItem(null);
                  }}
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-toss-gray-200 dark:border-slate-700 text-xs font-bold outline-none"
                />
              ) : (
                <span className="flex-1 min-w-0 truncate">{item.name}</span>
              )}
              {isEditing ? (
                <>
                  <button onClick={onSaveEdit} className="p-1 rounded text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingItem(null)} className="p-1 rounded text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditingItem({ type, id: item.id, name: item.name })} className="p-1 rounded text-toss-gray-400 hover:text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 rounded text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  </div>
);

const DetailLine: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
    <span className="text-xs font-black text-[#8B95A1]">{label}</span>
    <span className="text-xs font-bold text-[#191F28] text-right break-all">{value}</span>
  </div>
);

interface DepartmentTreeManagerProps {
  departments: api.OrgItem[];
  users: User[];
  addValue: string;
  onAddValueChange: (value: string) => void;
  onAdd: (parentId?: string | null, nameOverride?: string) => void;
  onDelete: (id: string) => void;
  editingItem: { type: OrgItemType; id: string; name: string } | null;
  setEditingItem: (item: { type: OrgItemType; id: string; name: string } | null) => void;
  onSaveEdit: () => void;
  draggingItem: { type: OrgItemType; id: string } | null;
  setDraggingItem: (item: { type: OrgItemType; id: string } | null) => void;
  dragOverItem: { type: OrgItemType; id: string } | null;
  setDragOverItem: (item: { type: OrgItemType; id: string } | null) => void;
  onDropDepartment: (type: OrgItemType, draggedId: string, targetId: string) => void;
  draggingUserId: string | null;
  setDraggingUserId: (id: string | null) => void;
  dragOverDepartmentId: string | null;
  setDragOverDepartmentId: (id: string | null) => void;
  onMoveUser: (userId: string, departmentName: string | null) => void | Promise<void>;
  onMoveDepartmentParent: (departmentId: string, parentId: string | null) => void | Promise<void>;
}

export const DepartmentTreeManager: React.FC<DepartmentTreeManagerProps> = ({
  departments,
  users,
  addValue,
  onAddValueChange,
  onAdd,
  onDelete,
  editingItem,
  setEditingItem,
  onSaveEdit,
  draggingItem,
  setDraggingItem,
  dragOverItem,
  setDragOverItem,
  onDropDepartment,
  draggingUserId,
  setDraggingUserId,
  dragOverDepartmentId,
  setDragOverDepartmentId,
  onMoveUser,
  onMoveDepartmentParent,
}) => {
  const unassignedUsers = users.filter((user) => !user.department);
  const departmentNodes = buildDepartmentTree(departments);
  const [childAddNames, setChildAddNames] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'flow' | 'tree' | 'list'>('flow');
  const [selectedNode, setSelectedNode] = useState<{
    type: 'org' | 'department' | 'team' | 'person' | 'unassigned';
    node?: DepartmentTreeNode;
    user?: User;
  }>({ type: 'org' });
  const allDepartmentNodes = flattenDepartmentTree(departmentNodes);
  const rootDepartments = allDepartmentNodes.filter((node) => node.depth === 0);
  const teamNodes = allDepartmentNodes.filter((node) => node.depth === 1);
  const partNodes = allDepartmentNodes.filter((node) => node.depth >= 2);

  const getNodeMembers = (node: DepartmentTreeNode) =>
    users.filter((user) => user.department === node.path || (node.depth === 0 && user.department === node.name));

  const findNodeByDepartmentPath = (department?: string | null) =>
    department ? allDepartmentNodes.find((node) => node.path === department || node.name === department) : undefined;

  const getAncestorIds = (node?: DepartmentTreeNode): string[] => {
    if (!node) return [];
    const parent = node.parent_id ? allDepartmentNodes.find((item) => item.id === node.parent_id) : undefined;
    return [...getAncestorIds(parent), node.id];
  };

  const selectedPathIds = selectedNode.node
    ? getAncestorIds(selectedNode.node)
    : getAncestorIds(findNodeByDepartmentPath(selectedNode.user?.department));
  const selectedPathSet = new Set(selectedPathIds);
  const isNodeHighlighted = (node: DepartmentTreeNode) => selectedPathSet.has(node.id);

  const isDescendantNode = (target: DepartmentTreeNode, maybeAncestorId: string): boolean => {
    if (!target.parent_id) return false;
    if (target.parent_id === maybeAncestorId) return true;
    const parent = allDepartmentNodes.find((node) => node.id === target.parent_id);
    return parent ? isDescendantNode(parent, maybeAncestorId) : false;
  };

  const handleDropOnNode = (event: React.DragEvent, node: DepartmentTreeNode) => {
    event.preventDefault();
    if (draggingUserId) {
      const member = users.find((item) => item.id === draggingUserId);
      if (member && window.confirm(`'${member.name}'을(를) '${node.path}'에 배정할까요?`)) {
        onMoveUser(draggingUserId, node.path);
      }
    } else if (draggingItem?.type === 'departments' && draggingItem.id !== node.id) {
      if (isDescendantNode(node, draggingItem.id)) {
        alert('하위 조직으로 자기 자신을 이동할 수 없습니다.');
      } else {
        onMoveDepartmentParent(draggingItem.id, node.id);
      }
    }
    setDraggingItem(null);
    setDragOverItem(null);
    setDraggingUserId(null);
    setDragOverDepartmentId(null);
  };

  const handleDropToRoot = (event: React.DragEvent) => {
    event.preventDefault();
    if (draggingItem?.type === 'departments') {
      onMoveDepartmentParent(draggingItem.id, null);
    }
    setDraggingItem(null);
    setDragOverItem(null);
  };

  const requestAddDepartment = (parentId: string | null = null, label = '조직') => {
    const name = window.prompt(`${label} 이름을 입력하세요.`);
    if (name?.trim()) onAdd(parentId, name.trim());
  };

  const handleAddChild = (parentId: string) => {
    const value = childAddNames[parentId]?.trim();
    if (!value) return;
    onAdd(parentId, value);
    setChildAddNames((prev) => ({ ...prev, [parentId]: '' }));
  };

  const renderUserCard = (member: User, compact = false) => (
    <div
      key={member.id}
      draggable
      onDragStart={() => setDraggingUserId(member.id)}
      onDragEnd={() => {
        setDraggingUserId(null);
        setDragOverDepartmentId(null);
      }}
      className={`group flex items-center gap-2.5 rounded-xl border border-toss-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 cursor-grab transition-all ${
        compact ? 'py-2' : ''
      } ${
        draggingUserId === member.id
          ? 'opacity-50 scale-[0.98] ring-2 ring-toss-blue/20'
          : 'hover:border-toss-blue/40 hover:shadow-sm'
      }`}
      title="드래그해서 다른 부서로 이동"
    >
      <Avatar name={member.name} profileImage={member.profile_image} className="w-7 h-7 text-[10px]" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[11px] font-black text-toss-gray-800 dark:text-slate-100 truncate">{member.name}</span>
        <span className="block text-[10px] font-bold text-toss-gray-400 truncate">{member.position || member.job_role || member.role}</span>
      </span>
      <GripVertical className="w-3.5 h-3.5 text-toss-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );

  const renderDepartmentNode = (node: DepartmentTreeNode, index: number) => {
    const members = getNodeMembers(node);
    const isEditing = editingItem?.type === 'departments' && editingItem.id === node.id;
    const isDraggingDept = draggingItem?.type === 'departments' && draggingItem.id === node.id;
    const isDeptDropTarget = dragOverItem?.type === 'departments' && dragOverItem.id === node.id && !isDraggingDept;
    const isUserDropTarget = dragOverDepartmentId === node.id && Boolean(draggingUserId);
    const childValue = childAddNames[node.id] || '';
    const levelLabel = node.depth === 0 ? '부' : node.depth === 1 ? '팀' : '파트';

    return (
      <div
        key={node.id}
        draggable
        onDragStart={(event) => {
          if ((event.target as HTMLElement).closest('[data-user-card], [data-tree-control]')) return;
          setDraggingItem({ type: 'departments', id: node.id });
        }}
        onDragEnter={() => setDragOverItem({ type: 'departments', id: node.id })}
        onDragOver={(event) => {
          event.preventDefault();
          if (draggingUserId) setDragOverDepartmentId(node.id);
          else setDragOverItem({ type: 'departments', id: node.id });
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggingUserId) onMoveUser(draggingUserId, node.path);
          else if (draggingItem?.type === 'departments') onDropDepartment('departments', draggingItem.id, node.id);
          setDraggingItem(null);
          setDragOverItem(null);
          setDraggingUserId(null);
          setDragOverDepartmentId(null);
        }}
        onDragEnd={() => {
          setDraggingItem(null);
          setDragOverItem(null);
          setDragOverDepartmentId(null);
        }}
        className="relative ml-5"
      >
        <span className="absolute -left-5 top-7 w-5 h-px bg-toss-gray-200 dark:bg-slate-700" />
        <span className={`absolute -left-[31px] top-4 w-6 h-6 rounded-full border-4 border-toss-gray-50 dark:border-slate-850 bg-white dark:bg-slate-900 text-[10px] font-black flex items-center justify-center ${
          node.depth === 0 ? 'text-toss-blue' : node.depth === 1 ? 'text-emerald-500' : 'text-violet-500'
        }`}>
          {index + 1}
        </span>
        {isDeptDropTarget && <span className="absolute -top-1 left-3 right-3 h-0.5 rounded-full bg-toss-blue shadow-[0_0_0_3px_rgba(49,130,246,0.12)]" />}
        <div className={`rounded-2xl border transition-all ${
          isUserDropTarget
            ? 'border-toss-blue bg-blue-50/80 dark:bg-blue-950/20 ring-2 ring-toss-blue/15'
            : isDeptDropTarget
            ? 'border-toss-blue/40 bg-blue-50/50 dark:bg-blue-950/10'
            : 'border-toss-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900'
        } ${isDraggingDept ? 'opacity-50 scale-[0.99]' : ''}`}>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-toss-gray-300 cursor-grab shrink-0" />
              <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black ${
                node.depth === 0
                  ? 'bg-blue-50 dark:bg-blue-950/20 text-toss-blue'
                  : node.depth === 1
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                  : 'bg-violet-50 dark:bg-violet-950/20 text-violet-600'
              }`}>
                {levelLabel}
              </span>
              {isEditing ? (
                <input
                  data-tree-control
                  value={editingItem.name}
                  onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSaveEdit();
                    if (event.key === 'Escape') setEditingItem(null);
                  }}
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-toss-gray-50 dark:bg-slate-950 border border-toss-gray-200 dark:border-slate-700 text-xs font-bold outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-toss-gray-800 dark:text-slate-100 truncate">{node.name}</span>
                  <span className="block text-[10px] font-bold text-toss-gray-400 mt-0.5 truncate">{node.path}</span>
                </span>
              )}
              <span className="shrink-0 px-2 py-1 rounded-full bg-toss-gray-100 dark:bg-slate-800 text-[11px] font-black text-toss-gray-500">
                하위 {node.children.length}
              </span>
              <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-black ${
                members.length > 0
                  ? 'bg-blue-50 dark:bg-blue-950/20 text-toss-blue'
                  : 'bg-toss-gray-100 dark:bg-slate-800 text-toss-gray-400'
              }`}>
                {members.length}명
              </span>
              {isEditing ? (
                <>
                  <button data-tree-control onClick={onSaveEdit} className="p-1.5 rounded-lg text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button data-tree-control onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button data-tree-control onClick={() => setEditingItem({ type: 'departments', id: node.id, name: node.name })} className="p-1.5 rounded-lg text-toss-gray-400 hover:text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button data-tree-control onClick={() => onDelete(node.id)} className="p-1.5 rounded-lg text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className={`mt-3 rounded-xl border border-dashed p-3 transition-all ${
              isUserDropTarget
                ? 'border-toss-blue bg-white/80 dark:bg-slate-950/50'
                : 'border-toss-gray-200 dark:border-slate-700 bg-toss-gray-50/70 dark:bg-slate-950/30'
            }`}>
              {members.length === 0 ? (
                <div className="h-12 flex items-center justify-center text-[11px] font-bold text-toss-gray-400">
                  {isUserDropTarget ? '여기에 놓으면 이 조직 노드에 배정됩니다.' : '직접 배정된 인력이 없습니다.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2">
                  {members.map((member) => <span key={member.id} data-user-card>{renderUserCard(member, true)}</span>)}
                </div>
              )}
            </div>

            <div data-tree-control className="mt-3 flex gap-2">
              <input
                value={childValue}
                onChange={(event) => setChildAddNames((prev) => ({ ...prev, [node.id]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddChild(node.id);
                }}
                placeholder={`${node.depth === 0 ? '팀' : '하위 조직'} 추가`}
                className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-toss-gray-50 dark:bg-slate-950 border border-toss-gray-100 dark:border-slate-800 text-[11px] font-bold text-toss-gray-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-toss-blue/50"
              />
              <button
                onClick={() => handleAddChild(node.id)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-toss-gray-100 dark:border-slate-800 text-[11px] font-black text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
              >
                하위 추가
              </button>
            </div>
          </div>

          {node.children.length > 0 && (
            <div className="px-4 pb-4">
              <div className="relative ml-5 border-l border-toss-gray-200 dark:border-slate-700 pl-4 space-y-3">
                {node.children.map((child, childIndex) => renderDepartmentNode(child, childIndex))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFlowDepartmentNode = (node: DepartmentTreeNode, index: number) => {
    const members = getNodeMembers(node);
    const isEditing = editingItem?.type === 'departments' && editingItem.id === node.id;
    const isDraggingDept = draggingItem?.type === 'departments' && draggingItem.id === node.id;
    const isDeptDropTarget = dragOverItem?.type === 'departments' && dragOverItem.id === node.id && !isDraggingDept;
    const isUserDropTarget = dragOverDepartmentId === node.id && Boolean(draggingUserId);
    const childValue = childAddNames[node.id] || '';
    const levelLabel = node.depth === 0 ? '부' : node.depth === 1 ? '팀' : '파트';
    const levelTone = node.depth === 0
      ? 'bg-blue-50 dark:bg-blue-950/20 text-toss-blue'
      : node.depth === 1
      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
      : 'bg-violet-50 dark:bg-violet-950/20 text-violet-600';

    return (
      <div key={node.id} className="relative flex items-start gap-14">
        <div
          draggable
          onDragStart={(event) => {
            if ((event.target as HTMLElement).closest('[data-user-card], [data-tree-control]')) return;
            setDraggingItem({ type: 'departments', id: node.id });
          }}
          onDragEnter={() => setDragOverItem({ type: 'departments', id: node.id })}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingUserId) setDragOverDepartmentId(node.id);
            else setDragOverItem({ type: 'departments', id: node.id });
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingUserId) onMoveUser(draggingUserId, node.path);
            else if (draggingItem?.type === 'departments') onDropDepartment('departments', draggingItem.id, node.id);
            setDraggingItem(null);
            setDragOverItem(null);
            setDraggingUserId(null);
            setDragOverDepartmentId(null);
          }}
          onDragEnd={() => {
            setDraggingItem(null);
            setDragOverItem(null);
            setDragOverDepartmentId(null);
          }}
          className={`relative w-[300px] shrink-0 transition-all ${
            isUserDropTarget
              ? 'rounded-3xl bg-blue-50/80 dark:bg-blue-950/20 ring-4 ring-toss-blue/10'
              : isDeptDropTarget
              ? 'rounded-3xl bg-blue-50/50 dark:bg-blue-950/10 ring-2 ring-toss-blue/20'
              : ''
          } ${isDraggingDept ? 'opacity-50 scale-[0.99]' : ''}`}
        >
          <div className="relative pl-7">
            <span className={`absolute left-0 top-3 w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${
              node.depth === 0 ? 'bg-toss-blue' : node.depth === 1 ? 'bg-emerald-400' : 'bg-violet-400'
            }`} />
            <span className={`absolute left-[5px] top-6 bottom-0 w-px ${
              node.children.length > 0 ? 'bg-toss-blue/35' : 'bg-transparent'
            }`} />

            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black ${levelTone}`}>{levelLabel}</span>
                  <span className="shrink-0 text-[10px] font-black text-toss-gray-300">#{index + 1}</span>
                  <span className="min-w-0 text-[10px] font-bold text-toss-gray-400 truncate">{node.path}</span>
                </div>
                {isEditing ? (
                  <input
                    data-tree-control
                    value={editingItem.name}
                    onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSaveEdit();
                      if (event.key === 'Escape') setEditingItem(null);
                    }}
                    autoFocus
                    className="mt-2 w-full px-2 py-1.5 rounded-lg bg-toss-gray-50 dark:bg-slate-950 border border-toss-gray-200 dark:border-slate-700 text-xs font-bold outline-none"
                  />
                ) : (
                  <p className="mt-1 text-base font-black text-toss-gray-900 dark:text-slate-100 truncate">{node.name}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10px] font-black text-toss-gray-400">
                  <span>하위 {node.children.length}</span>
                  <span className="w-1 h-1 rounded-full bg-toss-gray-300" />
                  <span>{members.length}명 배정</span>
                </div>
              </div>
              <GripVertical className="w-4 h-4 text-toss-gray-300 cursor-grab shrink-0 mt-1" />
            </div>

            <div className={`mt-3 rounded-2xl border border-dashed px-3 py-3 transition-all ${
              isUserDropTarget
                ? 'border-toss-blue bg-white/90 dark:bg-slate-950/50'
                : 'border-toss-gray-200/80 dark:border-slate-700 bg-white/35 dark:bg-slate-950/20'
            }`}>
              {members.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-thin" data-tree-control>
                {members.map((member) => <span key={member.id} data-user-card>{renderUserCard(member, true)}</span>)}
                </div>
              ) : (
                <div className="h-14 flex items-center justify-center text-[11px] font-bold text-toss-gray-400">
                  {isUserDropTarget ? '여기에 놓으면 이 조직에 배정됩니다.' : '배정된 인원이 없습니다.'}
                </div>
              )}
            </div>

            <div data-tree-control className="mt-3 flex gap-2">
              <input
                value={childValue}
                onChange={(event) => setChildAddNames((prev) => ({ ...prev, [node.id]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddChild(node.id);
                }}
                placeholder={`${node.depth === 0 ? '팀' : '하위 조직'} 추가`}
                className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-toss-gray-50 dark:bg-slate-950 border border-toss-gray-100 dark:border-slate-800 text-[11px] font-bold text-toss-gray-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-toss-blue/50"
              />
              <button
                onClick={() => handleAddChild(node.id)}
                className="px-3 py-2 rounded-xl bg-toss-gray-900 dark:bg-slate-950 text-[11px] font-black text-white hover:bg-slate-700 cursor-pointer"
              >
                추가
              </button>
            </div>

            <div className="mt-2 flex justify-end gap-1.5" data-tree-control>
              {isEditing ? (
                <>
                  <button onClick={onSaveEdit} className="p-1.5 rounded-lg text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg text-toss-gray-400 hover:bg-toss-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditingItem({ type: 'departments', id: node.id, name: node.name })} className="p-1.5 rounded-lg text-toss-gray-400 hover:text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(node.id)} className="p-1.5 rounded-lg text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {node.children.length > 0 && (
          <div className="relative flex flex-col gap-7 pt-1">
            <span className="absolute -left-14 top-4 w-14 h-px bg-toss-blue/70" />
            <span className="absolute -left-14 top-4 bottom-4 w-px bg-toss-blue/45" />
            {node.children.map((child, childIndex) => (
              <div key={child.id} className="relative">
                <span className="absolute -left-14 top-4 w-14 h-px bg-toss-blue/70" />
                {renderFlowDepartmentNode(child, childIndex)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const badgeClass = (type: 'org' | 'department' | 'team' | 'person' | 'unassigned') => {
    if (type === 'org') return 'bg-slate-900 text-white';
    if (type === 'department') return 'bg-blue-50 text-toss-blue';
    if (type === 'team') return 'bg-emerald-50 text-emerald-600';
    if (type === 'person') return 'bg-violet-50 text-violet-600';
    return 'bg-slate-100 text-slate-500';
  };

  const renderNodeCard = (node: DepartmentTreeNode, type: 'department' | 'team') => {
    const members = getNodeMembers(node);
    const leader = members[0];
    const isDropTarget = dragOverDepartmentId === node.id || dragOverItem?.id === node.id;
    const isHighlighted = isNodeHighlighted(node);
    return (
      <button
        key={node.id}
        draggable
        onClick={() => setSelectedNode({ type, node })}
        onDragStart={() => setDraggingItem({ type: 'departments', id: node.id })}
        onDragOver={(event) => {
          event.preventDefault();
          if (draggingUserId) setDragOverDepartmentId(node.id);
          else if (draggingItem?.type === 'departments') setDragOverItem({ type: 'departments', id: node.id });
        }}
        onDragLeave={() => {
          if (dragOverDepartmentId === node.id) setDragOverDepartmentId(null);
          if (dragOverItem?.id === node.id) setDragOverItem(null);
        }}
        onDrop={(event) => handleDropOnNode(event, node)}
        onDragEnd={() => {
          setDraggingItem(null);
          setDragOverItem(null);
          setDragOverDepartmentId(null);
        }}
        className={`relative w-full text-left rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border transition-all cursor-pointer hover:-translate-y-0.5 hover:border-toss-blue/40 ${
          isDropTarget
            ? 'border-toss-blue ring-4 ring-toss-blue/10'
            : isHighlighted
            ? 'border-toss-blue ring-4 ring-toss-blue/10 shadow-[0_12px_30px_rgba(49,130,246,0.12)]'
            : 'border-slate-100'
        }`}
      >
        <span className={`absolute -left-8 top-1/2 w-8 h-[2px] ${isHighlighted ? 'bg-toss-blue' : 'bg-[#CBD5E1]'}`} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-[10px] font-black ${badgeClass(type)}`}>{type === 'department' ? '부서' : '팀'}</span>
              <span className="text-[10px] font-bold text-slate-400">{type === 'department' ? `DEP-${node.id.slice(-3).toUpperCase()}` : node.parent_id ? node.path.split(' / ')[0] : 'ROOT'}</span>
            </div>
            <p className="mt-2 text-sm font-black text-[#191F28] truncate">{node.name}</p>
            <p className="mt-1 text-[11px] font-bold text-[#8B95A1] truncate">{node.path}</p>
          </div>
          <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] font-black text-slate-500">
          <span>하위 {node.children.length}</span>
          <span>인력 {members.length}</span>
        </div>
        {isDropTarget && (
          <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-black text-toss-blue">
            {draggingUserId ? '이 조직에 인원을 배정합니다' : '이 조직 아래로 이동합니다'}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {leader ? (
            <>
              <Avatar name={leader.name} profileImage={leader.profile_image} className="w-6 h-6 text-[9px]" />
              <span className="min-w-0 text-[11px] font-bold text-slate-500 truncate">{type === 'department' ? '부서장' : '팀장'}: {leader.name}</span>
            </>
          ) : (
            <span className="text-[11px] font-bold text-slate-400">리더 미지정</span>
          )}
        </div>
      </button>
    );
  };

  const renderPersonNode = (member: User, unassigned = false) => (
    <button
      key={member.id}
      draggable
      onClick={() => setSelectedNode({ type: unassigned ? 'unassigned' : 'person', user: member })}
      onDragStart={() => setDraggingUserId(member.id)}
      onDragEnd={() => {
        setDraggingUserId(null);
        setDragOverDepartmentId(null);
      }}
      className={`relative w-full text-left rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border hover:border-toss-blue/40 hover:-translate-y-0.5 transition-all cursor-grab ${
        selectedNode.user?.id === member.id ? 'border-toss-blue ring-4 ring-toss-blue/10' : 'border-slate-100'
      }`}
    >
      {!unassigned && <span className={`absolute -left-8 top-1/2 w-8 h-[2px] ${selectedNode.user?.id === member.id ? 'bg-toss-blue' : 'bg-[#CBD5E1]'}`} />}
      <div className="flex items-center gap-3">
        <Avatar name={member.name} profileImage={member.profile_image} className="w-9 h-9 text-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-[#191F28] truncate">{member.name}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeClass(unassigned ? 'unassigned' : 'person')}`}>
              {unassigned ? '미배정' : '인력'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] font-bold text-[#8B95A1] truncate">{member.job_role || member.position || member.role}</p>
        </div>
        <span className="px-2 py-1 rounded-full bg-blue-50 text-[10px] font-black text-toss-blue">100%</span>
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400 truncate">{member.department || '소속 없음'}</p>
    </button>
  );

  const renderColumn = (
    title: string,
    count: number,
    children: React.ReactNode,
    actionLabel?: string,
    onAction?: () => void
  ) => (
    <section className="relative w-[280px] shrink-0 rounded-[24px] bg-slate-50/90 border border-slate-200/70 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-black text-[#191F28]">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-white text-[11px] font-black text-[#8B95A1]">{count}</span>
          {actionLabel && onAction && (
            <button onClick={onAction} className="px-2 py-1 rounded-lg bg-white text-[11px] font-black text-toss-blue hover:bg-blue-50">
              + {actionLabel}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );

  const selectedTitle =
    selectedNode.user?.name ||
    selectedNode.node?.name ||
    'Project Atlas';

  return (
    <div className="bg-[#F8FAFC] rounded-[28px] border border-slate-200/70 overflow-hidden min-h-[760px] flex flex-col">
      <header className="px-6 py-5 bg-white border-b border-slate-200/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-[#191F28]">Project Atlas 조직도</h3>
          <p className="mt-1 text-xs font-bold text-[#8B95A1]">조직, 부서, 팀, 인력 배치를 Flow Diagram으로 관리합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['부서', rootDepartments.length],
            ['팀', teamNodes.length],
            ['전체 인력', users.length],
            ['미배정', unassignedUsers.length],
          ].map(([label, value]) => (
            <span key={label} className="px-3 py-2 rounded-xl bg-slate-50 text-xs font-black text-slate-600">{label} {value}</span>
          ))}
          <div className="ml-0 xl:ml-2 flex rounded-xl bg-slate-100 p-1">
            {(['flow', 'tree', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${viewMode === mode ? 'bg-white text-toss-blue shadow-sm' : 'text-slate-500'}`}
              >
                {mode === 'flow' ? 'Flow View' : mode === 'tree' ? 'Tree View' : 'List View'}
              </button>
            ))}
          </div>
          <button onClick={() => requestAddDepartment(null, '부서')} className="px-3 py-2 rounded-xl bg-toss-blue text-xs font-black text-white">부서 추가</button>
          <button
            onClick={() => {
              if (selectedNode.node) requestAddDepartment(selectedNode.node.id, '팀');
              else alert('팀을 추가할 부서 카드를 먼저 선택하세요.');
            }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-toss-blue"
          >
            팀 추가
          </button>
          <button onClick={() => alert('인력 추가는 사용자 계정 등록에서 진행합니다.')} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-600">인력 추가</button>
        </div>
      </header>

      <div className="min-h-0 flex-1 grid grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="bg-white border-r border-slate-200/70 p-4 flex flex-col gap-4">
          <section className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#191F28]">조직별 보기</h4>
              <span className="text-[10px] font-black text-[#8B95A1]">{departmentNodes.length}</span>
            </div>
            <div className="mt-3 space-y-1">
              <button onClick={() => setSelectedNode({ type: 'org' })} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 text-xs font-black text-toss-blue">
                전체 조직 <span>{users.length}</span>
              </button>
              {rootDepartments.map((node) => (
                <button key={node.id} onClick={() => setSelectedNode({ type: 'department', node })} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white text-xs font-bold text-slate-600">
                  {node.name} <span>{getNodeMembers(node).length}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#191F28]">즐겨찾기</h4>
              <button className="text-toss-blue text-xs font-black">+</button>
            </div>
            <div className="mt-3 space-y-2">
              {allDepartmentNodes.slice(0, 3).map((node) => (
                <button key={node.id} onClick={() => setSelectedNode({ type: node.depth === 0 ? 'department' : 'team', node })} className="w-full rounded-xl bg-white p-3 text-left border border-slate-100">
                  <p className="text-xs font-black text-[#191F28] truncate">{node.name}</p>
                  <p className="mt-1 text-[10px] font-bold text-[#8B95A1] truncate">{node.path}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="mt-auto rounded-2xl bg-slate-50 p-3">
            <h4 className="text-xs font-black text-[#191F28]">전체 요약</h4>
            <div className="mt-3 space-y-2 text-xs font-bold text-slate-500">
              <p className="flex justify-between">부서 <span>{rootDepartments.length}</span></p>
              <p className="flex justify-between">팀 <span>{teamNodes.length}</span></p>
              <p className="flex justify-between">파트 <span>{partNodes.length}</span></p>
              <p className="flex justify-between">미배정 <span>{unassignedUsers.length}</span></p>
            </div>
          </section>
        </aside>

        <main className="relative overflow-auto p-3 bg-[#F8FAFC]">
          <div className="relative min-w-[1500px] min-h-[780px] grid grid-cols-[270px_300px_300px_300px_280px] gap-4">
            <div className="absolute left-[250px] top-[270px] w-[34px] h-[2px] bg-[#9FB3CC]" />
            <div className="absolute left-[284px] top-[132px] bottom-[64px] w-[2px] bg-[#9FB3CC]" />
            <div className="absolute left-[584px] top-[108px] bottom-[86px] w-[2px] bg-[#CBD5E1]" />
            <div className="absolute left-[884px] top-[108px] bottom-[86px] w-[2px] bg-[#CBD5E1]" />

            <section className="relative rounded-[16px] bg-white border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.04)] p-4">
              <h4 className="text-sm font-black text-[#191F28]">조직</h4>
              <div
                onClick={() => setSelectedNode({ type: 'org' })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDropToRoot}
                className="absolute left-4 right-4 top-[240px] rounded-2xl bg-slate-900 p-4 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-toss-blue flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black truncate">Project Atlas</p>
                    <p className="text-[11px] font-bold text-slate-300">본사 조직</p>
                  </div>
                </div>
                <span className="inline-block mt-3 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black">조직</span>
              </div>
            </section>

            {renderColumn('부서', rootDepartments.length, (
              <div className="pt-16 space-y-8">
                {rootDepartments.map((node) => (
                  <div key={node.id} className="relative">
                    <span className={`absolute -left-10 top-1/2 w-10 h-[2px] ${isNodeHighlighted(node) ? 'bg-toss-blue' : 'bg-[#9FB3CC]'}`} />
                    {renderNodeCard(node, 'department')}
                  </div>
                ))}
              </div>
            ), '부서 추가', () => requestAddDepartment(null, '부서'))}

            {renderColumn('팀', teamNodes.length, (
              <div className="space-y-4">
                {teamNodes.map((node) => (
                  <div key={node.id} className="relative">
                    <span className={`absolute -left-10 top-1/2 w-10 h-[2px] ${isNodeHighlighted(node) ? 'bg-toss-blue' : 'bg-[#CBD5E1]'}`} />
                    {renderNodeCard(node, 'team')}
                  </div>
                ))}
              </div>
            ), '팀 추가', () => {
              if (selectedNode.node) requestAddDepartment(selectedNode.node.id, '팀');
              else alert('팀을 추가할 부서 카드를 먼저 선택하세요.');
            })}

            {renderColumn('파트 / 인력', partNodes.length + users.filter((user) => user.department).length, (
              <div className="space-y-4">
                {partNodes.map((node) => (
                  <div key={node.id} className="relative">
                    <span className={`absolute -left-10 top-1/2 w-10 h-[2px] ${isNodeHighlighted(node) ? 'bg-toss-blue' : 'bg-[#CBD5E1]'}`} />
                    {renderNodeCard(node, 'team')}
                  </div>
                ))}
                {users.filter((user) => user.department).map((member) => (
                  <div key={member.id} className="relative">
                    <span className={`absolute -left-10 top-1/2 w-10 h-[2px] ${selectedNode.user?.id === member.id ? 'bg-toss-blue' : 'bg-[#CBD5E1]'}`} />
                    {renderPersonNode(member)}
                  </div>
                ))}
              </div>
            ), '인력 추가', () => alert('인력 추가는 사용자 계정 등록에서 진행합니다.'))}

            {renderColumn('미배정 인력', unassignedUsers.length, (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingUserId) {
                    const member = users.find((item) => item.id === draggingUserId);
                    if (member && window.confirm(`'${member.name}'을(를) 미배정 상태로 변경할까요?`)) onMoveUser(draggingUserId, null);
                  }
                  setDraggingUserId(null);
                }}
                className="space-y-4"
              >
                {unassignedUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs font-bold text-slate-400">미배정 인력이 없습니다.</div>
                ) : (
                  unassignedUsers.map((member) => renderPersonNode(member, true))
                )}
                <button onClick={() => alert('인력 추가는 사용자 계정 등록에서 진행합니다.')} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 text-xs font-black text-toss-blue">+ 인력 추가</button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] font-bold text-[#8B95A1]">인력 카드를 팀/부서로 드래그하거나, 팀 카드를 부서로 드래그해 소속을 변경할 수 있습니다.</p>
        </main>

        <aside className="bg-white border-l border-slate-200/70 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black ${badgeClass(selectedNode.type)}`}>
                {selectedNode.type === 'org' ? '조직' : selectedNode.type === 'department' ? '부서' : selectedNode.type === 'team' ? '팀' : selectedNode.type === 'unassigned' ? '미배정' : '인력'}
              </span>
              <h4 className="mt-3 text-lg font-black text-[#191F28]">{selectedTitle}</h4>
              <p className="mt-1 text-xs font-bold text-[#8B95A1]">{selectedNode.node?.path || selectedNode.user?.department || '본사 조직'}</p>
            </div>
            <button onClick={() => setSelectedNode({ type: 'org' })} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {selectedNode.user ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={selectedNode.user.name} profileImage={selectedNode.user.profile_image} className="w-12 h-12" />
                  <div>
                    <p className="text-sm font-black text-[#191F28]">{selectedNode.user.name}</p>
                    <p className="text-xs font-bold text-[#8B95A1]">{selectedNode.user.job_role || selectedNode.user.position || selectedNode.user.role}</p>
                  </div>
                </div>
                <DetailLine label="이메일" value={selectedNode.user.email || '-'} />
                <DetailLine label="연락처" value={selectedNode.user.phone || '-'} />
                <DetailLine label="소속" value={selectedNode.user.department || '미배정'} />
                <DetailLine label="투입률" value="100%" />
                <button className="w-full px-4 py-3 rounded-xl bg-toss-blue text-sm font-black text-white">수정</button>
              </>
            ) : selectedNode.node ? (
              <>
                <DetailLine label={selectedNode.node.depth === 0 ? '부서명' : '팀명'} value={selectedNode.node.name} />
                <DetailLine label="상위 경로" value={selectedNode.node.path} />
                <DetailLine label="하위 조직" value={`${selectedNode.node.children.length}개`} />
                <DetailLine label="소속 인력" value={`${getNodeMembers(selectedNode.node).length}명`} />
                <div>
                  <p className="text-xs font-black text-[#191F28] mb-2">구성원</p>
                  <div className="space-y-2">
                    {getNodeMembers(selectedNode.node).slice(0, 5).map((member) => (
                      <div key={member.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                        <Avatar name={member.name} profileImage={member.profile_image} className="w-7 h-7 text-[10px]" />
                        <span className="text-xs font-bold text-slate-600">{member.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => requestAddDepartment(selectedNode.node?.id || null, '하위 조직')} className="w-full px-4 py-3 rounded-xl bg-toss-blue text-sm font-black text-white">하위 팀 추가</button>
                <button onClick={() => setEditingItem({ type: 'departments', id: selectedNode.node!.id, name: selectedNode.node!.name })} className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm font-black text-slate-700">수정</button>
                <button onClick={() => onDelete(selectedNode.node!.id)} className="w-full px-4 py-3 rounded-xl bg-red-50 text-sm font-black text-red-500">삭제</button>
              </>
            ) : (
              <>
                <DetailLine label="조직명" value="Project Atlas" />
                <DetailLine label="부서" value={`${rootDepartments.length}개`} />
                <DetailLine label="팀" value={`${teamNodes.length}개`} />
                <DetailLine label="인력" value={`${users.length}명`} />
                <DetailLine label="미배정" value={`${unassignedUsers.length}명`} />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <div className="toss-card p-5 bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-toss-gray-900 dark:text-slate-100">부서 트리 관리</h3>
          <p className="mt-1 text-xs font-bold text-toss-gray-400">부서 노드의 순서를 바꾸고, 직원 프로필 태그를 드래그해 소속을 이동합니다.</p>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <input
            type="text"
            value={addValue}
            onChange={(event) => onAddValueChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') onAdd(); }}
            placeholder="새 부서명 입력"
            className="min-w-0 flex-1 lg:w-56 text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
          />
          <button onClick={() => onAdd()} className="px-3.5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all">
            부서 추가
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <section className="rounded-2xl bg-[#eef3f9] dark:bg-slate-850 p-4 overflow-hidden">
          <div className="rounded-2xl border border-white/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-toss-blue text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-toss-gray-900 dark:text-slate-100 truncate">Project Atlas 조직</p>
                  <p className="text-[11px] font-bold text-toss-gray-400">부서 {departments.length}개 · 배정 {users.length - unassignedUsers.length}명 · 미배정 {unassignedUsers.length}명</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/20 text-[11px] font-black text-toss-blue">
                조직 트리
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto overflow-y-hidden pb-3 scrollbar-thin">
            <div className="relative min-w-max rounded-3xl bg-gradient-to-r from-white/35 via-white/10 to-white/35 dark:from-slate-900/40 dark:via-slate-950/20 dark:to-slate-900/40 p-6">
              <div className="absolute inset-y-6 left-[28px] right-[28px] pointer-events-none grid grid-cols-4 gap-6">
                {['조직', '부', '팀', '파트'].map((label) => (
                  <div key={label} className="rounded-3xl bg-white/35 dark:bg-slate-950/20 border border-white/50 dark:border-slate-800/60">
                    <p className="px-5 py-4 text-[11px] font-black text-toss-gray-400 dark:text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="relative z-10 flex items-start gap-14 py-8">
                <div className="relative w-[260px] shrink-0 pl-8">
                  <span className="absolute left-0 top-2 w-4 h-4 rounded-full bg-slate-900 dark:bg-white ring-4 ring-white dark:ring-slate-900" />
                  <span className="absolute left-[7px] top-6 bottom-0 w-px bg-slate-900/25 dark:bg-white/25" />
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900 text-[10px] font-black text-white">
                        <Building2 className="w-3 h-3" />
                        ROOT
                      </span>
                      <p className="mt-2 text-lg font-black text-toss-gray-900 dark:text-slate-100 truncate">Project Atlas 조직</p>
                      <p className="mt-1 text-[11px] font-bold text-toss-gray-400">부서와 팀 구조의 시작점</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] font-black text-toss-gray-400">노드</p>
                      <p className="text-sm font-black text-toss-blue">{departments.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] font-black text-toss-gray-400">배정</p>
                      <p className="text-sm font-black text-emerald-600">{users.length - unassignedUsers.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] font-black text-toss-gray-400">미배정</p>
                      <p className="text-sm font-black text-violet-600">{unassignedUsers.length}</p>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-5">
                  <span className="absolute -left-14 top-4 w-14 h-px bg-toss-blue/70" />
              {departmentNodes.length === 0 ? (
                    <div className="w-[330px] rounded-2xl border border-dashed border-white/90 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-6 text-center">
                  <p className="text-xs font-bold text-toss-gray-400">등록된 부서가 없습니다.</p>
                </div>
              ) : (
                    departmentNodes.map((node, index) => (
                      <div key={node.id} className="relative">
                        <span className="absolute -left-14 top-4 w-14 h-px bg-toss-blue/70" />
                        {renderFlowDepartmentNode(node, index)}
                      </div>
                    ))
              )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingUserId) setDragOverDepartmentId('__unassigned__');
          }}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget as HTMLElement | null;
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
              if (dragOverDepartmentId === '__unassigned__') setDragOverDepartmentId(null);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingUserId) onMoveUser(draggingUserId, null);
            setDraggingUserId(null);
            setDragOverDepartmentId(null);
          }}
          className={`rounded-2xl border p-4 transition-all ${
            dragOverDepartmentId === '__unassigned__'
              ? 'border-toss-blue bg-blue-50/80 dark:bg-blue-950/20 ring-2 ring-toss-blue/15'
              : 'border-toss-gray-100 dark:border-slate-800 bg-toss-gray-50 dark:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-toss-gray-100 dark:border-slate-800 flex items-center justify-center shrink-0">
                <UserRound className="w-4 h-4 text-toss-blue" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-toss-gray-900 dark:text-slate-100 truncate">미배정 인력</p>
                <p className="text-[11px] font-bold text-toss-gray-400">부서가 없는 직원</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-toss-gray-100 dark:border-slate-800 text-[11px] font-black text-toss-gray-500">
              {unassignedUsers.length}명
            </span>
          </div>

          <div className={`mt-4 min-h-[220px] rounded-2xl border border-dashed p-3 transition-all ${
            dragOverDepartmentId === '__unassigned__'
              ? 'border-toss-blue bg-white/70 dark:bg-slate-950/40'
              : 'border-toss-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40'
          }`}>
            {unassignedUsers.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center">
                <UserRound className="w-7 h-7 text-toss-gray-300 mb-2" />
                <p className="text-xs font-black text-toss-gray-500 dark:text-slate-300">모든 인력이 배정되었습니다.</p>
                <p className="mt-1 text-[11px] font-bold text-toss-gray-400">부서에서 이곳으로 드래그하면 미배정 처리됩니다.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                {unassignedUsers.map((member) => <span key={member.id} data-user-card>{renderUserCard(member, true)}</span>)}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] font-bold text-toss-gray-400 leading-relaxed">
            직원 카드를 부서 카드로 옮기면 즉시 소속이 변경됩니다. 부서에서 이 영역으로 옮기면 미배정 상태가 됩니다.
          </p>
        </aside>
      </div>
    </div>
  );
};
