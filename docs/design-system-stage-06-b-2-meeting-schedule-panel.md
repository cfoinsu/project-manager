# 디자인 시스템 6-B-2: MeetingSchedulePanel 내부 구조 전환

## 1. 목적

6-B-2의 목표는 `MeetingsView` 안의 `MeetingSchedulePanel`을 디자인 시스템 기반으로 더 깊게 전환하는 것입니다.

이번 단계에서는 주간 캘린더, 상태 탭, 기간 탭, 회의 목록 item을 `pm-` CSS와 공통 UI 컴포넌트로 정리했습니다.

## 2. 적용 대상

```text
src/components/MeetingsView.tsx
src/styles/components/meetings.css
src/styles/design-system.css
```

## 3. 추가된 CSS

```text
src/styles/components/meetings.css
```

`design-system.css`에 import했습니다.

```css
@import './components/meetings.css';
```

## 4. 전환한 영역

## 4.1. SummaryCard

회의 요약 카드 내부 스타일을 `pm-meeting-summary` 계열로 분리했습니다.

```text
pm-meeting-summary
pm-meeting-summary__header
pm-meeting-summary__label
pm-meeting-summary__value
pm-meeting-summary__sub
```

## 4.2. MeetingSchedulePanel wrapper

기존 Tailwind section wrapper를 `Panel`과 `pm-meeting-schedule`로 전환했습니다.

```tsx
<Panel className="pm-meeting-schedule">
```

## 4.3. 회의 생성 버튼

패널 내부 생성 버튼을 `Button`으로 전환했습니다.

```tsx
<Button variant="secondary" size="sm" icon={<Plus />}>
  회의 생성
</Button>
```

## 4.4. 상태 탭 / 기간 탭

반복되는 segmented control을 `pm-segmented` 계열 CSS로 분리했습니다.

```text
pm-segmented
pm-segmented--4
pm-segmented--2
pm-segmented__button
pm-segmented__button--active
```

## 4.5. 주간 캘린더

주간 캘린더 버튼을 `pm-meeting-day` 계열 CSS로 분리했습니다.

```text
pm-meeting-week__top
pm-meeting-week__nav
pm-meeting-week__days
pm-meeting-day
pm-meeting-day--active
pm-meeting-day__name
pm-meeting-day__number
pm-meeting-day__dot
```

주간 이동 버튼은 `IconButton`으로 전환했습니다.

## 4.6. 회의 목록

회의 목록 item을 `pm-meeting-card` 계열 CSS로 분리했습니다.

```text
pm-meeting-list
pm-meeting-list__header
pm-meeting-list__title
pm-meeting-card
pm-meeting-card--selected
pm-meeting-card__head
pm-meeting-card__title
pm-meeting-card__time
pm-meeting-card__footer
```

D-day와 상태 표시는 `Badge`로 전환했습니다.

빈 상태는 `EmptyState`로 전환했습니다.

## 5. 아직 남은 MeetingsView Tailwind

```text
AgendaCard
MinutesPreviewCard
ParticipantsCard
FollowUpCandidatesCard
CommentsCard
MeetingCreateModal
AvatarStack
MetaLine
일부 main/aside container
```

다음 단계에서는 회의 보조 카드들을 `Panel`, `Button`, `Badge`, `EmptyState`로 전환하는 것이 좋습니다.

## 6. 다음 추천 작업

```text
6-B-3. 회의 보조 카드들 Panel/Button/Badge 전환
6-C. MyWorkView 첫 구조 전환
```

추천 순서:

```text
6-B-3 -> 6-C
```

