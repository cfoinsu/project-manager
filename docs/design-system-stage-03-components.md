# 디자인 시스템 3단계: 공통 UI 컴포넌트 구축

## 1. 목적

3단계의 목표는 2단계에서 만든 `--pm-*` 토큰과 `pm-` CSS 클래스를 실제 React 공통 컴포넌트로 연결하는 것입니다.

이 단계부터 신규 UI는 Tailwind className을 직접 길게 작성하기보다, 먼저 `src/components/ui`의 공통 컴포넌트를 사용합니다.

## 2. 생성된 컴포넌트

이번 단계에서 추가하거나 정리한 컴포넌트는 다음과 같습니다.

```text
src/components/ui/Button.tsx
src/components/ui/IconButton.tsx
src/components/ui/Card.tsx
src/components/ui/Badge.tsx
src/components/ui/Modal.tsx
src/components/ui/EmptyState.tsx
src/components/ui/ToneBadge.tsx
src/components/ui/index.ts
```

## 3. 추가된 CSS

이번 단계에서 추가한 컴포넌트 CSS는 다음과 같습니다.

```text
src/styles/components/empty-state.css
src/styles/components/modal.css
```

그리고 `src/styles/design-system.css`에서 import합니다.

```css
@import './components/empty-state.css';
@import './components/modal.css';
```

## 4. 컴포넌트 사용 규칙

## 4.1. Button

버튼은 기본적으로 `Button` 컴포넌트를 사용합니다.

```tsx
import { Button } from './ui';

<Button variant="primary">저장</Button>
<Button variant="secondary">취소</Button>
<Button variant="ghost">더보기</Button>
<Button variant="danger">삭제</Button>
```

지원 variant:

```text
primary
secondary
ghost
danger
```

지원 size:

```text
md
sm
```

규칙:

- 신규 primary 버튼은 직접 `bg-*`를 쓰지 않는다.
- 아이콘과 텍스트가 함께 있는 버튼은 `icon` prop을 우선 사용한다.
- 반복되는 버튼 스타일을 화면 안에서 새로 만들지 않는다.

## 4.2. IconButton

아이콘만 있는 버튼은 `IconButton`을 사용합니다.

```tsx
<IconButton label="닫기" icon={<X />} onClick={onClose} />
```

규칙:

- 접근성을 위해 `label`은 필수입니다.
- hover 색상은 CSS 토큰을 따릅니다.
- 새 아이콘 버튼마다 padding, rounded, hover class를 직접 작성하지 않습니다.

## 4.3. Card

카드형 영역은 `Card`를 사용합니다.

```tsx
<Card>
  <Card.Header>
    <Card.Title>회의 현황</Card.Title>
  </Card.Header>
  <Card.Body>
    내용
  </Card.Body>
</Card>
```

간단한 padding 카드:

```tsx
<Card padded>
  내용
</Card>
```

상호작용 카드:

```tsx
<Card padded interactive>
  클릭 가능한 카드
</Card>
```

규칙:

- 신규 일반 카드는 `8px` radius를 기본으로 한다.
- 기존 대형 카드와 시각 차이가 큰 화면은 단계적으로 전환한다.
- 카드 안에 또 카드가 들어가는 구조는 피한다.

## 4.4. Badge

상태 배지는 `Badge`를 사용합니다.

```tsx
<Badge tone="meeting">회의</Badge>
<Badge tone="task">작업</Badge>
<Badge tone="risk">이슈</Badge>
```

지원 tone:

```text
task
meeting
assignment
risk
success
warning
danger
neutral
```

규칙:

- 업무, 회의, 인력, 이슈는 tone으로 구분한다.
- 색상은 `badge.css`와 `tokens.css`에서 관리한다.
- 화면마다 임의 색상 배지를 만들지 않는다.

## 4.5. ToneBadge

`ToneBadge`는 기존 코드 호환을 위한 얇은 wrapper입니다.

신규 코드에서는 가능하면 `Badge`를 직접 사용합니다.

기존 사용:

```tsx
<ToneBadge tone="meeting">회의</ToneBadge>
```

신규 권장:

```tsx
<Badge tone="meeting">회의</Badge>
```

## 4.6. EmptyState

빈 상태는 `EmptyState`를 사용합니다.

```tsx
<EmptyState text="표시할 데이터가 없습니다." />
<EmptyState text="등록된 회의가 없습니다." variant="dashed" />
```

규칙:

- 빈 상태 문구 스타일을 화면마다 새로 만들지 않는다.
- 단순 안내는 `plain`, 영역을 차지해야 하면 `dashed`를 사용한다.

## 4.7. Modal

새 모달은 `Modal` 컴포넌트를 사용합니다.

```tsx
<Modal
  open={open}
  title="회의록"
  onClose={close}
  footer={<Button variant="primary">저장</Button>}
>
  내용
</Modal>
```

규칙:

- dim은 전체 화면을 덮는다.
- 외부 클릭 종료는 `closeOnDimClick`으로 제어한다.
- 모달 본문은 내부 스크롤을 가진다.
- z-index는 `--pm-z-modal-dim`, `--pm-z-modal` 토큰을 따른다.

## 5. Import 규칙

신규 코드에서는 가능하면 barrel import를 사용합니다.

```tsx
import { Button, Card, Badge, Modal } from './ui';
```

컴포넌트 위치에 따라 상대 경로는 달라질 수 있습니다.

## 6. 기존 컴포넌트와의 관계

현재 프로젝트에는 이미 `ModalOverlay` 같은 기존 공통 컴포넌트가 있습니다.

이번 단계에서 기존 모달을 즉시 교체하지 않습니다.

전환 원칙:

```text
신규 모달: Modal 사용
기존 안정화된 모달: 유지
수정이 필요한 기존 모달: Modal로 점진 전환
```

## 7. Tailwind 사용 기준

3단계 이후에도 Tailwind를 즉시 금지하지 않습니다.

다만 아래 UI는 새 공통 컴포넌트를 우선 사용합니다.

```text
button
icon button
card
badge
empty state
modal
```

Tailwind 직접 작성이 허용되는 경우:

- 화면 고유의 임시 레이아웃
- 아직 공통 컴포넌트가 없는 복잡한 캘린더 / 차트 / 트리 구조
- 기존 화면의 작은 버그 수정

## 8. 4단계 진입 조건

4단계는 레이아웃 시스템 정리 단계입니다.

진입 전 확인할 것:

- 신규 UI가 `src/components/ui`를 우선 사용하고 있는지
- `pm-` 클래스와 `--pm-*` 토큰이 빌드에 문제 없는지
- 기존 화면을 바로 대량 치환하지 않는 원칙 유지

## 9. 4단계 추천 작업

4단계에서는 다음 레이아웃 CSS와 컴포넌트를 정리합니다.

```text
Page
PageHeader
PageBody
SplitLayout
DashboardGrid
Panel
Toolbar
```

우선 적용 대상:

```text
ProjectHeader
ProjectOverview
MeetingsView
MyWorkView
```

