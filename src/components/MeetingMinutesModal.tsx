import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Check, Clock, Copy, FileText, Loader2,
  MessageSquarePlus, Plus, Sparkles, X
} from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────────
// 그룹핑: 같은 시간 + 같은 안건 ID 이면 하나의 블록으로 합침
// ─────────────────────────────────────────────────────────────────
interface NoteGroup {
  time: string;
  agendaItemId: string | null;
  notes: MeetingNote[];
}

function groupNotesByTimeAndAgenda(orderedNotes: MeetingNote[]): NoteGroup[] {
  return orderedNotes.reduce<NoteGroup[]>((groups, note) => {
    const time = note.note_time || note.created_at.slice(11, 16);
    const agendaItemId = note.agenda_item_id || null;
    const last = groups[groups.length - 1];
    if (last?.time === time && last?.agendaItemId === agendaItemId) {
      last.notes.push(note);
    } else {
      groups.push({ time, agendaItemId, notes: [note] });
    }
    return groups;
  }, []);
}

// ─────────────────────────────────────────────────────────────────
// 복사 훅 — http 환경에서도 동작하도록 execCommand fallback 포함
// ─────────────────────────────────────────────────────────────────
function useCopyText() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
    } else {
      legacyCopy(text, done);
    }
  };
  return { copied, copy };
}

function legacyCopy(text: string, onDone: () => void) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); onDone(); } catch {}
  document.body.removeChild(ta);
}

export const MeetingMinutesModal: React.FC<MeetingMinutesModalProps> = ({ meeting, onClose, onSaved }) => {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [content, setContent] = useState('');
  const [noteTime, setNoteTime] = useState(getCurrentTime());
  const [agendaItemId, setAgendaItemId] = useState<string | null>(meeting.agenda_items?.[0]?.id || null);
  const [draftMeeting, setDraftMeeting] = useState<Meeting>(meeting);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [draftDone, setDraftDone] = useState(false);
  const notesCopy = useCopyText();
  const decisionsCopy = useCopyText();

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
    setDraftDone(!!meeting.notes?.trim());
    loadNotes();
  }, [meeting.id]);

  // 다음 정분(:00)에 정확히 맞춰 갱신 — setInterval(60s)는 마운트 시점 기준이라 어긋남
  const [autoTime, setAutoTime] = useState(true);
  const autoIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!autoTime) return;
    const tick = () => setNoteTime(getCurrentTime());

    // 다음 :00 까지 남은 밀리초
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // 1단계: 정확히 다음 정분에 첫 갱신
    const timeoutId = setTimeout(() => {
      tick();
      // 2단계: 이후 매 정분마다 반복
      autoIntervalRef.current = setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [autoTime]);

  const agendaItems = useMemo(() => {
    if (meeting.agenda_items?.length) return meeting.agenda_items;
    return (meeting.agenda || '').split('\n')
      .map((title, index) => ({ id: `legacy-${index}`, title: title.trim() }))
      .filter((item) => item.title);
  }, [meeting.agenda, meeting.agenda_items]);

  const agendaById = useMemo(() => new Map(agendaItems.map((item) => [item.id, item.title])), [agendaItems]);

  const orderedNotes = useMemo(() =>
    [...notes].sort((a, b) => `${a.note_time}${a.created_at}`.localeCompare(`${b.note_time}${b.created_at}`)),
    [notes]
  );

  // 같은 시간 + 같은 안건이면 하나 블록으로 합침
  const groupedNotes = useMemo(() => groupNotesByTimeAndAgenda(orderedNotes), [orderedNotes]);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const note = await createMeetingNote(meeting.id, content.trim(), noteTime || getCurrentTime(), agendaItemId);
      setNotes((prev) => [...prev, note]);
      setContent('');
      // 저장 후 자동 시간갱신 재개 (현재 시각으로 리셋)
      setNoteTime(getCurrentTime());
      setAutoTime(true);
    } finally {
      setSaving(false);
    }
  };

  const buildSummary = async () => {
    setSummarizing(true);
    setDraftDone(false);
    try {
      const updated = await summarizeMeeting(meeting.id);
      setDraftMeeting(updated);
      setDraftDone(true);
      await onSaved?.(updated);
    } finally {
      setSummarizing(false);
    }
  };

  // 텍스트 통계
  const totalNoteCount = orderedNotes.length;
  const agendaCoveredCount = new Set(orderedNotes.map((n) => n.agenda_item_id || 'general')).size;

  return (
    <ModalOverlay onClose={onClose} zIndex={9500}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(1100px,calc(100vw-32px))] h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-toss-lg flex flex-col"
      >
        {/* ── 헤더 ── */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black text-toss-blue uppercase">
              <BookOpen className="w-4 h-4" />
              Meeting Minutes
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100 truncate">{meeting.title}</h3>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {meeting.start_date} &nbsp;{meeting.start_time} – {meeting.end_time}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 메모 통계 뱃지 */}
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-500">
              <span>{totalNoteCount}개 메모</span>
              {agendaItems.length > 0 && <span className="text-toss-blue">{agendaCoveredCount}개 안건 기록</span>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 본문: 좌측 타임라인 | 우측 초안 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] flex-1 min-h-0 overflow-hidden">

          {/* ── 좌: 타임라인 ── */}
          <div className="flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">타임라인</h4>
              <span className="text-[11px] font-black text-slate-400">{totalNoteCount}개 메모</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs font-black text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />불러오는 중
                </div>
              ) : orderedNotes.length === 0 ? (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center gap-3 text-slate-400">
                  <Clock className="w-9 h-9 opacity-25" />
                  <div>
                    <p className="text-sm font-bold">아직 기록된 메모가 없습니다.</p>
                    <p className="text-xs font-bold text-slate-300 dark:text-slate-600 mt-1">아래 입력창으로 회의 중 내용을 실시간 메모하세요.</p>
                  </div>
                </div>
              ) : (
                <div className="relative pl-7 flex flex-col gap-5">
                  {/* 세로 타임라인 선 */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />

                  {groupedNotes.map((group, gIdx) => {
                    const agendaLabel = group.agendaItemId
                      ? agendaById.get(group.agendaItemId) || '안건'
                      : '공통';
                    const isAgendaItem = !!group.agendaItemId;

                    return (
                      <div key={`${group.time}-${group.agendaItemId ?? 'gen'}-${gIdx}`} className="relative flex flex-col gap-2">
                        {/* 타임라인 도트 */}
                        <div className={`absolute -left-[28px] top-1.5 w-3.5 h-3.5 rounded-full ring-[3px] ring-white dark:ring-slate-950 ${isAgendaItem ? 'bg-toss-blue' : 'bg-slate-400'}`} />

                        {/* 시간 + 안건 배지 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-toss-blue">{group.time}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isAgendaItem
                            ? 'bg-toss-blue/10 text-toss-blue border border-toss-blue/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                          }`}>
                            {agendaLabel}
                          </span>
                          {group.notes.length > 1 && (
                            <span className="text-[10px] font-black text-slate-400">{group.notes.length}개 합쳐짐</span>
                          )}
                        </div>

                        {/* 합쳐진 메모 카드 */}
                        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                          {group.notes.length === 1 ? (
                            // 단일 메모
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-black text-slate-400">{group.notes[0].author_name || 'Me'}</span>
                              </div>
                              <p className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{group.notes[0].content}</p>
                            </div>
                          ) : (
                            // 복수 메모 — 합쳐서 표시, 작성자 구분선으로 구분
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {group.notes.map((note, nIdx) => (
                                <div key={note.id} className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-toss-blue/50 shrink-0" />
                                    <span className="text-[11px] font-black text-slate-400">{note.author_name || 'Me'}</span>
                                  </div>
                                  <p className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap pl-3.5">{note.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── 우: 초안 ── */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto">

            {/* 초안 만들기 버튼 */}
            <button
              onClick={buildSummary}
              disabled={summarizing || orderedNotes.length === 0}
              className="relative w-full px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer overflow-hidden group transition-all"
            >
              {summarizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>정리 중… 잠시만요</span>
                </>
              ) : draftDone ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>다시 초안 만들기</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>회의록 초안 만들기</span>
                  {orderedNotes.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black">{orderedNotes.length}개 메모 정리</span>
                  )}
                </>
              )}
              {/* 진행 애니메이션 오버레이 */}
              {summarizing && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.2s_infinite]" />
              )}
            </button>

            {/* 초안 완성 후 힌트 */}
            {draftDone && !summarizing && (
              <p className="text-[11px] font-bold text-emerald-500 text-center -mt-2">
                ✓ 메모 {totalNoteCount}개가 안건별·시간순으로 정리되었습니다.
              </p>
            )}

            {/* 회의 내용 정리 섹션 */}
            <section className="rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                  <FileText className="w-4 h-4 text-toss-blue" />
                  회의 내용 정리
                </div>
                {draftMeeting.notes?.trim() && (
                  <button
                    onClick={() => notesCopy.copy(draftMeeting.notes || '')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-black text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {notesCopy.copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {notesCopy.copied ? '복사됨' : '복사'}
                  </button>
                )}
              </div>
              <div className="p-4 min-h-[160px] max-h-[280px] overflow-y-auto">
                {draftMeeting.notes?.trim() ? (
                  <NotesSummaryRenderer text={draftMeeting.notes} agendaItems={agendaItems} />
                ) : (
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-600 leading-relaxed">
                    타임라인 메모를 기반으로 안건별·시간순으로 초안이 생성됩니다.
                    {agendaItems.length > 0 && (
                      <span className="block mt-1 text-[11px]">현재 안건 {agendaItems.length}개 등록됨</span>
                    )}
                  </p>
                )}
              </div>
            </section>

            {/* 결정사항/후속조치 섹션 */}
            <section className="rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  결정사항 / 후속조치
                </div>
                {draftMeeting.decisions?.trim() && (
                  <button
                    onClick={() => decisionsCopy.copy(draftMeeting.decisions || '')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-[11px] font-black text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {decisionsCopy.copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {decisionsCopy.copied ? '복사됨' : '복사'}
                  </button>
                )}
              </div>
              <div className="p-4 min-h-[120px] max-h-[200px] overflow-y-auto">
                {draftMeeting.decisions?.trim() ? (
                  <DecisionRenderer text={draftMeeting.decisions} />
                ) : (
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-600 leading-relaxed">
                    결정·담당·마감·이슈 같은 키워드가 포함된 메모를 자동으로 추려냅니다.
                  </p>
                )}
              </div>
            </section>

          </div>
        </div>

        {/* ── 하단 입력 ── */}
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
              <div className="relative">
                <CustomTimePicker
                  value={noteTime}
                  onChange={(v) => { setNoteTime(v); setAutoTime(false); }}
                  positionDirection="up"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black outline-none"
                />
                {autoTime && (
                  <span
                    title="현재 시각으로 1분마다 자동 갱신 중. 클릭해서 수동으로 변경하면 멈춥니다."
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-black text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    자동
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (content.trim()) addNote(e as any);
                  }
                }}
                placeholder={`회의 중 내용을 바로 메모 (Ctrl+Enter로 빠른 저장)${agendaItemId ? ` — ${agendaById.get(agendaItemId) || ''}` : ''}`}
                rows={3}
                className="w-full min-h-[82px] max-h-40 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold outline-none resize-y leading-relaxed"
              />
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="h-[82px] px-5 rounded-xl bg-toss-blue text-white text-xs font-black flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
                <span>메모</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};

// ─────────────────────────────────────────────────────────────────
// 초안 텍스트 렌더러
// 입력 포맷:
//   [안건명]          ← 안건 섹션 헤더
//   - 14:30 작성자: 내용   ← 단일 메모
//   - 14:30               ← 같은 시간대 그룹 헤더
//     • 작성자: 내용       ← 그룹 내 개별 항목
// ─────────────────────────────────────────────────────────────────
interface AgendaItemShape { id: string; title: string; }

interface ParsedSection {
  type: 'agenda' | 'single' | 'group' | 'bullet' | 'blank';
  time?: string;
  author?: string | null;
  text?: string;
  items?: Array<{ author: string | null; text: string }>;
  raw?: string;
}

function parseSummaryText(raw: string): ParsedSection[] {
  const lines = raw.split('\n');
  const result: ParsedSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 빈 줄
    if (!trimmed) { result.push({ type: 'blank' }); i++; continue; }

    // [안건명]
    if (/^\[.+\]$/.test(trimmed)) {
      result.push({ type: 'agenda', text: trimmed.slice(1, -1) });
      i++; continue;
    }

    // - 14:30 (다음 줄이 들여쓰기 • 이면 그룹)
    const timeOnlyMatch = trimmed.match(/^-\s+(\d{1,2}:\d{2})$/);
    if (timeOnlyMatch) {
      const time = timeOnlyMatch[1];
      const items: Array<{ author: string | null; text: string }> = [];
      i++;
      while (i < lines.length && /^\s{1,}[•·]/.test(lines[i])) {
        const bullet = lines[i].replace(/^\s+[•·]\s*/, '').trim();
        const ci = bullet.indexOf(': ');
        items.push(ci > -1
          ? { author: bullet.slice(0, ci), text: bullet.slice(ci + 2) }
          : { author: null, text: bullet });
        i++;
      }
      result.push({ type: 'group', time, items });
      continue;
    }

    // - 14:30 작성자: 내용  (단일)
    const singleMatch = trimmed.match(/^-\s+(\d{1,2}:\d{2})\s+(.+)$/);
    if (singleMatch) {
      const time = singleMatch[1];
      const rest = singleMatch[2];
      const ci = rest.indexOf(': ');
      const author = ci > -1 ? rest.slice(0, ci) : null;
      const text  = ci > -1 ? rest.slice(ci + 2) : rest;
      result.push({ type: 'single', time, author, text });
      i++; continue;
    }

    // - 나머지 불릿
    if (trimmed.startsWith('- ')) {
      result.push({ type: 'bullet', text: trimmed.slice(2) });
      i++; continue;
    }

    result.push({ type: 'bullet', text: trimmed });
    i++;
  }
  return result;
}

const NotesSummaryRenderer: React.FC<{ text: string; agendaItems: AgendaItemShape[] }> = ({ text }) => {
  const sections = parseSummaryText(text);

  return (
    <div className="flex flex-col gap-0">
      {sections.map((sec, i) => {
        if (sec.type === 'blank') return <div key={i} className="h-3" />;

        if (sec.type === 'agenda') return (
          <div key={i} className="pt-3 pb-2 first:pt-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-toss-blue/10 text-toss-blue text-[11px] font-black border border-toss-blue/20">
              <span className="w-1.5 h-1.5 rounded-full bg-toss-blue" />
              {sec.text}
            </span>
          </div>
        );

        // 단일 메모
        if (sec.type === 'single') return (
          <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-slate-50 dark:border-slate-900 last:border-0">
            <span className="shrink-0 mt-0.5 text-[10px] font-black text-toss-blue bg-toss-blue/10 px-1.5 py-0.5 rounded tabular-nums">
              {sec.time}
            </span>
            <div className="min-w-0 flex-1">
              {sec.author && (
                <span className="text-[10px] font-black text-slate-400 mr-1.5">{sec.author}</span>
              )}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                {sec.text}
              </span>
            </div>
          </div>
        );

        // 같은 시간대 그룹
        if (sec.type === 'group') return (
          <div key={i} className="py-1.5 border-b border-slate-50 dark:border-slate-900 last:border-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="shrink-0 text-[10px] font-black text-toss-blue bg-toss-blue/10 px-1.5 py-0.5 rounded tabular-nums">
                {sec.time}
              </span>
              <span className="text-[10px] font-black text-slate-400">{sec.items?.length}개 메모</span>
            </div>
            <div className="pl-2 flex flex-col gap-1.5 border-l-2 border-toss-blue/20">
              {sec.items?.map((item, j) => (
                <div key={j} className="flex items-start gap-1.5">
                  {item.author && (
                    <span className="shrink-0 text-[10px] font-black text-slate-400 mt-0.5 min-w-[40px]">{item.author}</span>
                  )}
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );

        // 일반 불릿
        return (
          <div key={i} className="flex items-start gap-2 py-1">
            <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">{sec.text}</p>
          </div>
        );
      })}
    </div>
  );
};

const DecisionRenderer: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').filter((l) => l.trim());
  const decisionKeywords = ['결정', '확정', '담당', '마감', '이슈', '리스크', '하기로', '진행'];

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const isNegative = line.includes('감지되지 않았습니다');
        const body = line.trim().startsWith('- ') ? line.trim().slice(2) : line.trim();
        const keyword = decisionKeywords.find((k) => body.includes(k));

        if (isNegative) {
          return (
            <p key={i} className="text-sm font-semibold text-slate-400 dark:text-slate-600 italic">{body}</p>
          );
        }

        return (
          <div key={i} className="flex items-start gap-2.5">
            <span className="shrink-0 mt-1 w-4 h-4 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            </span>
            <div className="min-w-0">
              {keyword && (
                <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[9px] font-black text-amber-600 uppercase">
                  {keyword}
                </span>
              )}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">{body}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
