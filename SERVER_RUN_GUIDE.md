# 서버 실행 방법

프론트 개발 서버는 프로젝트 루트에서 다음 명령으로 실행합니다.

```powershell
npm.cmd run dev -- --host
```

백엔드 서버는 `server` 폴더 기준으로 실행합니다.

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run start
```

개발 중 파일 변경 시 자동 재시작이 필요하면 다음 명령을 사용합니다.

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run dev
```

또는 프로젝트 루트에 있는 실행 파일을 사용할 수도 있습니다.

```powershell
.\run-server.cmd
```

서버 기본 포트는 `5000`입니다.

현재 프론트 `.env` 설정은 다음 서버 주소를 바라봅니다.

```env
VITE_API_URL=http://192.168.0.155:5000
```

같은 PC에서만 테스트할 경우 아래처럼 바꿔도 됩니다.

```env
VITE_API_URL=http://localhost:5000
```

일반적인 실행 순서는 터미널을 2개 열고 다음처럼 진행하면 됩니다.

1. 백엔드 서버 실행

```powershell
cd D:\테스트\project\project-manager\server
npm.cmd run start
```

2. 프론트 개발 서버 실행

```powershell
cd D:\테스트\project\project-manager
npm.cmd run dev -- --host
```
