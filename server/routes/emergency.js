import express from 'express';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { dbAll, dbRun, dbGet } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Path to a local configuration file to persist settings
const CONFIG_PATH = join(__dirname, '..', 'config.json');

// Helper to get configuration
const getAppConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
};

// Helper to save configuration
const saveAppConfig = (config) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
};

// Load global configuration on startup to set environment variables
const initGlobalConfig = () => {
  const config = getAppConfig();
  if (config.DISABLE_DEVICE_AUTH !== undefined) {
    process.env.DISABLE_DEVICE_AUTH = String(config.DISABLE_DEVICE_AUTH);
  }
};
initGlobalConfig();

// 1. GET /emergency - 비상 기기 등록 해제 및 설정 웹 GUI 페이지 서빙
router.get('/', (req, res) => {
  const isAuthDisabled = process.env.DISABLE_DEVICE_AUTH === 'true';
  const masterPin = process.env.MASTER_PIN || '987654';

  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atlas ERP - 비상 관리 포털</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, sans-serif; }
    body { background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border-radius: 24px; padding: 32px; width: 100%; max-width: 680px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); }
    h1 { font-size: 24px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; text-align: center; }
    .desc { font-size: 14px; color: #94a3b8; text-align: center; margin-bottom: 30px; }
    
    /* Login Form */
    .pin-form { display: flex; flex-direction: column; gap: 16px; max-width: 360px; margin: 0 auto; }
    .input-group { display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 13px; font-weight: 600; color: #94a3b8; }
    input[type="password"] { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 14px; font-size: 16px; color: #f8fafc; text-align: center; letter-spacing: 6px; outline: none; transition: border 0.2s; }
    input[type="password"]:focus { border-color: #3b82f6; }
    button { background: #3b82f6; color: #fff; border: none; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #2563eb; }
    .error-msg { color: #f87171; font-size: 13px; text-align: center; font-weight: 500; min-height: 18px; }
    
    /* Admin Portal View */
    .portal-view { display: none; }
    .control-panel { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 16px 20px; border-radius: 16px; margin-bottom: 24px; border: 1px solid #334155; }
    .status-badge { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; }
    .status-dot.active { background: #10b981; box-shadow: 0 0 8px #10b981; }
    .status-dot.inactive { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
    
    .btn-toggle { background: #334155; border: 1px solid #475569; padding: 8px 16px; font-size: 13px; border-radius: 8px; }
    .btn-toggle.active { background: #ef4444; border-color: #f87171; }
    
    .user-list { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .user-list th { text-align: left; padding: 12px; font-size: 13px; font-weight: 600; color: #94a3b8; border-bottom: 1px solid #334155; }
    .user-list td { padding: 16px 12px; font-size: 14px; color: #cbd5e1; border-bottom: 1px solid #1e293b; vertical-align: middle; }
    .user-list tr:hover td { background: rgba(255,255,255,0.02); }
    .device-badge { font-family: monospace; font-size: 11px; padding: 4px 8px; background: #0f172a; border-radius: 6px; color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }
    .device-empty { color: #64748b; font-style: italic; }
    
    .btn-action { background: #334155; font-size: 12px; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; }
    .btn-action.reset { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
    .btn-action.reset:hover { background: #ef4444; color: #fff; }
    
    .btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
    .logout-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
    .btn-logout { background: transparent; border: none; color: #64748b; font-size: 13px; text-decoration: underline; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Atlas ERP 비상 관리 포털</h1>
    <p class="desc">기기 인증 잠김 해제 및 보안 설정을 제어합니다.</p>
    
    <!-- Login Form -->
    <div id="loginSection" class="pin-form">
      <div class="input-group">
        <label for="pin">마스터 PIN 번호 입력</label>
        <input type="password" id="pin" maxlength="10" placeholder="••••••" onkeydown="if(event.key === 'Enter') login()">
      </div>
      <div id="error" class="error-msg"></div>
      <button onclick="login()">인증 및 대시보드 진입</button>
      <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 10px;">PIN 분실 시 서버 컴퓨터의 config 파일 혹은 .env 설정을 직접 열어 수정하세요.</p>
    </div>
    
    <!-- Admin Portal View -->
    <div id="portalSection" class="portal-view">
      <div class="control-panel">
        <div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">글로벌 보안 옵션 설정</div>
          <div class="status-badge" id="statusBadge">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">기기 보안 검증 작동 중</span>
          </div>
        </div>
        <button id="toggleBtn" class="btn-toggle" onclick="toggleDeviceAuth()">기기 보안 비활성화하기</button>
      </div>
      
      <div style="font-size: 15px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">사내 사용자 목록 & 기기 연동 관리</div>
      <div style="overflow-x: auto;">
        <table class="user-list">
          <thead>
            <tr>
              <th>이름 (아이디)</th>
              <th>권한 / 부서</th>
              <th>등록된 기기 정보 (Hash)</th>
              <th style="text-align: center;">기기 해제</th>
            </tr>
          </thead>
          <tbody id="userTableBody">
            <!-- Dynamic Users Injection -->
          </tbody>
        </table>
      </div>
      
      <div class="logout-bar">
        <button class="btn-logout" onclick="logout()">포털 나가기</button>
      </div>
    </div>
  </div>

  <script>
    let sessionToken = '';

    async function login() {
      const pin = document.getElementById('pin').value;
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = '';

      try {
        const response = await fetch('/emergency/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          sessionToken = data.token;
          document.getElementById('loginSection').style.display = 'none';
          document.getElementById('portalSection').style.display = 'block';
          loadDashboard();
        } else {
          errorDiv.textContent = data.message || '인증에 실패했습니다.';
        }
      } catch (err) {
        errorDiv.textContent = '서버 통신 오류가 발생했습니다.';
      }
    }

    async function loadDashboard() {
      try {
        const response = await fetch('/emergency/data', {
          headers: { 'Authorization': sessionToken }
        });
        
        if (!response.ok) {
          logout();
          return;
        }
        
        const data = await response.json();
        renderDashboard(data);
      } catch (err) {
        alert('데이터 로드 실패');
      }
    }

    function renderDashboard(data) {
      // 1. Render global auth state
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      const btn = document.getElementById('toggleBtn');
      
      if (data.disableDeviceAuth) {
        dot.className = 'status-dot inactive';
        text.textContent = 'PC 기기인증 꺼짐 (아이디/비밀번호만 사용)';
        btn.textContent = '기기 보안 검증 켜기';
        btn.className = 'btn-toggle';
      } else {
        dot.className = 'status-dot active';
        text.textContent = 'PC 기기인증 켜짐 (미등록 PC 로그인 차단)';
        btn.textContent = '기기 보안 검증 끄기';
        btn.className = 'btn-toggle active';
      }

      // 2. Render Users Table
      const tbody = document.getElementById('userTableBody');
      tbody.innerHTML = '';
      
      data.users.forEach(u => {
        const tr = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        nameTd.innerHTML = `<strong>\${u.name}</strong><br/><span style="font-size:12px; color:#64748b;">\${u.username}</span>`;
        
        const deptTd = document.createElement('td');
        deptTd.innerHTML = `\${u.role.toUpperCase()}<br/><span style="font-size:12px; color:#64748b;">\${u.department || '부서 없음'}</span>`;
        
        const hashTd = document.createElement('td');
        if (u.device_hash) {
          hashTd.innerHTML = `<span class="device-badge" title="\${u.device_hash}">\${u.device_hash.substring(0, 16)}...</span>`;
        } else {
          hashTd.innerHTML = `<span class="device-empty">기기 등록 안됨 (최초 로그인 대기)</span>`;
        }
        
        const actionTd = document.createElement('td');
        actionTd.style.textAlign = 'center';
        
        const actionBtn = document.createElement('button');
        actionBtn.className = 'btn-action reset';
        actionBtn.textContent = '기기 해제';
        actionBtn.disabled = !u.device_hash;
        actionBtn.onclick = () => resetDevice(u.id, u.name);
        
        actionTd.appendChild(actionBtn);
        
        tr.appendChild(nameTd);
        tr.appendChild(deptTd);
        tr.appendChild(hashTd);
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
      });
    }

    async function toggleDeviceAuth() {
      try {
        const response = await fetch('/emergency/toggle-auth', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': sessionToken
          }
        });
        
        if (response.ok) {
          loadDashboard();
        } else {
          alert('상태 변경 실패');
        }
      } catch (err) {
        alert('서버 통신 오류');
      }
    }

    async function resetDevice(userId, userName) {
      if (!confirm(`[\${userName}] 님의 기기 등록을 초기화하시겠습니까?\n다음 로그인 시 첫 접속 기기가 새로 등록됩니다.`)) {
        return;
      }

      try {
        const response = await fetch(\`/emergency/reset-device/\${userId}\`, {
          method: 'POST',
          headers: { 'Authorization': sessionToken }
        });
        
        if (response.ok) {
          alert('기기 등록이 성공적으로 해제되었습니다.');
          loadDashboard();
        } else {
          alert('기기 해제 실패');
        }
      } catch (err) {
        alert('서버 통신 오류');
      }
    }

    function logout() {
      sessionToken = '';
      document.getElementById('pin').value = '';
      document.getElementById('loginSection').style.display = 'flex';
      document.getElementById('portalSection').style.display = 'none';
    }
  </script>
</body>
</html>
  `);
});

// 2. POST /emergency/verify - 마스터 PIN 번호 검증 및 토큰 발급
router.post('/verify', (req, res) => {
  const { pin } = req.body;
  const masterPin = process.env.MASTER_PIN || '987654';

  if (!pin) {
    return res.status(400).json({ message: 'PIN 번호를 입력해 주세요.' });
  }

  if (pin === masterPin) {
    // Generate a simple secure recovery token valid for this emergency session
    // For simplicity, we use a simple masked token verified in memory
    const sessionToken = `session-rec-${Math.random().toString(36).substring(2, 12)}`;
    // Store temporarily in express locals or server memory
    req.app.locals.emergencyToken = sessionToken;
    
    return res.json({ token: sessionToken });
  } else {
    return res.status(401).json({ message: '마스터 PIN 번호가 올바르지 않습니다.' });
  }
});

// Helper middleware to check recovery session token
const verifyEmergencyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  const expected = req.app.locals.emergencyToken;

  if (token && expected && token === expected) {
    next();
  } else {
    res.status(403).json({ message: '권한이 없습니다. 다시 로그인해 주세요.' });
  }
};

// 3. GET /emergency/data - 전체 사용자 및 보안 설정 정보 반환
router.get('/data', verifyEmergencyToken, async (req, res) => {
  try {
    const users = await dbAll(
      'SELECT id, username, name, role, department, device_hash FROM users ORDER BY name ASC'
    );
    const disableDeviceAuth = process.env.DISABLE_DEVICE_AUTH === 'true';

    return res.json({
      users,
      disableDeviceAuth
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '데이터 로드 오류' });
  }
});

// 4. POST /emergency/toggle-auth - 기기 인증 활성화/비활성화 글로벌 옵션 전환
router.post('/toggle-auth', verifyEmergencyToken, async (req, res) => {
  try {
    const currentConfig = getAppConfig();
    const currentState = process.env.DISABLE_DEVICE_AUTH === 'true';
    const newState = !currentState;

    // Update memory env
    process.env.DISABLE_DEVICE_AUTH = String(newState);

    // Persist to local config.json
    currentConfig.DISABLE_DEVICE_AUTH = newState;
    saveAppConfig(currentConfig);

    console.log(`[Emergency Portal] Global Device Authentication status changed: ${newState ? 'DISABLED' : 'ENABLED'}`);

    return res.json({ success: true, disableDeviceAuth: newState });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '설정 저장 오류' });
  }
});

// 5. POST /emergency/reset-device/:userId - 특정 사용자 기기 해시 제거
router.post('/reset-device/:userId', verifyEmergencyToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE users SET device_hash = NULL, updated_at = ? WHERE id = ?', [nowStr, userId]);

    console.log(`[Emergency Portal] Reset device hash for user: ${user.name} (ID: ${userId})`);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '기기 해제 처리 오류' });
  }
});

export default router;
