# 디자인 시스템 1단계: 현황 분석 및 기준 수립

## 1. 목적

이 문서는 Tailwind CSS를 점진적으로 걷어내고 프로젝트 전용 디자인 시스템을 도입하기 위한 1단계 기준 문서입니다.

1단계의 목표는 실제 코드를 대규모로 바꾸는 것이 아니라, 현재 스타일 구조를 분석하고 앞으로 개발할 때 지켜야 할 규칙을 먼저 고정하는 것입니다.

## 2. 현재 상태 요약

현재 프로젝트는 다음 방식이 섞여 있습니다.

- JSX 내부 Tailwind utility class
- `toss-` 계열 공통 클래스
- `cds--` 계열 공통 클래스
- `src/index.css` 내부 CSS 변수
- 화면별로 직접 작성된 레이아웃 / 카드 / 버튼 스타일

즉, 완전히 Tailwind만 사용하는 구조는 아니며 이미 일부 공통 CSS와 디자인 토큰이 존재합니다.

다만 공통 기준이 한곳에 정리되어 있지 않아, 화면마다 UI 밀도와 간격, 카드 스타일, 버튼 스타일이 달라지는 문제가 있습니다.

## 3. Tailwind 사용량이 높은 주요 파일

`className=` 기준으로 사용량이 많은 파일입니다.

| 순위 | 파일 | className 수 | 크기 |
| --- | --- | ---: | ---: |
| 1 | `src/components/ReportGeneration.tsx` | 391 | 95.8KB |
| 2 | `src/components/TaskManagement.tsx` | 318 | 89.8KB |
| 3 | `src/components/AssignmentManagementView.tsx` | 297 | 82.9KB |
| 4 | `src/components/DashboardView.tsx` | 242 | 62.2KB |
| 5 | `src/components/SettingsView.tsx` | 220 | 50.9KB |
| 6 | `src/components/UserManagementView.tsx` | 218 | 52.9KB |
| 7 | `src/components/MyWorkView.tsx` | 196 | 46.9KB |
| 8 | `src/components/CommentPanel.tsx` | 191 | 65.1KB |
| 9 | `src/components/DocumentLibraryView.tsx` | 175 | 48.4KB |
| 10 | `src/components/MeetingsView.tsx` | 152 | 38.6KB |
| 11 | `src/App.tsx` | 142 | 47.9KB |
| 12 | `src/components/ProjectOverview.tsx` | 139 | 39.6KB |

## 4. 전환 위험도 분류

### 위험도 높음

아래 파일은 크고 상태가 많으며, 한 번에 수정하면 회귀 가능성이 큽니다.

- `ReportGeneration.tsx`
- `TaskManagement.tsx`
- `AssignmentManagementView.tsx`
- `CommentPanel.tsx`
- `DashboardView.tsx`
- `ProjectScheduleCalendarView.tsx`
- `UserManagementView.tsx`
- `SettingsView.tsx`
- `DocumentLibraryView.tsx`

이 파일들은 화면 단위 전환 전에 공통 UI 컴포넌트를 먼저 충분히 만들어야 합니다.

### 위험도 중간

아래 파일은 중요 화면이지만 범위를 나누면 전환 가능합니다.

- `MyWorkView.tsx`
- `ProjectOverview.tsx`
- `MeetingsView.tsx`
- `ScheduleCalendarView.tsx`
- `ProjectAnalysis.tsx`
- `ProjectIssuesView.tsx`
- `MeetingMinutesModal.tsx`

### 위험도 낮음

아래 유형은 공통 UI 도입의 선행 작업으로 적합합니다.

- 작은 뱃지
- 빈 상태
- 아이콘 버튼
- 기본 버튼
- 공통 모달 wrapper
- 공통 카드 wrapper
- 공통 입력 필드

## 5. 기존 디자인 자산

현재 `src/index.css`에는 이미 다음 계열이 존재합니다.

- CSS 변수: `--gray-*`, `--radius-*`, `--shadow-*`
- 카드: `.toss-card`, `.cds--card`
- 버튼: `.toss-btn`, `.cds--btn`
- 입력: `.toss-input`, `.cds--text-input`
- 일부 화면 전용 클래스: `.cds--overview-*`, `.cds--schedule-*`, `.cds--kanban-*`

따라서 디자인 시스템 전환은 완전 신규 작성이 아니라, 기존 자산을 정리하고 표준화하는 방향으로 진행합니다.

## 6. 1단계 디자인 시스템 규칙

이 규칙은 1단계 이후 신규 개발과 수정 작업에 즉시 적용합니다.

### 6.1. 신규 UI는 공통 컴포넌트를 우선 사용

새로운 버튼, 배지, 빈 상태, 카드, 모달을 만들 때 JSX에 Tailwind class를 직접 길게 작성하지 않습니다.

우선 사용 대상:

- `src/components/ui/EmptyState.tsx`
- `src/components/ui/ToneBadge.tsx`

앞으로 추가할 대상:

- `Button`
- `IconButton`
- `Card`
- `Modal`
- `Input`
- `Select`
- `Tabs`
- `Dropdown`
- `Progress`

### 6.2. Tailwind 직접 작성은 임시 허용

아직 모든 공통 컴포넌트가 준비되지 않았기 때문에 Tailwind 사용을 즉시 금지하지 않습니다.

다만 다음 상황에서는 새 공통 컴포넌트 생성을 우선 검토합니다.

- 같은 class 조합이 3회 이상 반복될 때
- 버튼 / 카드 / 모달 / 배지 / input 계열일 때
- 색상과 간격이 화면마다 다르게 쓰일 때
- 다크모드 class가 중복될 때

### 6.3. 클래스 네이밍은 `pm-` prefix를 기준으로 한다

앞으로 새로 작성하는 디자인 시스템 CSS는 `pm-` prefix를 사용합니다.

예시:

```css
.pm-button {}
.pm-button--primary {}
.pm-button--ghost {}

.pm-card {}
.pm-card__header {}
.pm-card__body {}

.pm-badge {}
.pm-badge--meeting {}
.pm-badge--risk {}
```

기존 `.toss-*`, `.cds--*`는 바로 제거하지 않습니다.

전환 순서:

```text
기존 toss/cds 클래스 유지
-> 신규 pm 클래스 추가
-> 화면 단위로 pm 구조 적용
-> 더 이상 쓰지 않는 toss/cds 클래스 제거
```

### 6.4. 카드 반경은 8px 기본, 기존 대형 카드만 예외

앞으로 새 카드형 UI는 기본 `8px` radius를 사용합니다.

예외:

- 기존 화면의 시각 일관성을 깨는 경우
- 모달 / 대형 대시보드 카드처럼 이미 넓은 곡률을 전제로 설계된 경우
- 단계적 전환 중 기존 `.toss-card` / `.cds--card`를 유지하는 경우

최종 목표:

```text
작은 컨트롤: 6px
일반 카드: 8px
모달 / 큰 패널: 12px
원형 avatar / badge: 999px
```

### 6.5. 색상은 토큰으로만 확장

새로운 임의 색상을 JSX에 직접 추가하지 않습니다.

우선 사용하는 색상 역할:

```text
primary
surface
surface-muted
border
text-primary
text-secondary
text-muted
success
warning
danger
meeting
task
assignment
risk
```

추후 `tokens.css`로 분리할 때 위 역할 이름을 기준으로 정리합니다.

### 6.6. 모달과 dim은 반드시 공통화 대상

모달은 화면별로 dim, z-index, 외부 클릭 종료 방식이 달라지면 안 됩니다.

향후 모달 규칙:

```text
dim은 fixed inset-0
dim은 전체 화면을 덮어야 함
외부 클릭 시 닫힘 여부는 prop으로 제어
z-index 계층은 문서화
모달 내부 스크롤과 화면 스크롤을 분리
```

### 6.7. 화면 전환은 “작은 컴포넌트 -> 핵심 화면” 순서

Tailwind 제거는 다음 순서로 진행합니다.

```text
1. EmptyState / Badge / Button
2. Card / Section / Modal
3. Input / Select / DatePicker wrapper
4. ProjectHeader
5. ProjectOverview
6. MeetingsView
7. MyWorkView
8. Calendar
9. Task / Report / Assignment 계열 대형 화면
```

## 7. 반복 UI 패턴

현재 코드에서 반복적으로 보이는 UI 패턴입니다.

### 7.1. 카드

반복 형태:

- 흰색 배경
- border
- rounded
- shadow
- dark mode 배경 / border
- 내부 padding

공통화 대상:

```text
Card
SectionCard
MetricCard
InteractiveCard
```

### 7.2. 버튼

반복 형태:

- primary blue 버튼
- secondary gray 버튼
- ghost icon 버튼
- danger 버튼
- small action 버튼

공통화 대상:

```text
Button
IconButton
ButtonGroup
```

### 7.3. 상태 배지

반복 형태:

- 업무
- 회의
- 인력
- 이슈 / 리스크
- 예정 / 진행 / 완료
- 높음 / 중간 / 낮음

공통화 대상:

```text
ToneBadge
StatusBadge
PriorityBadge
```

### 7.4. 빈 상태

반복 형태:

- 가운데 정렬
- 작은 안내 텍스트
- dashed border 또는 plain 형태

공통화 대상:

```text
EmptyState
```

### 7.5. 모달 / 팝오버

반복 형태:

- fixed overlay
- rounded panel
- shadow
- outside click
- z-index 수동 지정
- 내부 스크롤

공통화 대상:

```text
Modal
Popover
Dropdown
ConfirmDialog
```

## 8. 1단계 완료 기준

1단계 완료 기준은 다음과 같습니다.

- Tailwind 사용량이 높은 파일 식별
- 전환 위험도 분류
- 기존 디자인 자산 확인
- 신규 개발 규칙 문서화
- 다음 단계에서 만들 공통 UI 우선순위 정의

## 9. 2단계 진입 조건

2단계는 디자인 토큰 구축 단계입니다.

2단계 진입 전 확인할 것:

- `pm-` prefix 사용 동의
- 기존 `.toss-*`, `.cds--*`를 당장 제거하지 않는 방향 동의
- 카드 radius 기준 확정
- dark mode 유지 여부 확정
- 신규 UI는 공통 컴포넌트 우선 원칙 확정

## 10. 2단계 예상 작업

2단계에서는 다음 파일을 만들거나 정리합니다.

```text
src/styles/tokens.css
src/styles/reset.css
src/styles/base.css
src/styles/components/button.css
src/styles/components/card.css
src/styles/components/badge.css
```

그리고 기존 `src/index.css`의 토큰과 공통 클래스를 위 구조로 분리할 준비를 합니다.

