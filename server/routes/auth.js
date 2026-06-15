import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun, dbAll } from '../db.js';

import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'project_atlas_erp_secret_key';

// Helper to verify admin password
const verifyAdminPassword = async (adminId, password) => {
  const admin = await dbGet('SELECT password_hash FROM users WHERE id = ? AND role = "admin"', [adminId]);
  if (!admin) return false;
  return await bcrypt.compare(password, admin.password_hash);
};

// 1. POST /auth/register - admin만 호출 가능 (신규 사용자 추가)
router.post('/register', verifyToken, checkRole(['admin']), async (req, res) => {
  const { username, name, email, password, role, department, position, job_role, phone, profile_image } = req.body;

  if (!username || !name || !password || !role) {
    return res.status(400).json({ message: '필수 필드(username, name, password, role)를 입력해 주세요.' });
  }

  if (!['admin', 'manager', 'member'].includes(role)) {
    return res.status(400).json({ message: '역할은 admin, manager, member 중 하나여야 합니다.' });
  }

  try {
    // Check if username already exists
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // Encrypt password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Math.random().toString(36).substr(2, 9);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, department, position, job_role, phone, profile_image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, name, email || null, passwordHash, role, 'active', 1, department || null, position || null, job_role || null, phone || null, profile_image || null, nowStr, nowStr]
    );

    return res.status(201).json({
      message: '사용자가 성공적으로 등록되었습니다.',
      user: { id: userId, username, name, email, role, department, position, job_role, phone, profile_image }
    });
  } catch (error) {
    console.error('Register failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. POST /auth/login - 아이디 + 비밀번호 + 기기 해시 로그인, JWT 토큰 반환
router.post('/login', async (req, res) => {
  const { username, password, deviceHash } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해 주세요.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
    }

    // Compare bcrypt passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (
      process.env.DISABLE_DEVICE_AUTH !== 'true' &&
      user.role !== 'admin' &&
      deviceHash &&
      user.device_hash &&
      user.device_hash !== deviceHash
    ) {
      await dbRun(
        'INSERT OR IGNORE INTO user_devices (id, user_id, device_hash, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)',
        [`udev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user.id, deviceHash, nowStr, nowStr]
      );
      user.device_hash = deviceHash;
    }

    // Device hash check (skip if DISABLE_DEVICE_AUTH environment variable is true).
    // Admin login is allowed after password verification so admins can recover
    // locked-out staff devices from the user management screen.
    if (process.env.DISABLE_DEVICE_AUTH !== 'true' && user.role !== 'admin') {
      if (!user.device_hash) {
        // First login - registration required
        return res.json({
          status: 'device_registration_required',
          userId: user.id
        });
      } else {
        if (!deviceHash || user.device_hash !== deviceHash) {
          return res.status(403).json({ message: '등록되지 않은 PC입니다. 관리자에게 문의하세요.' });
        }
      }
    }

    // Generate JWT Access Token (Payload: userId, role, email)
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await dbRun('UPDATE users SET last_login_at = ? WHERE id = ?', [nowStr, user.id]);

    return res.json({
      message: '로그인에 성공했습니다.',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        force_password_change: user.force_password_change,
        department: user.department,
        position: user.position,
        job_role: user.job_role,
        phone: user.phone,
        profile_image: user.profile_image,
        last_login_at: nowStr
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2.1 POST /auth/register-device - 최초 로그인 장치 등록
router.post('/register-device', async (req, res) => {
  const { userId, deviceHash } = req.body;

  if (!userId || !deviceHash) {
    return res.status(400).json({ message: 'userId와 deviceHash가 필요합니다.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    if (user.device_hash) {
      return res.status(400).json({ message: '이미 장치가 등록되어 있습니다. 관리자에게 문의하세요.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE users SET device_hash = ?, updated_at = ? WHERE id = ?', [deviceHash, nowStr, userId]);

    return res.json({ message: '장치가 성공적으로 등록되었습니다. 다시 로그인을 진행해 주세요.' });
  } catch (error) {
    console.error('Register device failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2.2 POST /auth/change-password - 로그인 후 강제 비밀번호 변경
router.post('/change-password', verifyToken, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = ? WHERE id = ?',
      [passwordHash, nowStr, req.user.id]
    );

    return res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('Change password failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 3. GET /auth/me - 토큰 유효성 검증 및 내 프로필 정보 조회
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, username, name, email, role, status, force_password_change, department, position, job_role, phone, profile_image, created_at, updated_at, last_login_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Fetch me failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 4. GET /auth/users - admin 전용 전체 사용자 조회
router.get('/users', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const users = await dbAll(
      'SELECT id, username, name, email, role, status, device_hash, force_password_change, department, position, job_role, phone, profile_image, created_at, updated_at, last_login_at FROM users ORDER BY name ASC'
    );
    return res.json({ users });
  } catch (error) {
    console.error('Fetch users failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 5. PUT /auth/users/:id - admin 전용 사용자 정보 수정 (비밀번호 재인증 필수)
router.put('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, status, department, position, job_role, phone, profile_image, adminPassword } = req.body;

  if (!name || !role) {
    return res.status(400).json({ message: '이름과 역할은 필수 입력 항목입니다.' });
  }

  try {
    // Admin password verification
    if (!adminPassword || !(await verifyAdminPassword(req.user.id, adminPassword))) {
      return res.status(401).json({ message: '관리자 비밀번호 인증에 실패했습니다.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'UPDATE users SET name = ?, email = ?, role = ?, status = ?, department = ?, position = ?, job_role = ?, phone = ?, profile_image = ?, updated_at = ? WHERE id = ?',
      [name, email || null, role, status || 'active', department || null, position || null, job_role || null, phone || null, profile_image || null, nowStr, id]
    );

    return res.json({ message: '사용자 정보가 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('Update user failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 5.1 POST /auth/users/:id/reset-device - admin 전용 등록 장치 초기화 (비밀번호 재인증 필수)
router.post('/users/:id/reset-device', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  try {
    if (!adminPassword || !(await verifyAdminPassword(req.user.id, adminPassword))) {
      return res.status(401).json({ message: '관리자 비밀번호 인증에 실패했습니다.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE users SET device_hash = NULL, updated_at = ? WHERE id = ?', [nowStr, id]);
    await dbRun('DELETE FROM user_devices WHERE user_id = ?', [id]);

    return res.json({ message: '등록된 PC 장치가 성공적으로 초기화되었습니다.' });
  } catch (error) {
    console.error('Reset device failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 5.2 POST /auth/users/:id/reset-password - admin 전용 비밀번호 초기화 (비밀번호 재인증 필수)
router.post('/users/:id/reset-password', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { adminPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
  }

  try {
    if (!adminPassword || !(await verifyAdminPassword(req.user.id, adminPassword))) {
      return res.status(401).json({ message: '관리자 비밀번호 인증에 실패했습니다.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'UPDATE users SET password_hash = ?, force_password_change = 1, updated_at = ? WHERE id = ?',
      [passwordHash, nowStr, id]
    );

    return res.json({ message: '비밀번호가 초기화되었습니다. 다음 로그인 시 변경이 필요합니다.' });
  } catch (error) {
    console.error('Reset password failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 6. DELETE /auth/users/:id - admin 전용 사용자 삭제 (비밀번호 재인증 필수)
router.delete('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword } = req.body;
    
    // In DELETE, we can pass adminPassword in query parameters or custom headers
    const passwd = adminPassword || req.query.adminPassword;

    if (!passwd || !(await verifyAdminPassword(req.user.id, passwd))) {
      return res.status(401).json({ message: '관리자 비밀번호 인증에 실패했습니다.' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ message: '본인 계정은 삭제할 수 없습니다.' });
    }
    await dbRun('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ message: '사용자가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete user failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// =============================================================
// 조직 정보 관리 API (부서, 직급, 직무)
// =============================================================

// GET /auth/org-info - 부서, 직급, 직무 전체 목록 조회
router.get('/org-info', verifyToken, async (req, res) => {
  try {
    const departments = await dbAll('SELECT id, name FROM departments ORDER BY name ASC');
    const positions = await dbAll('SELECT id, name FROM positions ORDER BY name ASC');
    const jobRoles = await dbAll('SELECT id, name FROM job_roles ORDER BY name ASC');
    return res.json({ departments, positions, jobRoles });
  } catch (error) {
    console.error('Fetch org-info failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /auth/org-info/:type - 조직 정보 추가 (admin만 가능)
router.post('/org-info/:type', verifyToken, checkRole(['admin']), async (req, res) => {
  const { type } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: '이름을 입력해 주세요.' });
  }

  let table = '';
  if (type === 'departments') table = 'departments';
  else if (type === 'positions') table = 'positions';
  else if (type === 'job-roles') table = 'job_roles';
  else {
    return res.status(400).json({ message: '잘못된 타입입니다.' });
  }

  try {
    const prefix = type.substring(0, 3);
    const id = prefix + '-' + Math.random().toString(36).substr(2, 9);
    await dbRun(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, name]);
    return res.status(201).json({ message: '성공적으로 추가되었습니다.', item: { id, name } });
  } catch (error) {
    console.error(`Add ${type} failed:`, error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ message: '이미 존재하는 이름입니다.' });
    }
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /auth/org-info/:type/:id - 조직 정보 삭제 (admin만 가능)
router.delete('/org-info/:type/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const { type, id } = req.params;

  let table = '';
  if (type === 'departments') table = 'departments';
  else if (type === 'positions') table = 'positions';
  else if (type === 'job-roles') table = 'job_roles';
  else {
    return res.status(400).json({ message: '잘못된 타입입니다.' });
  }

  try {
    await dbRun(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return res.json({ message: '성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error(`Delete ${type} failed:`, error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 3.1 PUT /auth/profile - 로그인한 사용자의 개인 정보 수정 (이름, 이메일, 연락처, 프로필사진, 비밀번호)
router.put('/profile', verifyToken, async (req, res) => {
  const { name, email, phone, profile_image, password } = req.body;

  if (!name) {
    return res.status(400).json({ message: '이름은 필수 입력 항목입니다.' });
  }

  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await dbRun(
        'UPDATE users SET name = ?, email = ?, phone = ?, profile_image = ?, password_hash = ?, updated_at = ? WHERE id = ?',
        [name, email || null, phone || null, profile_image || null, passwordHash, nowStr, req.user.id]
      );
    } else {
      await dbRun(
        'UPDATE users SET name = ?, email = ?, phone = ?, profile_image = ?, updated_at = ? WHERE id = ?',
        [name, email || null, phone || null, profile_image || null, nowStr, req.user.id]
      );
    }

    const updatedUser = await dbGet(
      'SELECT id, username, name, email, role, status, force_password_change, department, position, job_role, phone, profile_image, created_at, updated_at, last_login_at FROM users WHERE id = ?',
      [req.user.id]
    );

    return res.json({
      message: '프로필이 성공적으로 수정되었습니다.',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 7. GET /auth/admin-contact - 최고 관리자 연락처 조회 (로그인 화면 표시용)
router.get('/admin-contact', async (req, res) => {
  try {
    const admin = await dbGet(
      'SELECT name, email, phone FROM users WHERE role = "admin" ORDER BY created_at ASC LIMIT 1'
    );
    return res.json({ admin: admin || null });
  } catch (error) {
    console.error('Get admin contact failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
