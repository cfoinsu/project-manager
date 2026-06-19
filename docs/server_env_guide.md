# 서버 환경 변경 가이드

> 이 시스템은 **서버 PC 1대 + 사내 브라우저 클라이언트** 구성입니다.  
> 환경이 바뀌는 상황별로 해야 할 작업을 정리했습니다.

---

## 📁 핵심 설정 파일 위치

```
project-manager/
├── .env                  ← 프론트엔드가 읽는 서버 주소 (빌드 시 반영)
├── run-server.cmd        ← 서버 실행 스크립트
└── server/
    ├── index.js          ← 서버 포트 설정 (PORT 환경변수)
    ├── local.db          ← 모든 데이터 (이 파일 = DB 전체)
    └── config.json       ← 기기인증 활성화 여부 (자동 생성)
```

---

## 🔄 상황 1: 서버 PC의 IP 주소가 바뀐 경우

**가장 흔한 케이스.** IP가 바뀌면 클라이언트들이 서버를 못 찾음.

### Step 1 — `.env` 파일 수정
```
# project-manager/.env

VITE_API_URL=http://[새 IP 주소]:5000
# 예시: VITE_API_URL=http://192.168.1.50:5000
```

### Step 2 — 프론트엔드 재빌드 (배포 환경인 경우)
```bash
# project-manager/ 폴더에서 실행
npm run build
```
> ⚠️ `npm run build` 를 반드시 해야 `.env` 변경이 반영됩니다.  
> 개발 서버(`npm run dev`)는 저장하면 바로 반영됩니다.

### Step 3 — 클라이언트 브라우저 캐시 처리
직원들이 예전 주소를 localStorage에 저장하고 있을 수 있음.

**방법 A (권장)** — 시스템 관리자가 설정 화면에서 "서버 주소" 재설정  
**방법 B** — 직원이 브라우저에서 `F12 → Application → Local Storage → pa_server_url` 값 삭제 후 새로고침

---

## 🔄 상황 2: 서버 포트를 변경하는 경우

기본 포트는 **5000**. 다른 서비스와 충돌 시 변경.

### Step 1 — 서버 포트 변경
`server/index.js` 를 직접 수정하지 말고, 환경변수로 지정:

```bash
# run-server.cmd 수정
@echo off
cd /d "%~dp0"
set PORT=3001
node server/index.js > server-runtime.out.log 2> server-runtime.err.log
```

또는 `.env.server` 파일을 server/ 폴더에 만들어서:
```
PORT=3001
```

### Step 2 — `.env` 의 주소도 포트 맞게 수정
```
VITE_API_URL=http://192.168.1.50:3001
```

### Step 3 — 재빌드 + 서버 재시작

> ⚠️ 현재 코드에 `api.ts`가 URL 포트를 자동으로 5000으로 교정하는 버그가 있습니다.  
> 포트 변경 시 아래 코드 수정이 추가로 필요합니다.

**`src/utils/api.ts` 수정 (L116~128)**:
```typescript
// 수정 전 (문제 있는 코드)
const repairApiServerUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.port && parsed.port !== '5000') {
      parsed.port = '5000';  // ← 이 줄이 포트를 강제 5000으로 바꿈
      ...

// 수정 후
const repairApiServerUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    new URL(value); // 유효한 URL인지만 검증
    return value.replace(/\/$/, '');
  } catch {
    return null;
  }
};
```

---

## 🔄 상황 3: 서버 PC 자체가 교체되는 경우 (데이터 이전)

### Step 1 — 데이터 백업 (구 서버)
```
server/local.db          ← 반드시 복사 (모든 데이터)
server/uploads/          ← 반드시 복사 (업로드 파일)
server/config.json       ← 복사 (기기인증 설정)
.env                     ← 복사 (환경설정)
```

### Step 2 — 신규 서버에 설치
```bash
# Node.js 설치 후
cd project-manager
npm install          # 프론트엔드 패키지
cd server
npm install          # 서버 패키지
```

### Step 3 — 파일 복원
구 서버에서 백업한 파일들을 같은 경로에 덮어쓰기.

### Step 4 — `.env` 수정 (새 IP로)
```
VITE_API_URL=http://[새 서버 IP]:5000
```

### Step 5 — 재빌드 + 서버 시작
```bash
npm run build
run-server.cmd
```

---

## 🔄 상황 4: JWT 시크릿 키 변경 (보안 강화)

현재 기본값: `'project_atlas_erp_secret_key'` (하드코딩)  
키를 바꾸면 **기존 로그인 토큰이 전부 무효화** → 전 직원 재로그인 필요.

### Step 1 — `.env` 또는 서버 환경변수에 추가
```bash
# 운영 서버 실행 스크립트(run-server.cmd)에 추가
set JWT_SECRET=여기에_랜덤하고_긴_문자열_입력
```

예시 시크릿 생성 방법:
```bash
# PowerShell에서
[System.Web.Security.Membership]::GeneratePassword(32, 4)
# 또는 그냥 긴 문자열 직접 입력 (50자 이상 권장)
```

> ⚠️ 변경 직후 전 직원 로그아웃됩니다. 업무 외 시간에 변경 권장.

---

## 🔄 상황 5: 비상 포털 PIN 변경

`http://[서버IP]:5000/emergency` 에 접근하는 마스터 PIN.  
현재 기본값: `987654` (취약, 반드시 변경 필요)

### `run-server.cmd` 수정
```batch
@echo off
cd /d "%~dp0"
set MASTER_PIN=원하는PIN번호
node server/index.js > server-runtime.out.log 2> server-runtime.err.log
```

---

## 🔄 상황 6: 기기 인증 활성화/비활성화

새로 입사한 직원의 PC가 잠기거나, 운영 초기 등록 전 테스트 시.

### 방법 A (권장) — 비상 포털 사용
1. `http://[서버IP]:5000/emergency` 접속
2. PIN 입력
3. 화면에서 "기기 보안 검증 끄기/켜기" 버튼 클릭

### 방법 B — 환경변수로 영구 비활성화
```batch
# run-server.cmd
set DISABLE_DEVICE_AUTH=true
```

### 방법 C — config.json 직접 수정
```json
// server/config.json
{
  "DISABLE_DEVICE_AUTH": true
}
```
→ 서버 재시작 불필요, 즉시 반영.

---

## 🔄 상황 7: DB 초기화 (데이터 전체 삭제)

> ⚠️ **복구 불가**. 반드시 백업 후 진행.

```bash
# 서버 종료 후
del server\local.db

# 서버 재시작하면 DB가 새로 생성되고 기본 계정 자동 seeding
```

기본 생성 계정:
| 아이디 | 비밀번호 | 권한 |
|--------|----------|------|
| admin | admin123 | 관리자 |
| manager | manager123 | 매니저 |
| member | member123 | 일반 직원 |

---

## 📋 빠른 참조 — 변경 항목별 파일

| 변경 항목 | 수정 파일 | 재빌드 필요 |
|-----------|-----------|-------------|
| 서버 IP | `.env` | ✅ 필요 |
| 서버 포트 | `run-server.cmd` + `.env` + `api.ts` | ✅ 필요 |
| JWT 시크릿 | `run-server.cmd` | ❌ 재시작만 |
| 비상 PIN | `run-server.cmd` | ❌ 재시작만 |
| 기기 인증 ON/OFF | 비상 포털 또는 `config.json` | ❌ 즉시 반영 |
| 전체 데이터 이전 | `local.db` + `uploads/` 복사 | ❌ 재시작만 |
| DB 초기화 | `local.db` 삭제 | ❌ 재시작만 |

---

## ⚡ 서버 재시작 방법

```batch
# 서버 종료: 실행 중인 node 프로세스 종료
taskkill /IM node.exe /F

# 서버 시작
cd D:\테스트\project\project-manager
run-server.cmd
```

또는 Task Manager → node.exe 종료 → `run-server.cmd` 더블클릭
