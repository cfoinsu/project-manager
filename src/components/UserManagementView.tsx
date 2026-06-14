import React, { useState, useEffect } from 'react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';
import { 
  Trash2, UserPlus, Shield, Search, Mail, UserCheck, AlertCircle, 
  Settings2, UserCog, KeyRound, Laptop, Key, RefreshCw, Layers, Phone 
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export const UserManagementView: React.FC = () => {
  const { user: currentUser, serverMode } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab state: 'users' | 'org'
  const [activeTab, setActiveTab] = useState<'users' | 'org'>('users');

  // Org Info Master list state
  const [orgInfo, setOrgInfo] = useState<api.OrgInfo>({ departments: [], positions: [], jobRoles: [] });
  const [orgAddNames, setOrgAddNames] = useState({ departments: '', positions: '', jobRoles: '' });

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
  const handleAddOrgItem = async (type: 'departments' | 'positions' | 'job-roles') => {
    const val = orgAddNames[type === 'job-roles' ? 'jobRoles' : type];
    if (!val.trim()) return;

    try {
      await api.addOrgInfoItem(serverMode, type, val.trim());
      setOrgAddNames(prev => ({ ...prev, [type === 'job-roles' ? 'jobRoles' : type]: '' }));
      fetchOrgInfo();
    } catch (err: any) {
      alert(err.message || '추가에 실패했습니다.');
    }
  };

  const handleDeleteOrgItem = async (type: 'departments' | 'positions' | 'job-roles', id: string) => {
    if (!confirm('정말로 이 항목을 삭제하시겠습니까? 관련 사용자 정보에는 영향이 없지만 더 이상 연동 선택이 불가능해집니다.')) {
      return;
    }

    try {
      await api.deleteOrgInfoItem(serverMode, type, id);
      fetchOrgInfo();
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  };

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
                    {orgInfo.departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
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
      ) : (
        /* TAB: ORG MASTER SETTINGS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch shrink-0 select-none">
          
          {/* Departments */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col min-h-[400px]">
            <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
              <span className="text-sm font-black text-toss-gray-700 dark:text-slate-200">부서 (Departments)</span>
              <span className="text-xs text-toss-gray-400 font-bold">{orgInfo.departments.length}개</span>
            </div>

            {/* Add form */}
            <div className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={orgAddNames.departments}
                onChange={(e) => setOrgAddNames(prev => ({ ...prev, departments: e.target.value }))}
                placeholder="새 부서명 입력"
                className="flex-1 min-w-0 text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
              />
              <button
                onClick={() => handleAddOrgItem('departments')}
                className="px-3.5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all"
              >
                추가
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
              {orgInfo.departments.length === 0 ? (
                <p className="text-center text-xs text-toss-gray-400 py-10 font-bold">등록된 부서가 없습니다.</p>
              ) : (
                orgInfo.departments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                    <span>{item.name}</span>
                    <button
                      onClick={() => handleDeleteOrgItem('departments', item.id)}
                      className="p-1 rounded text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Positions */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col min-h-[400px]">
            <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
              <span className="text-sm font-black text-toss-gray-700 dark:text-slate-200">직급 (Positions)</span>
              <span className="text-xs text-toss-gray-400 font-bold">{orgInfo.positions.length}개</span>
            </div>

            {/* Add form */}
            <div className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={orgAddNames.positions}
                onChange={(e) => setOrgAddNames(prev => ({ ...prev, positions: e.target.value }))}
                placeholder="새 직급명 입력"
                className="flex-1 min-w-0 text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
              />
              <button
                onClick={() => handleAddOrgItem('positions')}
                className="px-3.5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all"
              >
                추가
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
              {orgInfo.positions.length === 0 ? (
                <p className="text-center text-xs text-toss-gray-400 py-10 font-bold">등록된 직급이 없습니다.</p>
              ) : (
                orgInfo.positions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                    <span>{item.name}</span>
                    <button
                      onClick={() => handleDeleteOrgItem('positions', item.id)}
                      className="p-1 rounded text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Job Roles */}
          <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-5 flex flex-col min-h-[400px]">
            <div className="border-b border-toss-gray-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
              <span className="text-sm font-black text-toss-gray-700 dark:text-slate-200">직무/역할 (Job Roles)</span>
              <span className="text-xs text-toss-gray-400 font-bold">{orgInfo.jobRoles.length}개</span>
            </div>

            {/* Add form */}
            <div className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={orgAddNames.jobRoles}
                onChange={(e) => setOrgAddNames(prev => ({ ...prev, jobRoles: e.target.value }))}
                placeholder="새 직무명 입력"
                className="flex-1 min-w-0 text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-100"
              />
              <button
                onClick={() => handleAddOrgItem('job-roles')}
                className="px-3.5 py-2 bg-toss-blue hover:bg-toss-blue-dark text-xs font-bold text-white rounded-xl cursor-pointer transition-all"
              >
                추가
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1">
              {orgInfo.jobRoles.length === 0 ? (
                <p className="text-center text-xs text-toss-gray-400 py-10 font-bold">등록된 직무가 없습니다.</p>
              ) : (
                orgInfo.jobRoles.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                    <span>{item.name}</span>
                    <button
                      onClick={() => handleDeleteOrgItem('job-roles', item.id)}
                      className="p-1 rounded text-toss-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

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
                      {orgInfo.departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
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
