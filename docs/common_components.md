# 🛠️ Project Atlas 공용 컴포넌트 표준 사용 가이드

Project Atlas 프론트엔드의 사용자 경험(UX) 및 디자인 일관성(토스 스타일 카드 및 Notion 스타일 디자인)을 유지하기 위해, **날짜 선택(Date), 셀렉트 박스(Select), 시간 선택(Time)** 입력창은 HTML 순정(Native) 태그의 사용을 금지하며 아래에 정의된 **공용 커스텀 컴포넌트**를 필수적으로 적용해야 합니다.

---

## 📌 공용 컴포넌트 필수 적용 규칙
> [!IMPORTANT]
> - **날짜(Date Range) 입력**: `<input type="date">`를 직접 사용하는 대신, 단일/기간 선택이 가능한 `RangeDatePicker` 컴포넌트를 사용합니다.
> - **셀렉트(Select) 드롭다운**: 네이티브 `<select>` 태그 대신 브라우저 간 스타일 일관성을 보장하고 토스 스타일로 렌더링되는 `CustomSelect` 컴포넌트를 사용합니다.
> - **시간(Time) 입력**: `<input type="time">` 대신 마우스/터치 선택이 최적화된 `CustomTimePicker` 컴포넌트를 사용합니다.

---

## 1. 일정 및 기간 선택기 (`RangeDatePicker`)

프로젝트 전체 일정, 프로세스 수행 기간, 인력 투입 기간 등 시작일과 종료일이 존재하는 범위를 선택할 때 사용합니다.

### 📥 Import 경로
```typescript
import { RangeDatePicker } from './RangeDatePicker'; // 또는 상대 경로
```

### ⚙️ Properties (Props)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `startDate` | `string` | **필수** | 시작일 (`YYYY-MM-DD` 포맷) |
| `endDate` | `string` | **필수** | 종료일 (`YYYY-MM-DD` 포맷) |
| `onChange` | `(start: string, end: string) => void` | **필수** | 날짜 범위 선택 시 호출되는 콜백 함수 |
| `minDate` | `string` | `undefined` | 선택 가능한 최소 날짜 (`YYYY-MM-DD`) |
| `maxDate` | `string` | `undefined` | 선택 가능한 최대 날짜 (`YYYY-MM-DD`) |
| `placeholder`| `string` | `'일정 선택'` | 날짜가 비어있을 때 표시할 문구 |
| `compact` | `boolean` | `false` | `true`로 설정 시 컴팩트한(작은) 스타일로 렌더링 |

### 💻 사용 예제
```tsx
import React, { useState } from 'react';
import { RangeDatePicker } from './RangeDatePicker';

export const MyComponent = () => {
  const [start, setStart] = useState('2026-06-01');
  const [end, setEnd] = useState('2026-06-30');

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-slate-500">프로젝트 일정</label>
      <RangeDatePicker
        startDate={start}
        endDate={end}
        onChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
        placeholder="기간을 선택하세요"
      />
    </div>
  );
};
```

---

## 2. 셀렉트 드롭다운 (`CustomSelect`)

디바이스나 브라우저의 영향 없이 일관되고 미려한 토스 스타일의 선택 목록을 제공하는 드롭다운 컴포넌트입니다.

### 📥 Import 경로
```typescript
import { CustomSelect } from './CustomSelect'; // 또는 상대 경로
```

### ⚙️ Properties (Props)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `value` | `string \| number` | `undefined` | 현재 선택된 값 |
| `onChange` | `(e: { target: { value: string } }) => void` | `undefined` | 값 변경 시 호출되는 이벤트 핸들러 (네이티브 select와 유사한 시그니처) |
| `disabled` | `boolean` | `false` | 활성화 여부 |
| `children` | `React.ReactNode` | `undefined` | 내부의 `<option>` 요소들 |
| `positionDirection` | `'up' \| 'down' \| 'auto'` | `'auto'` | 드롭다운이 열릴 방향 (기본값인 auto는 뷰포트 여백에 따라 자동 조정) |

### 💻 사용 예제
```tsx
import React, { useState } from 'react';
import { CustomSelect } from './CustomSelect';

export const MyComponent = () => {
  const [priority, setPriority] = useState('보통');

  return (
    <div className="w-48">
      <CustomSelect
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      >
        <option value="낮음">낮음</option>
        <option value="보통">보통</option>
        <option value="높음">높음</option>
        <option value="긴급">긴급</option>
      </CustomSelect>
    </div>
  );
};
```

---

## 3. 커스텀 시간 선택기 (`CustomTimePicker`)

24시간 형식의 시간 및 분을 사용하기 편한 스크롤 형태의 목록으로 제공하는 시간 입력기입니다.

### 📥 Import 경로
```typescript
import { CustomTimePicker } from './CustomTimePicker'; // 또는 상대 경로
```

### ⚙️ Properties (Props)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `value` | `string` | `''` | 현재 설정된 시간 (`HH:MM` 포맷) |
| `onChange` | `(val: string) => void` | `undefined` | 시간 선택 시 호출되는 콜백 함수 |
| `disabled` | `boolean` | `false` | 비활성화 여부 |
| `positionDirection` | `'up' \| 'down' \| 'auto'` | `'auto'` | 드롭다운이 열릴 방향 |

### 💻 사용 예제
```tsx
import React, { useState } from 'react';
import { CustomTimePicker } from './CustomTimePicker';

export const MyComponent = () => {
  const [time, setTime] = useState('09:00');

  return (
    <div className="w-32">
      <CustomTimePicker
        value={time}
        onChange={(val) => setTime(val)}
      />
    </div>
  );
};
```
