import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock, FileText, Loader2, Plus, Sparkles, X } from 'lucide-react';
import type { Meeting, MeetingNote } from '../types';
import { createMeetingNote, getMeetingNotes, summarizeMeeting } from '../utils/collaborationApi';
import { ModalOverlay } from './ModalOverlay';
import { CustomTimePicker } from './CustomTimePicker';
import { CustomSelect } from './CustomSelect';

interface MeetingMinutesModalProps {
  meeting: Meeting;
  onClose: () => void;
  onSaved?: (meeting?: Meeting) => void | Promise<void>;
}

const getCurrentTime = () => new Date().toTimeString().slice(0, 5);

export const MeetingMinutesModal: React.FC<MeetingMinutesModalProps> = ({ meeting, onClose, onSaved }) => {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [content, setContent] = useState('');
  const [noteTime, setNoteTime] = useState(getCurrentTime());
  const [agendaItemId, setAgendaItemId] = useState<string | null>(meeting.agenda_items?.[0]?.id || null);
  const [draftMeeting, setDraftMeeting] = useState<Meeting>(meeting);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const loadNotes = async () => {
    setLoading(true);
    try {
      setNotes(await getMeetingNotes(meeting.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDraftMeeting(meeting);
    setNoteTime(getCurrentTime());
    setAgendaItemId(meeting.agenda_items?.[0]?.id || null);
    loadNotes();
  }, [meeting.id]);

  const agendaItems = useMemo(() => {
    if (meeting.agenda_items?.length) return meeting.agenda_items;
    return (meeting.agenda || '').split('\n').map((title, index) => ({ id: `legacy-${index}`, title: title.trim() })).filter((item) => item.title);
  }, [meeting.agenda, meeting.agenda_items]);

  const agendaById = useMemo(() => new Map(agendaItems.map((item) => [item.id, item.title])), [agendaItems]);

  const orderedNotes = useMemo(() => {
    return [...notes].sort((a, b) => `${a.note_time}${a.created_at}`.localeCompare(`${b.note_time}${b.created_at}`));
  }, [notes]);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const note = await createMeetingNote(meeting.id, content.trim(), noteTime || getCurrentTime(), agendaItemId);
      setNotes((prev) => [...prev, note]);
      setContent('');
      setNoteTime(getCurrentTime());
    } finally {
      setSaving(false);
    }
  };

  const buildSummary = async () => {
    setSummarizing(true);
    try {
      const updated = await summarizeMeeting(meeting.id);
      setDraftMeeting(updated);
      await onSaved?.(updated);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} zIndex={9500}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(1040px,calc(100vw-32px))] h-[calc(100vh-96px)] max-h-[calc(100vh-96px)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black text-toss-blue uppercase">
              <BookOpen className="w-4 h-4" />
              Meeting minutes
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100 truncate">{meeting.title}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {meeting.start_date} {meeting.start_time} - {meeting.end_time}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 min-h-[420px]">
            {false && (<form onSubmit={addNote} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex flex-col gap-3">
              {false && agendaItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {agendaItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAgendaItemId(item.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer ${agendaItemId === item.id ? 'bg-toss-blue text-white border-toss-blue' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                    >
                      {index + 1}. {item.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAgendaItemId(null)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer ${agendaItemId === null ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  >
                    공통
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[minmax(150px,0.75fr)_112px_minmax(0,1fr)] gap-2">
                <CustomSelect
                  value={agendaItemId || 'general'}
                  onChange={(e) => setAgendaItemId(e.target.value === 'general' ? null : e.target.value)}
                  positionDirection="down"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black outline-none"
                >
                  <option value="general">공통</option>
                  {agendaItems.map((item, index) => (
                    <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>
                  ))}
                </CustomSelect>
                <CustomTimePicker
                  value={noteTime}
                  onChange={setNoteTime}
                  positionDirection="down"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black outline-none"
                />
                <input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="회의 중 나온 내용을 바로 메모"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="self-end px-3 py-2 rounded-xl bg-toss-blue text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                메모 추가
              </button>
            </form>)}

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">타임라인</h4>
              <span className="text-[11px] font-black text-slate-400">{orderedNotes.length}개 메모</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs font-black text-slate-400">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  불러오는 중
                </div>
              ) : orderedNotes.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                  <Clock className="w-8 h-8 opacity-30" />
                  <span className="text-sm font-bold">아직 기록된 회의 메모가 없습니다.</span>
                </div>
              ) : (
                <div className="relative pl-6 flex flex-col gap-4">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-800" />
                  {orderedNotes.map((note) => (
                    <div key={note.id} className="relative rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                      <div className="absolute -left-[22px] top-4 w-3.5 h-3.5 rounded-full bg-toss-blue ring-4 ring-white dark:ring-slate-950" />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-black text-toss-blue">{note.note_time || note.created_at.slice(11, 16)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 truncate">
                            {agendaById.get(note.agenda_item_id || '') || '공통'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">{note.author_name || 'Me'}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <button
              onClick={buildSummary}
              disabled={summarizing || orderedNotes.length === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              회의록 초안 만들기
            </button>

            <section className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-2 min-h-[180px]">
              <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                <FileText className="w-4 h-4 text-toss-blue" />
                회의 내용 정리
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {draftMeeting.notes?.trim() || '타임라인 메모를 바탕으로 정리 초안을 만들 수 있습니다.'}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-2 min-h-[160px]">
              <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                <Sparkles className="w-4 h-4 text-amber-500" />
                결정사항/후속조치
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {draftMeeting.decisions?.trim() || '결정, 담당, 마감, 이슈 같은 표현이 들어간 메모를 우선 추려냅니다.'}
              </p>
            </section>
          </div>
        </div>

        <form
          onSubmit={addNote}
          className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 p-4 backdrop-blur-md"
        >
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-[220px_132px] gap-2">
              <CustomSelect
                value={agendaItemId || 'general'}
                onChange={(e) => setAgendaItemId(e.target.value === 'general' ? null : e.target.value)}
                positionDirection="up"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black outline-none"
              >
                <option value="general">공통</option>
                {agendaItems.map((item, index) => (
                  <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>
                ))}
              </CustomSelect>
              <CustomTimePicker
                value={noteTime}
                onChange={setNoteTime}
                positionDirection="up"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black outline-none"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="회의 중 나온 내용을 바로 메모"
                rows={3}
                className="w-full min-h-[82px] max-h-40 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold outline-none resize-y leading-relaxed"
              />
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="h-[82px] px-5 rounded-xl bg-toss-blue text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                메모
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};
