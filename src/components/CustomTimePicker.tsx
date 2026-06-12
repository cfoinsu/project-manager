import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

interface CustomTimePickerProps {
  value?: string; // "HH:MM" format
  onChange?: (val: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  positionDirection?: 'up' | 'down' | 'auto';
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value = '',
  onChange,
  disabled = false,
  className = '',
  style,
  positionDirection = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Parse hours and minutes safely
  let selectedHour = 12;
  let selectedMinute = 0;
  
  if (value && value.includes(':')) {
    const parts = value.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && h >= 0 && h < 24) selectedHour = h;
    if (!isNaN(m) && m >= 0 && m < 60) selectedMinute = m;
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine open direction dynamically
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (positionDirection === 'up') {
        setDirection('up');
      } else if (positionDirection === 'down') {
        setDirection('down');
      } else {
        const selectRect = containerRef.current.getBoundingClientRect();
        const dropdownHeight = 280; // max height of the picker
        const spaceBelow = window.innerHeight - selectRect.bottom;
        
        if (spaceBelow < dropdownHeight && selectRect.top > dropdownHeight) {
          setDirection('up');
        } else {
          setDirection('down');
        }
      }
    }
  }, [isOpen, positionDirection]);

  // Scroll active elements into view when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow render
      setTimeout(() => {
        if (hourListRef.current) {
          const activeHourEl = hourListRef.current.querySelector('[data-active="true"]');
          if (activeHourEl) {
            activeHourEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          }
        }
        if (minuteListRef.current) {
          const activeMinuteEl = minuteListRef.current.querySelector('[data-active="true"]');
          if (activeMinuteEl) {
            activeMinuteEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          }
        }
      }, 50);
    }
  }, [isOpen]);

  const handleSelectHour = (h: number) => {
    if (disabled) return;
    const formattedHour = String(h).padStart(2, '0');
    const formattedMinute = String(selectedMinute).padStart(2, '0');
    if (onChange) {
      onChange(`${formattedHour}:${formattedMinute}`);
    }
  };

  const handleSelectMinute = (m: number) => {
    if (disabled) return;
    const formattedHour = String(selectedHour).padStart(2, '0');
    const formattedMinute = String(m).padStart(2, '0');
    if (onChange) {
      onChange(`${formattedHour}:${formattedMinute}`);
    }
  };

  const displayTime = value ? value : '--:--';

  const defaultClass = "w-full flex items-center justify-between text-left px-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all text-sm font-bold text-toss-gray-800 dark:text-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const buttonClass = className ? `${className} flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed` : defaultClass;

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full min-w-0 ${isOpen ? 'z-[999]' : 'z-10'}`} 
      style={style}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClass} relative`}
        style={{ paddingRight: '1.75rem' }}
      >
        <span className="truncate flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>{displayTime}</span>
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
          <ChevronDown className={`w-4 h-4 transition-transform text-toss-gray-400 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 ${direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-[999] bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-toss-lg p-2.5 flex flex-col backdrop-blur-md animate-scale-in text-left`} style={{ minWidth: '180px' }}>
          
          {/* Header indicator */}
          <div className="flex justify-between items-center text-[10px] font-black text-slate-400 dark:text-slate-500 px-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 select-none">
            <span className="w-1/2 text-center">시 (Hour)</span>
            <span className="w-1/2 text-center">분 (Minute)</span>
          </div>

          {/* Selector grid */}
          <div className="flex h-44 mt-1.5">
            {/* Hours column */}
            <div 
              ref={hourListRef}
              className="w-1/2 overflow-y-auto scrollbar-thin flex flex-col gap-0.5 border-r border-slate-100 dark:border-slate-800/80 pr-1"
            >
              {hours.map((h) => {
                const isActive = h === selectedHour;
                return (
                  <button
                    key={h}
                    type="button"
                    data-active={isActive}
                    onClick={() => handleSelectHour(h)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold text-center border-none transition-colors cursor-pointer shrink-0 ${
                      isActive
                        ? 'custom-select-option-selected'
                        : 'bg-transparent text-toss-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                );
              })}
            </div>

            {/* Minutes column */}
            <div 
              ref={minuteListRef}
              className="w-1/2 overflow-y-auto scrollbar-thin flex flex-col gap-0.5 pl-1"
            >
              {minutes.map((m) => {
                const isActive = m === selectedMinute;
                return (
                  <button
                    key={m}
                    type="button"
                    data-active={isActive}
                    onClick={() => handleSelectMinute(m)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold text-center border-none transition-colors cursor-pointer shrink-0 ${
                      isActive
                        ? 'custom-select-option-selected'
                        : 'bg-transparent text-toss-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions (Optional but nice to have) */}
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 select-none shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onChange) onChange('09:00');
              }}
              className="flex-1 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[9px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              오전 9시
            </button>
            <button
              type="button"
              onClick={() => {
                if (onChange) onChange('18:00');
              }}
              className="flex-1 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[9px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              오후 6시
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-1 rounded bg-toss-blue hover:bg-blue-600 text-[9px] font-bold text-white border-none transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
