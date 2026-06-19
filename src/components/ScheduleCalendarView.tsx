import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Compass, 
  ArrowRight,
  Layers,
  CheckSquare
} from 'lucide-react';
import type { Assignment, Process, Task } from '../types';
import { getAssignments } from '../utils/api';
import { CustomSelect } from './CustomSelect';
import { Avatar } from './Avatar';

interface LaneEvent {
  id: string;
  title: string;
  startCol: number;
  endCol: number;
  colorClass: string;
  type: 'project' | 'process' | 'task';
  original: any;
  start?: string;
  end?: string;
}

// 프로젝트 코드를 기준으로 유형별 테마 색상 반환
export const getProjectColorClass = (code?: string, variant: 'project' | 'process' | 'task' = 'project') => {
  if (!code || code.length < 5) {
    if (variant === 'process') {
      return 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-850/40';
    } else if (variant === 'task') {
      return 'bg-purple-500/10 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-850/40';
    }
    return 'bg-sky-500/10 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200/50 dark:border-sky-850/40';
  }
  
  const typeChar = code.charAt(4); // W, M, S, D, C, R, O, E 등
  
  switch(typeChar) {
    case 'W': // 웹 구축: 파랑 (blue)
      if (variant === 'project' || variant === 'process') {
        return 'bg-blue-500/10 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/30';
      }
      return 'bg-blue-50 dark:bg-blue-950/20 text-blue-500 dark:text-blue-400 border-blue-100 dark:border-blue-900/20';
      
    case 'M': // 모바일 앱: 보라 (purple)
      if (variant === 'project' || variant === 'process') {
        return 'bg-purple-500/10 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/30';
      }
      return 'bg-purple-50 dark:bg-purple-950/20 text-purple-500 dark:text-purple-400 border-purple-100 dark:border-purple-900/20';
      
    case 'S': // 시스템 개발: 초록 (emerald)
      if (variant === 'project' || variant === 'process') {
        return 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30';
      }
      return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20';
      
    case 'D': // 디자인: 분홍 (rose)
      if (variant === 'project' || variant === 'process') {
        return 'bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/30';
      }
      return 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border-rose-100 dark:border-rose-900/20';
      
    case 'C': // 컨설팅: 오렌지/앰버 (amber)
      if (variant === 'project' || variant === 'process') {
        return 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/30';
      }
      return 'bg-amber-50 dark:bg-amber-950/20 text-amber-500 dark:text-amber-400 border-amber-100 dark:border-amber-900/20';
      
    case 'R': // 리뉴얼: 청록 (teal)
      if (variant === 'project' || variant === 'process') {
        return 'bg-teal-500/10 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-200/50 dark:border-teal-800/30';
      }
      return 'bg-teal-50 dark:bg-teal-950/20 text-teal-500 dark:text-teal-400 border-teal-100 dark:border-teal-900/20';
      
    case 'O': // 운영/유지보수: 회색 (slate)
      if (variant === 'project' || variant === 'process') {
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50';
      }
      return 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-200/30 dark:border-slate-800/30';
      
    default: // 기타: 바이올렛 (indigo)
      if (variant === 'project' || variant === 'process') {
        return 'bg-indigo-500/10 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/30';
      }
      return 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/20';
  }
};

export const ScheduleCalendarView: React.FC = () => {
  const { projects, selectProject, setView } = useProjectStore();
  const { user, serverMode } = useAuthStore();
  
  // View mode: 'all' (All Projects) or 'single' (By Project)
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Date states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Local data for selected project (Single Project Mode)
  const [localProcesses, setLocalProcesses] = useState<Process[]>([]);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [loadingLocal, setLoadingLocal] = useState<boolean>(false);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setAssignments(await getAssignments(serverMode, user?.role || 'member', user?.id || ''));
      } catch (error) {
        console.error('Failed to load calendar assignments:', error);
        setAssignments([]);
      }
    };
    loadAssignments();
  }, [serverMode, user?.id, user?.role]);

  // Show local toast feedback
  const showLocalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2500);
  };

  // Fetch local data when selected project changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedProjectId) {
        setLocalProcesses([]);
        setLocalTasks([]);
        return;
      }
      setLoadingLocal(true);
      try {
        const { getProcesses: dbGetProcesses, getTasks: dbGetTasks } = await import('../utils/db');
        const procsData = await dbGetProcesses(selectedProjectId);
        setLocalProcesses(procsData);
        
        let allTasks: Task[] = [];
        for (const proc of procsData) {
          try {
            const tList = await dbGetTasks(proc.id);
            allTasks = [...allTasks, ...tList];
          } catch (err) {
            console.error('Failed to load tasks for process:', proc.id, err);
          }
        }
        setLocalTasks(allTasks);
      } catch (e) {
        console.error('Failed to load project details for calendar:', e);
      } finally {
        setLoadingLocal(false);
      }
    };
    loadData();
  }, [selectedProjectId]);

  // Set initial selected project if none is active
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Synchronize calendar focus with selected date
  useEffect(() => {
    const dObj = new Date(selectedDateStr);
    if (!isNaN(dObj.getTime())) {
      if (currentDate.getMonth() !== dObj.getMonth() || currentDate.getFullYear() !== dObj.getFullYear()) {
        setCurrentDate(dObj);
      }
    }
  }, [selectedDateStr]);

  // Helper date functions
  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const todayStr = useMemo(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`; 
  }, []);

  // Compute Sunday-to-Saturday week days containing focused currentDate
  const weekDays = useMemo(() => {
    const dateObj = new Date(currentDate);
    const dayOfWeek = dateObj.getDay();
    const diff = dateObj.getDate() - dayOfWeek;
    const sunday = new Date(dateObj.setDate(diff));
    
    const days = [];
    const weekdayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${mm}-${dd}`;
      days.push({
        date: d,
        dateStr,
        dayName: weekdayNamesShort[i],
        dayNum: d.getDate()
      });
    }
    return days;
  }, [currentDate]);

  // Calendar cells generation (6 rows * 7 columns = 42 cells)
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    const cells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = formatDateString(prevYear, prevMonth, d);
      cells.push({ day: d, dateStr, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = formatDateString(year, month, i);
      cells.push({ day: i, dateStr, isCurrentMonth: true });
    }

    // Next month days to make 42 cells
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const dateStr = formatDateString(nextYear, nextMonth, i);
      cells.push({ day: i, dateStr, isCurrentMonth: false });
    }

    return cells;
  }, [currentDate]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${today.getFullYear()}-${mm}-${dd}`);
  };

  // Date check helpers
  const isDateInRange = (dateStr: string, start?: string, end?: string) => {
    if (!start || !end) return false;
    return dateStr >= start && dateStr <= end;
  };

  const isRangeOverlapping = (startA: string, endA: string, startB: string, endB: string) => {
    return !(endA < startB || startA > endB);
  };

  // Get active events for a specific date range (for lane mapping)
  const getEventsForRange = (startStr: string, endStr: string) => {
    if (viewMode === 'all') {
      return projects
        .filter(p => p.start_date && p.end_date && isRangeOverlapping(p.start_date, p.end_date, startStr, endStr))
        .map(p => ({
          id: p.id,
          type: 'project' as const,
          title: p.name,
          start: p.start_date,
          end: p.end_date,
          colorClass: getProjectColorClass(p.code, 'project'),
          original: p
        }));
    } else {
      const events: { id: string; type: 'process' | 'task'; title: string; start?: string; end?: string; colorClass: string; original: any }[] = [];
      const selProj = projects.find(p => p.id === selectedProjectId);
      const projCode = selProj?.code;
      
      localProcesses
        .filter(p => p.start_date && p.end_date && isRangeOverlapping(p.start_date, p.end_date, startStr, endStr))
        .forEach(p => {
          events.push({
            id: p.id,
            type: 'process',
            title: p.name,
            start: p.start_date,
            end: p.end_date,
            colorClass: getProjectColorClass(projCode, 'process'),
            original: p
          });
        });

      localTasks
        .filter(t => t.start_date && t.end_date && isRangeOverlapping(t.start_date, t.end_date, startStr, endStr))
        .forEach(t => {
          events.push({
            id: t.id,
            type: 'task',
            title: t.title,
            start: t.start_date,
            end: t.end_date,
            colorClass: getProjectColorClass(projCode, 'task'),
            original: t
          });
        });

      return events;
    }
  };

  // Get active events on a specific day
  const getEventsForDay = (dateStr: string) => {
    if (viewMode === 'all') {
      return projects
        .filter(p => isDateInRange(dateStr, p.start_date, p.end_date))
        .map(p => ({
          id: p.id,
          type: 'project' as const,
          title: p.name,
          code: p.code,
          start: p.start_date,
          end: p.end_date,
          colorClass: getProjectColorClass(p.code, 'project'),
          original: p
        }));
    } else {
      const events: { id: string; type: 'process' | 'task'; title: string; start?: string; end?: string; colorClass: string; original: any }[] = [];
      const selProj = projects.find(p => p.id === selectedProjectId);
      const projCode = selProj?.code;
      
      localProcesses
        .filter(p => isDateInRange(dateStr, p.start_date, p.end_date))
        .forEach(p => {
          events.push({
            id: p.id,
            type: 'process',
            title: p.name,
            start: p.start_date,
            end: p.end_date,
            colorClass: getProjectColorClass(projCode, 'process'),
            original: p
          });
        });

      localTasks
        .filter(t => isDateInRange(dateStr, t.start_date, t.end_date))
        .forEach(t => {
          events.push({
            id: t.id,
            type: 'task',
            title: t.title,
            start: t.start_date,
            end: t.end_date,
            colorClass: getProjectColorClass(projCode, 'task'),
            original: t
          });
        });

      return events;
    }
  };

  // Events of currently selected date
  const selectedDayEvents = useMemo(() => {
    const list = getEventsForDay(selectedDateStr);
    return list.map((ev) => {
      if (ev.original && (ev.original.start_time || ev.original.end_time)) {
        const sTime = ev.original.start_time || '00:00';
        const eTime = ev.original.end_time || '24:00';
        
        const convertToAmPm = (tStr: string) => {
          const parts = tStr.split(':');
          const h = parseInt(parts[0], 10);
          const mm = parts[1] || '00';
          const suffix = h >= 12 ? 'PM' : 'AM';
          const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          return `${String(displayHour).padStart(2, '0')}:${mm} ${suffix}`;
        };
        
        return {
          ...ev,
          timeStr: `${convertToAmPm(sTime)} - ${convertToAmPm(eTime)}`
        };
      }
      
      // Deterministic fake hours for side panel cards
      let hash = 0;
      for (let i = 0; i < ev.id.length; i++) hash += ev.id.charCodeAt(i);
      const startHour = (hash % 5) + 9;
      const durationHours = ((hash % 4) * 0.5) + 1.5;
      
      const formatTime = (h: number) => {
        const hh = Math.floor(h);
        const mm = h % 1 === 0 ? '00' : '30';
        const suffix = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh > 12 ? hh - 12 : hh;
        return `${String(displayHour).padStart(2, '0')}:${mm} ${suffix}`;
      };

      return {
        ...ev,
        timeStr: `${formatTime(startHour)} - ${formatTime(startHour + durationHours)}`
      };
    });
  }, [selectedDateStr, viewMode, projects, localProcesses, localTasks]);

  // Navigate directly to views from event list
  const handleNavigateToWbsOrKanban = (ev: { id: string; type: 'project' | 'process' | 'task'; title: string; original: any }) => {
    if (ev.type === 'project') {
      selectProject(ev.original);
      setView('projects_overview');
      showLocalToast(`'${ev.title}' 개요 뷰로 이동했습니다.`);
    } else if (ev.type === 'process') {
      setView('projects_process');
      showLocalToast(`WBS 단계 관리 뷰로 이동했습니다.`);
    } else if (ev.type === 'task') {
      setView('projects_tasks');
      showLocalToast(`칸반 작업 관리 보드로 이동했습니다.`);
    }
  };

  const getEventProjectId = (ev: { type: 'project' | 'process' | 'task'; original: any }) => {
    if (ev.type === 'project') return ev.original?.id;
    return ev.original?.project_id || selectedProjectId;
  };

  const getEventParticipants = (ev: { type: 'project' | 'process' | 'task'; original: any }) => {
    if (ev.type === 'task') {
      const ids = ev.original?.assignees || [];
      const names = ev.original?.assignee_names || (ev.original?.assignee ? [ev.original.assignee] : []);
      if (ids.length > 0 || names.length > 0) {
        const byIds = ids.map((id: string) => assignments.find((assignment) => assignment.user_id === id)).filter(Boolean) as Assignment[];
        const byNames = names
          .filter((name: string) => !byIds.some((assignment) => assignment.user_name === name))
          .map((name: string, index: number) => ({ id: `${ev.original.id}-name-${index}`, user_id: name, user_name: name } as Assignment));
        return [...byIds, ...byNames];
      }
    }

    const projectId = getEventProjectId(ev);
    return assignments.filter((assignment) => assignment.project_id === projectId);
  };

  // Helper to render overlapping avatars from matched project/task assignments
  const renderAvatars = (ev: { type: 'project' | 'process' | 'task'; original: any }) => {
    const participants = getEventParticipants(ev);
    if (participants.length === 0) return null;
    const visible = participants.slice(0, 3);

    return (
      <div className="flex -space-x-1 overflow-hidden select-none items-center">
        {visible.map((participant) => (
          <Avatar
            key={participant.id || participant.user_id}
            name={participant.user_name || '이름 없음'}
            profileImage={participant.user_profile_image}
            className="w-4.5 h-4.5 text-[8px] border border-white dark:border-slate-900"
          />
        ))}
        {participants.length > visible.length && (
          <div className="w-4.5 h-4.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[8px] font-black flex items-center justify-center border border-white dark:border-slate-900">
            +{participants.length - visible.length}
          </div>
        )}
      </div>
    );
  };

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col gap-6 text-left select-none animate-slide-up h-full min-h-0">
      
      {/* Title Header (Peepulse Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
        <div className="flex flex-col">
          <span className="text-caption font-bold text-toss-blue mb-1">Schedule Calendar</span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">전체 스케줄 캘린더</h1>
        </div>

        {/* View Mode & Project Selectors */}
        <div className="flex flex-wrap items-center gap-3 select-none">
          <div className="flex items-center gap-1 bg-gray-150/70 dark:bg-slate-800/60 p-1 rounded-full border border-gray-200/20">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all cursor-pointer border-none bg-transparent ${
                viewMode === 'all'
                  ? 'bg-white text-toss-blue shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              전체 프로젝트
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all cursor-pointer border-none bg-transparent ${
                viewMode === 'single'
                  ? 'bg-white text-toss-blue shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              프로젝트별 상세
            </button>
          </div>

          {viewMode === 'single' && (
            <CustomSelect
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-sm font-bold px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all cursor-pointer text-toss-gray-800 dark:text-slate-200"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </CustomSelect>
          )}
        </div>
      </div>

      {/* Main Peepulse 3:1 Layout Grid */}
      <div className="cds--schedule-layout">
        
        {/* Left Section: Month Gantt Grid Calendar (Redesigned based on screenshots) */}
        <div className="cds--schedule-timeline-container min-h-0 flex flex-col">
          
          {/* Header Month Controller */}
          <div className="cds--schedule-timeline-header">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800/80 pb-0.5 select-none">
              <span className="text-sm font-extrabold text-toss-blue dark:text-blue-400 pb-2 border-b-2 border-toss-blue!">
                Month Grid
              </span>
            </div>

            {/* Navigation arrows */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-toss-gray-500 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200 min-w-[110px] text-center select-none">
                  {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                </span>

                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-toss-gray-500 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleToday}
                className="cds--btn cds--btn-secondary px-3.5 py-1.5 text-sm font-bold"
              >
                오늘
              </button>
            </div>
          </div>

          {/* Monthly grid column weekday titles */}
          <div className="grid grid-cols-7 gap-y-1 mb-2.5 text-center text-sm font-black text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0">
            {weekdayNames.map((day, idx) => (
              <div 
                key={day} 
                className={`py-1 ${idx === 0 ? 'text-rose-500/80' : idx === 6 ? 'text-toss-blue/80' : ''}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month Calendar Gantt Grid cells wrapper */}
          <div className="flex-1 flex flex-col gap-px bg-gray-100/70 dark:bg-slate-800/30 rounded-[20px] overflow-hidden border border-gray-100 dark:border-slate-800/60 min-h-0 bg-white/40">
            {[0, 1, 2, 3, 4, 5].map((weekIdx) => {
              const weekDaysList = calendarData.slice(weekIdx * 7, weekIdx * 7 + 7);
              const weekStartStr = weekDaysList[0].dateStr;
              const weekEndStr = weekDaysList[6].dateStr;

              // Compute events overlap inside lanes for this week row
              const weekLanes = (() => {
                const list = getEventsForRange(weekStartStr, weekEndStr);
                
                list.sort((a, b) => {
                  const aLen = (a.end || '').localeCompare(a.start || '');
                  const bLen = (b.end || '').localeCompare(b.start || '');
                  if (aLen !== bLen) return bLen - aLen;
                  return (a.start || '').localeCompare(b.start || '');
                });

                const lanes: LaneEvent[][] = [];
                
                list.forEach(ev => {
                  const startStr = ev.start || '';
                  const endStr = ev.end || '';
                  
                  const startCol = startStr < weekStartStr ? 0 : weekDaysList.findIndex(d => d.dateStr === startStr);
                  const endCol = endStr > weekEndStr ? 6 : weekDaysList.findIndex(d => d.dateStr === endStr);

                  let assignedLane = -1;
                  for (let i = 0; i < lanes.length; i++) {
                    const overlaps = lanes[i].some(allocated => {
                      return !(endCol < allocated.startCol || startCol > allocated.endCol);
                    });
                    if (!overlaps) {
                      assignedLane = i;
                      break;
                    }
                  }

                  if (assignedLane === -1) {
                    lanes.push([]);
                    assignedLane = lanes.length - 1;
                  }

                  lanes[assignedLane].push({
                    id: ev.id,
                    title: ev.title,
                    startCol,
                    endCol,
                    colorClass: ev.colorClass,
                    type: ev.type,
                    original: ev.original,
                    start: ev.start,
                    end: ev.end
                  });
                });

                return lanes;
              })();

              // Week height dynamically expands based on lane rows to prevent overflowing
              const weekRowHeight = Math.max(76, weekLanes.length * 28 + 30);

              return (
                <div 
                  key={weekIdx} 
                  className="flex-1 relative border-b border-gray-100/60 dark:border-slate-800/25 last:border-b-0 min-h-0 bg-white dark:bg-slate-900"
                  style={{ minHeight: `${weekRowHeight}px` }}
                >
                  {/* Background grid cells layer */}
                  <div className="absolute inset-0 grid grid-cols-7 divide-x divide-gray-100/40 dark:divide-slate-800/20">
                    {weekDaysList.map((cell, dIdx) => {
                      const isSelected = cell.dateStr === selectedDateStr;
                      const isToday = cell.dateStr === todayStr;
                      
                      let dayTextClass = "text-sm font-black ";
                      if (!cell.isCurrentMonth) {
                        dayTextClass += "text-toss-gray-300 dark:text-gray-700";
                      } else {
                        if (dIdx === 0) dayTextClass += "text-rose-500/70";
                        else if (dIdx === 6) dayTextClass += "text-toss-blue/70";
                        else dayTextClass += "text-gray-700 dark:text-gray-300";
                      }

                      return (
                        <div
                          key={dIdx}
                          onClick={() => setSelectedDateStr(cell.dateStr)}
                          className={`h-full flex flex-col p-2 relative select-none cursor-pointer ${
                            isSelected 
                              ? 'bg-sky-500/5 dark:bg-sky-500/10 ring-1 ring-toss-blue ring-inset z-10' 
                              : 'hover:bg-gray-50/50 dark:hover:bg-slate-850/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={dayTextClass}>{cell.day}</span>
                            {isToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-toss-blue" title="오늘" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
  
                  {/* Overlaid horizontal spanning Gantt bars */}
                  <div className="absolute top-7.5 bottom-1 left-0 right-0 pointer-events-none flex flex-col gap-1 overflow-hidden px-1">
                    {weekLanes.map((lane, laneIdx) => (
                      <div key={laneIdx} className="relative h-6 w-full shrink-0">
                        {lane.map(ev => {
                          const left = (ev.startCol * 100) / 7;
                          const width = ((ev.endCol - ev.startCol + 1) * 100) / 7;
                          const colSpan = ev.endCol - ev.startCol + 1;

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className={`cds--month-gantt-bar border ${ev.colorClass} cursor-default`}
                              style={{
                                left: `${left}%`,
                                width: `calc(${width}% - 4px)`,
                                marginLeft: '2px',
                                marginRight: '2px',
                                top: '0px'
                              }}
                              title={ev.title}
                            >
                              <span className="truncate pr-1 select-none leading-none">{ev.title}</span>
                              {colSpan >= 2 && renderAvatars(ev)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Schedule list side details card */}
        <div className="cds--card flex flex-col h-full min-h-0 overflow-hidden text-left gap-4 p-5">
          
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800/80 pb-3.5 shrink-0">
            <CalendarIcon className="w-4.5 h-4.5 text-toss-blue" />
            <h3 className="text-sm font-bold text-toss-gray-800 dark:text-gray-200">Schedule list</h3>
          </div>

          {/* Mini Calendar strip */}
          <div className="cds--schedule-sidebar-mini-cal shrink-0">
            {weekDays.slice(1, 6).map(day => {
              const isActive = day.dateStr === selectedDateStr;
              return (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`cds--schedule-mini-day-btn ${isActive ? 'cds--schedule-mini-day-btn-active' : ''}`}
                >
                  <span className="cds--schedule-mini-day-name text-xs">{day.dayName}</span>
                  <span className="cds--schedule-mini-day-num text-sm font-extrabold">{day.dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Daily events list */}
          <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-3.5 scrollbar-thin min-h-0">
            {loadingLocal ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-6 h-6 border-2 border-toss-blue border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-toss-gray-400 font-bold">일정 불러오는 중...</span>
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 gap-2.5 text-toss-gray-400 dark:text-slate-500">
                <Clock className="w-9 h-9 opacity-20 text-toss-blue" />
                <span className="text-sm font-bold leading-normal">등록된 일정이 없습니다.</span>
              </div>
            ) : (
              selectedDayEvents.map((ev, index) => {
                const isFirst = index === 0;

                if (isFirst) {
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => handleNavigateToWbsOrKanban(ev)}
                      className="cds--schedule-highlight-card cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-black text-black/50 uppercase tracking-widest">
                          {ev.type === 'project' ? 'Project' : ev.type === 'process' ? 'Process Stage' : 'Task Item'}
                        </span>
                        <h4 className="text-base font-black leading-tight line-clamp-2">{ev.title}</h4>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm font-bold text-white/95">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ev.timeStr}</span>
                      </div>

                      <div className="flex justify-between items-center mt-1">
                        {renderAvatars(ev)}
                        <span className="text-sm font-extrabold bg-white/20 px-2 py-0.5 rounded-full select-none">
                          {ev.type === 'project' ? '1단계' : ev.type === 'process' ? 'WBS' : 'Kanban'}
                        </span>
                      </div>

                      {/* Go to Link action button */}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNavigateToWbsOrKanban(ev);
                        }}
                        className="cds--schedule-highlight-btn"
                      >
                        {ev.type === 'project' ? (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            <span>개요 바로가기</span>
                          </>
                        ) : ev.type === 'process' ? (
                          <>
                            <Layers className="w-3.5 h-3.5" />
                            <span>WBS 단계 보기</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>칸반 카드 이동</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={ev.id}
                    onClick={() => handleNavigateToWbsOrKanban(ev)}
                    className="p-4 rounded-2xl bg-gray-50/50 dark:bg-slate-850/20 border border-gray-150 dark:border-slate-800/40 hover:bg-gray-100/50 dark:hover:bg-slate-850/30 transition-all flex flex-col gap-3 text-left relative group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ev.type === 'project' ? <Compass className="w-4 h-4 text-sky-500" /> : ev.type === 'process' ? <Layers className="w-4 h-4 text-emerald-500" /> : <CheckSquare className="w-4 h-4 text-purple-500" />}
                        <span className="text-sm text-gray-400 dark:text-slate-500 font-extrabold uppercase select-none">
                          {ev.type === 'project' ? '프로젝트' : ev.type === 'process' ? '프로세스' : '작업'}
                        </span>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNavigateToWbsOrKanban(ev);
                        }}
                        className="text-sm text-toss-blue hover:text-toss-blue-hover font-bold hover:underline flex items-center gap-0.5 cursor-pointer border-none bg-transparent"
                      >
                        이동 <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <h4 className="text-sm font-black text-toss-gray-800 dark:text-gray-200 leading-normal line-clamp-2">
                      {ev.title}
                    </h4>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-toss-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ev.timeStr}</span>
                      </div>
                      {renderAvatars(ev)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Floating local toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-toss-lg z-50 animate-scale-in select-none backdrop-blur-sm">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
