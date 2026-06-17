# Tailwind CSS 제거 및 디자인 시스템 도입 계획

## 1. 목적

현재 프로젝트는 Tailwind CSS 클래스가 JSX 안에 직접 많이 작성되어 있습니다.

이 방식은 빠르게 화면을 만들기에는 좋지만, 프로젝트 규모가 커질수록 다음 문제가 생깁니다.

- 화면마다 간격, 색상, 글자 크기, border radius 기준이 달라짐
- 컴포넌트 재사용성이 낮아짐
- 디자인 수정 시 여러 파일을 동시에 수정해야 함
- Tailwind className이 길어져 JSX 가독성이 낮아짐
- 모달, 버튼, 카드, 배지 같은 공통 UI가 화면별로 다르게 구현됨

따라서 Tailwind를 한 번에 제거하기보다, 먼저 디자인 시스템 레이어를 만들고 화면 단위로 점진적으로 전환하는 방향이 안전합니다.

## 2. 전제

이 작업의 핵심은 “Tailwind 즉시 제거”가 아닙니다.

권장 방향은 다음과 같습니다.

```text
1차 목표: 디자인 시스템 기준 확립
2차 목표: 핵심 화면부터 Tailwind 의존도 제거
3차 목표: 마지막에 Tailwind 패키지 제거
```

Tailwind를 너무 빨리 제거하면 기존 화면의 레이아웃, 반응형, 모달, 드롭다운, 캘린더가 대량으로 깨질 수 있습니다.

## 3. 권장 CSS 구조

사용자가 말한 `iem 구조`는 프론트 CSS 맥락상 일반적으로 쓰이는 표현은 아니므로, 여기서는 **BEM 기반의 계층형 CSS 구조**로 해석합니다.

권장 구조:

```text
src/
  styles/
    tokens.css
    reset.css
    base.css
    utilities.css
    components/
      button.css
      card.css
      modal.css
      badge.css
      form.css
      table.css
      layout.css
    pages/
      project-overview.css
      meetings.css
      my-work.css
      calendar.css

  components/
    ui/
      Button.tsx
      IconButton.tsx
      Card.tsx
      Modal.tsx
      Badge.tsx
      EmptyState.tsx
      Select.tsx
      DatePicker.tsx
      Avatar.tsx
      Tabs.tsx
      Dropdown.tsx
      Progress.tsx
```

## 4. 네이밍 규칙

클래스 충돌을 줄이기 위해 프로젝트 prefix를 붙입니다.

예시 prefix:

```text
pm-
```

BEM 예시:

```css
.pm-card {}
.pm-card__header {}
.pm-card__title {}
.pm-card__body {}
.pm-card--interactive {}

.pm-button {}
.pm-button--primary {}
.pm-button--ghost {}
.pm-button--danger {}

.pm-badge {}
.pm-badge--task {}
.pm-badge--meeting {}
.pm-badge--risk {}
```

## 5. 단계별 실행 계획

## 5.1. 1단계: 현황 분석 및 기준 수립

목표는 Tailwind를 어디서부터 제거할지 판단하는 것입니다.

주요 작업:

- Tailwind 사용량이 많은 컴포넌트 파악
- 반복되는 UI 패턴 정리
- 색상, 간격, 폰트 크기, radius, shadow 추출
- 공통화 우선순위 선정
- 제거 시 위험한 화면 분류

우선순위 높은 화면:

- 프로젝트 개요
- 내 업무
- 회의
- 일정 캘린더
- 이슈 / 분석
- 프로젝트 헤더
- 공통 모달
- 공통 버튼

예상 토큰:

```text
15,000 ~ 30,000 tokens
```

## 5.2. 2단계: 디자인 토큰 구축

Tailwind를 걷어내기 전에 CSS 변수 기반의 디자인 기준을 만듭니다.

예시:

```css
:root {
  --color-primary: #3182f6;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}
```

주요 작업:

- `tokens.css` 작성
- `reset.css` 작성
- `base.css` 작성
- dark mode 기준 결정
- 기존 Tailwind 색상과 디자인 토큰 매핑

예상 토큰:

```text
20,000 ~ 40,000 tokens
```

## 5.3. 3단계: 공통 UI 컴포넌트 구축

Tailwind 제거의 핵심 단계입니다.

JSX에 직접 작성된 스타일을 공통 컴포넌트로 흡수합니다.

먼저 만들 컴포넌트:

```text
Button
IconButton
Card
Section
Modal
Dialog
Badge
Avatar
Input
Textarea
Select
DatePicker wrapper
EmptyState
Tabs
Popover
Dropdown
Progress
```

사용 예시:

```tsx
<Button variant="primary" size="sm">
  저장
</Button>

<Badge tone="meeting">
  회의
</Badge>

<Card>
  <Card.Header />
  <Card.Body />
</Card>
```

예상 토큰:

```text
40,000 ~ 80,000 tokens
```

## 5.4. 4단계: 레이아웃 시스템 정리

현재 프로젝트는 카드, 섹션, grid, flex 구조가 화면마다 다르게 들어가 있을 가능성이 큽니다.

이 단계에서는 레이아웃 규칙을 정리합니다.

주요 작업:

- 페이지 공통 컨테이너
- 프로젝트 헤더 레이아웃
- 좌 / 우 패널 구조
- 대시보드 그리드
- 리스트 / 상세 2단 구조
- 모달 z-index / dim 공통화
- 스크롤 영역 규칙

예상 CSS:

```css
.pm-page {}
.pm-page__header {}
.pm-page__body {}

.pm-dashboard-grid {}
.pm-dashboard-grid--overview {}

.pm-split-layout {}
.pm-split-layout__main {}
.pm-split-layout__aside {}
```

예상 토큰:

```text
35,000 ~ 70,000 tokens
```

## 5.5. 5단계: 화면별 Tailwind 제거

한 번에 전체 제거하지 않고 화면 단위로 진행합니다.

권장 순서:

```text
1. ProjectHeader / 공통 모달 / 공통 배지
2. 프로젝트 개요
3. 회의
4. 내 업무
5. 일정 캘린더
6. 작업 보드
7. 폴더 / 분석 / 보고서
8. 나머지 작은 컴포넌트
```

각 화면마다 해야 할 일:

- JSX Tailwind class 제거
- 공통 UI 컴포넌트로 교체
- 화면 전용 CSS 작성
- 반응형 확인
- 모달 / 팝오버 z-index 확인
- 빌드 / 린트 확인

예상 토큰:

```text
120,000 ~ 250,000 tokens
```

## 5.6. 6단계: Tailwind 설정 제거

모든 주요 화면에서 Tailwind 의존도가 사라진 뒤 진행합니다.

제거 대상:

```text
tailwind.config.js
postcss.config.js 내 Tailwind 설정
@tailwind import
tailwindcss dependency
@tailwindcss/postcss dependency
JSX 내 남은 Tailwind className
```

이 단계는 마지막이어야 합니다.

중간에 제거하면 화면이 대량으로 깨질 가능성이 큽니다.

예상 토큰:

```text
20,000 ~ 40,000 tokens
```

## 5.7. 7단계: QA 및 시각 검수

Tailwind 제거 후에는 기능보다 화면 깨짐 리스크가 큽니다.

확인 대상:

- 모바일 / 데스크톱 반응형
- 모달 dim 전체 화면 적용
- 팝오버 외부 클릭 종료
- 텍스트 overflow
- 버튼 클릭 영역
- 달력 / 회의 / 투두 스크롤
- dark mode 유지 여부
- 빌드 사이즈 변화

예상 토큰:

```text
40,000 ~ 80,000 tokens
```

## 6. 전체 예상 토큰

전체를 제대로 진행할 경우 예상 토큰은 다음과 같습니다.

```text
최소: 290,000 tokens
권장: 400,000 ~ 600,000 tokens
넓게 보면: 700,000 tokens 이상
```

GPT Plus 기준으로는 한 번에 끝내기보다 여러 작업 단위로 나누는 것이 안전합니다.

## 7. 추천 실행 회차

```text
1회차: 디자인 토큰 + 공통 Button / Card / Badge / EmptyState
2회차: Modal / Popover / Dropdown / Input / Select 정리
3회차: 프로젝트 헤더 + 프로젝트 개요 Tailwind 제거
4회차: 회의 화면 Tailwind 제거
5회차: 내 업무 + 일정 캘린더 Tailwind 제거
6회차: 작업 / 이슈 / 분석 / 보고서 화면 정리
7회차: Tailwind dependency 제거 + 전체 QA
```

## 8. 예상 파장

가장 큰 파장은 다음과 같습니다.

- JSX 변경량이 큼
- 기존 화면의 미세한 간격이 달라질 수 있음
- Tailwind 유틸로 처리하던 예외 스타일을 CSS 구조로 옮겨야 함
- 공통 컴포넌트 설계를 잘못하면 수정 난이도가 오히려 증가함
- 모달, 드롭다운, 캘린더, 투두처럼 상태가 많은 UI에서 회귀 가능성이 큼
- dark mode 기준이 흔들릴 수 있음
- 화면별 스크롤 구조가 달라질 수 있음

## 9. 권장 전략

처음부터 Tailwind 완전 제거를 목표로 잡기보다, 먼저 디자인 시스템 레이어를 만들고 신규 / 수정 UI는 무조건 그 컴포넌트를 쓰는 방식이 안전합니다.

권장 흐름:

```text
1. 디자인 토큰을 만든다.
2. 공통 UI 컴포넌트를 만든다.
3. 신규 작업은 공통 UI만 사용한다.
4. 기존 화면은 우선순위별로 천천히 전환한다.
5. 마지막에 Tailwind 패키지를 제거한다.
```

이 순서가 가장 안전하고, 회귀를 관리하기 쉽습니다.

