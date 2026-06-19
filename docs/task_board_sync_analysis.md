# 작업보드 데이터 유실 및 동기화 분석

작성일: 2026-06-15

## 증상 요약

- 작업보드에서 작업 상태를 이동하면 체크리스트, 업무 이력 등 상세 데이터가 사라질 수 있음.
- 작업 상세의 체크리스트와 업무 이력이 저장되지 않거나 다른 PC에서 보이지 않음.
- 작업 댓글 기능이 정상 동작하지 않음.
- 다른 PC 접속 시 변경 사항이 실시간 반영되지 않거나, 통신이 되지 않는 것처럼 보임.

## 확인된 주요 원인

### 1. 작업 저장 시 `INSERT OR REPLACE` 사용

`server/routes/tasks.js`의 작업 저장 API가 `INSERT OR REPLACE INTO tasks`를 사용하고 있었다.

SQLite의 `REPLACE`는 기존 row를 업데이트하는 것이 아니라 삭제 후 새로 삽입한다. `subtasks`, `worklogs`는 `task_id`에 `ON DELETE CASCADE`가 걸려 있어 작업 row가 삭제되는 순간 체크리스트와 업무 이력도 같이 삭제될 수 있다.

### 2. 작업 댓글 저장 모델 불일치

프론트는 작업 댓글을 `task_id`, `context_type`, `context_id`로 보내지만 서버의 `comments` 테이블과 라우트는 이 값을 저장하지 않았다.

또한 프론트가 작업 댓글을 `assignment_id = task_${task.id}` 형태로 우회 저장하려 했는데, 서버 DB의 `comments.assignment_id`는 실제 `assignments(id)` 외래키라서 저장 실패가 발생할 수 있다.

### 3. 서버 요청 실패가 localStorage fallback으로 숨겨짐

체크리스트와 업무 이력 API는 서버 모드에서 요청 실패 시 에러를 표시하지 않고 localStorage fallback으로 저장했다.

이 경우 현재 PC에서는 저장된 것처럼 보이지만 중앙 DB에는 저장되지 않아 다른 PC에서 보이지 않는다.

### 4. 실시간 동기화 구조 부재

현재 WebSocket/SSE 기반 실시간 통신은 없다. 일부 작업 로그만 15초 polling을 하고, 프로젝트/프로세스/작업 목록은 화면 진입 또는 프로젝트 선택 시 로드된다.

따라서 다른 PC에서 변경한 작업 상태와 상세 정보는 자동으로 즉시 반영되지 않는다.

### 5. 서버 URL 설정이 PC별 localStorage에만 저장됨

환경설정의 서버 URL은 `pa_server_url` localStorage에 저장되어 각 PC마다 따로 관리된다. admin이 설정한 서버 주소가 전체 직원 PC에 전파되는 구조가 아니다.

## 해결 방향

- 작업 저장 SQL을 `ON CONFLICT(id) DO UPDATE` 형태로 변경해 기존 row 삭제를 막는다.
- `comments` 테이블에 `task_id`, `context_type`, `context_id` 컬럼을 추가하고 작업 댓글 저장/조회에 사용한다.
- 서버 모드에서 체크리스트/업무 이력 저장 실패 시 localStorage fallback으로 숨기지 않고 실패를 명확히 노출한다.
- 작업보드에서 중앙 서버 데이터를 주기적으로 다시 불러오는 polling을 추가한다.
- admin이 설정한 서버 URL을 서버 전역 설정으로 저장하고, 모든 클라이언트가 해당 값을 받아 localStorage 캐시에 반영하도록 한다.
