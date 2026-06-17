# 디자인 시스템 2단계: 디자인 토큰 구축

## 1. 목적

2단계의 목표는 Tailwind CSS를 바로 제거하는 것이 아니라, 앞으로 Tailwind를 대체할 프로젝트 전용 디자인 토큰과 기초 CSS 구조를 만드는 것입니다.

이 단계부터 신규 UI는 가능한 한 `--pm-*` 토큰과 `pm-` 클래스를 기준으로 작성합니다.

## 2. 생성된 파일

이번 단계에서 추가한 파일은 다음과 같습니다.

```text
src/styles/design-system.css
src/styles/tokens.css
src/styles/reset.css
src/styles/base.css
src/styles/components/button.css
src/styles/components/card.css
src/styles/components/badge.css
```

그리고 `src/index.css`에서 새 디자인 시스템 CSS를 import합니다.

```css
@import './styles/design-system.css';
```

## 3. 도입 방식

이번 단계에서는 기존 화면을 깨지 않기 위해 다음 원칙을 적용했습니다.

- 기존 `toss-*` 클래스 유지
- 기존 `cds--*` 클래스 유지
- 기존 Tailwind className 유지
- 신규 디자인 시스템은 `pm-` prefix로만 추가
- 신규 CSS 변수는 `--pm-*` prefix로만 추가
- reset은 `.pm-root` 하위에만 제한 적용

즉, 현재 화면의 시각적 변경을 최소화하면서 다음 단계에서 사용할 기반을 만든 상태입니다.

## 4. 디자인 토큰 규칙

새로운 디자인 값은 반드시 `src/styles/tokens.css`에 추가합니다.

JSX나 개별 CSS 파일에 임의 색상, 임의 shadow, 임의 radius를 계속 추가하지 않습니다.

### 4.1. 색상 토큰

주요 색상 역할:

```text
--pm-color-primary
--pm-color-primary-hover
--pm-color-primary-soft

--pm-color-surface
--pm-color-surface-muted
--pm-color-surface-subtle
--pm-color-border
--pm-color-border-strong

--pm-color-text-primary
--pm-color-text-secondary
--pm-color-text-muted
--pm-color-text-disabled

--pm-color-success
--pm-color-warning
--pm-color-danger

--pm-color-task
--pm-color-meeting
--pm-color-assignment
--pm-color-risk
```

상태별 색상은 반드시 역할 기반 이름을 사용합니다.

예시:

```css
color: var(--pm-color-danger);
background: var(--pm-color-danger-soft);
```

금지:

```css
color: #f04452;
background: #feecee;
```

단, 외부 라이브러리 스타일을 덮어쓰는 경우에는 예외를 둘 수 있습니다.

## 5. 간격 토큰

간격은 `4px` 단위 스케일을 기준으로 합니다.

```text
--pm-space-1: 4px
--pm-space-2: 8px
--pm-space-3: 12px
--pm-space-4: 16px
--pm-space-5: 20px
--pm-space-6: 24px
--pm-space-8: 32px
--pm-space-10: 40px
--pm-space-12: 48px
```

새 CSS에서는 가능하면 위 토큰을 사용합니다.

예시:

```css
gap: var(--pm-space-3);
padding: var(--pm-space-5);
```

## 6. Radius 규칙

2단계부터 새 디자인 시스템 CSS는 아래 radius 기준을 사용합니다.

```text
--pm-radius-xs: 4px
--pm-radius-sm: 6px
--pm-radius-md: 8px
--pm-radius-lg: 12px
--pm-radius-xl: 16px
--pm-radius-full: 999px
```

권장 사용:

```text
작은 입력 / 작은 버튼: sm
일반 카드 / 일반 버튼: md
모달 / 큰 패널: lg
큰 팝오버: xl
avatar / badge: full
```

기존 `.toss-card`, `.cds--card`의 큰 radius는 당장 제거하지 않습니다.

## 7. Shadow 규칙

shadow는 3단계만 사용합니다.

```text
--pm-shadow-sm
--pm-shadow-md
--pm-shadow-lg
```

권장 사용:

```text
일반 카드: sm
hover 카드 / popover: md
modal / 큰 dropdown: lg
```

## 8. Typography 규칙

폰트 패밀리는 아래 토큰을 사용합니다.

```css
--pm-font-sans
```

크기 토큰:

```text
--pm-font-size-2xs: 10px
--pm-font-size-xs: 11px
--pm-font-size-sm: 12px
--pm-font-size-md: 14px
--pm-font-size-lg: 16px
--pm-font-size-xl: 20px
--pm-font-size-2xl: 24px
```

신규 CSS에서 viewport 단위로 font-size를 조절하지 않습니다.

## 9. Z-index 규칙

z-index는 아래 토큰을 기준으로 합니다.

```text
--pm-z-dropdown: 50
--pm-z-popover: 60
--pm-z-modal-dim: 100
--pm-z-modal: 110
--pm-z-toast: 130
```

앞으로 모달, 팝오버, 드롭다운은 이 계층을 기준으로 정리합니다.

## 10. Dark Mode 규칙

dark mode는 기존처럼 `.dark` 클래스를 기준으로 합니다.

`tokens.css`에서 `.dark` 아래에 같은 변수명을 재정의합니다.

예시:

```css
.dark {
  --pm-color-surface: #0f172a;
  --pm-color-text-primary: #f8fafc;
}
```

따라서 컴포넌트 CSS에서는 `.dark .pm-card`처럼 매번 별도 분기하지 않고, 가능한 한 변수만 사용합니다.

## 11. Scoped Reset 규칙

reset은 전체 앱에 강제 적용하지 않습니다.

현재 reset은 `.pm-root` 하위에만 적용됩니다.

```css
.pm-root,
.pm-root * {
  box-sizing: border-box;
}
```

이유:

- 기존 화면의 예기치 않은 깨짐 방지
- Tailwind 전환 전까지 기존 reset 유지
- 새 디자인 시스템 적용 영역만 점진적으로 관리

## 12. 추가된 기본 클래스

### 12.1. Layout

```text
.pm-root
.pm-page
.pm-page__header
.pm-page__body
.pm-scroll-area
```

### 12.2. Text

```text
.pm-text-primary
.pm-text-secondary
.pm-text-muted
```

### 12.3. Button

```text
.pm-button
.pm-button--primary
.pm-button--secondary
.pm-button--ghost
.pm-button--danger
.pm-button--sm
.pm-icon-button
```

### 12.4. Card

```text
.pm-card
.pm-card--padded
.pm-card--interactive
.pm-card__header
.pm-card__title
.pm-card__body
```

### 12.5. Badge

```text
.pm-badge
.pm-badge--task
.pm-badge--meeting
.pm-badge--assignment
.pm-badge--risk
.pm-badge--success
.pm-badge--warning
.pm-badge--danger
.pm-badge--neutral
```

## 13. 신규 개발 규칙

2단계 이후 신규 UI를 만들 때는 다음 순서를 따릅니다.

```text
1. 이미 있는 ui 컴포넌트가 있는지 확인
2. 없으면 pm 클래스 조합으로 구현
3. 같은 패턴이 3회 이상 반복되면 ui 컴포넌트로 승격
4. 임의 색상, 임의 radius, 임의 shadow는 tokens.css에 먼저 등록
5. 화면 전용 CSS는 styles/pages 아래로 분리하는 것을 원칙으로 함
```

## 14. 아직 하지 않은 일

이번 단계에서는 아래 작업을 하지 않았습니다.

- Tailwind dependency 제거
- 기존 Tailwind className 제거
- 기존 `.toss-*` 제거
- 기존 `.cds--*` 제거
- 대형 화면 리팩터링
- index.css 전체 분해

이 작업들은 3단계 이후 화면 단위로 진행합니다.

## 15. 3단계 진입 조건

3단계는 공통 UI 컴포넌트 구축 단계입니다.

진입 전 확인할 것:

- `--pm-*` 토큰 기준 유지
- `pm-` prefix 기준 유지
- 기존 화면을 한 번에 바꾸지 않는 점진 전환 유지
- 우선 컴포넌트: Button, Card, Badge, EmptyState, Modal

## 16. 3단계 추천 작업

3단계에서는 다음 컴포넌트를 우선 만듭니다.

```text
src/components/ui/Button.tsx
src/components/ui/IconButton.tsx
src/components/ui/Card.tsx
src/components/ui/Badge.tsx
src/components/ui/Modal.tsx
```

그리고 기존 `EmptyState`, `ToneBadge`를 `pm-` 클래스 기반으로 정리합니다.

