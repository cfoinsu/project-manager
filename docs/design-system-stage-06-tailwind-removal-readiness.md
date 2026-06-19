# 디자인 시스템 6단계: Tailwind 제거 준비 및 안전 게이트

## 1. 목적

6단계의 원래 목표는 Tailwind 설정과 dependency를 제거하는 것입니다.

다만 현재 프로젝트에는 Tailwind 기반 className이 아직 대량으로 남아 있습니다. 따라서 이번 6단계에서는 실제 제거를 바로 실행하지 않고, 제거 가능 여부를 판단하는 안전 게이트와 잔존 의존성 목록을 정리합니다.

## 2. 현재 결론

현재 상태에서는 Tailwind를 제거하면 안 됩니다.

이유:

- 대형 화면 대부분이 아직 Tailwind utility class에 의존함
- `src/index.css`에 Tailwind import가 남아 있음
- `package.json`에 Tailwind dependency가 남아 있음
- `postcss.config.js`가 Tailwind PostCSS plugin을 사용 중임
- `tailwind.config.js`의 `toss-*`, `notion-*`, shadow, animation 확장을 여러 화면에서 사용 중임

따라서 6단계는 “제거 실행”이 아니라 “제거 준비 단계”로 기록합니다.

## 3. Tailwind 잔존 사용량

`className=` 기준 상위 파일입니다.

| 순위 | 파일 | className 수 | 크기 |
| --- | --- | ---: | ---: |
| 1 | `src/components/ReportGeneration.tsx` | 391 | 95.8KB |
| 2 | `src/components/TaskManagement.tsx` | 318 | 89.8KB |
| 3 | `src/components/AssignmentManagementView.tsx` | 297 | 82.9KB |
| 4 | `src/components/DashboardView.tsx` | 242 | 62.2KB |
| 5 | `src/components/SettingsView.tsx` | 220 | 50.9KB |
| 6 | `src/components/UserManagementView.tsx` | 218 | 52.9KB |
| 7 | `src/components/MyWorkView.tsx` | 196 | 46.9KB |
| 8 | `src/components/CommentPanel.tsx` | 191 | 65.1KB |
| 9 | `src/components/DocumentLibraryView.tsx` | 175 | 48.4KB |
| 10 | `src/components/MeetingsView.tsx` | 152 | 38.6KB |
| 11 | `src/App.tsx` | 142 | 47.9KB |
| 12 | `src/components/ProjectAnalysis.tsx` | 137 | 30.8KB |
| 13 | `src/components/ProjectOverview.tsx` | 128 | 38.9KB |

`ProjectOverview.tsx`는 5단계에서 일부 전환했지만 아직 내부 Tailwind가 많이 남아 있습니다.

## 4. Tailwind 설정 의존성

현재 제거 후보는 다음입니다.

```text
src/index.css
- @import "tailwindcss";
- @config "../tailwind.config.js";

postcss.config.js
- '@tailwindcss/postcss'

package.json
- tailwindcss
- @tailwindcss/postcss

tailwind.config.js
- colors.toss
- colors.notion
- shadow
- animation
- keyframes
```

하지만 아직 제거하지 않습니다.

## 5. 제거 금지 조건

아래 조건 중 하나라도 해당하면 Tailwind 제거를 진행하지 않습니다.

```text
1. JSX에 bg-, text-, rounded-, border-, shadow-, flex, grid, gap 계열 class가 대량으로 남아 있음
2. dark:, hover:, focus:, sm:, md:, xl: responsive/state class가 대량으로 남아 있음
3. tailwind.config.js의 toss 색상이나 shadow를 화면에서 사용 중임
4. index.css의 기존 toss/cds class가 Tailwind 변수나 유틸 전제와 섞여 있음
5. 주요 화면이 pm 컴포넌트로 전환되지 않음
6. build 후 시각 검수 자료가 없음
```

현재는 1, 2, 3, 4, 5에 해당합니다.

## 6. 제거 가능 조건

Tailwind dependency 제거는 아래 조건을 만족한 뒤 진행합니다.

```text
1. 주요 화면의 최상위 구조가 Page / PageHeader / PageBody 기반으로 전환됨
2. 카드 / 패널은 Card 또는 Panel 기반으로 전환됨
3. 버튼은 Button / IconButton 기반으로 전환됨
4. 배지는 Badge 기반으로 전환됨
5. 모달은 Modal 또는 기존 ModalOverlay 중 하나로 정리됨
6. tailwind.config.js의 toss 색상 값이 tokens.css로 이관됨
7. shadow / animation 값이 pm token 또는 일반 CSS로 이관됨
8. rg 기준 Tailwind성 class 사용량이 충분히 낮아짐
9. npm run build 통과
10. 주요 화면 시각 검수 완료
```

권장 정량 기준:

```text
className 상위 파일이 100개 미만
Tailwind성 class 패턴 상위 파일이 250개 미만
ProjectOverview / MeetingsView / MyWorkView / App header 전환 완료
```

## 7. 제거 전환 순서

Tailwind 제거 전 남은 작업은 다음 순서를 권장합니다.

```text
1. ProjectOverview 내부 컴포넌트 추가 전환
2. MeetingsView 상단 / 목록 / 상세 구조 전환
3. MyWorkView 대시보드 / 투두 / 알림 구조 전환
4. App 프로젝트 헤더 / popover 구조 전환
5. ProjectScheduleCalendarView / ScheduleCalendarView 캘린더 wrapper 전환
6. TaskManagement 주요 카드 / 버튼 / 모달 전환
7. ReportGeneration / AssignmentManagementView 대형 화면 분할 전환
8. tailwind.config.js 토큰을 tokens.css로 이관
9. Tailwind import 제거 테스트
10. dependency 제거
```

## 8. 실제 제거 단계에서 수행할 작업

조건이 충족되면 다음 순서로 제거합니다.

### 8.1. CSS import 제거

`src/index.css`에서 제거:

```css
@import "tailwindcss";
@config "../tailwind.config.js";
```

### 8.2. PostCSS 설정 변경

`postcss.config.js`에서 제거:

```js
'@tailwindcss/postcss': {}
```

최종 예시:

```js
export default {
  plugins: {
    autoprefixer: {},
  },
};
```

### 8.3. package dependency 제거

`package.json`에서 제거:

```text
tailwindcss
@tailwindcss/postcss
```

그 후 lockfile 갱신:

```powershell
npm.cmd install
```

### 8.4. 설정 파일 제거

더 이상 참조하지 않으면 제거:

```text
tailwind.config.js
```

## 9. 이번 단계에서 실제로 한 일

이번 단계에서 실제 dependency 제거는 하지 않았습니다.

대신 다음을 수행했습니다.

- Tailwind 잔존 사용량 측정
- 제거 대상 파일 확인
- 제거 금지 조건 문서화
- 제거 가능 조건 문서화
- 실제 제거 순서 문서화
- 다음 작업 우선순위 정리

## 10. 다음 추천 작업

다음 단계는 Tailwind dependency 제거가 아니라 5단계의 화면 전환을 이어가는 것이 맞습니다.

추천:

```text
6-A. ProjectOverview 내부 컴포넌트 추가 전환
6-B. MeetingsView 첫 구조 전환
6-C. MyWorkView 첫 구조 전환
```

가장 안전한 선택은 `6-A. ProjectOverview 내부 컴포넌트 추가 전환`입니다.

