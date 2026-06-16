import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, Circle, ListTodo, Plus, RefreshCw } from 'lucide-react';
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

interface AssignedTask extends Task {
  project?: Project;
  process_name?: string;
}

export const MyWorkView: React.FC = () => {
  const { user } = useAuthStore();
  const { projects, setView, selectProject } = useProjectStore();
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDueDate, setTodoDueDate] = useState(new Date().toISOString().slice(0, 10));
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

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = useMemo(() => tasks.filter((task) => !task.end_date || task.end_date >= today), [tasks, today]);
  const upcomingMeetings = useMemo(() => meetings.filter((meeting) => meeting.start_date >= today).slice(0, 8), [meetings, today]);
  const openTodos = useMemo(() => todos.filter((todo) => todo.status !== 'done'), [todos]);
  const unread = notifications.filter((item) => !item.read_at);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;
    await createPersonalTodo({ title: todoTitle.trim(), due_date: todoDueDate, priority: 'normal', status: 'todo' });
    setTodoTitle('');
    await load();
  };

  return (
    <div className="h-full overflow-y-auto pr-1 text-left flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">My Work</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">내 업무, 회의, 개인 투두, 알림을 한 곳에서 확인합니다.</p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black flex items-center gap-2 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric icon={<ListTodo className="w-4 h-4" />} label="내 업무" value={todayTasks.length} />
        <Metric icon={<CalendarClock className="w-4 h-4" />} label="예정 회의" value={upcomingMeetings.length} />
        <Metric icon={<CheckCircle2 className="w-4 h-4" />} label="개인 투두" value={openTodos.length} />
        <Metric icon={<Bell className="w-4 h-4" />} label="읽지 않은 알림" value={unread.length} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="text-sm font-black">나에게 할당된 업무</h3>
          {todayTasks.length === 0 ? <Empty text="할당된 업무가 없습니다." /> : todayTasks.slice(0, 8).map((task) => (
            <button
              key={task.id}
              onClick={async () => {
                if (task.project) await selectProject(task.project);
                setView('projects_tasks');
              }}
              className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">{task.title}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">{task.project?.name} / {task.process_name}</div>
              <div className="text-[10px] font-bold text-toss-blue mt-2">{task.start_date || '시작일 미정'} - {task.end_date || '마감일 미정'}</div>
            </button>
          ))}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="text-sm font-black">회의</h3>
          {upcomingMeetings.length === 0 ? <Empty text="예정된 회의가 없습니다." /> : upcomingMeetings.map((meeting) => (
            <div key={meeting.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850">
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">{meeting.title}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">{meeting.project_name || meeting.project_id}</div>
              <div className="text-[10px] font-bold text-toss-blue mt-2">{meeting.start_date} {meeting.start_time}</div>
              <div className="flex gap-2 mt-3">
                <button onClick={async () => { await respondMeeting(meeting.id, 'accepted'); await load(); }} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black cursor-pointer">참석</button>
                <button onClick={async () => { await respondMeeting(meeting.id, 'declined'); await load(); }} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black cursor-pointer">불참</button>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="text-sm font-black">개인 투두</h3>
          <form onSubmit={addTodo} className="flex gap-2">
            <input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="할 일 추가" className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-xs font-bold outline-none" />
            <input type="date" value={todoDueDate} onChange={(e) => setTodoDueDate(e.target.value)} className="w-36 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-xs font-bold outline-none" />
            <button type="submit" className="p-2 rounded-xl bg-toss-blue text-white cursor-pointer"><Plus className="w-4 h-4" /></button>
          </form>
          {openTodos.length === 0 ? <Empty text="개인 투두가 없습니다." /> : openTodos.map((todo) => (
            <button key={todo.id} onClick={async () => { await updatePersonalTodo(todo.id, { status: 'done' }); await load(); }} className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 text-left cursor-pointer">
              <Circle className="w-4 h-4 mt-0.5 text-slate-400" />
              <div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-100">{todo.title}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">{todo.due_date || '마감일 없음'}</div>
              </div>
            </button>
          ))}
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black">알림</h3>
          <span className="text-xs font-black text-toss-blue">{unread.length} unread</span>
        </div>
        {notifications.length === 0 ? <Empty text="알림이 없습니다." /> : notifications.slice(0, 10).map((item) => (
          <button key={item.id} onClick={async () => { await markNotificationRead(item.id); await load(); }} className={`text-left p-3 rounded-xl border cursor-pointer ${item.read_at ? 'bg-slate-50/60 dark:bg-slate-850/60 border-transparent opacity-70' : 'bg-toss-blue/5 dark:bg-toss-blue/10 border-toss-blue/20'}`}>
            <div className="text-xs font-black text-slate-800 dark:text-slate-100">{item.title}</div>
            {item.body && <div className="text-[10px] font-bold text-slate-400 mt-1">{item.body}</div>}
          </button>
        ))}
      </section>
    </div>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-black text-slate-400">{icon}{label}</div>
    <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">{value}</div>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-slate-400">{text}</div>
);
