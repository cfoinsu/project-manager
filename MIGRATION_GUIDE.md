# Project Atlas (forder) 타 PC 이관 및 개발 환경 셋업 가이드

본 문서는 다른 컴퓨터(서버 혹은 개인 PC)로 본 프로젝트를 안전하게 이관하여 개발 및 테스트 작업을 단절 없이 이어나갈 수 있도록 작성된 **통합 마이그레이션 가이드(MIGRATION_GUIDE.md)**입니다.

---

## 1. 이관 핵심 요약 (이것만은 꼭 챙기세요!)

다른 PC로 소스 코드를 복사해 갈 때 아래 내용을 반드시 확인해 주세요.

1.  **용량 다이어트 (중요)**
    *   현재 프로젝트 폴더가 약 **2GB 이상**인 이유는 빌드 임시 폴더(`src-tauri/target/`) 및 의존성 라이브러리(`node_modules/`) 폴더 때문입니다.
    *   다른 PC로 코드를 복사(혹은 압축)하여 가져갈 때는 아래 폴더들을 **반드시 제외**하고 압축하셔야 **수십 MB** 수준으로 가볍게 옮길 수 있습니다.
        *   `[제외]` 루트 폴더의 `node_modules/`
        *   `[제외]` `server/node_modules/`
        *   `[제외]` `src-tauri/target/` (Tauri/Rust 빌드 산출물 폴더)
2.  **데이터베이스 및 서버 파일 필수 동반**
    *   Tauri 앱 빌드본(`exe`) 안에는 프런트엔드 화면만 내장되어 있어 Express 백엔드 서버와 데이터베이스가 동봉되지 않습니다.
    *   따라서 실제 사용하던 프로젝트 데이터와 사용자 정보가 담긴 **`server/` 폴더 전체(특히 `server/local.db` 파일)**를 무조건 같이 가져가야 기존 데이터를 유지한 채 백엔드 서버를 구동할 수 있습니다.

---

## 2. 다른 PC에서 개발 환경 세팅 프로세스

프로젝트를 가져간 PC에서 개발 및 Tauri 데스크톱 빌드를 진행하기 위해 아래 도구들을 순서대로 설치해야 합니다.

### [1단계] 필수 개발 도구 설치
1.  **Node.js LTS 설치**
    *   프런트엔드와 Express 백엔드 API 서버를 실행하는 핵심 런타임입니다.
    *   [Node.js 공식 홈페이지](https://nodejs.org/ko)에서 최신 LTS 버전을 설치합니다.
2.  **Rust 개발 환경(Rustup) 설치** (Tauri 데스크톱 앱 빌드/기동 시 필수)
    *   [Rust 공식 홈페이지](https://rustup.rs/)에서 윈도우용 인스톨러(rustup-init.exe)를 다운로드해 실행하여 설치합니다.
3.  **C++ 빌드 도구 (Visual Studio C++ Build Tools) 설치**
    *   Tauri가 Rust 컴파일러를 통해 데스크톱 래퍼를 빌드할 때 C++ 컴파일 도구가 필수적입니다.
    *   [Visual Studio 빌드 도구 다운로드](https://visualstudio.microsoft.com/ko/downloads/) 페이지 하단에서 "Visual Studio용 빌드 도구"를 받거나, Visual Studio 설치 시 **"C++를 사용한 데스크톱 개발"** 워크로드를 체크하여 설치 완료해 주세요.

### [2단계] 의존성 패키지 설치
소스 폴더가 위치한 경로의 터미널(cmd 또는 PowerShell)을 열고 아래 커맨드를 순차적으로 실행하여 누락된 라이브러리를 설치합니다.

```bash
# 1. 프런트엔드(Client) 패키지 설치
npm install

# 2. 백엔드(Express Server) 패키지 설치
cd server
npm install
cd ..
```

---

## 3. 서비스 기동 및 테스트

이관 완료 후 시스템을 실행하는 방법입니다.

### 1) Express API 백엔드 서버 실행
데이터베이스 및 JWT 인증 처리를 수행하는 API 백엔드를 먼저 구동합니다.
```bash
cd server
npm run start
# 또는 노드몬 자동 재시작 개발용 모드: npm run dev
```
*   서버는 `http://localhost:5000` 포트에서 대기하며, SQLite DB 파일(`server/local.db`)에 자동으로 액세스합니다.

### 2) 프런트엔드 웹 서버 실행 (브라우저용)
웹 브라우저를 통해 코드를 작성하고 확인하기 위한 프런트엔드 서버를 띄웁니다.
```bash
# 별도의 터미널 창을 열고 프로젝트 루트에서 실행
npm run dev
```
*   항상 **`http://localhost:5174`** 포트로 고정 기동되도록 구성되어 있습니다.

### 3) Tauri 데스크톱 클라이언트 실행 (데스크톱 앱용)
물리 폴더 트리 구조 분석 및 로컬 디렉토리 진단이 가능한 Tauri 윈도우 창을 띄웁니다.
```bash
# 별도의 터미널 창을 열고 프로젝트 루트에서 실행
npx tauri dev
```

---

## 4. 로그인 및 다중 PC(기기 차단) 대처 가이드

### 🔑 기본 내장 테스트 계정
데이터베이스(`local.db`) 생성 시 자동 세팅되는 기본 로그인 계정 리스트입니다.
*   **최고 관리자 (Admin)**: `admin` / 비밀번호 `admin123`
*   **프로젝트 매니저 (Manager)**: `manager` / 비밀번호 `manager123`
*   **일반 개발원 (Member)**: `member` / 비밀번호 `member123`

### 🚫 "등록되지 않은 PC입니다" 로그인 차단 해제법
현재 시스템은 다중 PC 도용을 방지하기 위해 1계정당 1대의 기기만 로그인하도록 제한합니다. 타 PC로 이전 시 아래 방법 중 하나를 선택해 차단을 해제하세요.

#### 방법 A: 특정 계정의 PC 기기 정보 초기화 (다시 자동 등록 유도)
계정의 기기 정보 필드를 `NULL`로 만들면, 해당 PC에서 최초 로그인 시 새로운 기기 해시가 자동으로 승인/등록됩니다.
*   **Admin 페이지에서 제어**:
    *   어드민 계정(`admin` / `admin123`)으로 로그인한 후 **사용자 관리 메뉴**로 이동합니다.
    *   잠김 처리가 된 대상자 이름 옆의 **[장치 초기화(Reset Device)]** 버튼을 클릭하고 최고 관리자 패스워드를 입력하여 초기화합니다.
*   **SQLite DB 파일에서 쿼리 직접 수행**:
    *   `server/local.db`를 DB 툴로 열거나 쿼리 터미널에서 아래 명령을 실행합니다.
        ```sql
        UPDATE users SET device_hash = NULL WHERE username = '사용자아이디';
        ```

#### 방법 B: 서버 소스 코드에서 기기 제한 임시 해제 (검증 비활성화)
개발/테스트 편의를 위해 PC 등록 차단 기능을 아예 끄고 싶을 때 적용합니다.
*   **수정 파일**: [server/routes/auth.js](file:///d:/테스트/forder/server/routes/auth.js#L81-L92)
*   **조치 내용**: 로그인 처리 라인(약 81~92 라인)의 `device_hash` 조건 검증 구문을 통째로 주석 처리합니다.
    ```javascript
    // Device hash check (이 부분을 아래와 같이 주석처리)
    /*
    if (!user.device_hash) {
      return res.json({
        status: 'device_registration_required',
        userId: user.id
      });
    } else {
      if (!deviceHash || user.device_hash !== deviceHash) {
        return res.status(403).json({ message: '등록되지 않은 PC입니다. 관리자에게 문의하세요.' });
      }
    }
    */
    ```

---

## 5. 최종 릴리즈 빌드 패키징 (윈도우 앱 exe 제작)

타 PC 세팅 후, 최종 사용자에게 제공할 단독 실행용 파일(`exe`, `msi`)을 완성하려면 루트 경로에서 아래 커맨드를 기동합니다.
```bash
npm run tauri build
```
*   컴파일 완료 시 빌드된 실행 파일은 `src-tauri/target/release/bundle/` 폴더 하위에 생성됩니다. (이 `exe` 배포 시에도 `server/` 구동용 Node.js 백엔드는 타겟 PC에 따로 같이 띄워 주어야 합니다.)
