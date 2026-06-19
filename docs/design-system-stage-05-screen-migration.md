# 디자인 시스템 5단계: 화면별 Tailwind 제거 시작

## 1. 목적

5단계의 목표는 실제 화면에서 Tailwind 의존도를 줄이기 시작하는 것입니다.

이번 단계에서는 전체 화면을 한 번에 바꾸지 않고, `ProjectOverview`를 첫 대상 화면으로 선택해 상단 구조, KPI 그리드, 반복 섹션 helper부터 디자인 시스템 컴포넌트로 전환했습니다.

## 2. 적용 대상

이번 단계의 적용 대상:

```text
src/components/ProjectOverview.tsx
```

변경한 공통 레이아웃:

```text
Page
PageHeader
PageBody
DashboardGrid
DashboardGridItem
Panel
Button
```

## 3. 이번 단계에서 전환한 범위

## 3.1. 페이지 상단

기존:

```tsx
<div className="mb-4 flex items-center justify-between gap-4">
  ...
  <button className="...">사업 정보 수정</button>
</div>
```

변경:

```tsx
<PageHeader
  title={activeProject.name}
  description="Project Overview"
  actions={<Button variant="primary">사업 정보 수정</Button>}
/>
```

규칙:

- 페이지 제목과 액션은 `PageHeader`를 사용합니다.
- 주요 액션 버튼은 `Button`을 사용합니다.

## 3.2. KPI 그리드

기존:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-4">
  ...
</div>
```

변경:

```tsx
<DashboardGrid>
  <DashboardGridItem span={2}>
    <DashboardMetricCard />
  </DashboardGridItem>
</DashboardGrid>
```

이번 단계에서 KPI 6개 배치를 위해 `DashboardGridItem`에 `span={2}`를 추가했습니다.

규칙:

- 대시보드형 화면은 직접 grid class를 만들기보다 `DashboardGrid`를 우선 사용합니다.
- 12컬럼 기준에서 6개 KPI는 `span={2}`를 사용합니다.

## 3.3. 반복 섹션

기존 `SectionGroup`은 자체 border, background, padding을 Tailwind로 직접 구성했습니다.

변경 후 `Panel`을 사용합니다.

```tsx
const SectionGroup = ({ title, children }) => (
  <Panel title={title} className="mb-4">
    {children}
  </Panel>
);
```

규칙:

- 화면 맥락을 묶는 큰 단위는 `Panel`을 사용합니다.
- 반복되는 작은 항목은 `Card`를 사용합니다.
- 섹션마다 border / radius / shadow를 새로 작성하지 않습니다.

## 3.4. 반복 카드

`DashboardMetricCard`, `OverviewCard`의 외곽 구조를 `Panel` 기반으로 전환했습니다.

```tsx
const OverviewCard = ({ title, action, onAction, children }) => (
  <Panel
    title={title}
    actions={action && (
      <Button variant="ghost" size="sm" onClick={onAction}>
        {action} <ArrowRight />
      </Button>
    )}
  >
    {children}
  </Panel>
);
```

규칙:

- 카드 헤더 액션은 `Button variant="ghost" size="sm"`을 사용합니다.
- 카드 외곽의 border, shadow, radius는 `Panel`이 관리합니다.

## 4. 아직 남은 Tailwind

이번 단계는 첫 화면의 전체 Tailwind 제거가 아니라, 안전한 부분 전환입니다.

`ProjectOverview` 안에는 아직 아래 Tailwind가 남아 있습니다.

- 내부 chart / progress / avatar 배치
- 편집 모달 form
- 정보 row
- compact list
- narrative block
- 일부 grid
- 일부 색상 / text class

이 부분은 다음 화면 전환 단계에서 더 작은 컴포넌트로 분리하면서 줄입니다.

## 5. 5단계 이후 신규 규칙

화면을 전환할 때는 다음 순서를 지킵니다.

```text
1. 페이지 최상위 구조를 Page / PageHeader / PageBody로 전환
2. KPI 또는 대시보드 영역을 DashboardGrid로 전환
3. 큰 섹션을 Panel로 전환
4. 작은 반복 아이템을 Card로 전환
5. 버튼을 Button / IconButton으로 전환
6. 배지를 Badge로 전환
7. 마지막에 세부 Tailwind class를 CSS로 이동
```

## 6. 화면별 전환 기준

한 화면을 전환할 때 전체를 한 번에 바꾸지 않습니다.

권장 단위:

```text
상단 헤더
KPI 영역
주요 섹션 wrapper
목록 아이템
모달
폼
차트 / 캘린더
```

각 단위마다 타입 체크, 린트, 빌드를 확인합니다.

## 7. 다음 추천 작업

다음 5단계 확장 작업은 둘 중 하나를 추천합니다.

```text
A. ProjectOverview 내부 컴포넌트 추가 전환
   - InfoRow
   - CompactList
   - NarrativeBlock
   - edit modal button

B. MeetingsView 첫 구조 전환
   - Page / PageHeader / Toolbar
   - 회의 목록 Panel
   - 회의 상세 Panel
```

현재는 A를 먼저 진행하는 것이 더 안전합니다.

