# Design System Stage 06-B-3: Meeting Detail Panels

## Scope

회의 화면의 중앙 상세 영역과 우측 보조 패널을 디자인 시스템 기반 구조로 전환했다.

## Applied Rules

- 회의 화면 전용 스타일은 `pm-meeting-*` 네임스페이스로 관리한다.
- 화면의 3열 작업 영역은 컴포넌트 내부 Tailwind grid 대신 `.pm-meeting-workspace`에서 정의한다.
- 상세 영역과 보조 패널의 배경, 테두리, 간격은 `.pm-meeting-main`, `.pm-meeting-aside`에서 통일한다.
- 회의 상세 메타 정보, 안건 목록, 회의록 프리뷰, 참여 인력, 후속 작업 후보, 댓글 목록은 각각 의미 기반 클래스에 스타일 책임을 둔다.
- 토큰에 없는 색상 변수는 만들지 않고 기존 `--pm-color-*` 토큰만 사용한다.

## Updated Files

- `src/components/MeetingsView.tsx`
- `src/styles/components/meetings.css`

## Remaining Work

- `MeetingCreateModal`은 아직 Tailwind 기반 폼 레이아웃이 남아 있으므로 별도 단계에서 `Modal`, `TextInput`, `Button` 기반으로 전환한다.
- `AvatarStack`은 크기와 겹침 스타일이 Tailwind 문자열로 남아 있어, 재사용 가능성이 확인되면 공용 아바타 스택 컴포넌트로 분리한다.
- 회의 상세 하위 카드의 일부 제목/보조 텍스트 클래스는 기능 안정성을 우선해 남겼으며 다음 세부 패스에서 제거한다.

## Verification

- `npx.cmd tsc -b`
- `npm.cmd run lint -- --quiet`
- `npm.cmd run build`
