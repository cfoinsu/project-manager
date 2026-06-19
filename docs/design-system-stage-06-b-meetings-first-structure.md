# 디자인 시스템 6-B: MeetingsView 첫 구조 전환

## 1. 목적

6-B의 목표는 `MeetingsView`의 최상위 화면 구조를 디자인 시스템 컴포넌트로 전환하기 시작하는 것입니다.

이번 단계는 회의 화면 전체 Tailwind 제거가 아니라, 화면의 큰 뼈대와 반복 wrapper를 먼저 `Page`, `DashboardGrid`, `Panel`, `Button`, `Badge`로 옮기는 작업입니다.

## 2. 적용 대상

```text
src/components/MeetingsView.tsx
```

## 3. 전환한 범위

## 3.1. 최상위 화면 구조

기존:

```tsx
<div className="h-full overflow-y-auto text-left flex flex-col gap-5">
```

변경:

```tsx
<Page scroll className="h-full text-left">
  <PageHeader />
  <PageBody />
</Page>
```

규칙:

- 신규/전환 화면은 최상위에서 `Page`를 우선 사용합니다.
- 화면 제목과 주요 액션은 `PageHeader`에 둡니다.

## 3.2. 회의 생성 액션

상단 주요 액션을 `Button`으로 전환했습니다.

```tsx
<Button variant="primary" icon={<Plus />} onClick={() => setCreateOpen(true)}>
  회의 생성
</Button>
```

기존 일정 패널 내부 생성 버튼은 아직 유지했습니다.

## 3.3. 요약 카드 그리드

기존:

```tsx
<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
```

변경:

```tsx
<DashboardGrid>
  <DashboardGridItem span={4}>...</DashboardGridItem>
  <DashboardGridItem span={2}>...</DashboardGridItem>
</DashboardGrid>
```

배치 기준:

```text
다음 예정 회의: span 4
예정 / 진행 / 임박 / 완료: span 2
```

## 3.4. SummaryCard

요약 카드 외곽을 `Panel flush` 기반으로 전환했습니다.

```tsx
<Panel flush className="min-h-[126px]">
```

D-day 배지는 `Badge tone="task"`로 전환했습니다.

## 3.5. MeetingDetailCard

선택 회의 상세 카드 외곽을 `Panel`로 전환했습니다.

상태 배지:

```tsx
<Badge tone="meeting">{getMeetingStatusLabel(meeting)}</Badge>
```

회의록 / 참석 버튼:

```tsx
<Button variant="secondary" size="sm">회의록</Button>
<Button variant="primary" size="sm">참석</Button>
```

## 4. 아직 남은 Tailwind

`MeetingsView`에는 아직 다음 영역의 Tailwind가 남아 있습니다.

```text
MeetingSchedulePanel 전체
주간 캘린더 버튼
회의 목록 item
AgendaCard
MinutesPreviewCard
ParticipantsCard
FollowUpCandidatesCard
CommentsCard
MeetingCreateModal
AvatarStack
MetaLine
```

이번 단계는 큰 wrapper부터 전환한 것이며, 다음 단계에서 내부 카드들을 순차적으로 줄입니다.

## 5. 다음 추천 작업

다음 후보:

```text
6-B-2. MeetingSchedulePanel 내부 구조 전환
6-B-3. 회의 보조 카드들 Panel/Button/Badge 전환
6-C. MyWorkView 첫 구조 전환
```

추천 순서:

```text
6-B-2 -> 6-B-3 -> 6-C
```

