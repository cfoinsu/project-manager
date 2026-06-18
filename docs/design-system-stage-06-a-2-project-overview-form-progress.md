# 디자인 시스템 6-A-2: ProjectOverview form/progress 전환

## 1. 목적

6-A-2의 목표는 `ProjectOverview` 내부에 남아 있던 form 입력과 progress 표현을 공통 UI 컴포넌트로 분리하는 것입니다.

이번 단계는 `6-A`에서 진행한 내부 컴포넌트 전환의 연장입니다.

## 2. 추가된 공통 컴포넌트

```text
src/components/ui/FormControls.tsx
src/components/ui/Progress.tsx
```

추가 export:

```ts
TextInput
SelectInput
TextareaInput
Progress
```

## 3. 추가된 CSS

```text
src/styles/components/form.css
src/styles/components/progress.css
```

`design-system.css`에 import했습니다.

```css
@import './components/form.css';
@import './components/progress.css';
```

## 4. ProjectOverview 적용 내용

## 4.1. TextField

기존 input Tailwind class를 제거하고 `TextInput`으로 전환했습니다.

```tsx
<TextInput label={label} value={value} onChange={onChange} />
```

## 4.2. SelectField

기존 select Tailwind class를 제거하고 `SelectInput`으로 전환했습니다.

```tsx
<SelectInput label={label} value={value} onChange={onChange} options={options} />
```

## 4.3. TextareaField

기존 textarea Tailwind class를 제거하고 `TextareaInput`으로 전환했습니다.

```tsx
<TextareaInput label={label} value={value} onChange={onChange} rows={3} />
```

## 4.4. Progress

`InfoRow`와 `RiskProgress`에서 progress bar를 `Progress` 컴포넌트로 전환했습니다.

```tsx
<Progress value={progress} showValue={false} />
<Progress label={label} value={value} tone="danger" />
```

## 4.5. 지역 선택 필드

지역 선택 버튼은 아직 모달을 열어야 하므로 버튼 동작은 유지하되, 스타일은 `pm-field-button` 계열 CSS로 분리했습니다.

## 5. 신규 개발 규칙

이후 form UI는 다음 순서를 따릅니다.

```text
단일 텍스트 입력: TextInput
select: SelectInput
긴 텍스트 입력: TextareaInput
진행률: Progress
모달을 여는 필드형 버튼: pm-field-button
```

화면 안에서 input/select/textarea Tailwind class를 새로 작성하지 않습니다.

## 6. 아직 남은 ProjectOverview Tailwind

```text
KPI 내부 원형 그래프
회의 카드 내부 avatar/list
작업 추이 SVG text
프로세스 원형 진행률
편집 모달 wrapper
일부 grid/flex 배치
```

다음 작업은 `MeetingsView` 첫 구조 전환 또는 `ProjectOverview` KPI/meeting card 세부 전환 중 선택하면 됩니다.

