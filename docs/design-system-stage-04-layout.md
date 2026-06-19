# 디자인 시스템 4단계: 레이아웃 시스템 정리

## 1. 목적

4단계의 목표는 화면마다 제각각 작성되던 grid, flex, 패널, 툴바, 좌우 분할 구조를 공통 레이아웃 시스템으로 정리하는 것입니다.

이번 단계에서는 기존 화면을 대량 전환하지 않고, 신규 화면과 이후 리팩터링에서 사용할 레이아웃 컴포넌트와 CSS 기준을 먼저 추가했습니다.

## 2. 생성된 파일

이번 단계에서 추가한 파일은 다음과 같습니다.

```text
src/styles/components/layout.css
src/components/ui/Layout.tsx
```

`src/styles/design-system.css`에도 layout import를 추가했습니다.

```css
@import './components/layout.css';
```

`src/components/ui/index.ts`에서는 다음 컴포넌트를 export합니다.

```text
Page
PageHeader
PageBody
Toolbar
Panel
SplitLayout
DashboardGrid
DashboardGridItem
```

## 3. 레이아웃 컴포넌트 기준

## 3.1. Page

화면의 최상위 레이아웃은 `Page`를 사용합니다.

```tsx
<Page>
  <PageHeader title="회의" />
  <PageBody>내용</PageBody>
</Page>
```

스크롤이 필요한 페이지는 `scroll` prop을 사용합니다.

```tsx
<Page scroll>
  ...
</Page>
```

규칙:

- 화면 최상위에 임의 `flex flex-col gap-*` 조합을 반복하지 않습니다.
- 페이지 단위 세로 간격은 `Page`가 관리합니다.
- 화면 전체 스크롤 여부는 `Page`에서 결정합니다.

## 3.2. PageHeader

페이지 제목, 설명, 액션 영역은 `PageHeader`를 사용합니다.

```tsx
<PageHeader
  title="프로젝트 개요"
  description="진행률, 회의, 이슈를 확인합니다."
  actions={<Button variant="primary">수정</Button>}
/>
```

규칙:

- 제목 영역과 액션 버튼 영역을 화면마다 새로 flex 구성하지 않습니다.
- 페이지 제목은 `h1`을 사용합니다.
- 설명은 제목 아래에만 배치합니다.

## 3.3. PageBody

페이지 본문은 `PageBody`를 사용합니다.

```tsx
<PageBody>
  ...
</PageBody>
```

규칙:

- 본문은 `min-width: 0`, `min-height: 0`을 기본으로 가집니다.
- 내부 스크롤은 필요한 컴포넌트에서 명시합니다.

## 3.4. Toolbar

필터, 탭, 검색, 액션 버튼이 섞이는 상단 도구 영역은 `Toolbar`를 사용합니다.

```tsx
<Toolbar
  left={<Tabs />}
  right={<Button variant="primary">추가</Button>}
/>
```

규칙:

- 좌측은 필터 / 탭 / 검색, 우측은 액션을 우선 배치합니다.
- 모바일에서는 세로 배치로 자연스럽게 접힙니다.
- 아이콘 버튼만 있는 경우 `IconButton`을 사용합니다.

## 3.5. Panel

카드보다 큰 정보 묶음이나 섹션은 `Panel`을 사용합니다.

```tsx
<Panel title="회의 현황" actions={<Button size="sm">전체 보기</Button>}>
  내용
</Panel>
```

규칙:

- 페이지 섹션은 카드 남발 대신 `Panel`로 묶습니다.
- 반복 아이템은 `Card`, 맥락 묶음은 `Panel`을 사용합니다.
- 패널 안에 패널을 중첩하지 않습니다.

## 3.6. SplitLayout

좌측 메인 + 우측 보조 패널 구조는 `SplitLayout`을 사용합니다.

```tsx
<SplitLayout
  main={<MainContent />}
  aside={<AsideContent />}
/>
```

좌측 보조 패널 + 우측 메인 구조는 `reverse`를 사용합니다.

```tsx
<SplitLayout
  reverse
  aside={<Calendar />}
  main={<MeetingDetail />}
/>
```

규칙:

- 상세 + 사이드바 구조는 직접 grid를 새로 만들지 않습니다.
- 데스크톱은 2열, 태블릿 이하에서는 1열로 접힙니다.
- aside 폭은 기본 `280px ~ 360px` 범위로 유지합니다.

## 3.7. DashboardGrid

KPI, 현황 카드, 차트 등 대시보드형 화면은 `DashboardGrid`를 사용합니다.

```tsx
<DashboardGrid>
  <DashboardGridItem span={3}>
    <Metric />
  </DashboardGridItem>
  <DashboardGridItem span={6}>
    <Chart />
  </DashboardGridItem>
</DashboardGrid>
```

지원 span:

```text
3
4
6
8
12
```

규칙:

- 데스크톱은 12컬럼 기준입니다.
- 1024px 이하에서는 모든 item이 12컬럼으로 접힙니다.
- 차트, KPI, 표가 섞인 화면은 `DashboardGrid`를 우선 사용합니다.

## 4. 카드와 패널의 구분

카드와 패널을 다음처럼 구분합니다.

```text
Card
- 반복 아이템
- 클릭 가능한 항목
- 작은 정보 단위
- 회의 카드, 투두 카드, 작업 카드

Panel
- 화면 섹션
- 맥락이 이어지는 정보 묶음
- 헤더와 본문이 있는 큰 영역
- 회의 현황, 프로젝트 개요 및 범위, 알림 센터
```

카드 안에 카드를 넣는 구조는 피합니다.

## 5. 스크롤 규칙

스크롤은 다음 기준을 따릅니다.

```text
페이지 전체 스크롤: Page scroll
섹션 내부 스크롤: pm-scroll-area
모달 내부 스크롤: Modal body
캘린더 / 목록 고정 높이 스크롤: 해당 컴포넌트에서 명시
```

한 화면 안에서 body 스크롤과 내부 스크롤이 동시에 난립하지 않도록 합니다.

## 6. 반응형 규칙

기본 breakpoint:

```text
1024px 이하:
- SplitLayout 1열 전환
- DashboardGrid item 전체 12컬럼 전환

720px 이하:
- PageHeader 세로 배치
- Toolbar 세로 배치
- 액션 그룹 wrap 허용
```

신규 화면에서 font-size를 viewport 단위로 조절하지 않습니다.

## 7. 적용 우선순위

기존 화면 전환은 다음 순서가 적합합니다.

```text
1. ProjectHeader 주변 popover / toolbar
2. ProjectOverview
3. MeetingsView
4. MyWorkView
5. ProjectScheduleCalendarView
6. ScheduleCalendarView
7. ProjectIssuesView
8. TaskManagement
9. ReportGeneration
10. AssignmentManagementView
```

대형 화면은 공통 컴포넌트 적용 범위를 작게 나누어 진행합니다.

## 8. 신규 개발 규칙

4단계 이후 신규 화면은 다음 순서로 구성합니다.

```text
Page
-> PageHeader
-> Toolbar 또는 주요 액션
-> PageBody
-> SplitLayout / DashboardGrid / Panel
-> Card 또는 리스트 아이템
```

예시:

```tsx
<Page scroll>
  <PageHeader
    title="내 업무"
    actions={<Button variant="primary">추가</Button>}
  />
  <Toolbar left={<Filters />} right={<Search />} />
  <PageBody>
    <DashboardGrid>
      <DashboardGridItem span={6}>
        <Panel title="핵심 업무">...</Panel>
      </DashboardGridItem>
      <DashboardGridItem span={6}>
        <Panel title="다가오는 회의">...</Panel>
      </DashboardGridItem>
    </DashboardGrid>
  </PageBody>
</Page>
```

## 9. 아직 하지 않은 일

이번 단계에서는 아래 작업을 하지 않았습니다.

- 기존 화면의 대량 className 치환
- Tailwind dependency 제거
- `toss-*`, `cds--*` 제거
- 캘린더 / 차트 / 테이블 레이아웃 전면 교체

이 작업들은 5단계 이후 화면 단위로 진행합니다.

## 10. 5단계 진입 조건

5단계는 화면별 Tailwind 제거 단계입니다.

진입 전 확인할 것:

- 공통 UI 컴포넌트가 빌드에 문제 없는지
- 레이아웃 컴포넌트 기준 확정
- 기존 화면을 한 번에 바꾸지 않는 원칙 유지
- 우선 전환 화면 확정

## 11. 5단계 추천 시작 화면

첫 화면 전환은 `ProjectOverview`를 추천합니다.

이유:

- 프로젝트 핵심 화면이라 효과가 큼
- KPI, 패널, 목록, 회의, 이슈 등 디자인 시스템 요소가 골고루 있음
- 이미 개요 레이아웃을 최근 정리했기 때문에 맥락 파악이 쉬움

