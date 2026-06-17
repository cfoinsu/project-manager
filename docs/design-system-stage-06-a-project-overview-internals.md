# 디자인 시스템 6-A: ProjectOverview 내부 컴포넌트 추가 전환

## 1. 목적

6-A의 목표는 5단계에서 시작한 `ProjectOverview` 화면 전환을 더 안쪽까지 확장하는 것입니다.

이번 작업은 Tailwind 제거 완료가 아니라, 반복되는 내부 UI 조각을 `pm-` 토큰 기반 CSS와 공통 UI 컴포넌트로 옮기는 단계입니다.

## 2. 적용 대상

```text
src/components/ProjectOverview.tsx
src/styles/components/overview.css
src/styles/design-system.css
```

## 3. 추가된 CSS

이번 단계에서 `overview.css`를 추가했습니다.

```text
src/styles/components/overview.css
```

그리고 `design-system.css`에 import했습니다.

```css
@import './components/overview.css';
```

## 4. 전환한 내부 UI

## 4.1. 프로젝트 설명 hero

기존 Tailwind 기반 hero 영역을 `pm-overview-hero` 계열 클래스로 분리했습니다.

추가 클래스:

```text
pm-overview-hero
pm-overview-hero__grid
pm-overview-hero__summary
pm-overview-hero__eyebrow
pm-overview-hero__description
pm-overview-hero__badges
pm-overview-hero__aside
```

설명, 중요도, 우선순위, 기간 배지는 `Badge` 컴포넌트를 사용합니다.

## 4.2. NarrativeBlock

사업 목적, 주요 범위, 특이사항 블록을 `pm-overview-narrative` 계열로 전환했습니다.

추가 클래스:

```text
pm-overview-narrative
pm-overview-narrative__title
pm-overview-narrative__text
pm-overview-narrative__empty
```

## 4.3. InfoRow

사업 정보 / 발주처 정보 / 문서 및 폴더 진단에 반복되는 정보 행을 `pm-info-row` 계열로 전환했습니다.

추가 클래스:

```text
pm-info-row
pm-info-row__label
pm-info-row__value-wrap
pm-info-row__value
pm-info-row__value--rose
pm-info-row__value--blue
pm-info-row__value--indigo
pm-info-row__progress
pm-info-row__progress-fill
```

## 4.4. CompactList

최근 업데이트, 최근 완료 작업, 이슈 및 리스크, 투입 인력 목록을 `pm-compact-list` 계열로 전환했습니다.

추가 클래스:

```text
pm-compact-list
pm-compact-list__item
pm-compact-list__content
pm-compact-list__title
pm-compact-list__sub
```

목록 meta 값은 `Badge` 컴포넌트로 표시합니다.

## 4.5. 빠른 작업 버튼

빠른 작업의 버튼을 `Button` 컴포넌트로 전환했습니다.

```tsx
<Button variant="primary" icon={<Activity />}>
  폴더 구조 동기화
</Button>

<Button variant="secondary" icon={<FolderOpen />}>
  프로젝트 폴더 열기
</Button>
```

## 5. 아직 남은 Tailwind

`ProjectOverview`에는 아직 다음 영역의 Tailwind가 남아 있습니다.

```text
KPI 내부 원형 그래프
회의 카드 내부 avatar/list
작업 추이 SVG text
프로세스 원형 진행률
일정 진행 위험도 progress
편집 모달 form
TextField / SelectField / TextareaField
```

다음 추가 전환에서는 form 컴포넌트와 progress 컴포넌트를 만드는 것이 좋습니다.

## 6. 다음 추천 작업

다음 후보:

```text
6-A-2. ProjectOverview form/progress 추가 전환
6-B. MeetingsView 첫 구조 전환
6-C. MyWorkView 첫 구조 전환
```

안전 순서는 `6-A-2 -> 6-B -> 6-C`입니다.

