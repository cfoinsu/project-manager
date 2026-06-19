# 프론트엔드 / 백엔드 서버 설정 및 실행 방법

이 프로젝트는 프론트엔드(Vite + React)와 백엔드(Express + SQLite)를 각각 실행해야 정상 동작합니다.

## 1. 기본 구조

| 구분 | 위치 | 실행 포트 | 역할 |
| --- | --- | --- | --- |
| 프론트엔드 | 프로젝트 루트 | `5174` | 화면 UI, Tauri 앱에서 사용하는 웹 화면 |
| 백엔드 | `server` 폴더 | `5000` | 로그인, 프로젝트, 업무, 회의, 알림, 파일 API |

## 2. 최초 설치

프로젝트를 처음 받았거나 `node_modules`가 없을 때만 실행합니다.

### 프론트엔드 패키지 설치

```powershell
cd D:\테스트\project\project-manager
npm.cmd install
```

### 백엔드 패키지 설치

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd install
```

## 3. 백엔드 서버 설정

백엔드는 기본적으로 `5000` 포트에서 실행됩니다.

백엔드 포트를 바꾸고 싶다면 `server` 폴더에 `.env` 파일을 만들고 아래처럼 설정합니다.

```env
PORT=5000
```

현재 서버는 SQLite DB 파일을 사용합니다.

```text
server/local.db
```

서버 실행 시 `server/db.js`를 통해 필요한 테이블과 초기 데이터가 확인됩니다.

## 4. 프론트엔드 API 주소 설정

프론트엔드는 프로젝트 루트의 `.env` 파일에서 백엔드 주소를 읽습니다.

현재 설정:

```env
VITE_API_URL=http://192.168.0.155:5000
```

같은 PC에서만 테스트할 경우 아래처럼 바꿔도 됩니다.

```env
VITE_API_URL=http://localhost:5000
```

다른 PC나 같은 네트워크의 기기에서 접속해야 한다면 `localhost`가 아니라 백엔드 서버가 실행되는 PC의 내부 IP를 사용해야 합니다.

예시:

```env
VITE_API_URL=http://192.168.0.155:5000
```

`.env`를 수정한 뒤에는 프론트엔드 개발 서버를 재시작해야 반영됩니다.

## 5. 실행 순서

터미널을 2개 열고 아래 순서대로 실행하는 것을 권장합니다.

### 1단계: 백엔드 서버 실행

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run start
```

개발 중 파일 변경 시 자동 재시작이 필요하면 아래 명령을 사용합니다.

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run dev
```

프로젝트 루트에 있는 실행 파일로도 백엔드를 실행할 수 있습니다.

```powershell
cd D:\테스트\project\project-manager
.\run-server.cmd
```

단, `run-server.cmd`는 서버 로그를 아래 파일로 저장합니다.

```text
server-runtime.out.log
server-runtime.err.log
```

### 2단계: 프론트엔드 개발 서버 실행

```powershell
cd D:\테스트\project\project-manager
npm.cmd run dev -- --host
```

실행 후 브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:5174
```

같은 네트워크의 다른 기기에서 접속하려면 프론트엔드 서버가 출력하는 Network 주소를 사용합니다.

예시:

```text
http://192.168.0.155:5174
```

## 6. 서버 정상 동작 확인

백엔드가 정상 실행 중인지 확인하려면 아래 주소를 브라우저에서 열거나 PowerShell에서 호출합니다.

```text
http://localhost:5000/health
```

PowerShell 확인 명령:

```powershell
Invoke-RestMethod http://localhost:5000/health
```

정상이라면 대략 아래와 같은 응답이 나옵니다.

```json
{
  "status": "OK",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

## 7. 빌드 및 미리보기

프론트엔드 빌드:

```powershell
cd D:\테스트\project\project-manager
npm.cmd run build
```

빌드 결과 미리보기:

```powershell
cd D:\테스트\project\project-manager
npm.cmd run preview
```

## 8. 자주 생기는 문제

### 프론트 화면은 뜨지만 로그인이 안 됨

백엔드 서버가 실행 중인지 확인합니다.

```powershell
Invoke-RestMethod http://localhost:5000/health
```

프론트 `.env`의 `VITE_API_URL`이 실제 백엔드 주소와 같은지도 확인합니다.

### 다른 PC에서 접속이 안 됨

프론트 실행 시 반드시 아래처럼 `--host` 옵션을 붙입니다.

```powershell
npm.cmd run dev -- --host
```

그리고 `.env`의 API 주소는 `localhost`가 아니라 서버 PC의 내부 IP로 설정합니다.

```env
VITE_API_URL=http://서버PC_IP:5000
```

### 포트가 이미 사용 중이라고 나옴

기존에 실행 중인 프론트/백엔드 서버를 종료하거나, 설정 포트를 변경해야 합니다.

프론트 포트는 `vite.config.ts`에서 설정되어 있습니다.

```ts
server: {
  port: 5174
}
```

백엔드 포트는 `server/index.js`의 기본값이 `5000`이며, `server/.env`의 `PORT`로 변경할 수 있습니다.

## 9. 권장 실행 요약

백엔드:

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run start
```

프론트엔드:

```powershell
cd D:\테스트\project\project-manager
npm.cmd run dev -- --host
```

