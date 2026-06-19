# Design System Stage 06-B-4: Meeting Schedule Density and Create Modal

## Scope

회의 화면의 좌측 일정 패널 여백을 줄이고, 회의 생성 모달의 첫 구조를 디자인 시스템 클래스 기반으로 전환했다.

## Applied Rules

- 일정 패널은 정보 탐색 영역이므로 카드 내부보다 더 compact한 패딩을 사용한다.
- 일정 패널의 헤더, 상태 탭, 주간 캘린더, 목록은 `.pm-meeting-schedule-*` 클래스로 밀도를 제어한다.
- 회의 생성 모달은 Tailwind 조합 대신 `.pm-meeting-create-*` 클래스로 레이아웃을 정의한다.
- 기본 텍스트 입력은 공용 `.pm-input` 스타일을 사용한다.
- 닫기, 안건 삭제 같은 아이콘 버튼은 `IconButton`을 사용한다.
- 저장/취소/안건 추가 같은 명령 버튼은 `Button`을 사용한다.

## Updated Files

- `src/components/MeetingsView.tsx`
- `src/styles/components/meetings.css`

## Remaining Work

- 회의 생성 모달은 아직 `ModalOverlay`를 사용한다. 다음 모달 정리 단계에서 공용 `Modal` 컴포넌트로 옮길 수 있다.
- `CustomDatePicker`, `CustomTimePicker`, `UserMultiSelect` 자체 내부 스타일은 별도 공용 컴포넌트 정리 범위로 남긴다.
- `AvatarStack`의 Tailwind 기반 크기/겹침 스타일은 다음 회의 화면 잔여 정리에서 공용 컴포넌트화한다.

## Verification

- `npx.cmd tsc -b`
- `npm.cmd run lint -- --quiet`
