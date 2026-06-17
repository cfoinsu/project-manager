import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  ArrowRight,
  Layers,
  CheckSquare,
  AlertCircle,
  FileText,
  Users
} from 'lucide-react';
import type { Assignment, Meeting } from '../types';
import { getAssignments } from '../utils/api';
import { getMeetings } from '../utils/collaborationApi';
import { MeetingMinutesModal } from './MeetingMinutesModal';
import { Avatar } from './Avatar';
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

interface LaneEvent {
  id: string;
  title: string;
  startCol: number;
  endCol: number;
  colorClass: string;
  type: 'process' | 'task' | 'meeting';
  original: any;
  start?: string;
  end?: string;
}

type ScheduleEventType = 'process' | 'task' | 'meeting';
type ScheduleEventLike = { type: ScheduleEventType; title: string; start?: string; end?: string; original: any };

const getScheduleEventLabel = (type: ScheduleEventType) => {
  if (type === 'meeting') return '회의';
  if (type === 'process') return '프로세스';
  return '작업';
};

const getScheduleEventActionLabel = (type: ScheduleEventType) => {
  if (type === 'meeting') return '회의록';
  return '이동';
};

const getScheduleEventTimeText = (ev: ScheduleEventLike, fallback = '') => {
  if (ev.type === 'meeting') {
    const meeting = ev.original as Meeting;
    return `${meeting.start_date} ${meeting.start_time} ~ ${meeting.end_time}`;
  }
  return fallback || [ev.start, ev.end].filter(Boolean).join(' ~ ');
};

export const ProjectScheduleCalendarView: React.FC = () => {
  const { activeProject, processes, tasks: tasksMap, setView } = useProjectStore();
  const { user, serverMode } = useAuthStore();

  // Drag scroll state for timeline view
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('.cds--schedule-timeline-event-pill') || target.closest('button')) {
      return;
    }
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftState(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Flattened tasks list from store
  const tasks = useMemo(() => {
    return Object.values(tasksMap).flat();
  }, [tasksMap]);

  // View mode tab state: 'timeline' (Weekly Timeline) or 'month' (Monthly Calendar Grid)
  const [activeTab, setActiveTab] = useState<'timeline' | 'month'>('timeline');

  // Date states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Show local toast feedback
  const showLocalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2500);
  };

  const loadMeetings = async () => {
    if (!activeProject?.id) {
      setMeetings([]);
      return;
    }
    try {
      setMeetings(await getMeetings(activeProject.id));
    } catch (error) {
      console.error('Load meetings for schedule failed:', error);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [activeProject?.id]);

  useEffect(() => {
    const loadAssignments = async () => {
      if (!activeProject?.id) {
        setAssignments([]);
        return;
      }
      try {
        const list = await getAssignments(serverMode, user?.role || 'member', user?.id || '');
        setAssignments(list.filter((assignment) => assignment.project_id === activeProject.id));
      } catch (error) {
        console.error('Load assignments for project schedule failed:', error);
        setAssignments([]);
      }
    };
    loadAssignments();
  }, [activeProject?.id, serverMode, user?.id, user?.role]);

  // Synchronize calendar focus with selected date
  useEffect(() => {
    const dObj = new Date(selectedDateStr);
    if (!isNaN(dObj.getTime())) {
      if (currentDate.getMonth() !== dObj.getMonth() || currentDate.getFullYear() !== dObj.getFullYear()) {
        setCurrentDate(dObj);
      }
    }
  }, [selectedDateStr]);

  // Process unique colors definition for localized legend and vertical grid line representations
  const PROCESS_COLORS = [
    '#3182F6', // Toss Blue
    '#00D28A', // Emerald/Green
    '#FF5F2E', // Orange
    '#A052FF', // Purple
    '#FF385C', // Rose/Red
    '#00B7D4', // Cyan/Teal
    '#FFB800', // Yellow
    '#8B95A1'  // Cool Gray
  ];
  const getProcessColor = (procId: string): string => {
    const idx = processes.findIndex(p => p.id === procId);
    if (idx === -1) {
      let hash = 0;
      for (let i = 0; i < procId.length; i++) hash += procId.charCodeAt(i);
      return PROCESS_COLORS[hash % PROCESS_COLORS.length];
    }
    return PROCESS_COLORS[idx % PROCESS_COLORS.length];
  };

  // Date helper functions
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
    const weekdayNamesKorean = ['일', '월', '화', '수', '목', '금', '토'];
    
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
        dayKorean: weekdayNamesKorean[i],
        dayNum: d.getDate()
      });
    }
    return days;
  }, [currentDate]);

  // Monthly Calendar cells generation
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

  // Navigators
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handlePrevWeek = () => {
    const prevWeekDate = new Date(currentDate);
    prevWeekDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(prevWeekDate);
  };

  const handleNextWeek = () => {
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextWeekDate);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${today.getFullYear()}-${mm}-${dd}`);
  };

  // Date range checking helpers
  const isDateInRange = (dateStr: string, start?: string, end?: string) => {
    if (!start || !end) return false;
    return dateStr >= start && dateStr <= end;
  };

  const isRangeOverlapping = (startA: string, endA: string, startB: string, endB: string) => {
    return !(endA < startB || startA > endB);
  };

  const parseTimeToHourFloat = (timeStr?: string, defaultHour: number = 9): number => {
    if (!timeStr) return defaultHour;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    if (isNaN(h)) return defaultHour;
    return h + m / 60;
  };



  const getEventsForRange = (startStr: string, endStr: string) => {
    const events: { id: string; type: 'process' | 'task' | 'meeting'; title: string; start?: string; end?: string; colorClass: string; original: any }[] = [];
    const projCode = activeProject?.code;
    
    processes
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

    tasks
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

    meetings
      .filter(m => m.start_date && isRangeOverlapping(m.start_date, m.start_date, startStr, endStr))
      .forEach(m => {
        events.push({
          id: m.id,
          type: 'meeting',
          title: m.title,
          start: m.start_date,
          end: m.start_date,
          colorClass: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-900/40',
          original: m
        });
      });

    return events;
  };

  // Compute dynamic timeline range based on tasks in the current week
  const timelineRange = useMemo(() => {
    let minHour = 9;
    let maxHour = 18;
    
    if (weekDays.length === 7) {
      const startWeekStr = weekDays[0].dateStr;
      const endWeekStr = weekDays[6].dateStr;
      const weekEvents = getEventsForRange(startWeekStr, endWeekStr);
      
      weekEvents.forEach(ev => {
        if ((ev.type === 'task' || ev.type === 'meeting') && ev.original) {
          const timedItem = ev.original;
          if (timedItem.start_time || timedItem.end_time) {
            const sh = parseTimeToHourFloat(timedItem.start_time, 9);
            const eh = parseTimeToHourFloat(timedItem.end_time, 18);
            if (sh < minHour) minHour = Math.floor(sh);
            if (eh > maxHour) maxHour = Math.ceil(eh);
          }
        }
      });
    }
    
    const startHour = Math.min(9, minHour);
    const endHour = Math.max(18, maxHour);
    const totalHours = endHour - startHour;
    
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      const hh = h;
      const suffix = hh >= 12 ? 'pm' : 'am';
      const displayHour = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
      slots.push(`${String(displayHour).padStart(2, '0')}:00 ${suffix}`);
    }
    
    return {
      startHour,
      endHour,
      totalHours,
      slots
    };
  }, [weekDays, processes, tasks, meetings]);

  // Deterministic daily event time slots calculation based on ID hashes or actual task time
  const getEventTimeSlot = (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    const targetMeeting = meetings.find(m => m.id === id);
    let startHour = 9;
    let endHour = 18;
    let hasActualTime = false;
    
    if (targetMeeting && (targetMeeting.start_time || targetMeeting.end_time)) {
      startHour = parseTimeToHourFloat(targetMeeting.start_time, 9);
      endHour = parseTimeToHourFloat(targetMeeting.end_time, Math.max(startHour + 1, 10));
      hasActualTime = true;
    } else if (targetTask && (targetTask.start_time || targetTask.end_time)) {
      startHour = parseTimeToHourFloat(targetTask.start_time, 9);
      endHour = parseTimeToHourFloat(targetTask.end_time, 18);
      hasActualTime = true;
    }
    
    if (!hasActualTime) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
      startHour = (hash % 5) + 9; // Starts at 9, 10, 11, 12, 13
      const durationHours = ((hash % 4) * 0.5) + 1.5; // Duration 1.5, 2.0, 2.5, 3.0
      endHour = startHour + durationHours;
    }
    
    // Clamp to dynamic view limits
    const startOffset = timelineRange ? timelineRange.startHour : 9;
    const totalSpan = timelineRange ? timelineRange.totalHours : 9;
    
    const leftPercent = Math.max(0, Math.min(100, ((startHour - startOffset) * 100) / totalSpan));
    const widthPercent = Math.max(5, Math.min(100 - leftPercent, ((endHour - startHour) * 100) / totalSpan));
    
    const formatTime = (h: number) => {
      const hh = Math.floor(h);
      const mm = Math.round((h % 1) * 60) === 0 ? '00' : String(Math.round((h % 1) * 60)).padStart(2, '0');
      const suffix = hh >= 12 ? 'PM' : 'AM';
      const displayHour = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
      return `${String(displayHour).padStart(2, '0')}:${mm} ${suffix}`;
    };
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      timeStr: `${formatTime(startHour)} - ${formatTime(endHour)}`,
      startHour,
      endHour
    };
  };

  // Get active events on a specific day
  const getEventsForDay = (dateStr: string) => {
    const events: { id: string; type: 'process' | 'task' | 'meeting'; title: string; start?: string; end?: string; colorClass: string; original: any }[] = [];
    const projCode = activeProject?.code;
    
    processes
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

    tasks
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

    meetings
      .filter(m => m.start_date === dateStr)
      .forEach(m => {
        events.push({
          id: m.id,
          type: 'meeting',
          title: m.title,
          start: m.start_date,
          end: m.start_date,
          colorClass: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-900/40',
          original: m
        });
      });

    return events;
  };

  // Events of currently selected date
  const selectedDayEvents = useMemo(() => {
    const list = getEventsForDay(selectedDateStr);
    return list.map((ev) => {
      const timeSlot = getEventTimeSlot(ev.id);
      return {
        ...ev,
        timeStr: timeSlot.timeStr
      };
    });
  }, [selectedDateStr, processes, tasks, meetings, timelineRange]);

  // Navigate to WBS or Kanban view directly from event list
  const handleNavigateToWbsOrKanban = (ev: { id: string; type: 'process' | 'task' | 'meeting'; title: string; original: any }) => {
    if (ev.type === 'process') {
      setView('projects_process');
      showLocalToast(`WBS 단계 관리 뷰로 이동했습니다.`);
    } else if (ev.type === 'task') {
      setView('projects_tasks');
      showLocalToast(`칸반 작업 관리 보드로 이동했습니다.`);
    } else if (ev.type === 'meeting') {
      setSelectedMeeting(ev.original as Meeting);
    }
  };

  const getEventParticipants = (ev: { id: string; type: 'process' | 'task' | 'meeting'; original: any }) => {
    if (ev.type === 'meeting') {
      const meeting = ev.original as Meeting;
      const ids = meeting.attendees || [];
      const names = meeting.attendee_names || [];
      const byIds = ids.map((id) => assignments.find((assignment) => assignment.user_id === id)).filter(Boolean) as Assignment[];
      const byNames = names
        .filter((name) => !byIds.some((assignment) => assignment.user_name === name))
        .map((name, index) => ({ id: `${meeting.id}-attendee-${index}`, user_id: name, user_name: name } as Assignment));
      return [...byIds, ...byNames];
    }

    if (ev.type === 'task') {
      const ids = ev.original?.assignees || [];
      const names = ev.original?.assignee_names || (ev.original?.assignee ? [ev.original.assignee] : []);
      if (ids.length > 0 || names.length > 0) {
        const byIds = ids.map((id: string) => assignments.find((assignment) => assignment.user_id === id)).filter(Boolean) as Assignment[];
        const byNames = names
          .filter((name: string) => !byIds.some((assignment) => assignment.user_name === name))
          .map((name: string, index: number) => ({ id: `${ev.original.id}-assignee-${index}`, user_id: name, user_name: name } as Assignment));
        return [...byIds, ...byNames];
      }
    }

    return assignments;
  };

  // Helper to render overlapping avatars from matched assignments or meeting attendees
  const renderAvatars = (ev: { id: string; type: 'process' | 'task' | 'meeting'; original: any }) => {
    const participants = getEventParticipants(ev);
    if (participants.length === 0) return null;
    const visible = participants.slice(0, 3);

    return (
      <div className="flex -space-x-1.5 overflow-hidden select-none items-center">
        {visible.map((participant) => (
          <Avatar
            key={participant.id || participant.user_id}
            name={participant.user_name || '?? ??'}
            profileImage={participant.user_profile_image}
            className="w-5.5 h-5.5 text-[9px] border-2 border-white dark:border-slate-900"
          />
        ))}
        {participants.length > visible.length && (
          <div className="w-5.5 h-5.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[9.5px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900">
            +{participants.length - visible.length}
          </div>
        )}
      </div>
    );
  };

  // Helper to layout timeline events inside a row lane
  const getDayRowLanes = (dateStr: string) => {
    const list = getEventsForRange(dateStr, dateStr).filter(ev => ev.type === 'task' || ev.type === 'meeting');
    
    const eventsWithTime = list.map((ev) => {
      const timeSlot = getEventTimeSlot(ev.id);
      return {
        ...ev,
        ...timeSlot
      };
    });

    const lanes: typeof eventsWithTime[] = [];
    eventsWithTime.forEach(ev => {
      let laneIdx = -1;
      for (let i = 0; i < lanes.length; i++) {
        const hasOverlap = lanes[i].some(allocated => {
          return !(ev.endHour! <= allocated.startHour! || ev.startHour! >= allocated.endHour!);
        });
        if (!hasOverlap) {
          laneIdx = i;
          break;
        }
      }
      if (laneIdx === -1) {
        lanes.push([]);
        laneIdx = lanes.length - 1;
      }
      lanes[laneIdx].push(ev);
    });

    return lanes;
  };



  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 select-none">
        <AlertCircle className="w-12 h-12 text-gray-300 animate-pulse mb-3" />
        <p className="text-body-2 font-bold">프로젝트를 먼저 선택해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col gap-6 text-left select-none animate-slide-up h-full min-h-0">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4 select-none">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
            <span>{activeProject.name}</span>
            <span className="text-sm px-2.5 py-0.5 rounded-full bg-toss-blue/10 text-toss-blue font-bold uppercase select-none">상세 일정</span>
          </h1>
          <p className="text-caption text-gray-500 dark:text-gray-450 font-medium mt-1.5">
            이 프로젝트의 핵심 프로세스 단계와 그 하위 상세 업무의 기간 및 진척 상황을 상세히 모니터링합니다.
          </p>
        </div>
      </div>

      {/* Main Peepulse layout grid */}
      <div className="cds--schedule-layout">
        
        {/* Left Section: Timeline Board / Month Grid */}
        <div className="cds--schedule-timeline-container min-h-0 flex flex-col">
          
          {/* Header controls inside calendar card */}
          <div className="cds--schedule-timeline-header">
            {/* View Tab Selector: Timeline vs Month */}
            <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-800/80 pb-0.5">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-2 text-sm font-bold transition-all border-b-2 border-transparent cursor-pointer bg-transparent border-none ${
                  activeTab === 'timeline'
                    ? 'border-toss-blue! text-toss-blue dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:text-slate-500'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setActiveTab('month')}
                className={`pb-2 text-sm font-bold transition-all border-b-2 border-transparent cursor-pointer bg-transparent border-none ${
                  activeTab === 'month'
                    ? 'border-toss-blue! text-toss-blue dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:text-slate-500'
                }`}
              >
                Month
              </button>
            </div>

            {/* Navigation controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={activeTab === 'timeline' ? handlePrevWeek : handlePrevMonth}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-toss-gray-500 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-sm font-black text-toss-gray-800 dark:text-gray-200 min-w-[120px] text-center select-none">
                  {activeTab === 'timeline' 
                    ? `${weekDays[0].date.getMonth() + 1}월 ${weekDays[0].date.getDate()}일 - ${weekDays[6].date.getMonth() + 1}월 ${weekDays[6].date.getDate()}일`
                    : `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
                  }
                </span>

                <button
                  onClick={activeTab === 'timeline' ? handleNextWeek : handleNextMonth}
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

          {/* SubView: Weekly Timeline */}
          {activeTab === 'timeline' && (
            <div className="cds--schedule-timeline-board relative overflow-hidden">
              <div 
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="overflow-auto select-none cursor-grab active:cursor-grabbing flex-1 flex flex-col min-w-0 scrollbar-thin pb-2"
              >
                {/* Hours Header Axis */}
                <div 
                  className="cds--schedule-hours-axis sticky top-0 bg-white dark:bg-slate-900 z-[35] shadow-[0_2px_5px_rgba(0,0,0,0.02)]"
                  style={{ 
                    top: 0,
                    gridTemplateColumns: `80px repeat(${timelineRange.totalHours}, minmax(110px, 1fr))` 
                  }}
                >
                  <div 
                    className="text-[11px] font-black tracking-tight text-center self-center text-toss-gray-400 sticky bg-white dark:bg-slate-900 z-[40] shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-100 dark:border-slate-800 h-full flex items-center justify-center min-w-[80px] select-none"
                    style={{ left: 0, top: 0 }}
                  >
                  </div>
                  {timelineRange.slots.map(h => (
                    <div key={h} className="self-center font-bold text-sm">{h}</div>
                  ))}
                </div>

                {/* Day Rows Container */}
                <div 
                  className="cds--schedule-day-rows-container scrollbar-thin relative min-w-max flex-1"
                  style={{ overflow: 'visible' }}
                >
                  
                  {/* 12:00 PM Red Dotted Indicator Line (Peepulse Style) */}
                  {12 >= timelineRange.startHour && 12 <= timelineRange.endHour && (
                    <div 
                      className="cds--schedule-time-indicator-line" 
                      style={{ left: `calc(80px + ${((12 - timelineRange.startHour) * 100) / timelineRange.totalHours}% - 1px)` }}
                    >
                      <span className="cds--schedule-time-indicator-badge">12:00 PM</span>
                    </div>
                  )}

                  {weekDays.map(day => {
                    const lanes = getDayRowLanes(day.dateStr);
                    const isSelected = day.dateStr === selectedDateStr;
                    const isToday = day.dateStr === todayStr;

                    // Get processes running on this specific date
                    const dayProcesses = processes.filter(p => p.start_date && p.end_date && isDateInRange(day.dateStr, p.start_date, p.end_date));

                    // Dynamically calculate day row height based on overlapping lanes count
                    const rowHeight = Math.max(68, lanes.length * 44 + 20);

                    return (
                      <div 
                        key={day.dateStr} 
                        className={`cds--schedule-day-row ${isSelected ? 'bg-sky-500/5 dark:bg-sky-500/5 z-10' : ''}`}
                        style={{ 
                          height: `${rowHeight}px`,
                          gridTemplateColumns: `80px repeat(${timelineRange.totalHours}, minmax(110px, 1fr))`
                        }}
                        onClick={() => setSelectedDateStr(day.dateStr)}
                      >
                        {/* Left Day label column */}
                        <div 
                          className="cds--schedule-day-label-col sticky bg-white dark:bg-slate-900 z-[30] shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-100 dark:border-slate-800 min-w-[80px]"
                          style={{ left: 0 }}
                        >
                          {/* Vertical lines representing WBS processes active on this weekday */}
                          <div className="absolute left-0 top-0 bottom-0 flex gap-[2px] pl-[3px] py-1 select-none pointer-events-none z-10">
                            {dayProcesses.map(p => (
                              <div 
                                key={p.id}
                                className="w-[3px] h-full rounded-full transition-colors"
                                style={{ backgroundColor: getProcessColor(p.id) }}
                                title={p.name}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 font-black tracking-tight">{day.dayKorean}</span>
                          <div className={`cds--schedule-day-label-badge ${
                            isToday ? 'cds--schedule-day-label-badge-active' : isSelected ? 'bg-gray-100 text-toss-blue font-bold dark:bg-slate-800' : ''
                          }`}>
                            {day.dayNum}
                          </div>
                        </div>

                        {/* Timeline columns backgrounds (vertical dashed lines) */}
                        {timelineRange.slots.map((_, hIdx) => (
                          <div key={hIdx} className="cds--schedule-grid-cell" />
                        ))}

                        {/* Event pills overlaid absolute-positioned */}
                        <div className="cds--schedule-row-events-overlay">
                          {lanes.map((lane, laneIdx) => 
                            lane.map(ev => {
                              const top = laneIdx * 44 + 10;
                              const isMeeting = ev.type === 'meeting';
                              const itemColor = isMeeting
                                ? 'bg-amber-50/95 hover:bg-amber-100/95 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40 h-[38px] rounded-xl'
                                : 'bg-purple-50/90 hover:bg-purple-100/90 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30 h-[38px] rounded-xl';

                              const duration = (ev.endHour || 18) - (ev.startHour || 9);
                              const isVeryShort = duration < 1.5;
                              const isMediumShort = duration >= 1.5 && duration < 2.5;

                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDateStr(day.dateStr);
                                    if (isMeeting) setSelectedMeeting(ev.original as Meeting);
                                  }}
                                  className={`cds--schedule-timeline-event-pill border flex items-center justify-between transition-all ${itemColor}`}
                                  style={{
                                    left: ev.left,
                                    width: `calc(${ev.width} - 8px)`,
                                    minWidth: '115px', // Guarantee minimum width to prevent squishing layout
                                    top: `${top}px`,
                                    marginLeft: '4px'
                                  }}
                                  title={`${getScheduleEventLabel(ev.type)} · ${ev.title} (${getScheduleEventTimeText(ev, ev.timeStr)})`}
                                >
                                  <div className="flex flex-col justify-center overflow-hidden pr-2 text-left w-full min-w-0">
                                    <span className={`truncate text-[10px] font-black leading-none ${isMeeting ? 'text-amber-500 dark:text-amber-300' : 'text-purple-500 dark:text-purple-400'}`}>{getScheduleEventLabel(ev.type)}</span>
                                    <span className={`truncate text-xs font-extrabold leading-tight mt-0.5 ${isMeeting ? 'text-amber-700 dark:text-amber-300' : 'text-purple-700 dark:text-purple-300'}`}>{ev.title}</span>
                                    {!isVeryShort && !isMediumShort && (
                                      <span className={`text-[10px] opacity-75 font-semibold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis ${isMeeting ? 'text-amber-600/80 dark:text-amber-300/80' : 'text-purple-500/80 dark:text-purple-400/80'}`}>{getScheduleEventTimeText(ev, ev.timeStr)}</span>
                                    )}
                                  </div>
                                  {!isVeryShort && renderAvatars(ev)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SubView: Monthly Grid (Gantt Grid layout style swap) */}
          {activeTab === 'month' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Weekday labels */}
              <div className="grid grid-cols-7 gap-y-1 mb-2.5 text-center text-sm font-black text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <div 
                    key={day} 
                    className={`py-1 ${idx === 0 ? 'text-rose-500/80' : idx === 6 ? 'text-toss-blue/80' : ''}`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Monthly grid cell blocks */}
              <div className="flex-1 flex flex-col gap-px bg-gray-100/60 dark:bg-slate-800/30 rounded-[20px] overflow-hidden border border-gray-100 dark:border-slate-800/60 min-h-[350px] bg-white/40">
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
                      className="flex-1 relative border-b border-gray-100/40 dark:border-slate-800/25 last:border-b-0 min-h-0 bg-white dark:bg-slate-900"
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

                              const isProcess = ev.type === 'process';
                              const isMeeting = ev.type === 'meeting';
                              const procColor = isProcess ? getProcessColor(ev.id) : '';
                              const meetingStyle = isMeeting ? {
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                color: '#d97706',
                                borderColor: 'rgba(245, 158, 11, 0.28)',
                              } : {};
                              const customStyle = isProcess ? {
                                backgroundColor: `${procColor}20`,
                                color: procColor,
                                borderColor: `${procColor}40`,
                              } : meetingStyle;

                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isMeeting) setSelectedMeeting(ev.original as Meeting);
                                  }}
                                  className={`cds--month-gantt-bar border ${isProcess || isMeeting ? '' : ev.colorClass} ${isMeeting ? 'pointer-events-auto cursor-pointer' : 'cursor-default'}`}
                                  style={{
                                    left: `${left}%`,
                                    width: `calc(${width}% - 4px)`,
                                    marginLeft: '2px',
                                    marginRight: '2px',
                                    top: '0px',
                                    ...customStyle
                                  }}
                                  title={`${getScheduleEventLabel(ev.type)} · ${ev.title}${isMeeting ? ` · ${getScheduleEventTimeText(ev)}` : ''}`}
                                >
                                  <span className="truncate pr-1 select-none leading-none text-xs">{isMeeting ? `회의 · ${ev.title}` : ev.title}</span>
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
          )}
          
          {/* 하단 WBS 프로세스 색상 범례 라벨 */}
          {processes.length > 0 && (
            <div className="flex items-center gap-3.5 flex-wrap px-5 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-[20px] border border-slate-100 dark:border-slate-800/60 mt-3.5 select-none shrink-0">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">프로세스 범례 :</span>
              {processes.map(p => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getProcessColor(p.id) }} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Section: Schedule list & Date details */}
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
            {selectedDayEvents.length === 0 ? (
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
                          {getScheduleEventLabel(ev.type)}
                        </span>
                        <h4 className="text-base font-black leading-tight line-clamp-2">
                          {ev.type === 'meeting' ? `회의명 · ${ev.title}` : ev.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm font-bold text-white/95">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getScheduleEventTimeText(ev, ev.timeStr)}</span>
                      </div>

                      <div className="flex justify-between items-center mt-1">
                        {renderAvatars(ev)}
                        <span className="text-sm font-extrabold bg-white/20 px-2 py-0.5 rounded-full select-none">
                          {ev.type === 'meeting' ? '회의' : ev.type === 'process' ? 'WBS' : 'Kanban'}
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
                        {ev.type === 'meeting' ? (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            <span>회의록 작성</span>
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
                        {ev.type === 'meeting' ? <Users className="w-4 h-4 text-amber-500" /> : ev.type === 'process' ? <Layers className="w-4 h-4 text-emerald-500" /> : <CheckSquare className="w-4 h-4 text-purple-500" />}
                        <span className="text-sm text-gray-400 dark:text-slate-500 font-extrabold uppercase select-none">
                          {getScheduleEventLabel(ev.type)}
                        </span>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNavigateToWbsOrKanban(ev);
                        }}
                        className="text-sm text-toss-blue hover:text-toss-blue-hover font-bold hover:underline flex items-center gap-0.5 cursor-pointer border-none bg-transparent"
                      >
                        {getScheduleEventActionLabel(ev.type)} <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <h4 className="text-sm font-black text-toss-gray-800 dark:text-gray-200 leading-normal line-clamp-2">
                      {ev.type === 'meeting' ? `회의명 · ${ev.title}` : ev.title}
                    </h4>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-toss-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getScheduleEventTimeText(ev, ev.timeStr)}</span>
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
      {selectedMeeting && (
        <MeetingMinutesModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onSaved={async (updated) => {
            if (updated) setSelectedMeeting(updated);
            await loadMeetings();
          }}
        />
      )}
    </div>
  );
};
