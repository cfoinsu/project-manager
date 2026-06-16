import React, { useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Bell,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Filter,
  ListTodo,
  Megaphone,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import * as db from '../utils/db';
import {
  createPersonalTodo,
  getMeetings,
  getNotifications,
  getPersonalTodos,
  markNotificationRead,
  respondMeeting,
  updatePersonalTodo,
} from '../utils/collaborationApi';
import { notifyUnreadItems } from '../utils/desktopNotifications';
import type { AppNotification, Meeting, PersonalTodo, Project, Task } from '../types';
import { MeetingMinutesModal } from './MeetingMinutesModal';
import { ModalOverlay } from './ModalOverlay';
import { CustomDatePicker } from './CustomDatePicker';

interface AssignedTask extends Task {
  project?: Project;
  process_name?: string;
}

type NotificationFilter = 'all' | AppNotification['type'];

const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getWeekStart = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
};
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const toDateTime = (date?: string, time?: string) => new Date(`${date || '1970-01-01'}T${time || '00:00'}`);
const isDoneTask = (status?: string) => ['완료', 'done', 'completed'].includes(status || '');
const dayDiff = (date?: string) => {
  if (!date) return 999;
  const today = new Date(todayKey()).getTime();
  return Math.ceil((new Date(date).getTime() - today) / 86400000);
};
const formatDateLabel = (date?: string) => {
  if (!date) return '마감일 없음';
  const diff = dayDiff(date);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  return date.replaceAll('-', '.');
};
const formatMeetingTime = (meeting: Meeting) => `${meeting.start_time} - ${meeting.end_time}`;
const sortByNearest = <T extends { start_date?: string; start_time?: string; end_date?: string }>(items: T[]) => {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aDate = a.start_date || a.end_date;
    const bDate = b.start_date || b.end_date;
    const aTime = toDateTime(aDate, a.start_time).getTime();
    const bTime = toDateTime(bDate, b.start_time).getTime();
    return Math.abs(aTime - now) - Math.abs(bTime - now) || aTime - bTime;
  });
};
const taskPriorityLabel = (priority?: string) => {
  if (['긴급', 'urgent'].includes(priority || '')) return '높음';
  if (['높음', 'high'].includes(priority || '')) return '높음';
  if (['낮음', 'low'].includes(priority || '')) return '낮음';
  return '보통';
};
const taskPriorityClass = (priority?: string) => {
  const label = taskPriorityLabel(priority);
  if (label === '높음') return 'bg-rose-50 text-rose-500 dark:bg-rose-950/30';
  if (label === '낮음') return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30';
  return 'bg-amber-50 text-amber-600 dark:bg-amber-950/30';
};
const notificationIcon = (type: AppNotification['type']) => {
  if (type === 'task') return <ClipboardList className="w-3.5 h-3.5" />;
  if (type === 'meeting') return <CalendarClock className="w-3.5 h-3.5" />;
  if (type === 'comment') return <AtSign className="w-3.5 h-3.5" />;
  if (type === 'todo') return <CheckCircle2 className="w-3.5 h-3.5" />;
  return <Megaphone className="w-3.5 h-3.5" />;
};
const notificationColor = (type: AppNotification['type']) => {
  if (type === 'task') return 'bg-blue-600 text-white';
  if (type === 'meeting') return 'bg-emerald-500 text-white';
  if (type === 'comment') return 'bg-violet-600 text-white';
  if (type === 'todo') return 'bg-teal-500 text-white';
  return 'bg-amber-500 text-white';
};

export const MyWorkView: React.FC = () => {
  const { user } = useAuthStore();
  const { projects, setView, selectProject } = useProjectStore();
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDueDate, setTodoDueDate] = useState(todayKey());
  const [todoWeekStart, setTodoWeekStart] = useState(() => getWeekStart(new Date()));
  const [todoRangeFilter, setTodoRangeFilter] = useState<'all' | 'week'>('week');
  const [selectedTodoDate, setSelectedTodoDate] = useState<string | null>(null);
  const [priorityPickerTodoId, setPriorityPickerTodoId] = useState<string | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);
  const [todoListOpen, setTodoListOpen] = useState(false);
  const [notificationListOpen, setNotificationListOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const assigned: AssignedTask[] = [];
      for (const project of projects) {
        const processes = await db.getProcesses(project.id);
        for (const process of processes) {
          const processTasks = await db.getTasks(process.id);
          assigned.push(
            ...processTasks
              .filter((task) => task.assignee === user.name || task.assignee === user.id || task.assignees?.includes(user.id))
              .map((task) => ({ ...task, project, process_name: process.name }))
          );
        }
      }
      const [meetingList, todoList, notificationList] = await Promise.all([
        getMeetings(),
        getPersonalTodos(),
        getNotifications(),
      ]);
      setTasks(assigned);
      setMeetings(meetingList.filter((meeting) => meeting.attendees.includes(user.id) || meeting.created_by === user.id));
      setTodos(todoList);
      setNotifications(notificationList);
      await notifyUnreadItems(notificationList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id, projects.length]);

  useEffect(() => {
    const start = formatDateKey(todoWeekStart);
    const end = formatDateKey(addDays(todoWeekStart, 6));
    if (selectedTodoDate && (selectedTodoDate < start || selectedTodoDate > end)) {
      setSelectedTodoDate(null);
      setTodoRangeFilter('week');
    }
  }, [selectedTodoDate, todoWeekStart]);

  const today = todayKey();
  const activeTasks = useMemo(() => sortByNearest(tasks.filter((task) => !isDoneTask(task.status))), [tasks]);
  const coreTasks = useMemo(() => {
    return activeTasks
      .filter((task) => !task.end_date || task.end_date >= today || dayDiff(task.end_date) >= -1)
      .slice(0, 3);
  }, [activeTasks, today]);
  const upcomingMeetings = useMemo(() => sortByNearest(meetings.filter((meeting) => meeting.start_date >= today)).slice(0, 6), [meetings, today]);
  const nextMeeting = upcomingMeetings[0];
  const todoWeekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(todoWeekStart, index)), [todoWeekStart]);
  const todoWeekStartStr = formatDateKey(todoWeekDays[0]);
  const todoWeekEndStr = formatDateKey(todoWeekDays[6]);
  const todosByDate = useMemo(() => {
    return todos.reduce<Record<string, PersonalTodo[]>>((acc, todo) => {
      if (!todo.due_date) return acc;
      acc[todo.due_date] = acc[todo.due_date] || [];
      acc[todo.due_date].push(todo);
      return acc;
    }, {});
  }, [todos]);
  const visibleTodos = useMemo(() => {
    if (selectedTodoDate) return todos.filter((todo) => todo.due_date === selectedTodoDate);
    if (todoRangeFilter === 'week') return todos.filter((todo) => todo.due_date && todo.due_date >= todoWeekStartStr && todo.due_date <= todoWeekEndStr);
    return todos;
  }, [selectedTodoDate, todoRangeFilter, todoWeekEndStr, todoWeekStartStr, todos]);
  const openTodos = useMemo(() => visibleTodos.filter((todo) => todo.status !== 'done'), [visibleTodos]);
  const doneTodos = visibleTodos.filter((todo) => todo.status === 'done');
  const allOpenTodos = todos.filter((todo) => todo.status !== 'done');
  const allDoneTodos = todos.filter((todo) => todo.status === 'done');
  const urgentTodos = openTodos.filter((todo) => todo.due_date && dayDiff(todo.due_date) <= 0);
  const unread = notifications.filter((item) => !item.read_at);
  const filteredNotifications = notificationFilter === 'all'
    ? notifications
    : notifications.filter((item) => item.type === notificationFilter);
  const todayMeetings = sortByNearest(meetings.filter((meeting) => meeting.start_date === today));
  const todaySchedule = [
    ...todayMeetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      time: formatMeetingTime(meeting),
      title: meeting.title,
      sub: meeting.location || meeting.project_name || '회의',
      status: meeting.start_time <= new Date().toTimeString().slice(0, 5) ? '진행 예정' : '예정',
      kind: 'meeting' as const,
      original: meeting,
    })),
    ...activeTasks
      .filter((task) => task.end_date === today)
      .map((task) => ({
        id: `task-${task.id}`,
        time: task.end_time ? `마감 ${task.end_time}` : '오늘 마감',
        title: task.title,
        sub: task.project?.name || task.process_name || '업무',
        status: '마감',
        kind: 'task' as const,
        original: task,
      })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const goalTotal = Math.max(activeTasks.length + allDoneTodos.length, 1);
  const completionRate = Math.min(100, Math.round((allDoneTodos.length / goalTotal) * 100));
  const todoTotal = Math.max(visibleTodos.length, 1);
  const todoCompletionRate = Math.min(100, Math.round((doneTodos.length / todoTotal) * 100));

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;
    await createPersonalTodo({ title: todoTitle.trim(), due_date: todoDueDate, priority: 'normal', status: 'todo' });
    setTodoTitle('');
    await load();
  };

  const updateTodoPriorityValue = async (todo: PersonalTodo, priority: PersonalTodo['priority']) => {
    await updatePersonalTodo(todo.id, { priority });
    setPriorityPickerTodoId(null);
    await load();
  };

  const moveTodo = async (todo: PersonalTodo, status: PersonalTodo['status']) => {
    await updatePersonalTodo(todo.id, { status });
    await load();
  };

  const openTask = async (task: AssignedTask) => {
    if (task.project) await selectProject(task.project);
    setView('projects_tasks');
  };

  const openMeeting = async (meeting: Meeting) => {
    const project = projects.find((item) => item.id === meeting.project_id);
    if (project) await selectProject(project);
    setView('projects_meetings');
  };

  const openMinutes = (meeting: Meeting) => {
    setMinutesMeeting(meeting);
  };

  const markAllRead = async () => {
    await Promise.all(unread.map((item) => markNotificationRead(item.id)));
    await load();
  };

  return (
    <div className="h-full overflow-y-auto pr-1 text-left flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">나의 업무</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">내 업무, 회의, 개인 투두, 알림을 한 화면에서 확인합니다.</p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black flex items-center gap-2 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryMetric icon={<ListTodo className="w-5 h-5" />} title="내 업무" value={activeTasks.length} sub="진행 중인 업무">
          <div>
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 mb-2">
              <span>이번 주 완료 목표</span>
              <span className="text-toss-blue">{allDoneTodos.length} / {goalTotal}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-toss-blue rounded-full" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </SummaryMetric>
        <SummaryMetric icon={<Calendar className="w-5 h-5" />} title="예정 회의" value={upcomingMeetings.length} sub={`오늘 ${todayMeetings.length}건 · 이번 주 ${meetings.filter((meeting) => dayDiff(meeting.start_date) <= 7 && dayDiff(meeting.start_date) >= 0).length}건`}>
          <p className="text-[11px] font-bold text-slate-500 truncate">
            다음 회의 <span className="text-toss-blue font-black ml-2">{nextMeeting ? nextMeeting.start_time : '-'}</span> {nextMeeting?.title || '예정 없음'}
          </p>
        </SummaryMetric>
        <SummaryMetric icon={<CheckCircle2 className="w-5 h-5" />} title="개인 투두" value={openTodos.length} sub={`완료 ${allDoneTodos.length} / 전체 ${todos.length}`}>
          <p className="text-[11px] font-black text-rose-500">오늘 마감 {urgentTodos.length}건</p>
        </SummaryMetric>
        <SummaryMetric icon={<Bell className="w-5 h-5" />} title="읽지 않은 알림" value={unread.length} sub="새로운 알림">
          <button onClick={markAllRead} disabled={unread.length === 0} className="text-[11px] font-black text-toss-blue disabled:text-slate-300 flex items-center gap-1 cursor-pointer">
            모두 읽기 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </SummaryMetric>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">오늘 업무 흐름</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-1">핵심 업무, 회의, 일정, 집중 시간을 한 번에 봅니다.</p>
            </div>
            <button onClick={() => setView('projects_calendar')} className="text-xs font-black text-slate-400 hover:text-toss-blue cursor-pointer">전체 일정 보기</button>
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 min-h-[270px] flex flex-col">
              <PanelHeader title="오늘의 핵심 업무" action="전체 보기" onAction={() => setView('projects_tasks')} />
              <div className="mt-4 flex-1 min-h-0 max-h-[260px] overflow-y-auto pr-1 flex flex-col gap-2">
                {coreTasks.length === 0 ? <Empty text="오늘 확인할 업무가 없습니다." /> : coreTasks.map((task, index) => (
                  <button key={task.id} onClick={() => openTask(task)} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer">
                    <div className="grid grid-cols-[1fr_54px] gap-3 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0" />
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{task.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${taskPriorityClass(task.priority)}`}>{taskPriorityLabel(task.priority)}</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-2 truncate">{task.project?.name || '프로젝트 없음'} <ChevronRight className="inline w-3 h-3" /> {task.process_name || '프로세스'}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1"><CalendarClock className="inline w-3 h-3 mr-1" />{formatDateLabel(task.end_date)} · {task.end_time || '18:00'} 마감</p>
                      </div>
                      <ProgressRing value={index === 0 ? 65 : index === 1 ? 40 : 20} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 min-h-[270px] flex flex-col">
              <PanelHeader title="다가오는 회의" action="회의 보기" onAction={() => setView('projects_meetings')} />
              <div className="mt-4 flex-1 min-h-0 max-h-[260px] overflow-y-auto pr-1 flex flex-col gap-4">
                {upcomingMeetings.length === 0 ? <Empty text="예정된 회의가 없습니다." /> : upcomingMeetings.slice(0, 4).map((meeting) => (
                  <div key={meeting.id} className="grid grid-cols-[46px_1fr_auto] gap-3 items-start">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200">{meeting.start_time}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">{formatDateLabel(meeting.start_date)}</p>
                    </div>
                    <div className="relative pl-5 min-w-0">
                      <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-toss-blue ring-4 ring-blue-50 dark:ring-blue-950/30" />
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{meeting.title}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">{meeting.project_name || meeting.location || '회의'} · {formatMeetingTime(meeting)}</p>
                      <AvatarInitials names={meeting.attendee_names || meeting.attendees} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { await respondMeeting(meeting.id, 'accepted'); await load(); }} className="px-3 py-2 rounded-lg bg-toss-blue text-white text-xs font-black cursor-pointer">참석</button>
                      <button onClick={() => openMinutes(meeting)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black cursor-pointer">회의록</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 min-h-[220px] flex flex-col">
              <PanelHeader title="오늘 일정" action="캘린더 보기" onAction={() => setView('projects_calendar')} />
              <div className="mt-4 border-l-2 border-toss-blue/70 pl-4 flex-1 min-h-0 max-h-[210px] overflow-y-auto pr-1 flex flex-col gap-3">
                {todaySchedule.length === 0 ? <Empty text="오늘 일정이 없습니다." /> : todaySchedule.slice(0, 6).map((item) => (
                  <button key={item.id} onClick={() => item.kind === 'meeting' ? openMeeting(item.original as Meeting) : openTask(item.original as AssignedTask)} className="grid grid-cols-[82px_1fr_auto] gap-3 items-start text-left cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 p-2 -ml-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.time}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 dark:text-slate-100 truncate">{item.title}</span>
                      <span className="block text-[11px] font-bold text-slate-400 mt-1 truncate">{item.sub}</span>
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-toss-blue text-[10px] font-black">{item.status}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4 min-h-[220px] flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">집중 시간 제안</h3>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-3">오늘 10:00 - 12:00</p>
                <p className="text-[11px] font-bold text-slate-500 mt-1">회의 없는 집중 시간을 제안드려요.</p>
              </div>
              <button className="self-start px-3 py-2 rounded-lg border border-toss-blue text-toss-blue bg-white dark:bg-slate-900 text-xs font-black cursor-pointer">집중 시간 추가</button>
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm min-h-[560px] flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">개인 투두</h3>
            <div className="flex items-center gap-2">
              <CustomDatePicker value={todoDueDate} onChange={setTodoDueDate} compact className="w-36" />
              <button form="my-work-todo-form" type="submit" className="w-9 h-9 rounded-lg bg-toss-blue text-white flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <form id="my-work-todo-form" onSubmit={addTodo} className="mt-4 flex flex-col gap-2">
            <input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="할 일을 입력하세요" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold outline-none" />
          </form>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
              <span>{todoWeekStart.getFullYear()}년 {todoWeekStart.getMonth() + 1}월 · {todoWeekStart.getDate()}일 - {todoWeekDays[6].getDate()}일</span>
              <div className="flex gap-1">
                <button onClick={() => { setTodoWeekStart((prev) => addDays(prev, -7)); setSelectedTodoDate(null); setTodoRangeFilter('week'); }} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850" aria-label="이전 주">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <button onClick={() => { setTodoWeekStart((prev) => addDays(prev, 7)); setSelectedTodoDate(null); setTodoRangeFilter('week'); }} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850" aria-label="다음 주">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-850 p-1 mb-3">
              <button
                onClick={() => { setSelectedTodoDate(null); setTodoRangeFilter('all'); }}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${selectedTodoDate === null && todoRangeFilter === 'all' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                전체 기간 {todos.length}
              </button>
              <button
                onClick={() => { setSelectedTodoDate(null); setTodoRangeFilter('week'); }}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${selectedTodoDate === null && todoRangeFilter === 'week' ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                이번 주 {todos.filter((todo) => todo.due_date && todo.due_date >= todoWeekStartStr && todo.due_date <= todoWeekEndStr).length}
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {todoWeekDays.map((date) => {
                const dateStr = formatDateKey(date);
                const dayTodos = todosByDate[dateStr] || [];
                const active = selectedTodoDate === dateStr;
                const todayActive = dateStr === today;
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedTodoDate(dateStr); setTodoRangeFilter('week'); }}
                    className={`relative h-11 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer ${active ? 'border-toss-blue bg-blue-50/80 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                  >
                    <span className="text-[10px] font-black text-slate-400 leading-none">{['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}</span>
                    <span className={`mt-1 text-xs font-black leading-none ${todayActive || active ? 'text-toss-blue' : 'text-slate-700 dark:text-slate-200'}`}>{date.getDate()}</span>
                    {dayTodos.length > 0 && <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-toss-blue" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-850 p-3">
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 mb-2">
              <span>투두 진행도</span>
              <span className="text-toss-blue">{doneTodos.length} / {todos.length}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-toss-blue rounded-full transition-all" style={{ width: `${todoCompletionRate}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-slate-500">
              <span>진행 {openTodos.length}</span>
              <span>완료 {doneTodos.length}</span>
              <span>오늘 마감 {urgentTodos.length}</span>
            </div>
          </div>
          <div className="mt-4 flex-1 min-h-0 flex flex-col gap-4">
            {openTodos.length === 0 && doneTodos.length === 0 ? <Empty text="개인 투두가 없습니다." /> : (
              <>
                <TodoPreviewGroup
                  title="예정"
                  todos={openTodos}
                  emptyText="예정 투두가 없습니다."
                  onToggle={(todo) => moveTodo(todo, 'done')}
                  priorityPickerTodoId={priorityPickerTodoId}
                  onPriorityOpen={setPriorityPickerTodoId}
                  onPriorityChange={updateTodoPriorityValue}
                />
                <TodoPreviewGroup
                  title="완료"
                  todos={doneTodos}
                  emptyText="완료된 투두가 없습니다."
                  done
                  onToggle={(todo) => moveTodo(todo, 'todo')}
                  priorityPickerTodoId={priorityPickerTodoId}
                  onPriorityOpen={setPriorityPickerTodoId}
                  onPriorityChange={updateTodoPriorityValue}
                />
              </>
            )}
          </div>
          <FooterLink label="투두 전체 보기" onClick={() => setTodoListOpen(true)} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm max-h-[320px] flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">알림 센터</h3>
              {unread.length > 0 && <span className="px-2 py-1 rounded-full bg-blue-50 text-toss-blue text-[11px] font-black">{unread.length}개 읽지 않음</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={markAllRead} className="text-xs font-black text-toss-blue cursor-pointer disabled:text-slate-300" disabled={unread.length === 0}>모두 읽기</button>
              <button className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"><Filter className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1 border-b border-slate-100 dark:border-slate-800">
            {[
              { key: 'all' as NotificationFilter, label: '전체', count: notifications.length },
              { key: 'comment' as NotificationFilter, label: '멘션', count: notifications.filter((item) => item.type === 'comment').length },
              { key: 'task' as NotificationFilter, label: '업무', count: notifications.filter((item) => item.type === 'task').length },
              { key: 'meeting' as NotificationFilter, label: '회의', count: notifications.filter((item) => item.type === 'meeting').length },
              { key: 'system' as NotificationFilter, label: '시스템', count: notifications.filter((item) => item.type === 'system').length },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setNotificationFilter(tab.key)} className={`px-2 py-2 text-xs font-black border-b-2 cursor-pointer ${notificationFilter === tab.key ? 'border-toss-blue text-toss-blue' : 'border-transparent text-slate-500'}`}>
                {tab.label} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto pr-1">
            {filteredNotifications.length === 0 ? <Empty text="알림이 없습니다." /> : filteredNotifications.slice(0, 3).map((item) => (
              <button key={item.id} onClick={async () => { await markNotificationRead(item.id); await load(); }} className="w-full py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notificationColor(item.type)}`}>{notificationIcon(item.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.title}</span>
                  {item.body && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.body}</span>}
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 shrink-0">{item.type}</span>
                <span className="text-[11px] font-bold text-slate-400 shrink-0">{formatDateLabel(item.created_at.slice(0, 10))}</span>
                {!item.read_at && <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0" />}
              </button>
            ))}
          </div>
          <FooterLink label="알림 센터 전체 보기" onClick={() => setNotificationListOpen(true)} />
        </section>
      </div>

      {minutesMeeting && (
        <MeetingMinutesModal
          meeting={minutesMeeting}
          onClose={() => setMinutesMeeting(null)}
          onSaved={async (updated) => {
            if (updated) setMinutesMeeting(updated);
            await load();
          }}
        />
      )}

      {todoListOpen && (
        <ModalOverlay onClose={() => setTodoListOpen(false)} zIndex={9400}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl max-h-[82vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-toss-lg flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">투두 전체 보기</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">미완료 {allOpenTodos.length}건 · 완료 {allDoneTodos.length}건</p>
              </div>
              <button onClick={() => setTodoListOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-hidden">
              <TodoGroup
                title="예정"
                todos={allOpenTodos}
                emptyText="예정 투두가 없습니다."
                onToggle={(todo) => moveTodo(todo, 'done')}
                priorityPickerTodoId={priorityPickerTodoId}
                onPriorityOpen={setPriorityPickerTodoId}
                onPriorityChange={updateTodoPriorityValue}
              />
              <TodoGroup
                title="완료"
                todos={allDoneTodos}
                emptyText="완료된 투두가 없습니다."
                done
                onToggle={(todo) => moveTodo(todo, 'todo')}
                priorityPickerTodoId={priorityPickerTodoId}
                onPriorityOpen={setPriorityPickerTodoId}
                onPriorityChange={updateTodoPriorityValue}
              />
            </div>
          </div>
        </ModalOverlay>
      )}

      {notificationListOpen && (
        <ModalOverlay onClose={() => setNotificationListOpen(false)} zIndex={9400}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[82vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-toss-lg flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">알림 센터 전체 보기</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">현재 필터 기준 {filteredNotifications.length}건 · 읽지 않음 {unread.length}건</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={markAllRead} disabled={unread.length === 0} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-black text-toss-blue disabled:text-slate-300 cursor-pointer">모두 읽기</button>
                <button onClick={() => setNotificationListOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-5 pt-4 flex items-center gap-1 border-b border-slate-100 dark:border-slate-800">
              {[
                { key: 'all' as NotificationFilter, label: '전체', count: notifications.length },
                { key: 'comment' as NotificationFilter, label: '멘션', count: notifications.filter((item) => item.type === 'comment').length },
                { key: 'task' as NotificationFilter, label: '업무', count: notifications.filter((item) => item.type === 'task').length },
                { key: 'meeting' as NotificationFilter, label: '회의', count: notifications.filter((item) => item.type === 'meeting').length },
                { key: 'system' as NotificationFilter, label: '시스템', count: notifications.filter((item) => item.type === 'system').length },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setNotificationFilter(tab.key)} className={`px-4 py-2.5 text-xs font-black border-b-2 cursor-pointer ${notificationFilter === tab.key ? 'border-toss-blue text-toss-blue' : 'border-transparent text-slate-500'}`}>
                  {tab.label} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="p-5 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredNotifications.length === 0 ? <Empty text="알림이 없습니다." /> : filteredNotifications.map((item) => (
                <NotificationRow key={item.id} item={item} onClick={async () => { await markNotificationRead(item.id); await load(); }} />
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

const todoPriorityOptions: { key: PersonalTodo['priority']; label: string }[] = [
  { key: 'low', label: '낮음' },
  { key: 'normal', label: '보통' },
  { key: 'high', label: '높음' },
  { key: 'urgent', label: '긴급' },
];

const TodoPriorityPicker = ({ todo, openId, onOpen, onChange }: { todo: PersonalTodo; openId: string | null; onOpen: (id: string | null) => void; onChange: (todo: PersonalTodo, priority: PersonalTodo['priority']) => void | Promise<void> }) => (
  <span className="relative shrink-0">
    <button onClick={() => onOpen(openId === todo.id ? null : todo.id)} className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer ${taskPriorityClass(todo.priority)}`} title="중요도 선택">
      {taskPriorityLabel(todo.priority)}
    </button>
    {openId === todo.id && (
      <span className="absolute left-0 top-[calc(100%+6px)] z-30 w-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-toss-lg p-1 flex flex-col gap-1">
        {todoPriorityOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(todo, option.key)}
            className={`px-2 py-1.5 rounded-lg text-left text-[11px] font-black cursor-pointer ${todo.priority === option.key ? 'bg-blue-50 dark:bg-blue-950/30 text-toss-blue' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
          >
            {option.label}
          </button>
        ))}
      </span>
    )}
  </span>
);

const TodoPreviewGroup = ({ title, todos, emptyText, done = false, onToggle, priorityPickerTodoId, onPriorityOpen, onPriorityChange }: { title: string; todos: PersonalTodo[]; emptyText: string; done?: boolean; onToggle: (todo: PersonalTodo) => void | Promise<void>; priorityPickerTodoId: string | null; onPriorityOpen: (id: string | null) => void; onPriorityChange: (todo: PersonalTodo, priority: PersonalTodo['priority']) => void | Promise<void> }) => (
  <section className="flex flex-col gap-2 min-h-0">
    <div className="flex items-center justify-between">
      <h4 className="text-[11px] font-black text-slate-500">{title}</h4>
      <span className="text-[10px] font-black text-slate-400">{todos.length}건</span>
    </div>
    <div className="max-h-[190px] overflow-y-auto pr-1 flex flex-col gap-2">
      {todos.length === 0 ? <Empty text={emptyText} /> : todos.map((todo) => (
        <div key={todo.id} className={`flex items-center gap-3 text-left ${done ? 'opacity-75 hover:opacity-100' : ''}`}>
          <button onClick={() => onToggle(todo)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${done ? 'border-toss-blue bg-toss-blue' : 'border-slate-300 dark:border-slate-700 hover:border-toss-blue'}`} aria-label={done ? '완료 취소' : '투두 완료'}>
            {done && <Check className="w-3 h-3 text-white" />}
          </button>
          <TodoPriorityPicker todo={todo} openId={priorityPickerTodoId} onOpen={onPriorityOpen} onChange={onPriorityChange} />
          <span className="min-w-0 flex-1">
            <span className={`block text-xs font-black truncate ${done ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{todo.title}</span>
            {todo.project_name && <span className="block text-[10px] font-bold text-slate-400 mt-0.5 truncate">{todo.project_name}</span>}
          </span>
          <span className={`text-[11px] font-black ${!done && dayDiff(todo.due_date) <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>{formatDateLabel(todo.due_date)}</span>
        </div>
      ))}
    </div>
  </section>
);

const TodoGroup = ({ title, todos, emptyText, done = false, onToggle, priorityPickerTodoId, onPriorityOpen, onPriorityChange }: { title: string; todos: PersonalTodo[]; emptyText: string; done?: boolean; onToggle: (todo: PersonalTodo) => void | Promise<void>; priorityPickerTodoId: string | null; onPriorityOpen: (id: string | null) => void; onPriorityChange: (todo: PersonalTodo, priority: PersonalTodo['priority']) => void | Promise<void> }) => (
  <section className="min-h-0 rounded-xl bg-slate-50/70 dark:bg-slate-850/40 p-4 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h4>
      <span className="text-[11px] font-black text-slate-400">{todos.length}건</span>
    </div>
    <div className="min-h-0 overflow-y-auto pr-1 divide-y divide-slate-200/70 dark:divide-slate-800">
    {todos.length === 0 ? <Empty text={emptyText} /> : todos.map((todo) => (
      <div key={todo.id} className={`flex items-center gap-3 text-left py-3 ${done ? 'opacity-75' : ''}`}>
        <button onClick={() => onToggle(todo)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${done ? 'border-toss-blue bg-toss-blue' : 'border-slate-300 dark:border-slate-700 hover:border-toss-blue'}`} aria-label={done ? '완료 취소' : '투두 완료'}>
          {done && <Check className="w-3 h-3 text-white" />}
        </button>
        <TodoPriorityPicker todo={todo} openId={priorityPickerTodoId} onOpen={onPriorityOpen} onChange={onPriorityChange} />
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-black truncate ${done ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{todo.title}</span>
          <span className="block text-[10px] font-bold text-slate-400 mt-0.5 truncate">{todo.project_name || todo.meeting_title || todo.task_title || '개인 투두'}</span>
        </span>
        <span className={`text-[11px] font-black ${!done && dayDiff(todo.due_date) <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>{formatDateLabel(todo.due_date)}</span>
      </div>
    ))}
    </div>
  </section>
);

const NotificationRow = ({ item, onClick }: { item: AppNotification; onClick: () => void | Promise<void> }) => (
  <button onClick={onClick} className="w-full py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850">
    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notificationColor(item.type)}`}>{notificationIcon(item.type)}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.title}</span>
      {item.body && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.body}</span>}
    </span>
    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 shrink-0">{item.type}</span>
    <span className="text-[11px] font-bold text-slate-400 shrink-0">{formatDateLabel(item.created_at.slice(0, 10))}</span>
    {!item.read_at && <span className="w-2 h-2 rounded-full bg-toss-blue shrink-0" />}
  </button>
);

const SummaryMetric = ({ icon, title, value, sub, children }: { icon: React.ReactNode; title: string; value: number; sub: string; children?: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[150px] flex flex-col justify-between">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-toss-blue flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{title}</p>
        <p className="text-3xl font-black text-slate-950 dark:text-slate-50 mt-1">{value}</p>
        <p className="text-xs font-bold text-slate-400 mt-2">{sub}</p>
      </div>
    </div>
    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">{children}</div>
  </section>
);

const PanelHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="flex items-center justify-between gap-3">
    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>
    {action && <button onClick={onAction} className="text-xs font-black text-slate-400 hover:text-toss-blue cursor-pointer">{action}</button>}
  </div>
);

const ProgressRing = ({ value }: { value: number }) => (
  <div
    className="w-12 h-12 rounded-full flex items-center justify-center text-[11px] font-black text-slate-700 dark:text-slate-200"
    style={{ background: `conic-gradient(#3182f6 ${value * 3.6}deg, #e5e7eb 0deg)` }}
  >
    <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">{value}%</div>
  </div>
);

const AvatarInitials = ({ names }: { names: string[] }) => (
  <div className="flex -space-x-2 mt-2">
    {names.slice(0, 4).map((name, index) => (
      <span key={`${name}-${index}`} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 text-[9px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-center">
        {name.slice(0, 2).toUpperCase()}
      </span>
    ))}
    {names.length > 4 && <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 text-[9px] font-black text-slate-500 flex items-center justify-center">+{names.length - 4}</span>}
  </div>
);

const FooterLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="mt-4 text-xs font-black text-toss-blue flex items-center gap-1 cursor-pointer">
    {label}
    <ChevronRight className="w-3.5 h-3.5" />
  </button>
);

const Empty = ({ text }: { text: string }) => (
  <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-slate-400">{text}</div>
);
