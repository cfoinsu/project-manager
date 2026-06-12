# 전체 폰트 크기 조정 및 위계 고도화 계획서

본 계획서는 시스템 전체에서 너무 작게 표시되는 폰트(8px ~ 11px)를 사용자 가독성 확보를 위해 최소 12px(`text-xs`)로 일괄 조정하고, 이에 따른 시각적 계층 구조(Hierarchy)를 유지하기 위해 인근 텍스트 요소의 크기를 조정하는 방안을 수립합니다.

## User Review Required

> [!IMPORTANT]
> **1. 최소 폰트 크기 12px 지정**
> *   기존에 소형 라벨, 배지, 서브텍스트 등에 적용되어 있던 `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[10.5px]` 스타일을 모두 제거하고 최소 `text-xs` (12px) 크기를 보장합니다.
>
> **2. 위계 유지를 위한 계층형 스케일업**
> *   텍스트 크기가 12px로 상승함에 따라, 부모/자식/형제 요소 간의 대비(Contrast)가 줄어드는 현상을 방지하기 위해 상위 텍스트(예: 이름, 타이틀)를 `text-xs` -> `text-sm` (14px) 또는 `text-sm` -> `text-base` (16px)로 동반 스케일업하여 가독성과 심미성을 모두 만족하도록 처리합니다.
> *   예시: 좌측 하단 프로필 영역에서 사용자 이름(`text-xs`)과 역할(`text-[10px]`)의 크기 차이를 유지하기 위해 이름을 `text-sm`으로, 역할을 `text-xs`로 스케일업합니다.
>
> **3. 미니 아바타 및 컴포넌트 크기 리팩토링**
> *   캘린더 등에서 사용되는 초소형 사용자 아바타 배지(`w-4.5 h-4.5`, 내부 텍스트 9px)는 12px 폰트 적용 시 글자가 원 밖으로 넘치므로, 아바타 크기를 `w-6 h-6` (24px)으로 확대하고 내부 텍스트를 `text-xs`로 자연스럽게 정돈합니다.

---

## Proposed Changes

### 1. 전역 스타일 가이드

#### [MODIFY] [index.css](file:///d:/테스트/forder/src/index.css)
*   사용되지 않는 하위 호환용 폰트 변수 조정:
    *   `--font-size-xxs: 11px;` -> `12px;`
    *   `--font-size-xxxs: 10px;` -> `12px;`

---

### 2. 컴포넌트별 폰트 위계 조정

#### [MODIFY] [App.tsx](file:///d:/테스트/forder/src/App.tsx)
*   좌측 프로필 사용자 이름: `text-xs` -> `text-sm`
*   사용자 권한 표시: `text-[10px]` -> `text-xs`
*   로그아웃 버튼: `text-[10px]` -> `text-xs`

#### [MODIFY] [AnalysisPanel.tsx](file:///d:/테스트/forder/src/components/AnalysisPanel.tsx)
*   빈 폴더 및 대용량 폴더 리스트 내 파일 경로: `text-[8px]` -> `text-xs`

#### [MODIFY] [CommentPanel.tsx](file:///d:/테스트/forder/src/components/CommentPanel.tsx)
*   댓글 개수 배지: `text-[10px]` -> `text-xs`
*   아바타 텍스트: `text-[11px]` -> `text-xs`
*   작성 시간 정보: `text-[11px]` -> `text-xs`
*   '배정', '워크로드' 구분 배지: `text-[10px]` -> `text-xs`
*   하단 단축키(Ctrl+Enter) 안내 가이드: `text-[11px]` -> `text-xs`
*   댓글 작성자 이름: `text-xs` -> `text-sm` (위계 유지)

#### [MODIFY] [DashboardView.tsx](file:///d:/테스트/forder/src/components/DashboardView.tsx)
*   주간 간트차트 요일 이름: `text-[11px]` -> `text-xs`
*   캘린더 바 프로젝트 타이틀: `text-[11px]` -> `text-xs`
*   최근 프로젝트 목록 내 프로젝트 코드 배지: `text-[11px]` -> `text-xs`
*   진행률 퍼센트 표시: `text-[11px]` -> `text-xs`
*   코드 생성 규칙 안내 서브텍스트: `text-[11px]` -> `text-xs`
*   스캔 로컬 폴더 경로 안내: `text-[11px]` -> `text-xs`

#### [MODIFY] [DocumentLibraryView.tsx](file:///d:/테스트/forder/src/components/DocumentLibraryView.tsx)
*   업로드 모달 파일 안내 크기 제한: `text-[10px]` -> `text-xs`
*   헤더 '전사 공용' 구분 배지: `text-[10px]` -> `text-xs`
*   문서 카드 카테고리 배지: `text-[10px]` -> `text-xs`
*   문서 카드 태그 텍스트: `text-[10px]` -> `text-xs`
*   문서 카드 날짜 및 파일 크기: `text-[11px]` -> `text-xs`
*   문서 카드 업로더 표시: `text-[11px]` -> `text-xs`

#### [MODIFY] [LoginView.tsx](file:///d:/테스트/forder/src/components/LoginView.tsx)
*   비밀번호 분실 안내 문구: `text-[11px]` -> `text-xs`
*   기기 인증 모달의 "Device Authentication" 서브 타이틀: `text-[10px]` -> `text-xs`

#### [MODIFY] [RuleChecker.tsx](file:///d:/테스트/forder/src/components/RuleChecker.tsx)
*   기준 폴더 경로 코드 박스: `text-[10px]` -> `text-xs`

#### [MODIFY] [ScheduleCalendarView.tsx](file:///d:/테스트/forder/src/components/ScheduleCalendarView.tsx)
*   캘린더 내부 투입인원 아바타 텍스트: `text-[9px]` -> `text-xs`
*   캘린더 내부 투입인원 아바타 컨테이너 크기: `w-4.5 h-4.5` -> `w-6 h-6` (12px 글씨 크기에 맞춰 확장)

#### [MODIFY] [SettingsView.tsx](file:///d:/테스트/forder/src/components/SettingsView.tsx)
*   프로젝트 코드 체계(지역, 연도, 유형, 순번) 개별 설명 라벨: `text-[10px]` -> `text-xs`
*   백엔드 서버 URL 안내 가이드: `text-[11px]` -> `text-xs`

#### [MODIFY] [TreemapView.tsx](file:///d:/테스트/forder/src/components/TreemapView.tsx)
*   트리맵 블록 이름: `text-xs` -> `text-sm` (위계 유지)
*   트리맵 블록 파일 크기 표시: `text-[10px]` -> `text-xs`

#### [MODIFY] [UserManagementView.tsx](file:///d:/테스트/forder/src/components/UserManagementView.tsx)
*   아이디(username) 표시: `text-[11px]` -> `text-xs`
*   목록 내 역할 배지(관리자, 매니저, 개발원): `text-[11px]` -> `text-xs`
*   PC 등록 및 미등록 여부 배지: `text-[10px]` -> `text-xs`
*   생성 폼 내 부서/직급/직무 라벨: `text-[10px]` -> `text-xs`
*   상세 폼 내 부서/직급/직무 라벨: `text-[10px]` -> `text-xs`
*   "Edit Account Profile" 상세 서브헤더: `text-[10px]` -> `text-xs`
*   기기 미등록 및 등록상태 배지: `text-[10px]` -> `text-xs`
*   기기 접근 보안 관리 설명 본문: `text-[10.5px]` -> `text-xs`
*   2차 인증 모달 "Double Authentication" 서브 타이틀: `text-[10px]` -> `text-xs`

---

## Verification Plan

### Automated Tests
*   `npm run build`를 수행하여 모든 TypeScript 타입 에러 및 빌드 오류 유무 검증.

### Manual Verification
1.  **가독성 검증**:
    *   화면 전 영역을 탐색하며 폰트가 지나치게 작아 눈이 피로한 영역이 없는지 확인합니다.
    *   12px 텍스트가 정상적으로 노출되며 깨지거나 잘리는 현상이 없는지 확인합니다.
2.  **레이아웃 캘리브레이션 검증**:
    *   프로필 영역, 캘린더 내 미니 아바타 영역, 트리맵 블록 내부, 문서 카드 등 폰트 상승 및 아바타 크기 확장 영역이 주위 레이아웃을 틀어지게 하지 않는지 교차 검증합니다.
3.  **위계 유지 검증**:
    *   동반 상승된 상위 텍스트(이름, 타이틀 등)와의 스케일 차이가 적절히 나타나는지 시각적 균형을 체크합니다.
