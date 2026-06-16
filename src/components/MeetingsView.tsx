import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Clock, FileText, Link, MapPin, Plus, Trash2, Users, X } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { createMeeting, deleteMeeting, getMeetings, respondMeeting } from '../utils/collaborationApi';
import { getUsers } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Meeting, MeetingAgendaItem, User } from '../types';
import { ModalOverlay } from './ModalOverlay';
import { Avatar } from './Avatar';
import { MeetingMinutesModal } from './MeetingMinutesModal';
import { CustomTimePicker } from './CustomTimePicker';
import { CustomDatePicker } from './CustomDatePicker';
import { UserMultiSelect } from './UserMultiSelect';

const toDateTime = (date?: string, time?: string) => new Date(`${date || '1970-01-01'}T${time || '00:00'}`);

const getRemainingLabel = (meeting: Meeting) => {
  const diffMs = toDateTime(meeting.start_date, meeting.start_time).getTime() - Date.now();
  if (diffMs <= 0) return '진행 중이거나 시작 시간이 지났습니다';
  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}일 ${hours}시간 후`;
  if (hours > 0) return `${hours}시간 ${minutes}분 후`;
  return `${minutes}분 후`;
};

const isFinished = (meeting: Meeting) => toDateTime(meeting.start_date, meeting.end_time || meeting.start_time).getTime() < Date.now();

export const MeetingsView: React.FC = () => {
  const { activeProject } = useProjectStore();
  const { user, serverMode } = useAuthStore();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [meetingList, userList] = await Promise.all([getMeetings(activeProject.id), getUsers(serverMode)]);
      setMeetings(meetingList);
      setUsers(userList.filter((item) => item.status !== 'inactive'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeProject?.id]);

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => toDateTime(a.start_date, a.start_time).getTime() - toDateTime(b.start_date, b.start_time).getTime()),
    [meetings]
  );
  const upcoming = useMemo(() => sortedMeetings.filter((meeting) => !isFinished(meeting)), [sortedMeetings]);
  const finished = useMemo(() => sortedMeetings.filter(isFinished).reverse(), [sortedMeetings]);
  const nextMeeting = upcoming[0] || null;
  const remainingUpcoming = nextMeeting ? upcoming.slice(1) : upcoming;

  if (!activeProject) return <div className="p-6 text-sm font-bold text-slate-400">프로젝트를 먼저 선택해 주세요.</div>;

  return (
    <div className="h-full overflow-y-auto pr-1 text-left flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">회의</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">{activeProject.name} 회의와 참석 응답을 관리합니다.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-black flex items-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" />
          회의 추가
        </button>
      </div>

      {loading ? (
        <div className="text-sm font-bold text-slate-400">회의를 불러오는 중...</div>
      ) : (
        <>
          {nextMeeting ? (
            <NextMeetingCard
              meeting={nextMeeting}
              currentUserId={user?.id || ''}
              usersById={usersById}
              onDelete={async () => { await deleteMeeting(nextMeeting.id); await load(); }}
              onRespond={async (response) => { await respondMeeting(nextMeeting.id, response); await load(); }}
              onOpenMinutes={() => setMinutesMeeting(nextMeeting)}
            />
          ) : (
            <EmptyBox label="예정된 회의가 없습니다." />
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">예정 회의</h3>
              <span className="text-xs font-black text-slate-400">{upcoming.length}건</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {remainingUpcoming.length === 0 ? <EmptyBox label="다음 회의 외 추가 예정 회의가 없습니다." /> : remainingUpcoming.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUserId={user?.id || ''}
                  usersById={usersById}
                  onDelete={async () => { await deleteMeeting(meeting.id); await load(); }}
                  onRespond={async (response) => { await respondMeeting(meeting.id, response); await load(); }}
                  onOpenMinutes={() => setMinutesMeeting(meeting)}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">지난 회의</h3>
              <span className="text-xs font-black text-slate-400">회의록과 결정사항 관리 대상</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {finished.length === 0 ? <EmptyBox label="종료된 회의가 없습니다." /> : finished.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUserId={user?.id || ''}
                  usersById={usersById}
                  finished
                  onDelete={async () => { await deleteMeeting(meeting.id); await load(); }}
                  onRespond={async (response) => { await respondMeeting(meeting.id, response); await load(); }}
                  onOpenMinutes={() => setMinutesMeeting(meeting)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {modalOpen && (
        <MeetingCreateModal
          projectId={activeProject.id}
          users={users}
          onClose={() => setModalOpen(false)}
          onCreated={async () => { setModalOpen(false); await load(); }}
        />
      )}
      {minutesMeeting && (
        <MeetingMinutesModal
          meeting={minutesMeeting}
          onClose={() => setMinutesMeeting(null)}
          onSaved={async (updated) => { if (updated) setMinutesMeeting(updated); await load(); }}
        />
      )}
    </div>
  );
};

const EmptyBox = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs font-bold text-slate-400">{label}</div>
);

interface MeetingCreateModalProps {
  projectId: string;
  users: User[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const MeetingCreateModal: React.FC<MeetingCreateModalProps> = ({ projectId, users, onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    start_date: new Date().toISOString().slice(0, 10),
    start_time: '10:00',
    end_time: '11:00',
    location: '',
    meeting_url: '',
    attendees: [] as string[],
    attendeeNames: [] as string[],
    agendaItems: [{ id: `agenda-${Date.now()}`, title: '' }] as MeetingAgendaItem[],
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const agendaItems = form.agendaItems.map((item) => ({ ...item, title: item.title.trim() })).filter((item) => item.title);
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createMeeting({
        project_id: projectId,
        title: form.title.trim(),
        start_date: form.start_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        meeting_url: form.meeting_url,
        attendees: form.attendees,
        attendee_names: form.attendeeNames,
        agenda: agendaItems.map((item) => item.title).join('\n'),
        agenda_items: agendaItems,
      });
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  const updateAgenda = (id: string, title: string) => {
    setForm((prev) => ({ ...prev, agendaItems: prev.agendaItems.map((item) => item.id === id ? { ...item, title } : item) }));
  };

  return (
    <ModalOverlay onClose={onClose} zIndex={9000}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-toss-lg max-w-2xl w-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black">회의 추가</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="회의 제목" className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-bold outline-none" />
        <div className="grid grid-cols-3 gap-3">
          <CustomDatePicker value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} />
          <CustomTimePicker value={form.start_time} onChange={(value) => setForm({ ...form, start_time: value })} positionDirection="down" />
          <CustomTimePicker value={form.end_time} onChange={(value) => setForm({ ...form, end_time: value })} positionDirection="down" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="장소" className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-bold outline-none" />
          <input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="온라인 링크" className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-bold outline-none" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500">안건</span>
            <button type="button" onClick={() => setForm({ ...form, agendaItems: [...form.agendaItems, { id: `agenda-${Date.now()}-${form.agendaItems.length}`, title: '' }] })} className="text-xs font-black text-toss-blue cursor-pointer">
              안건 추가
            </button>
          </div>
          {form.agendaItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-500 flex items-center justify-center shrink-0">{index + 1}</span>
              <input value={item.title} onChange={(e) => updateAgenda(item.id, e.target.value)} placeholder="논의할 안건" className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-semibold outline-none" />
              {form.agendaItems.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, agendaItems: form.agendaItems.filter((agenda) => agenda.id !== item.id) })} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <UserMultiSelect users={users} selectedIds={form.attendees} onChange={(ids, names) => setForm({ ...form, attendees: ids, attendeeNames: names })} placeholder="참석 인력 선택" />
        <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-black cursor-pointer disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>
    </ModalOverlay>
  );
};

interface MeetingCardProps {
  meeting: Meeting;
  currentUserId: string;
  usersById: Map<string, User>;
  finished?: boolean;
  onDelete: () => Promise<void>;
  onRespond: (response: 'accepted' | 'declined') => Promise<void>;
  onOpenMinutes: () => void;
}

const NextMeetingCard: React.FC<MeetingCardProps> = (props) => (
  <div className="rounded-2xl border border-toss-blue/25 bg-toss-blue/5 dark:bg-toss-blue/10 p-5 shadow-sm">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-toss-blue">
          <Clock className="w-4 h-4" />
          다음 회의 · {getRemainingLabel(props.meeting)}
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2 truncate">{props.meeting.title}</h3>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{props.meeting.start_date} {props.meeting.start_time} - {props.meeting.end_time}</p>
      </div>
      <ResponseSummary meeting={props.meeting} usersById={props.usersById} prominent />
    </div>
    <AgendaPreview meeting={props.meeting} />
    <MeetingMeta meeting={props.meeting} />
    <MeetingActions {...props} />
  </div>
);

const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, currentUserId, usersById, finished, onDelete, onRespond, onOpenMinutes }) => (
  <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col gap-4 ${finished ? 'border-slate-200 dark:border-slate-800 opacity-90' : 'border-slate-100 dark:border-slate-800'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-toss-blue">
          <CalendarClock className="w-4 h-4" />
          {meeting.start_date} {meeting.start_time} - {meeting.end_time}
        </div>
        <h3 className="text-base font-black text-slate-850 dark:text-slate-100 mt-2 truncate">{meeting.title}</h3>
      </div>
      <button onClick={onDelete} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
    </div>
    <AgendaPreview meeting={meeting} />
    <MeetingMeta meeting={meeting} />
    <ResponseSummary meeting={meeting} usersById={usersById} />
    {finished ? <FinishedMeetingState meeting={meeting} onOpenMinutes={onOpenMinutes} /> : <MeetingActions meeting={meeting} currentUserId={currentUserId} usersById={usersById} onDelete={onDelete} onRespond={onRespond} onOpenMinutes={onOpenMinutes} />}
  </div>
);

const AgendaPreview = ({ meeting }: { meeting: Meeting }) => {
  const items = meeting.agenda_items?.length ? meeting.agenda_items : (meeting.agenda || '').split('\n').filter(Boolean).map((title, index) => ({ id: `legacy-${index}`, title }));
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
      {items.slice(0, 3).map((item, index) => <p key={item.id} className="truncate">{index + 1}. {item.title}</p>)}
      {items.length > 3 && <p className="text-[11px] font-black text-slate-400">+{items.length - 3}개 안건</p>}
    </div>
  );
};

const MeetingMeta = ({ meeting }: { meeting: Meeting }) => (
  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
    {meeting.location && <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-850 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{meeting.location}</span>}
    {meeting.meeting_url && <a href={meeting.meeting_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-850 text-toss-blue flex items-center gap-1"><Link className="w-3.5 h-3.5" />링크</a>}
    <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-850 flex items-center gap-1"><Users className="w-3.5 h-3.5" />{meeting.attendees.length}명 초대</span>
  </div>
);

const ResponseSummary = ({ meeting, usersById, prominent = false }: { meeting: Meeting; usersById: Map<string, User>; prominent?: boolean }) => {
  const responses = meeting.responses || {};
  const accepted = meeting.attendees.filter((id) => responses[id] === 'accepted').length;
  const declined = meeting.attendees.filter((id) => responses[id] === 'declined').length;
  const pending = Math.max(meeting.attendees.length - accepted - declined, 0);
  return (
    <div className={`flex flex-col gap-2 ${prominent ? 'lg:items-end' : ''}`}>
      <div className="flex items-center gap-2">
        {meeting.attendees.map((id) => {
          const attendee = usersById.get(id);
          const response = responses[id] || 'pending';
          const ringClass = response === 'accepted' ? 'ring-2 ring-emerald-400' : response === 'declined' ? 'ring-2 ring-rose-400 opacity-60 grayscale' : 'ring-2 ring-slate-250 dark:ring-slate-700';
          return <div key={id} className={ringClass + ' rounded-xl'} title={`${attendee?.name || id} · ${response}`}><Avatar name={attendee?.name || id} profileImage={attendee?.profile_image} className="w-8 h-8 text-[10px]" /></div>;
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
        <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">참석 {accepted}</span>
        <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-600">불참 {declined}</span>
        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">대기 {pending}</span>
      </div>
    </div>
  );
};

const MeetingActions: React.FC<MeetingCardProps> = ({ meeting, currentUserId, onRespond, onOpenMinutes }) => {
  const myResponse = meeting.responses?.[currentUserId] || 'pending';
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-3">
      <span className="text-xs font-black text-slate-400">내 응답: {myResponse === 'accepted' ? '참석' : myResponse === 'declined' ? '불참' : '대기'}</span>
      <div className="flex gap-2">
        <button onClick={onOpenMinutes} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"><FileText className="w-3.5 h-3.5" /> 회의록</button>
        <button onClick={() => onRespond('accepted')} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> 참석</button>
        <button onClick={() => onRespond('declined')} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> 불참</button>
      </div>
    </div>
  );
};

const FinishedMeetingState = ({ meeting, onOpenMinutes }: { meeting: Meeting; onOpenMinutes: () => void }) => (
  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-xs font-black text-slate-500"><FileText className="w-4 h-4" />종료된 회의</div>
    <div className="flex flex-wrap gap-2 text-[10px] font-black">
      <span className={`px-2 py-1 rounded-full ${meeting.notes?.trim() ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{meeting.notes?.trim() ? '회의록 작성됨' : '회의록 필요'}</span>
      <span className={`px-2 py-1 rounded-full ${meeting.decisions?.trim() ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{meeting.decisions?.trim() ? '결정사항 기록됨' : '결정사항 없음'}</span>
    </div>
    <button onClick={onOpenMinutes} className="self-start px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"><FileText className="w-3.5 h-3.5" /> 회의록 열기</button>
  </div>
);
