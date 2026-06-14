import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RangeDatePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  minDate?: string;  // 범위 제한 YYYY-MM-DD
  maxDate?: string;  // 범위 제한 YYYY-MM-DD
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const RangeDatePicker: React.FC<RangeDatePickerProps> = ({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  placeholder = '일정 선택',
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const initialDate = startDate ? new Date(startDate) : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdown = document.getElementById('rdp-portal-dropdown');
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdown && !dropdown.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 트리거 위치 계산 (portal 위치용)
  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownH = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= dropdownH
        ? rect.bottom + window.scrollY + 6
        : rect.top + window.scrollY - dropdownH - 6;
      let left = rect.left + window.scrollX;
      // 오른쪽 벗어남 방지
      if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
      setDropdownPos({ top, left });
    }
    setIsOpen(v => !v);
  };

  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
    }
  }, [startDate]);

  const formatDateString = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(p => p - 1); }
    else setCurrentMonth(p => p - 1);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(p => p + 1); }
    else setCurrentMonth(p => p + 1);
  };

  const isDateDisabled = (dateStr: string) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const handleDateClick = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDateDisabled(dateStr)) return;
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, '');
      setHoverDate(null);
    } else {
      if (dateStr < startDate) {
        onChange(dateStr, '');
      } else {
        onChange(startDate, dateStr);
        setIsOpen(false);
      }
    }
  };

  const handleDateMouseEnter = (dateStr: string) => {
    if (startDate && !endDate && dateStr >= startDate && !isDateDisabled(dateStr)) {
      setHoverDate(dateStr);
    } else {
      setHoverDate(null);
    }
  };

  const getDayStatus = (dateStr: string) => {
    const isSelectedStart = startDate === dateStr;
    const isSelectedEnd = endDate === dateStr;
    let isInRange = false;
    let isHoverRange = false;
    if (startDate && endDate) {
      isInRange = dateStr > startDate && dateStr < endDate;
    } else if (startDate && hoverDate) {
      isHoverRange = dateStr > startDate && dateStr <= hoverDate;
    }
    return { isSelectedStart, isSelectedEnd, isInRange, isHoverRange, disabled: isDateDisabled(dateStr) };
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
    setHoverDate(null);
  };

  const getDisplayText = () => {
    if (startDate && endDate) return `${startDate} ~ ${endDate}`;
    if (startDate) return `${startDate} ~ 종료일 선택`;
    return placeholder;
  };

  const renderCalendarCells = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="w-10 h-10" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateString(currentYear, currentMonth, day);
      const { isSelectedStart, isSelectedEnd, isInRange, isHoverRange, disabled } = getDayStatus(dateStr);

      let cellClass = "w-10 h-10 flex items-center justify-center text-xs font-bold relative cursor-pointer select-none transition-all duration-150 rounded-full ";
      if (disabled) {
        cellClass += "text-notion-ink-faint dark:text-slate-700 cursor-not-allowed pointer-events-none";
      } else if (isSelectedStart || isSelectedEnd) {
        cellClass += "bg-notion-blue text-white shadow-sm";
      } else if (isInRange) {
        cellClass += "bg-notion-blue/10 dark:bg-notion-blue/20 text-notion-blue rounded-none";
      } else if (isHoverRange) {
        cellClass += "bg-notion-blue/5 dark:bg-notion-blue/15 text-notion-blue/80 rounded-none";
      } else {
        cellClass += "text-notion-ink-secondary dark:text-slate-200 hover:bg-notion-canvas-soft dark:hover:bg-slate-800";
      }

      cells.push(
        <div
          key={dateStr}
          onClick={(e) => handleDateClick(dateStr, e)}
          onMouseEnter={() => handleDateMouseEnter(dateStr)}
          className="w-10 h-10 flex items-center justify-center relative z-10 shrink-0"
        >
          {(isInRange || isHoverRange) && (
            <div className={`absolute inset-0 bg-notion-blue/10 dark:bg-notion-blue/20 -z-10 ${
              isSelectedStart ? 'rounded-l-full' : ''
            } ${isSelectedEnd ? 'rounded-r-full' : ''}`} />
          )}
          <span className={cellClass}>{day}</span>
        </div>
      );
    }
    return cells;
  };

  const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];

  const calendarDropdown = isOpen && dropdownPos ? createPortal(
    <div
      id="rdp-portal-dropdown"
      style={{ position: 'fixed', top: dropdownPos.top - window.scrollY, left: dropdownPos.left, zIndex: 99999 }}
      className="bg-white dark:bg-slate-900 border border-notion-hairline dark:border-slate-700 rounded-xl p-5 shadow-2xl w-80 animate-scale-in"
    >
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-xl hover:bg-notion-canvas-soft dark:hover:bg-slate-800 text-notion-ink-secondary dark:text-slate-450 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">
          {currentYear}년 {currentMonth + 1}월
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-xl hover:bg-notion-canvas-soft dark:hover:bg-slate-800 text-notion-ink-secondary dark:text-slate-450 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 gap-y-1 mb-2 text-center text-xs font-bold text-toss-gray-400 uppercase tracking-wider">
        {dayOfWeekNames.map((day, idx) => (
          <span key={day} className={idx === 0 ? 'text-notion-pink' : idx === 6 ? 'text-notion-blue/80' : ''}>
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 justify-items-center">
        {renderCalendarCells()}
      </div>

      {(minDate || maxDate) && (
        <div className="mt-4 pt-3 border-t border-notion-hairline dark:border-slate-800/80 text-xs text-toss-gray-400 dark:text-slate-500 text-center font-medium">
          선택 가능: {minDate || '제한 없음'} ~ {maxDate || '제한 없음'}
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger */}
      <div
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 border-none transition-all cursor-pointer select-none ${
          compact
            ? 'text-xs px-2.5 py-1.5 bg-notion-canvas-soft dark:bg-slate-850 hover:bg-notion-hairline/60 dark:hover:bg-slate-800 rounded-md font-semibold border border-notion-hairline'
            : 'text-sm px-4 py-2 bg-white dark:bg-slate-800 hover:bg-notion-canvas-soft dark:hover:bg-slate-750 rounded-md border border-notion-hairline focus-within:ring-1 focus-within:ring-notion-blue focus-within:shadow-notion-1 font-semibold'
        }`}
      >
        <div className="flex items-center gap-2 text-notion-ink dark:text-slate-200 min-w-0 flex-1">
          <Calendar className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-notion-blue shrink-0`} />
          <span className={`truncate whitespace-nowrap text-xs font-semibold ${!startDate ? 'text-notion-ink-muted dark:text-slate-500 font-normal' : ''}`}>
            {getDisplayText()}
          </span>
        </div>
        {startDate && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full hover:bg-notion-canvas-soft dark:hover:bg-slate-700 text-notion-ink-muted dark:text-slate-500 transition-colors"
          >
            <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          </button>
        )}
      </div>

      {calendarDropdown}
    </div>
  );
};
