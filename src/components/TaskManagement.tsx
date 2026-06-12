import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import * as api from '../utils/api';
import {
  Plus, Trash2, ArrowLeft, ArrowRight, Edit, ClipboardList,
  Clock, X, Check, MessageSquare, ListTodo, CalendarDays,
  Users, ChevronRight, Loader2, UserPlus, Search,
  CheckSquare, History, Timer,
} from 'lucide-react';
import type { Task, SubTask, WorkLog, User } from '../types';
import { RangeDatePicker } from './RangeDatePicker';
import { CustomTimePicker } from './CustomTimePicker';
import { CommentPanel } from './CommentPanel';

// ─── 유틸 ─────────────────────────────────────────────────────
function getRemainingDays(endDate?: string) {
  if (!endDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}일 초과`, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40' };
  if (diff === 0) return { label: '오늘 마감', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' };
  if (diff <= 5) return { label: `D-${diff}`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' };
  return { label: `D-${diff}`, color: 'text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60' };
}

function getInitials(name: string) { return name?.slice(0, 2) || '?'; }
const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-pink-500','bg-indigo-500','bg-teal-500','bg-rose-500'];
function avatarBg(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }

// ─── 담당자 선택 팝업 ─────────────────────────────────────────
interface AssigneeSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[], names: string[]) => void;
  onClose: () => void;
  users: User[];
}
const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({ selectedIds, onChange, onClose, users }) => {
  const [search, setSearch] = useState('');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedIds);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const filtered = users.filter(u =>
    u.name.includes(search) || (u.department || '').includes(search) || u.username.includes(search)
  );

  const toggle = (u: User) => {
    setTempSelectedIds(prev => 
      prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
    );
  };

  const handleConfirm = () => {
    const newNames = users.filter(usr => tempSelectedIds.includes(usr.id)).map(usr => usr.name);
    onChange(tempSelectedIds, newNames);
    onClose();
  };

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[9999] w-72 overflow-hidden animate-scale-in">
      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름·부서 검색"
            className="flex-1 text-xs bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
          />
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-4">검색 결과 없음</p>
        ) : filtered.map(u => {
          const sel = tempSelectedIds.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                toggle(u);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${sel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <div className={`w-7 h-7 rounded-full ${avatarBg(u.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                {getInitials(u.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{u.name}</p>
                <p className="text-[10px] text-slate-400">{[u.department, u.position].filter(Boolean).join(' · ')}</p>
              </div>
              {sel && <Check className="w-3.5 h-3.5 text-toss-blue shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-2 bg-toss-blue hover:bg-toss-blue-dark text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
        >
          확인
        </button>
      </div>
    </div>
  );
};

// ─── 체크리스트 (세부 업무) ────────────────────────────────────
interface ChecklistPanelProps {
  taskId: string;
  serverMode: boolean;
}
const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ taskId, serverMode }) => {
  const [items, setItems] = useState<SubTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.getSubTasks(serverMode, taskId)); }
    finally { setLoading(false); }
  }, [taskId, serverMode]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    try {
      const s = await api.createSubTask(serverMode, { task_id: taskId, title: input.trim() });
      setItems(prev => [...prev, s]);
      setInput('');
      inputRef.current?.focus();
    } finally { setAdding(false); }
  };

  const handleToggle = async (item: SubTask) => {
    const updated = await api.updateSubTask(serverMode, item.id, { done: !item.done });
    if (updated) setItems(prev => prev.map(s => s.id === item.id ? { ...s, done: !s.done } : s));
  };

  const handleDelete = async (id: string) => {
    await api.deleteSubTask(serverMode, id);
    setItems(prev => prev.filter(s => s.id !== id));
  };

  const handleEditSave = async (item: SubTask) => {
    if (!editText.trim()) return;
    const updated = await api.updateSubTask(serverMode, item.id, { title: editText.trim() });
    if (updated) setItems(prev => prev.map(s => s.id === item.id ? { ...s, title: editText.trim() } : s));
    setEditingId(null);
  };

  const done = items.filter(s => s.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 진행률 헤더 */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {done}/{items.length}개 완료
            </span>
            <span className="text-[11px] font-extrabold text-toss-blue">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct === 100 ? 'bg-emerald-500' : 'bg-toss-blue'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* 체크리스트 항목들 */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-slate-300 dark:text-slate-600 select-none">
          <CheckSquare className="w-8 h-8" />
          <p className="text-xs font-semibold">체크리스트가 비어있습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/60 overflow-hidden">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 group transition-colors ${
                item.done
                  ? 'bg-slate-50/70 dark:bg-slate-800/30'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
              }`}
            >
              {/* 번호 */}
              <span className="text-[11px] font-bold text-slate-300 dark:text-slate-600 w-5 text-center shrink-0">
                {idx + 1}
              </span>

              {/* 체크박스 */}
              <button
                onClick={() => handleToggle(item)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  item.done
                    ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                    : 'border-slate-300 dark:border-slate-600 hover:border-toss-blue dark:hover:border-toss-blue/70'
                }`}
              >
                {item.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </button>

              {/* 제목 / 인라인 편집 */}
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditSave(item);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleEditSave(item)}
                  className="flex-1 text-sm bg-transparent border-b-2 border-toss-blue outline-none text-slate-800 dark:text-slate-100 font-medium"
                />
              ) : (
                <span
                  onDoubleClick={() => { setEditingId(item.id); setEditText(item.title); }}
                  className={`flex-1 text-sm font-medium cursor-text select-text ${
                    item.done
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                  title="더블클릭하여 편집"
                >
                  {item.title}
                </span>
              )}

              {/* 삭제 */}
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 항목 추가 입력 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-toss-blue/30 focus-within:border-toss-blue transition-all">
          <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="항목 추가 후 Enter"
            className="flex-1 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-medium"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-extrabold hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          추가
        </button>
      </div>
    </div>
  );
};

// ─── 업무 이력 패널 ───────────────────────────────────────────
interface WorkLogPanelProps {
  taskId: string;
  serverMode: boolean;
}
const WorkLogPanel: React.FC<WorkLogPanelProps> = ({ taskId, serverMode }) => {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [hours, setHours] = useState<string>('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLogs(await api.getWorkLogs(serverMode, taskId)); }
    finally { setLoading(false); }
  }, [taskId, serverMode]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const log = await api.createWorkLog(serverMode, {
        task_id: taskId,
        content: content.trim(),
        hours: hours ? parseFloat(hours) : null,
        log_date: logDate,
      });
      setLogs(prev => [log, ...prev]);
      setContent('');
      setHours('');
      setShowForm(false);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    await api.deleteWorkLog(serverMode, id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const totalHours = logs.reduce((sum, l) => sum + (l.hours || 0), 0);

  function getInitials(name: string) { return name?.slice(0, 2) || '?'; }
  const AVATAR_COLORS_LOG = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-pink-500','bg-indigo-500','bg-teal-500','bg-rose-500'];
  function avatarBgLog(name: string) { return AVATAR_COLORS_LOG[(name?.charCodeAt(0) || 0) % AVATAR_COLORS_LOG.length]; }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 통계 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              총 <span className="text-toss-blue">{logs.length}</span>건
            </span>
          </div>
          {totalHours > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/40">
              <Timer className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                누적 {totalHours.toFixed(1)}h
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            showForm
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              : 'bg-toss-blue text-white hover:bg-blue-600'
          }`}
        >
          {showForm ? <><X className="w-3.5 h-3.5" />닫기</> : <><Plus className="w-3.5 h-3.5" />이력 등록</>}
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4 flex flex-col gap-3 animate-scale-in"
        >
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-0.5">
            <History className="w-3.5 h-3.5 text-toss-blue" />
            업무 이력 등록
          </div>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500">수행일자</label>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                required
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500">작업 시간 (선택)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  min={0}
                  max={24}
                  step={0.5}
                  placeholder="0.0"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue"
                />
                <span className="text-xs font-bold text-slate-400 shrink-0">h</span>
              </div>
            </div>
          </div>

          {/* 수행 내용 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500">수행 내용 *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="어떤 업무를 수행했는지 작성하세요..."
              rows={3}
              required
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue resize-none leading-relaxed"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-4 py-2 rounded-xl bg-toss-blue text-white text-xs font-extrabold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              등록
            </button>
          </div>
        </form>
      )}

      {/* 이력 목록 */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-300 dark:text-slate-600 select-none">
          <History className="w-8 h-8" />
          <p className="text-xs font-semibold">등록된 업무 이력이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map(log => (
            <div
              key={log.id}
              className="flex gap-3 group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* 아바타 */}
              <div className={`w-8 h-8 rounded-full ${avatarBgLog(log.author_name || '?')} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                {getInitials(log.author_name || '?')}
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                {/* 작성자 + 메타 */}
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
                    {log.author_name || '알 수 없음'}
                  </span>
                  {[log.author_department, log.author_position].filter(Boolean).map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-semibold rounded-md border border-slate-200/60 dark:border-slate-700/60">
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <CalendarDays className="w-3 h-3" />
                    {log.log_date}
                  </span>
                  {log.hours && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold rounded-full border border-amber-200 dark:border-amber-800/40">
                      <Timer className="w-3 h-3" />{log.hours}h
                    </span>
                  )}
                </div>

                {/* 수행 내용 */}
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {log.content}
                </p>
              </div>

              {/* 삭제 */}
              <button
                onClick={() => handleDelete(log.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all cursor-pointer shrink-0 self-start"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 작업 상세 슬라이드 패널 ───────────────────────────────────
interface TaskDetailPanelProps {
  task: Task;
  projectId: string;
  serverMode: boolean;
  users: User[];
  onClose: () => void;
  onUpdate: (task: Task) => void;
}
const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ task, projectId, serverMode, users, onClose, onUpdate }) => {
  const [tab, setTab] = useState<'checklist' | 'worklog' | 'comments'>('checklist');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description || '');
  const [editStartDate, setEditStartDate] = useState(task.start_date || '');
  const [editEndDate, setEditEndDate] = useState(task.end_date || '');
  const [editStartTime, setEditStartTime] = useState(task.start_time || '');
  const [editEndTime, setEditEndTime] = useState(task.end_time || '');
  const [showAssigneeSelector, setShowAssigneeSelector] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees || (task.assignee ? [task.assignee] : []));
  const [assigneeNames, setAssigneeNames] = useState<string[]>(task.assignee_names || (task.assignee ? [task.assignee] : []));

  const priorityColor = task.priority === '긴급' ? 'text-rose-500 bg-rose-50 border-rose-200'
    : task.priority === '높음' ? 'text-amber-500 bg-amber-50 border-amber-200'
    : 'text-slate-500 bg-slate-100 border-slate-200';

  const statusColor = task.status === '완료' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : task.status === '진행중' ? 'text-toss-blue bg-sky-50 border-sky-200'
    : task.status === '검토중' ? 'text-amber-500 bg-amber-50 border-amber-200'
    : 'text-slate-500 bg-slate-100 border-slate-200';

  const remaining = getRemainingDays(task.end_date);

  const handleSaveAssignees = (ids: string[], names: string[]) => {
    setAssigneeIds(ids);
    setAssigneeNames(names);
    onUpdate({ ...task, assignees: ids, assignee_names: names, assignee: names[0] || '' });
  };

  const handleEditDateChange = (start: string, end: string) => {
    setEditStartDate(start);
    setEditEndDate(end);
    if (start && end && start > end) {
      setEditEndDate(start);
    }
  };

  const handleEditStartTimeChange = (val: string) => {
    setEditStartTime(val);
    if (editStartDate && editEndDate && editStartDate === editEndDate && editEndTime && val > editEndTime) {
      setEditEndTime(val);
    }
  };

  const handleEditEndTimeChange = (val: string) => {
    setEditEndTime(val);
    if (editStartDate && editEndDate && editStartDate === editEndDate && editStartTime && val < editStartTime) {
      setEditStartTime(val);
    }
  };

  const handleSaveEdit = () => {
    if (editStartDate && editEndDate) {
      if (editStartDate > editEndDate) {
        alert('시작일은 종료일보다 늦을 수 없습니다.');
        return;
      }
      if (editStartDate === editEndDate && editStartTime && editEndTime && editStartTime > editEndTime) {
        alert('시작 시간은 종료 시간보다 늦을 수 없습니다.');
        return;
      }
    }
    onUpdate({ 
      ...task, 
      title: editTitle, 
      description: editDesc, 
      assignees: assigneeIds, 
      assignee_names: assigneeNames,
      start_date: editStartDate,
      end_date: editEndDate,
      start_time: editStartTime,
      end_time: editEndTime
    });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditStartDate(task.start_date || '');
    setEditEndDate(task.end_date || '');
    setEditStartTime(task.start_time || '');
    setEditEndTime(task.end_time || '');
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex" onClick={onClose}>
      <div className="flex-1 bg-black/30 backdrop-blur-sm" />
      <div
        className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-slide-in-right overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColor}`}>{task.priority}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>{task.status}</span>
              {remaining && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${remaining.color}`}>
                  <CalendarDays className="w-3 h-3" />{remaining.label}
                </span>
              )}
            </div>
            {editing ? (
              <div className="flex flex-col gap-2 w-full mt-2">
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-lg font-extrabold text-slate-800 dark:text-slate-100 bg-transparent border-b-2 border-toss-blue outline-none w-full"
                  autoFocus
                />
                <div className="w-full max-w-xs mt-1 flex gap-2">
                  <div className="flex-1">
                    <RangeDatePicker
                      startDate={editStartDate}
                      endDate={editEndDate}
                      onChange={handleEditDateChange}
                      placeholder="작업 일정 선택"
                    />
                  </div>
                  <div className="w-28">
                    <CustomTimePicker
                      value={editStartTime}
                      onChange={handleEditStartTimeChange}
                      className="text-xs font-bold py-1 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="w-28">
                    <CustomTimePicker
                      value={editEndTime}
                      onChange={handleEditEndTimeChange}
                      className="text-xs font-bold py-1 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{task.title}</h2>
                {(task.start_date || task.end_date) && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                    <span>{task.start_date || '?'} ~ {task.end_date || '?'}</span>
                    {(task.start_time || task.end_time) && (
                      <span className="text-toss-blue dark:text-sky-400 font-bold ml-1">
                        ({task.start_time || '00:00'} ~ {task.end_time || '24:00'})
                      </span>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {editing ? (
              <>
                <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded-xl bg-toss-blue text-white text-xs font-bold cursor-pointer hover:bg-blue-600">저장</button>
                <button onClick={handleCancelEdit} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">취소</button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setEditTitle(task.title);
                  setEditDesc(task.description || '');
                  setEditStartDate(task.start_date || '');
                  setEditEndDate(task.end_date || '');
                  setEditStartTime(task.start_time || '');
                  setEditEndTime(task.end_time || '');
                  setEditing(true);
                }} 
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 담당자 */}
        <div className="px-6 py-3 border-b border-slate-50 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />담당자
            </span>
            {assigneeNames.length === 0 ? (
              <span className="text-xs text-slate-400 italic">미할당</span>
            ) : (
              assigneeNames.map((name, i) => (
                <div key={i} className={`w-6 h-6 rounded-full ${avatarBg(name)} flex items-center justify-center text-white text-[10px] font-bold`} title={name}>
                  {getInitials(name)}
                </div>
              ))
            )}
            <div className="relative">
              <button
                onClick={() => setShowAssigneeSelector(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-400 hover:text-toss-blue hover:border-toss-blue transition-colors cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                {assigneeNames.length > 0 ? '변경' : '할당'}
              </button>
              {showAssigneeSelector && (
                <AssigneeSelector
                  selectedIds={assigneeIds}
                  onChange={handleSaveAssignees}
                  onClose={() => setShowAssigneeSelector(false)}
                  users={users}
                />
              )}
            </div>
          </div>
        </div>

        {/* 설명 */}
        {(editing || task.description) && (
          <div className="px-6 py-3 border-b border-slate-50 dark:border-slate-800/60 shrink-0">
            {editing ? (
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
                placeholder="작업 설명을 입력하세요..."
                className="w-full text-sm px-3 py-2 border border-toss-blue rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 resize-none"
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{task.description}</p>
            )}
          </div>
        )}

        {/* 탭 */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0 px-6">
          {(
            [['checklist', <CheckSquare className="w-3.5 h-3.5" />, '체크리스트'],
             ['worklog', <History className="w-3.5 h-3.5" />, '업무 이력'],
             ['comments', <MessageSquare className="w-3.5 h-3.5" />, '댓글']] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex items-center gap-1.5 px-1 py-3 mr-6 text-xs font-extrabold border-b-2 transition-colors cursor-pointer ${
                tab === key ? 'border-toss-blue text-toss-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'checklist' ? (
            <div className="px-6 py-5">
              <ChecklistPanel taskId={task.id} serverMode={serverMode} />
            </div>
          ) : tab === 'worklog' ? (
            <div className="px-6 py-5">
              <WorkLogPanel taskId={task.id} serverMode={serverMode} />
            </div>
          ) : (
            <div className="h-full">
              <CommentPanel
                projectId={projectId}
                taskId={task.id}
                selectedAssignment={{ id: `task_${task.id}`, user_id: '', project_id: projectId, role: task.title, allocation_percent: 0, start_date: '', end_date: '', user_name: task.title } as any}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 칸반 카드 ────────────────────────────────────────────────
interface KanbanCardProps {
  task: Task;
  subTaskMeta: Record<string, { total: number; done: number }>;
  commentCounts: Record<string, number>;
  onMove: (dir: 'prev' | 'next') => void;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}
const KanbanCard: React.FC<KanbanCardProps> = ({ task, subTaskMeta, commentCounts, onMove, onEdit, onDelete, onClick }) => {
  const priorityColor = task.priority === '긴급' ? 'text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-900/20'
    : task.priority === '높음' ? 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-900/20'
    : 'text-slate-400 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700';

  const remaining = getRemainingDays(task.end_date);
  const meta = subTaskMeta[task.id];
  const commentCount = commentCounts[task.id] || 0;
  const assigneeNames = task.assignee_names || (task.assignee ? [task.assignee] : []);

  return (
    <div className="cds--kanban-task-card group cursor-pointer" onClick={onClick}>
      <div className="cds--kanban-card-main">
        <div className="cds--kanban-card-title-row">
          <span className="cds--kanban-card-title flex-1 min-w-0">{task.title}</span>
          <span className={`cds--kanban-card-priority-badge border ${priorityColor} shrink-0`}>{task.priority}</span>
        </div>

        {task.description && (
          <p className="cds--kanban-card-description line-clamp-2">{task.description}</p>
        )}

        {/* 날짜 */}
        {(task.start_date || task.end_date) && (
          <div className="cds--kanban-card-date-row">
            <Clock className="cds--kanban-card-date-icon" />
            <span>{task.start_date || '?'} ~ {task.end_date || '?'}</span>
          </div>
        )}

        {/* 배지 행: 업무수 · 댓글 · 남은일수 */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {meta && meta.total > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <ListTodo className="w-3 h-3" />
              {meta.done}/{meta.total}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-toss-blue border border-blue-100 dark:border-blue-900/40">
              <MessageSquare className="w-3 h-3" />
              {commentCount}
            </span>
          )}
          {remaining && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${remaining.color}`}>
              <CalendarDays className="w-3 h-3" />
              {remaining.label}
            </span>
          )}
        </div>
      </div>

      {/* 하단 */}
      <div className="cds--kanban-card-bottom" onClick={e => e.stopPropagation()}>
        {/* 담당자 아바타 */}
        <div className="flex items-center gap-0.5">
          {assigneeNames.length === 0 ? (
            <span className="text-[10px] text-slate-400">미할당</span>
          ) : (
            <>
              {assigneeNames.slice(0, 3).map((n, i) => (
                <div key={i} className={`w-5 h-5 rounded-full ${avatarBg(n)} flex items-center justify-center text-white text-[9px] font-bold border border-white dark:border-slate-900 -ml-1 first:ml-0`} title={n}>
                  {getInitials(n)}
                </div>
              ))}
              {assigneeNames.length > 3 && (
                <span className="text-[10px] text-slate-400 ml-1">+{assigneeNames.length - 3}</span>
              )}
            </>
          )}
        </div>

        <div className="cds--kanban-card-actions">
          <button onClick={() => onMove('prev')} disabled={task.status === '대기'} className="cds--kanban-card-action-btn" title="이전">
            <ArrowLeft className="w-3 h-3" />
          </button>
          <button onClick={onEdit} className="cds--kanban-card-hover-action-btn" title="수정">
            <Edit className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="cds--kanban-card-hover-action-btn-danger" title="삭제">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => onMove('next')} disabled={task.status === '완료'} className="cds--kanban-card-action-btn" title="다음">
            <ArrowRight className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-1" />
        </div>
      </div>
    </div>
  );
};

// ─── 메인 TaskManagement ───────────────────────────────────────
export const TaskManagement: React.FC = () => {
  const { activeProject, processes, tasks, addTask, updateTask, removeTask } = useProjectStore();
  const { serverMode } = useAuthStore();
  const [activeProcessIdx, setActiveProcessIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // SubTask 메타 (카드 배지용): {taskId: {total, done}}
  const [subTaskMeta, setSubTaskMeta] = useState<Record<string, { total: number; done: number }>>({});
  // 댓글 수 (카드 배지용)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Task form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('보통');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeNames, setAssigneeNames] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [showAssigneeSel, setShowAssigneeSel] = useState(false);

  const activeProcess = processes[activeProcessIdx] || null;
  const activeTasks = activeProcess ? (tasks[activeProcess.id] || []) : [];

  const columns = useMemo(() => ({
    todo: activeTasks.filter(t => t.status === '대기'),
    progress: activeTasks.filter(t => t.status === '진행중'),
    review: activeTasks.filter(t => t.status === '검토중'),
    done: activeTasks.filter(t => t.status === '완료'),
  }), [activeTasks]);

  // 사용자 목록 로드
  useEffect(() => {
    api.getUsers(serverMode).then(setUsers).catch(() => {});
  }, [serverMode]);

  // SubTask 메타 로드
  useEffect(() => {
    const fetchMeta = async () => {
      const meta: Record<string, { total: number; done: number }> = {};
      for (const task of activeTasks) {
        try {
          const subs = await api.getSubTasks(serverMode, task.id);
          meta[task.id] = { total: subs.length, done: subs.filter((s: any) => s.done).length };
        } catch { meta[task.id] = { total: 0, done: 0 }; }
      }
      setSubTaskMeta(meta);
    };
    if (activeTasks.length) fetchMeta();
  }, [activeTasks, serverMode]);

  // 댓글 수 로드
  useEffect(() => {
    const fetchCounts = async () => {
      if (!activeProject) return;
      const counts: Record<string, number> = {};
      for (const task of activeTasks) {
        try {
          const all = await api.getComments(serverMode, {
            project_id: activeProject.id,
            assignment_id: `task_${task.id}`
          });
          counts[task.id] = all.length;
        } catch { counts[task.id] = 0; }
      }
      setCommentCounts(counts);
    };
    if (activeTasks.length && activeProject) fetchCounts();
  }, [activeTasks, serverMode, activeProject]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setPriority('보통');
    setAssigneeIds([]); setAssigneeNames([]);
    setStartDate(''); setEndDate('');
    setStartTime(''); setEndTime('');
    setEditingTask(null);
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end && start > end) {
      setEndDate(start);
    }
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (startDate && endDate && startDate === endDate && endTime && val > endTime) {
      setEndTime(val);
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (startDate && endDate && startDate === endDate && startTime && val < startTime) {
      setStartTime(val);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !activeProcess) return;

    if (startDate && endDate) {
      if (startDate > endDate) {
        alert('시작일은 종료일보다 늦을 수 없습니다.');
        return;
      }
      if (startDate === endDate && startTime && endTime && startTime > endTime) {
        alert('시작 시간은 종료 시간보다 늦을 수 없습니다.');
        return;
      }
    }

    if (editingTask) {
      await updateTask({
        ...editingTask, title, description, priority,
        assignees: assigneeIds, assignee_names: assigneeNames, assignee: assigneeNames[0] || '',
        start_date: startDate, end_date: endDate,
        start_time: startTime, end_time: endTime
      });
    } else {
      await addTask(activeProcess.id, title, description, priority, startDate, endDate, startTime, endTime);
    }
    resetForm(); setModalOpen(false);
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setAssigneeIds(task.assignees || []);
    setAssigneeNames(task.assignee_names || []);
    setStartDate(task.start_date || '');
    setEndDate(task.end_date || '');
    setStartTime(task.start_time || '');
    setEndTime(task.end_time || '');
    setModalOpen(true);
  };

  const handleMoveStatus = async (task: Task, direction: 'prev' | 'next') => {
    const statuses = ['대기', '진행중', '검토중', '완료'];
    const cur = statuses.indexOf(task.status);
    const next = direction === 'prev' ? cur - 1 : cur + 1;
    if (next >= 0 && next < statuses.length) {
      await updateTask({ ...task, status: statuses[next] });
    }
  };

  const handleRemoveTask = async (id: string, procId: string) => {
    if (confirm('이 작업을 삭제하시겠습니까?')) await removeTask(id, procId);
  };

  const handleDetailUpdate = async (updated: Task) => {
    await updateTask(updated);
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
  };

  // 칸반 컬럼 렌더
  const renderColumn = (colTitle: string, colTasks: Task[], borderStyle: string) => {
    const colColor = colTitle === '진행중' ? 'text-toss-blue' : colTitle === '검토중' ? 'text-amber-500' : colTitle === '완료' ? 'text-emerald-500' : 'text-slate-500';
    return (
      <div className={`cds--kanban-column border ${borderStyle}`}>
        <div className="cds--kanban-col-header-wrap">
          <span className={`cds--kanban-col-title ${colColor}`}>{colTitle}</span>
          <span className="cds--kanban-col-badge">{colTasks.length}</span>
        </div>
        <div className="cds--kanban-cards-container scrollbar-thin">
          {colTasks.length === 0 ? (
            <div className="cds--kanban-empty-column-card">할당된 작업 없음</div>
          ) : (
            colTasks.map(task => (
              <KanbanCard
                key={task.id}
                task={task}
                subTaskMeta={subTaskMeta}
                commentCounts={commentCounts}
                onMove={dir => handleMoveStatus(task, dir)}
                onEdit={() => handleEditClick(task)}
                onDelete={() => handleRemoveTask(task.id, task.process_id)}
                onClick={() => setSelectedTask(task)}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cds--overview-container animate-slide-up">
      {/* 헤더 */}
      <div className="cds--overview-header">
        <div className="cds--column-flex">
          <span className="text-sm font-bold text-toss-blue mb-1">Task Manager</span>
          <h1 className="cds--overview-header-title">작업 관리 (칸반)</h1>
        </div>
        {activeProcess && (
          <button
            onClick={() => { resetForm(); setModalOpen(true); }}
            className="cds--btn cds--btn-primary px-5 py-3 flex items-center gap-1.5 font-bold shadow-sm cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>작업 카드 추가</span>
          </button>
        )}
      </div>

      {/* 프로세스 탭 */}
      {processes.length > 0 && (
        <div className="cds--kanban-tabs-container">
          {processes.map((proc, index) => (
            <button
              key={proc.id}
              onClick={() => setActiveProcessIdx(index)}
              className={`cds--kanban-tab-btn ${activeProcessIdx === index ? 'cds--kanban-tab-btn-active' : 'cds--kanban-tab-btn-inactive'}`}
            >
              {proc.name}
            </button>
          ))}
        </div>
      )}

      {/* 칸반 보드 */}
      {!activeProcess ? (
        <div className="cds--kanban-empty-board">
          <ClipboardList className="cds--kanban-empty-icon" />
          <p className="cds--kanban-empty-text">활성화된 프로세스 단계가 없습니다. 먼저 단계 관리를 마쳐주세요.</p>
        </div>
      ) : (
        <div className="cds--kanban-columns-grid">
          {renderColumn('대기', columns.todo, 'border-toss-gray-200/50')}
          {renderColumn('진행중', columns.progress, 'border-toss-blue/30')}
          {renderColumn('검토중', columns.review, 'border-amber-500/30')}
          {renderColumn('완료', columns.done, 'border-emerald-500/30')}
        </div>
      )}

      {/* 작업 추가/수정 모달 */}
      {modalOpen && activeProcess && (
        <div className="cds--modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="cds--modal-container animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="cds--modal-title">{editingTask ? '작업 카드 수정' : '신규 작업 추가'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="cds--modal-form">
              <div className="cds--column-flex gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">작업 제목</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 요구사항 파악 회의" required className="cds--text-input font-bold" />
              </div>

              <div className="cds--modal-grid-2">
                <div className="cds--column-flex gap-1.5">
                  <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">우선순위</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="cds--text-input font-bold cursor-pointer">
                    <option value="낮음">낮음</option>
                    <option value="보통">보통</option>
                    <option value="높음">높음</option>
                    <option value="긴급">긴급</option>
                  </select>
                </div>
                <div className="cds--column-flex gap-1.5">
                  <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">담당자 ({assigneeNames.length}명)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAssigneeSel(v => !v)}
                      className="w-full cds--text-input font-bold text-left flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 truncate">
                        {assigneeNames.length > 0 ? assigneeNames.join(', ') : '담당자 선택'}
                      </span>
                    </button>
                    {showAssigneeSel && (
                      <AssigneeSelector
                        selectedIds={assigneeIds}
                        onChange={(ids, names) => { setAssigneeIds(ids); setAssigneeNames(names); }}
                        onClose={() => setShowAssigneeSel(false)}
                        users={users}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="cds--column-flex gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">작업 기간</label>
                <RangeDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleDateChange}
                  minDate={activeProcess.start_date || undefined}
                  maxDate={activeProcess.end_date || undefined}
                  placeholder="작업 일정 선택"
                />
              </div>

              <div className="cds--modal-grid-2">
                <div className="cds--column-flex gap-1.5">
                  <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">시작 시간</label>
                  <CustomTimePicker
                    value={startTime}
                    onChange={handleStartTimeChange}
                  />
                </div>
                <div className="cds--column-flex gap-1.5">
                  <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">종료 시간</label>
                  <CustomTimePicker
                    value={endTime}
                    onChange={handleEndTimeChange}
                  />
                </div>
              </div>

              <div className="cds--column-flex gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">설명</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="작업에 필요한 세부 내용" rows={3} className="cds--text-input font-semibold resize-none" />
              </div>

              <div className="cds--modal-footer-btns">
                <button type="button" onClick={() => setModalOpen(false)} className="cds--btn cds--btn-secondary cds--modal-btn-cancel">취소</button>
                <button type="submit" className="cds--btn cds--btn-primary cds--modal-btn-submit">{editingTask ? '저장하기' : '등록하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상세 슬라이드 패널 */}
      {selectedTask && activeProject && (
        <TaskDetailPanel
          task={selectedTask}
          projectId={activeProject.id}
          serverMode={serverMode}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleDetailUpdate}
        />
      )}
    </div>
  );
};
