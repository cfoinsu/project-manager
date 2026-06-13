import { isTauri } from './tauriBridge';
import type { User, Assignment } from '../types';
import bcrypt from 'bcryptjs';

// Helper to dynamically load Tauri invoke function with type-safety bypass
const getInvoke = async (): Promise<any> => {
  // @ts-ignore
  const { invoke } = await import('@tauri-apps/api');
  return invoke;
};

// Web Crypto SHA-256 helper
export const sha256 = async (message: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Get device SHA-256 hash
export const getDeviceHash = async (): Promise<string> => {
  if (isTauri()) {
    try {
      const invoke = await getInvoke();
      const rawId = await invoke('get_raw_device_id');
      return await sha256(rawId);
    } catch (e) {
      console.error('Failed to get raw device ID from Tauri:', e);
    }
  }
  
  // Browser fallback
  let mockUuid = localStorage.getItem('pa_mock_device_uuid');
  if (!mockUuid) {
    mockUuid = 'mock-device-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('pa_mock_device_uuid', mockUuid);
  }
  return await sha256(mockUuid);
};

export const getApiBaseUrl = (): string => {
  return localStorage.getItem('pa_server_url') || 'http://localhost:5000';
};

// Helper to get headers with JWT auth token
const getHeaders = (isJson = true) => {
  const token = localStorage.getItem('pa_token');
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Safe API Fetcher with Fallback check
// If the backend Express server is offline or errors, we fall back to LocalStorage simulation.
export const apiRequest = async (path: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers as Record<string, string> || {})
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    // If the server is unreachable (Failed to fetch), throw specific error so store can handle fallback
    if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      console.warn(`Express backend server offline at ${getApiBaseUrl()}. Running in Local Fallback mode.`);
      throw new Error('SERVER_OFFLINE');
    }
    throw error;
  }
};

// =============================================================
// Local Database Emulation/Fallback (when server is offline)
// =============================================================

// Mock users data seeded in LocalStorage if not exists
export const initLocalFallbackUsers = () => {
  if (!localStorage.getItem('pa_fallback_users')) {
    const fallbackUsers = [
      { id: 'user-admin-1', username: 'admin', name: '최고 관리자 (Local)', email: 'admin@atlas.com', role: 'admin', status: 'active', force_password_change: 0, created_at: '2026-06-11 00:00:00', updated_at: '2026-06-11 00:00:00', device_hash: null },
      { id: 'user-manager-1', username: 'manager', name: '프로젝트 매니저 (Local)', email: 'manager@atlas.com', role: 'manager', status: 'active', force_password_change: 0, created_at: '2026-06-11 00:00:00', updated_at: '2026-06-11 00:00:00', device_hash: null },
      { id: 'user-member-1', username: 'member', name: '일반 개발원 (Local)', email: 'member@atlas.com', role: 'member', status: 'active', force_password_change: 0, created_at: '2026-06-11 00:00:00', updated_at: '2026-06-11 00:00:00', device_hash: null }
    ];
    localStorage.setItem('pa_fallback_users', JSON.stringify(fallbackUsers));
  }
  if (!localStorage.getItem('pa_fallback_departments')) {
    localStorage.setItem('pa_fallback_departments', JSON.stringify([
      { id: 'dept-1', name: '기획부' },
      { id: 'dept-2', name: '디자인부' },
      { id: 'dept-3', name: '개발부' },
      { id: 'dept-4', name: '경영지원부' }
    ]));
  }
  if (!localStorage.getItem('pa_fallback_positions')) {
    localStorage.setItem('pa_fallback_positions', JSON.stringify([
      { id: 'pos-1', name: '사원' },
      { id: 'pos-2', name: '대리' },
      { id: 'pos-3', name: '과장' },
      { id: 'pos-4', name: '차장' },
      { id: 'pos-5', name: '부장' }
    ]));
  }
  if (!localStorage.getItem('pa_fallback_job_roles')) {
    localStorage.setItem('pa_fallback_job_roles', JSON.stringify([
      { id: 'jr-1', name: 'PM' },
      { id: 'jr-2', name: 'PL' },
      { id: 'jr-3', name: '기획자' },
      { id: 'jr-4', name: '디자이너' },
      { id: 'jr-5', name: '퍼블리셔' },
      { id: 'jr-6', name: '개발자' }
    ]));
  }
  if (!localStorage.getItem('pa_fallback_assignments')) {
    const fallbackAssigns = [
      { id: 'assign-demo-1', user_id: 'user-manager-1', user_name: '프로젝트 매니저 (Local)', user_email: 'manager@atlas.com', project_id: 'proj-demo-1', project_name: '스마트 관광 플랫폼 구축', project_code: 'HC26W001', role: 'PL', allocation_percent: 80, start_date: '2026-06-01', end_date: '2026-12-31' },
      { id: 'assign-demo-2', user_id: 'user-member-1', user_name: '일반 개발원 (Local)', user_email: 'member@atlas.com', project_id: 'proj-demo-1', project_name: '스마트 관광 플랫폼 구축', project_code: 'HC26W001', role: 'Front-End Developer', allocation_percent: 100, start_date: '2026-06-15', end_date: '2026-11-30' }
    ];
    localStorage.setItem('pa_fallback_assignments', JSON.stringify(fallbackAssigns));
  }
};

initLocalFallbackUsers();

export const localFallbackLogin = async (username: string, password?: string, deviceHash?: string): Promise<any> => {
  const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
  const matched = users.find((u: any) => u.username === username || u.email === username);
  if (!matched) {
    throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
  }

  // Simple password check for fallback simulation
  const expectedPass = username === 'admin' ? 'admin123' : 
                       username === 'manager' ? 'manager123' : 
                       username === 'member' ? 'member123' : '123456';
  if (password && password !== expectedPass) {
    throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
  }

  if (matched.status === 'inactive') {
    throw new Error('비활성화된 계정입니다. 관리자에게 문의하세요.');
  }

  // device_hash가 없거나 다르면 현재 기기로 자동 등록/갱신 (로컬 모드에서 첫 로그인 및 기기 변경 편의 제공)
  if (!matched.device_hash || matched.device_hash !== deviceHash) {
    if (deviceHash) {
      // 자동 등록/갱신
      localFallbackRegisterDevice(matched.id, deviceHash);
      matched.device_hash = deviceHash;
    }
    // deviceHash도 없으면 그냥 통과 (브라우저 환경 호환)
  }

  return {
    token: `mock-jwt-token-for-${matched.id}`,
    user: matched
  };
};

export const localFallbackRegisterDevice = (userId: string, deviceHash: string): void => {
  const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
  const idx = users.findIndex((u: any) => u.id === userId);
  if (idx > -1) {
    users[idx].device_hash = deviceHash;
    localStorage.setItem('pa_fallback_users', JSON.stringify(users));
  }
};

export const localFallbackChangePassword = (userId: string): void => {
  const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
  const idx = users.findIndex((u: any) => u.id === userId);
  if (idx > -1) {
    users[idx].force_password_change = 0;
    localStorage.setItem('pa_fallback_users', JSON.stringify(users));
  }
};

export const localFallbackResetPassword = (id: string): void => {
  const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
  const idx = users.findIndex((u: any) => u.id === id);
  if (idx > -1) {
    users[idx].force_password_change = 1;
    localStorage.setItem('pa_fallback_users', JSON.stringify(users));
  }
};

export const localFallbackResetDevice = (id: string): void => {
  const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
  const idx = users.findIndex((u: any) => u.id === id);
  if (idx > -1) {
    users[idx].device_hash = null;
    localStorage.setItem('pa_fallback_users', JSON.stringify(users));
  }
};

export const localFallbackGetUsers = (): any[] => {
  return JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
};

export const localFallbackAddUser = (user: any) => {
  const users = localFallbackGetUsers();
  if (users.some((u: any) => u.username === user.username)) {
    throw new Error('이미 존재하는 아이디입니다.');
  }
  const newUser = {
    ...user,
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    status: 'active',
    force_password_change: 1,
    device_hash: null,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };
  users.push(newUser);
  localStorage.setItem('pa_fallback_users', JSON.stringify(users));
  return newUser;
};

export const localFallbackDeleteUser = (id: string) => {
  let users = localFallbackGetUsers();
  users = users.filter((u: any) => u.id !== id);
  localStorage.setItem('pa_fallback_users', JSON.stringify(users));
};

export const localFallbackGetOrgInfo = () => {
  const departments = JSON.parse(localStorage.getItem('pa_fallback_departments') || '[]');
  const positions = JSON.parse(localStorage.getItem('pa_fallback_positions') || '[]');
  const jobRoles = JSON.parse(localStorage.getItem('pa_fallback_job_roles') || '[]');
  return { departments, positions, jobRoles };
};

export const localFallbackAddOrgInfo = (type: string, name: string) => {
  const key = type === 'departments' ? 'pa_fallback_departments' :
              type === 'positions' ? 'pa_fallback_positions' : 'pa_fallback_job_roles';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  if (list.some((item: any) => item.name === name)) {
    throw new Error('이미 존재하는 이름입니다.');
  }
  const newItem = {
    id: type.substring(0, 3) + '-' + Math.random().toString(36).substr(2, 9),
    name
  };
  list.push(newItem);
  localStorage.setItem(key, JSON.stringify(list));
  return newItem;
};

export const localFallbackDeleteOrgInfo = (type: string, id: string) => {
  const key = type === 'departments' ? 'pa_fallback_departments' :
              type === 'positions' ? 'pa_fallback_positions' : 'pa_fallback_job_roles';
  let list = JSON.parse(localStorage.getItem(key) || '[]');
  list = list.filter((item: any) => item.id !== id);
  localStorage.setItem(key, JSON.stringify(list));
};

export const localFallbackGetAssignments = (role: string, currentUserId: string): any[] => {
  const assigns = JSON.parse(localStorage.getItem('pa_fallback_assignments') || '[]');
  if (role === 'member') {
    return assigns.filter((a: any) => a.user_id === currentUserId);
  }
  return assigns;
};

export const localFallbackAddAssignment = (assign: any) => {
  const assigns = JSON.parse(localStorage.getItem('pa_fallback_assignments') || '[]');
  const users = localFallbackGetUsers();
  const projects = JSON.parse(localStorage.getItem('pa_projects') || '[]');
  
  const user = users.find((u: any) => u.id === assign.user_id);
  const project = projects.find((p: any) => p.id === assign.project_id) || { name: '데모 프로젝트', code: 'PROJ-CODE' };

  const newAssign = {
    ...assign,
    id: 'assign-' + Math.random().toString(36).substr(2, 9),
    user_name: user?.name || '알 수 없는 사용자',
    user_email: user?.email || '',
    project_name: project.name,
    project_code: project.code
  };
  
  assigns.push(newAssign);
  localStorage.setItem('pa_fallback_assignments', JSON.stringify(assigns));
  return newAssign;
};

export const localFallbackUpdateAssignment = (id: string, updates: any) => {
  const assigns = JSON.parse(localStorage.getItem('pa_fallback_assignments') || '[]');
  const idx = assigns.findIndex((a: any) => a.id === id);
  if (idx > -1) {
    assigns[idx] = { ...assigns[idx], ...updates };
    localStorage.setItem('pa_fallback_assignments', JSON.stringify(assigns));
    return assigns[idx];
  }
  throw new Error('배정 내역을 찾을 수 없습니다.');
};

export const localFallbackDeleteAssignment = (id: string) => {
  let assigns = JSON.parse(localStorage.getItem('pa_fallback_assignments') || '[]');
  assigns = assigns.filter((a: any) => a.id !== id);
  localStorage.setItem('pa_fallback_assignments', JSON.stringify(assigns));
};

// =============================================================
// Unified Database Access Layer (Express / Tauri SQLite / LocalStorage)
// =============================================================

export const getUsers = async (serverMode: boolean): Promise<User[]> => {
  if (serverMode) {
    const data = await apiRequest('/auth/users');
    return data.users;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    return invoke('db_get_users');
  } else {
    return localFallbackGetUsers();
  }
};

export const addUser = async (serverMode: boolean, user: Omit<User, 'id'> & { password?: string }): Promise<User> => {
  if (serverMode) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(user)
    });
    return data.user;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    return invoke('db_create_user', {
      username: user.username,
      name: user.name,
      email: user.email || null,
      role: user.role,
      department: user.department || null,
      position: user.position || null,
      job_role: user.job_role || null
    });
  } else {
    return localFallbackAddUser(user);
  }
};

export const updateUser = async (
  serverMode: boolean,
  id: string,
  updates: Partial<Omit<User, 'id'>> & { adminPassword?: string }
): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    if (updates.adminPassword) {
      const isVerified = await invoke('db_verify_admin_password', { password: updates.adminPassword });
      if (!isVerified) throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    }
    await invoke('db_update_user', {
      id,
      name: updates.name || null,
      email: updates.email || null,
      role: updates.role || null,
      status: updates.status || null,
      department: updates.department || null,
      position: updates.position || null,
      job_role: updates.job_role || null
    });
  } else {
    if (updates.adminPassword && updates.adminPassword !== 'admin123') {
      throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    }
    const users = JSON.parse(localStorage.getItem('pa_fallback_users') || '[]');
    const idx = users.findIndex((u: any) => u.id === id);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) };
      localStorage.setItem('pa_fallback_users', JSON.stringify(users));
    }
  }
};

export const deleteUser = async (serverMode: boolean, id: string, adminPassword?: string): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/auth/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminPassword })
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const isVerified = await invoke('db_verify_admin_password', { password: adminPassword || '' });
    if (!isVerified) throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    await invoke('db_delete_user', { id });
  } else {
    if (adminPassword !== 'admin123') throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    localFallbackDeleteUser(id);
  }
};

export const resetUserDevice = async (serverMode: boolean, id: string, adminPassword?: string): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/auth/users/${id}/reset-device`, {
      method: 'POST',
      body: JSON.stringify({ adminPassword })
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const isVerified = await invoke('db_verify_admin_password', { password: adminPassword || '' });
    if (!isVerified) throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    await invoke('db_reset_user_device', { id });
  } else {
    if (adminPassword !== 'admin123') throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    localFallbackResetDevice(id);
  }
};

export const resetUserPassword = async (
  serverMode: boolean,
  id: string,
  newPassword?: string,
  adminPassword?: string
): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ adminPassword, newPassword })
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const isVerified = await invoke('db_verify_admin_password', { password: adminPassword || '' });
    if (!isVerified) throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword || '', salt);
    await invoke('db_reset_user_password', { id, passwordHash });
  } else {
    if (adminPassword !== 'admin123') throw new Error('관리자 비밀번호 인증에 실패했습니다.');
    localFallbackResetPassword(id);
  }
};

export const changePassword = async (
  serverMode: boolean,
  newPassword?: string
): Promise<void> => {
  if (serverMode) {
    await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const userJson = localStorage.getItem('pa_user');
    if (!userJson) throw new Error('로그인 정보가 없습니다.');
    const me = JSON.parse(userJson);
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword || '', salt);
    await invoke('db_change_password', { id: me.id, passwordHash });
  } else {
    const userJson = localStorage.getItem('pa_user');
    if (!userJson) throw new Error('로그인 정보가 없습니다.');
    const me = JSON.parse(userJson);
    localFallbackChangePassword(me.id);
  }
};

export const registerDevice = async (
  serverMode: boolean,
  userId: string,
  deviceHash: string
): Promise<void> => {
  if (serverMode) {
    await apiRequest('/auth/register-device', {
      method: 'POST',
      body: JSON.stringify({ userId, deviceHash })
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    await invoke('db_register_device', { id: userId, deviceHash });
  } else {
    localFallbackRegisterDevice(userId, deviceHash);
  }
};

export const verifyAdminPassword = async (serverMode: boolean, password?: string): Promise<boolean> => {
  if (serverMode) {
    // Under serverMode, verification is handled server-side during PUT/POST/DELETE.
    // However, if we need UI validation, we can call custom endpoint if exists, 
    // but in auth.js route there's no single verify endpoint, so we return true for validation success
    // and let the actual transaction fail if the password is wrong.
    return true;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    return invoke('db_verify_admin_password', { password: password || '' });
  } else {
    return password === 'admin123';
  }
};

export interface OrgItem {
  id: string;
  name: string;
}

export interface OrgInfo {
  departments: OrgItem[];
  positions: OrgItem[];
  jobRoles: OrgItem[];
}

export const getOrgInfo = async (serverMode: boolean): Promise<OrgInfo> => {
  if (serverMode) {
    const data = await apiRequest('/auth/org-info');
    return data;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const rawOrg = await invoke('db_get_org_info');
    // Map Rust struct fields: job_roles is returned as jobRoles in typescript CamelCase mapping
    return {
      departments: rawOrg.departments || [],
      positions: rawOrg.positions || [],
      jobRoles: rawOrg.job_roles || []
    };
  } else {
    const raw = localFallbackGetOrgInfo();
    return {
      departments: raw.departments,
      positions: raw.positions,
      jobRoles: raw.jobRoles
    };
  }
};

export const addOrgInfoItem = async (
  serverMode: boolean,
  type: 'departments' | 'positions' | 'job-roles',
  name: string
): Promise<OrgItem> => {
  if (serverMode) {
    const data = await apiRequest(`/auth/org-info/${type}`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return data.item;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    return invoke('db_add_org_info', { type, name });
  } else {
    return localFallbackAddOrgInfo(type, name);
  }
};

export const deleteOrgInfoItem = async (
  serverMode: boolean,
  type: 'departments' | 'positions' | 'job-roles',
  id: string
): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/auth/org-info/${type}/${id}`, {
      method: 'DELETE'
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    await invoke('db_delete_org_info', { type, id });
  } else {
    localFallbackDeleteOrgInfo(type, id);
  }
};

export const getAssignments = async (
  serverMode: boolean,
  role: string,
  currentUserId: string
): Promise<Assignment[]> => {
  if (serverMode) {
    const data = await apiRequest('/assignments');
    return data.assignments;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    const assigns = await invoke('db_get_assignments');
    if (role === 'member') {
      return assigns.filter((a: any) => a.user_id === currentUserId);
    }
    return assigns;
  } else {
    return localFallbackGetAssignments(role, currentUserId);
  }
};

export const createAssignment = async (
  serverMode: boolean,
  assignment: Omit<Assignment, 'id'>
): Promise<Assignment> => {
  if (serverMode) {
    const data = await apiRequest('/assignments', {
      method: 'POST',
      body: JSON.stringify(assignment)
    });
    return data.assignment;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    return invoke('db_create_assignment', {
      userId: assignment.user_id,
      projectId: assignment.project_id,
      role: assignment.role,
      allocationPercent: assignment.allocation_percent,
      startDate: assignment.start_date,
      endDate: assignment.end_date
    });
  } else {
    return localFallbackAddAssignment(assignment);
  }
};

export const updateAssignment = async (
  serverMode: boolean,
  id: string,
  updates: Partial<Omit<Assignment, 'id'>>
): Promise<Assignment> => {
  if (serverMode) {
    const data = await apiRequest(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.assignment;
  } else if (isTauri()) {
    const invoke = await getInvoke();
    await invoke('db_update_assignment', {
      id,
      role: updates.role,
      allocationPercent: updates.allocation_percent,
      startDate: updates.start_date,
      endDate: updates.end_date
    });
    const assigns = await invoke('db_get_assignments');
    return assigns.find((a: any) => a.id === id) || (updates as Assignment);
  } else {
    return localFallbackUpdateAssignment(id, updates);
  }
};

export const deleteAssignment = async (serverMode: boolean, id: string): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/assignments/${id}`, {
      method: 'DELETE'
    });
  } else if (isTauri()) {
    const invoke = await getInvoke();
    await invoke('db_delete_assignment', { id });
  } else {
    localFallbackDeleteAssignment(id);
  }
};

// =============================================================
// WORKLOAD API
// =============================================================

export const generateWorkload = async (serverMode: boolean, assignment_id: string): Promise<any> => {
  if (serverMode) {
    return apiRequest('/workload/generate', {
      method: 'POST',
      body: JSON.stringify({ assignment_id })
    });
  }

  // fallback: 로컬 생성 시뮬레이션
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split('T')[0];
  };

  try {
    const assigns = JSON.parse(localStorage.getItem('pa_fallback_assignments') || '[]');
    const assign = assigns.find((a: any) => a.id === assignment_id);
    if (!assign) {
      throw new Error('배정 내역을 찾을 수 없습니다.');
    }

    const start = new Date(assign.start_date || new Date());
    const end = new Date(assign.end_date || new Date());
    const mondayStart = new Date(getMonday(start));
    const mondayEnd = new Date(getMonday(end));

    const generatedWls: any[] = [];
    let current = new Date(mondayStart);

    while (current <= mondayEnd) {
      const weekStartStr = current.toISOString().split('T')[0];
      const wlId = `wl-${Math.random().toString(36).substr(2, 9)}`;
      generatedWls.push({
        id: wlId,
        assignment_id: assignment_id,
        user_id: assign.user_id,
        project_id: assign.project_id,
        week_start: weekStartStr,
        work_ratio: assign.allocation_percent || 100,
        expected_hours: ((assign.allocation_percent || 100) / 100) * 40,
        status: 'planned'
      });
      current.setDate(current.getDate() + 7);
    }

    let stored = JSON.parse(localStorage.getItem('pa_fallback_workloads') || '[]');
    stored = stored.filter((w: any) => w.assignment_id !== assignment_id);
    stored.push(...generatedWls);
    localStorage.setItem('pa_fallback_workloads', JSON.stringify(stored));

    return { message: '워크로드가 성공적으로 생성되었습니다.', workloads: generatedWls };
  } catch (err: any) {
    throw new Error(err.message || '워크로드 생성 중 오류가 발생했습니다.');
  }
};

export const getWorkloads = async (
  serverMode: boolean,
  params: { user_id?: string; project_id?: string; assignment_id?: string }
): Promise<any[]> => {
  if (serverMode) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const data = await apiRequest(`/workload?${query}`);
    return data.workloads || [];
  }
  // Fallback: localStorage
  const stored = JSON.parse(localStorage.getItem('pa_fallback_workloads') || '[]');
  
  // Calculate true overload from the full stored array
  const totalRatioMap: Record<string, number> = {};
  for (const w of stored) {
    const key = `${w.user_id}__${w.week_start}`;
    totalRatioMap[key] = (totalRatioMap[key] || 0) + w.work_ratio;
  }
  
  let filtered = stored;
  if (params.project_id) filtered = stored.filter((w: any) => w.project_id === params.project_id);
  else if (params.user_id) filtered = stored.filter((w: any) => w.user_id === params.user_id);
  else if (params.assignment_id) filtered = stored.filter((w: any) => w.assignment_id === params.assignment_id);

  return filtered.map((w: any) => {
    const key = `${w.user_id}__${w.week_start}`;
    const tot = totalRatioMap[key] || 0;
    return {
      ...w,
      total_ratio: tot,
      is_overloaded: tot > 100
    };
  });
};

export const updateWorkload = async (
  serverMode: boolean,
  id: string,
  updates: { work_ratio?: number; status?: 'planned' | 'done'; expected_hours?: number }
): Promise<any> => {
  if (serverMode) {
    const data = await apiRequest(`/workload/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.workload;
  }
  // Fallback
  const stored = JSON.parse(localStorage.getItem('pa_fallback_workloads') || '[]');
  const idx = stored.findIndex((w: any) => w.id === id);
  if (idx > -1) {
    stored[idx] = { ...stored[idx], ...updates };
    localStorage.setItem('pa_fallback_workloads', JSON.stringify(stored));
    return stored[idx];
  }
  return null;
};

// =============================================================
// COMMENTS API
// =============================================================

export const getComments = async (
  serverMode: boolean,
  params: { project_id?: string; assignment_id?: string; workload_id?: string }
): Promise<any[]> => {
  if (serverMode) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const data = await apiRequest(`/comments?${query}`);
    return data.comments || [];
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
  let filtered = stored;
  if (params.workload_id) {
    filtered = stored.filter((c: any) => c.workload_id === params.workload_id);
  } else if (params.assignment_id) {
    filtered = stored.filter((c: any) => c.assignment_id === params.assignment_id);
  } else if (params.project_id) {
    filtered = stored.filter((c: any) => c.project_id === params.project_id);
  }
  return filtered.map((c: any) => ({
    ...c,
    reactions: c.reactions || {}
  }));
};

export const createComment = async (
  serverMode: boolean,
  payload: {
    project_id: string;
    assignment_id?: string;
    workload_id?: string;
    task_id?: string;
    context_type?: 'project' | 'task' | 'assignment';
    context_id?: string;
    content: string;
    parent_id?: string | null;
  }
): Promise<any> => {
  if (serverMode) {
    const data = await apiRequest('/comments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data.comment;
  }
  // Fallback
  const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
  const { user } = (await import('../store/authStore')).useAuthStore.getState();
  const newComment = {
    id: 'cmt-' + Math.random().toString(36).substr(2, 9),
    ...payload,
    user_id: user?.id || 'local-user',
    author_name: user?.name || '현재 사용자 (Local)',
    author_department: user?.department || null,
    author_position: user?.position || null,
    author_job_role: user?.job_role || null,
    parent_id: payload.parent_id || null,
    reactions: {},
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    updated_at: null
  };
  stored.unshift(newComment);
  localStorage.setItem('pa_fallback_comments', JSON.stringify(stored));
  return newComment;
};

/**
 * 기존 'task_' 접두어 우회 방식 댓글을 context_type/context_id/task_id 정규화
 * 앱 시작 시 1회 실행
 */
export const migrateComments = (): void => {
  try {
    const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
    let changed = false;
    const migrated = stored.map((c: any) => {
      if (c.context_type) return c; // 이미 마이그레이션됨
      changed = true;
      if (c.assignment_id?.startsWith('task_')) {
        const realTaskId = c.assignment_id.replace('task_', '');
        return { ...c, context_type: 'task', context_id: realTaskId, task_id: realTaskId, assignment_id: null };
      }
      if (c.assignment_id) {
        return { ...c, context_type: 'assignment', context_id: c.assignment_id };
      }
      return { ...c, context_type: 'project', context_id: c.project_id };
    });
    if (changed) {
      localStorage.setItem('pa_fallback_comments', JSON.stringify(migrated));
    }
  } catch (e) {
    console.warn('댓글 마이그레이션 실패:', e);
  }
};

export const deleteComment = async (serverMode: boolean, id: string): Promise<void> => {
  if (serverMode) {
    await apiRequest(`/comments/${id}`, { method: 'DELETE' });
  } else {
    const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
    localStorage.setItem('pa_fallback_comments', JSON.stringify(stored.filter((c: any) => c.id !== id)));
  }
};

export const updateComment = async (
  serverMode: boolean,
  id: string,
  content: string
): Promise<any> => {
  if (serverMode) {
    const data = await apiRequest(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    return data.comment;
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
  const idx = stored.findIndex((c: any) => c.id === id);
  if (idx !== -1) {
    stored[idx] = {
      ...stored[idx],
      content,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    localStorage.setItem('pa_fallback_comments', JSON.stringify(stored));
    return stored[idx];
  }
  throw new Error('댓글을 찾을 수 없습니다.');
};

export const toggleCommentReaction = async (
  serverMode: boolean,
  id: string,
  emoji: string
): Promise<any> => {
  if (serverMode) {
    const data = await apiRequest(`/comments/${id}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    return data;
  }
  // Local fallback
  const stored = JSON.parse(localStorage.getItem('pa_fallback_comments') || '[]');
  const idx = stored.findIndex((c: any) => c.id === id);
  if (idx !== -1) {
    const comment = stored[idx];
    let reactions = comment.reactions || {};
    if (typeof reactions === 'string') {
      try { reactions = JSON.parse(reactions); } catch { reactions = {}; }
    }
    const loggedInUser = JSON.parse(localStorage.getItem('pa_logged_in_user') || '{}');
    const userId = loggedInUser.id || 'local-user';

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    const uidx = reactions[emoji].indexOf(userId);
    if (uidx > -1) {
      reactions[emoji].splice(uidx, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(userId);
    }
    comment.reactions = reactions;
    stored[idx] = comment;
    localStorage.setItem('pa_fallback_comments', JSON.stringify(stored));
    return { id, reactions };
  }
  throw new Error('댓글을 찾을 수 없습니다.');
};

export const createReply = async (
  serverMode: boolean,
  payload: { project_id: string; parent_id: string; content: string; assignment_id?: string; workload_id?: string }
): Promise<any> => {
  return createComment(serverMode, payload as any);
};



// =============================================================
// SUBTASK API (세부 업무)
// =============================================================

export const getSubTasks = async (serverMode: boolean, taskId: string): Promise<any[]> => {
  if (serverMode) {
    try {
      const data = await apiRequest(`/tasks/${taskId}/subtasks`);
      return data.subtasks || [];
    } catch { return []; }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_subtasks') || '[]');
  return stored.filter((s: any) => s.task_id === taskId);
};

export const createSubTask = async (serverMode: boolean, payload: { task_id: string; title: string }): Promise<any> => {
  if (serverMode) {
    try {
      const data = await apiRequest(`/tasks/${payload.task_id}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title: payload.title })
      });
      return data.subtask;
    } catch { /* fallthrough */ }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_subtasks') || '[]');
  const newSub = {
    id: 'sub-' + Math.random().toString(36).substr(2, 9),
    task_id: payload.task_id,
    title: payload.title,
    done: false,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };
  stored.push(newSub);
  localStorage.setItem('pa_fallback_subtasks', JSON.stringify(stored));
  return newSub;
};

export const updateSubTask = async (serverMode: boolean, id: string, updates: { title?: string; done?: boolean }): Promise<any> => {
  if (serverMode) {
    try {
      const data = await apiRequest(`/subtasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
      return data.subtask;
    } catch { /* fallthrough */ }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_subtasks') || '[]');
  const idx = stored.findIndex((s: any) => s.id === id);
  if (idx !== -1) {
    stored[idx] = { ...stored[idx], ...updates };
    localStorage.setItem('pa_fallback_subtasks', JSON.stringify(stored));
    return stored[idx];
  }
  return null;
};

export const deleteSubTask = async (serverMode: boolean, id: string): Promise<void> => {
  if (serverMode) {
    try { await apiRequest(`/subtasks/${id}`, { method: 'DELETE' }); } catch { /* fallthrough */ }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_subtasks') || '[]');
  localStorage.setItem('pa_fallback_subtasks', JSON.stringify(stored.filter((s: any) => s.id !== id)));
};


// =============================================================
// WORKLOG API (업무 이력)
// =============================================================

export const getWorkLogs = async (serverMode: boolean, taskId: string): Promise<any[]> => {
  if (serverMode) {
    try {
      const data = await apiRequest(`/tasks/${taskId}/worklogs`);
      return data.worklogs || [];
    } catch { return []; }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_worklogs') || '[]');
  return stored.filter((w: any) => w.task_id === taskId).sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const createWorkLog = async (
  serverMode: boolean,
  payload: { task_id: string; content: string; hours?: number | null; log_date: string }
): Promise<any> => {
  if (serverMode) {
    try {
      const data = await apiRequest(`/tasks/${payload.task_id}/worklogs`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data.worklog;
    } catch { /* fallthrough */ }
  }
  const { user } = (await import('../store/authStore')).useAuthStore.getState();
  const stored = JSON.parse(localStorage.getItem('pa_fallback_worklogs') || '[]');
  const newLog = {
    id: 'wlog-' + Math.random().toString(36).substr(2, 9),
    ...payload,
    user_id: user?.id || 'local-user',
    author_name: user?.name || '현재 사용자',
    author_department: user?.department || null,
    author_position: user?.position || null,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };
  stored.unshift(newLog);
  localStorage.setItem('pa_fallback_worklogs', JSON.stringify(stored));
  return newLog;
};

export const deleteWorkLog = async (serverMode: boolean, id: string): Promise<void> => {
  if (serverMode) {
    try { await apiRequest(`/worklogs/${id}`, { method: 'DELETE' }); } catch { /* fallthrough */ }
  }
  const stored = JSON.parse(localStorage.getItem('pa_fallback_worklogs') || '[]');
  localStorage.setItem('pa_fallback_worklogs', JSON.stringify(stored.filter((w: any) => w.id !== id)));
};

// =============================================================
// DOCUMENT LIBRARY API (서류 양식 라이브러리)
// =============================================================

export interface DocTemplate {
  id: string;
  original_name: string;
  stored_name: string;
  category: string;
  tags: string;
  description: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploader_name?: string;
  created_at: string;
}

// 파일 업로드
export const uploadDocument = async (
  formData: FormData
): Promise<DocTemplate> => {
  const file = formData.get('file') as File;
  const category = (formData.get('category') as string) || '기타';
  const tags = (formData.get('tags') as string) || '';
  const description = (formData.get('description') as string) || '';

  try {
    const token = localStorage.getItem('pa_token');
    const response = await fetch(`${getApiBaseUrl()}/doclib/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `업로드 실패: ${response.status}`);
    }

    const data = await response.json();
    return data.document;
  } catch (error: any) {
    if (error.message === 'SERVER_OFFLINE' || error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      console.warn('Express server is offline. Falling back to local storage simulation for uploading.');
      
      const { user } = (await import('../store/authStore')).useAuthStore.getState();
      const id = `doc-${Math.random().toString(36).substr(2, 9)}`;
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      const newDoc: DocTemplate = {
        id,
        original_name: file.name,
        stored_name: `stored-${id}-${file.name}`,
        category,
        tags,
        description,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_by: user?.id || 'local-user',
        uploader_name: user?.name || '현재 사용자 (Local)',
        created_at: nowStr
      };

      // Store file content as Data URL if small (< 2MB)
      if (file && file.size < 2 * 1024 * 1024) {
        try {
          const fileDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
          });
          localStorage.setItem(`pa_fallback_doc_content_${id}`, fileDataUrl);
        } catch (e) {
          console.warn('Failed to store local file content:', e);
        }
      }

      const stored = JSON.parse(localStorage.getItem('pa_fallback_document_templates') || '[]');
      stored.unshift(newDoc);
      localStorage.setItem('pa_fallback_document_templates', JSON.stringify(stored));

      return newDoc;
    }
    throw error;
  }
};

// 목록 조회
export const getDocuments = async (params: {
  q?: string;
  category?: string;
} = {}): Promise<DocTemplate[]> => {
  try {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const response = await fetch(`${getApiBaseUrl()}/doclib${query ? `?${query}` : ''}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error: any) {
    if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      console.warn('Express server is offline. Falling back to local storage simulation for getDocuments.');
      
      let stored = JSON.parse(localStorage.getItem('pa_fallback_document_templates') || '[]');
      
      // Seed default document templates if empty
      if (stored.length === 0) {
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
        stored = [
          {
            id: 'doc-seed-1',
            original_name: '표준_근로계약서.docx',
            stored_name: 'stored-doc-seed-1',
            category: '계약',
            tags: '인사, 표준, 2026',
            description: '2026년 기준 전사 표준 정규직 및 계약직 근로계약서 양식입니다.',
            file_size: 45200,
            mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            uploaded_by: 'user-admin-1',
            uploader_name: '최고 관리자',
            created_at: nowStr
          },
          {
            id: 'doc-seed-2',
            original_name: '서비스_기획_상세설계_템플릿.xlsx',
            stored_name: 'stored-doc-seed-2',
            category: '기획',
            tags: '기획, 스펙, 템플릿',
            description: '화면 설계 및 상세 요구사항 정의를 위한 기획 사양서 템플릿입니다.',
            file_size: 112000,
            mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            uploaded_by: 'user-manager-1',
            uploader_name: '프로젝트 매니저',
            created_at: nowStr
          },
          {
            id: 'doc-seed-3',
            original_name: 'UI_디자인_가이드라인_v1.0.pdf',
            stored_name: 'stored-doc-seed-3',
            category: '디자인',
            tags: '디자인, 시스템, 가이드',
            description: 'Project Atlas 통합 디자인 가이드 및 Figma 컴포넌트 사용 가이드라인입니다.',
            file_size: 2450000,
            mime_type: 'application/pdf',
            uploaded_by: 'user-admin-1',
            uploader_name: '최고 관리자',
            created_at: nowStr
          }
        ];
        localStorage.setItem('pa_fallback_document_templates', JSON.stringify(stored));
      }

      // Filter by category
      if (params.category && params.category !== '전체') {
        stored = stored.filter((d: any) => d.category === params.category);
      }

      // Filter by query
      if (params.q) {
        const q = params.q.toLowerCase();
        stored = stored.filter((d: any) =>
          d.original_name.toLowerCase().includes(q) ||
          (d.tags && d.tags.toLowerCase().includes(q)) ||
          (d.description && d.description.toLowerCase().includes(q))
        );
      }

      return stored;
    }
    throw error;
  }
};

// 다운로드 URL 생성 (브라우저 다운로드)
export const getDocumentDownloadUrl = (id: string): string => {
  const token = localStorage.getItem('pa_token');
  return `${getApiBaseUrl()}/doclib/${id}/download?token=${token}`;
};

// 파일 다운로드 (직접 트리거)
export const downloadDocument = async (id: string, filename: string): Promise<void> => {
  try {
    const token = localStorage.getItem('pa_token');
    const response = await fetch(`${getApiBaseUrl()}/doclib/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) throw new Error('다운로드 실패');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      console.warn('Express server is offline. Running local file download.');
      
      const fileDataUrl = localStorage.getItem(`pa_fallback_doc_content_${id}`);
      let blob: Blob;
      
      if (fileDataUrl) {
        // Data URL -> Blob
        const arr = fileDataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        // Dummy placeholder
        blob = new Blob([`이 파일은 오프라인 로컬 데모 모드에서 다운로드된 가상 파일입니다.\n양식명: ${filename}\nID: ${id}\n\n실제 첨부파일을 사용하시려면 Express 백엔드 서버를 구동해 주세요.`], { type: 'text/plain;charset=utf-8' });
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.txt') || fileDataUrl ? filename : `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }
    throw error;
  }
};

// 파일 다운로드 (바이트 추출)
export const downloadDocumentBytes = async (id: string): Promise<Uint8Array> => {
  try {
    const token = localStorage.getItem('pa_token');
    const response = await fetch(`${getApiBaseUrl()}/doclib/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) throw new Error('다운로드 실패');

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error: any) {
    if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      console.warn('Express server is offline. Running local file download bytes fallback.');
      
      const fileDataUrl = localStorage.getItem(`pa_fallback_doc_content_${id}`);
      if (fileDataUrl) {
        const arr = fileDataUrl.split(',');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return u8arr;
      } else {
        const encoder = new TextEncoder();
        return encoder.encode(`이 파일은 오프라인 로컬 데모 모드에서 생성된 가상 파일입니다.\nID: ${id}\n\n실제 첨부파일을 사용하시려면 Express 백엔드 서버를 구동해 주세요.`);
      }
    }
    throw error;
  }
};

// 메타데이터 수정
export const updateDocument = async (
  id: string,
  updates: Partial<Pick<DocTemplate, 'original_name' | 'category' | 'tags' | 'description'>>
): Promise<DocTemplate> => {
  try {
    const data = await apiRequest(`/doclib/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.document;
  } catch (error: any) {
    if (error.message === 'SERVER_OFFLINE' || error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      const stored = JSON.parse(localStorage.getItem('pa_fallback_document_templates') || '[]');
      const idx = stored.findIndex((d: any) => d.id === id);
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...updates };
        localStorage.setItem('pa_fallback_document_templates', JSON.stringify(stored));
        return stored[idx];
      }
      throw new Error('문서를 찾을 수 없습니다.');
    }
    throw error;
  }
};

// 파일 삭제
export const deleteDocument = async (id: string): Promise<void> => {
  try {
    await apiRequest(`/doclib/${id}`, { method: 'DELETE' });
  } catch (error: any) {
    if (error.message === 'SERVER_OFFLINE' || error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
      const stored = JSON.parse(localStorage.getItem('pa_fallback_document_templates') || '[]');
      localStorage.setItem('pa_fallback_document_templates', JSON.stringify(stored.filter((d: any) => d.id !== id)));
      localStorage.removeItem(`pa_fallback_doc_content_${id}`);
      return;
    }
    throw error;
  }
};
