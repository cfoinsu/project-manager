import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link,
  MapPin,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { createMeeting, deleteMeeting, getMeetingNotes, getMeetings, respondMeeting } from '../utils/collaborationApi';
import { getUsers } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Meeting, MeetingAgendaItem, MeetingNote, User } from '../types';
import { ModalOverlay } from './ModalOverlay';
import { Avatar } from './Avatar';
import { MeetingMinutesModal } from './MeetingMinutesModal';
import { CustomDatePicker } from './CustomDatePicker';
import { CustomTimePicker } from './CustomTimePicker';
import { UserMultiSelect } from './UserMultiSelect';

const toDateTime = (date?: string, time?: string) => new Date(`${date || '1970-01-01'}T${time || '00:00'}`);
const todayStr = () => new Date().toISOString().slice(0, 10);

const isFinished = (meeting: Meeting) => toDateTime(meeting.start_date, meeting.end_time || meeting.start_time).getTime() < Date.now();
const isOngoing = (meeting: Meeting) => {
  const now = Date.now();
  return toDateTime(meeting.start_date, meeting.start_time).getTime() <= now && toDateTime(meeting.start_date, meeting.end_time || meeting.start_time).getTime() >= now;
};

type MeetingStatusFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';

const getMeetingStatus = (meeting: Meeting): Exclude<MeetingStatusFilter, 'all'> => {
  if (isFinished(meeting)) return 'completed';
  if (isOngoing(meeting)) return 'ongoing';
  return 'upcoming';
};

const getMeetingStatusLabel = (meeting: Meeting) => {
  const status = getMeetingStatus(meeting);
  if (status === 'completed') return '완료';
  if (status === 'ongoing') return '진행';
  return '예정';
};

const dayDiff = (date: string) => {
  const today = new Date(todayStr());
  const target = new Date(date);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const dDayLabel = (date: string) => {
  const diff = dayDiff(date);
  if (diff === 0) return 'D-0';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};

const formatDateLine = (meeting: Meeting) => `${meeting.start_date} ${meeting.start_time} ~ ${meeting.end_time}`;

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

const formatKoreanMonth = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

const sortMeetingsByNearest = (items: Meeting[]) => {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aTime = toDateTime(a.start_date, a.start_time).getTime();
    const bTime = toDateTime(b.start_date, b.start_time).getTime();
    const distance = Math.abs(aTime - now) - Math.abs(bTime - now);
    return distance || aTime - bTime;
  });
};

const getAgendaItems = (meeting?: Meeting | null): MeetingAgendaItem[] => {
  if (!meeting) return [];
  if (meeting.agenda_items?.length) return meeting.agenda_items;
  return (meeting.agenda || '')
    .split('\n')
    .map((title, index) => ({ id: `legacy-${index}`, title: title.trim() }))
    .filter((item) => item.title);
};

export const MeetingsView: React.FC = () => {
  const { activeProject } = useProjectStore();
  const { user, serverMode } = useAuthStore();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notes, setNotes] = useState<MeetingNote[]>([]);

  const load = async () => {
    if (!activeProject) return;
    try {
      const [meetingList, userList] = await Promise.all([getMeetings(activeProject.id), getUsers(serverMode)]);
      const sorted = meetingList.sort((a, b) => toDateTime(a.start_date, a.start_time).getTime() - toDateTime(b.start_date, b.start_time).getTime());
      setMeetings(sorted);
      setUsers(userList.filter((item) => item.status !== 'inactive'));
      const next = sorted.find((meeting) => !isFinished(meeting)) || sorted[sorted.length - 1];
      setSelectedMeetingId((prev) => prev || next?.id || '');
    } finally {
      // reserved for future skeleton loading state
    }
  };

  useEffect(() => {
    load();
  }, [activeProject?.id]);

  const selectedMeeting = useMemo(() => {
    return meetings.find((meeting) => meeting.id === selectedMeetingId) || meetings.find((meeting) => !isFinished(meeting)) || meetings[0] || null;
  }, [meetings, selectedMeetingId]);

  useEffect(() => {
    if (!selectedMeeting) {
      setNotes([]);
      return;
    }
    getMeetingNotes(selectedMeeting.id).then(setNotes).catch(() => setNotes([]));
  }, [selectedMeeting?.id]);

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const upcoming = useMemo(() => meetings.filter((meeting) => getMeetingStatus(meeting) === 'upcoming'), [meetings]);
  const ongoing = useMemo(() => meetings.filter((meeting) => getMeetingStatus(meeting) === 'ongoing'), [meetings]);
  const finished = useMemo(() => meetings.filter(isFinished).reverse(), [meetings]);
  const urgent = useMemo(() => upcoming.filter((meeting) => dayDiff(meeting.start_date) <= 1).length, [upcoming]);
  const currentMonth = new Date().getMonth();
  const finishedThisMonth = finished.filter((meeting) => new Date(meeting.start_date).getMonth() === currentMonth).length;
  const nextMeeting = upcoming[0] || null;

  if (!activeProject) return <div className="p-6 text-sm font-bold text-slate-400">프로젝트를 먼저 선택해 주세요.</div>;

  return (
    <div className="h-full overflow-y-auto text-left flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          title="다음 예정 회의"
          value={nextMeeting?.title || '예정 없음'}
          sub={nextMeeting ? formatDateLine(nextMeeting) : '등록된 예정 회의가 없습니다.'}
          badge={nextMeeting ? dDayLabel(nextMeeting.start_date) : '-'}
          avatars={nextMeeting?.attendees || []}
          usersById={usersById}
          prominent
        />
        <SummaryCard title="예정 회의" value={`${upcoming.length}`} sub={`이번 주 ${upcoming.filter((m) => dayDiff(m.start_date) <= 7).length}건`} />
        <SummaryCard title="진행 중 회의" value={`${ongoing.length}`} sub="현재 시간 기준" />
        <SummaryCard title="마감 임박 회의" value={`${urgent}`} sub="D-1 이내" danger />
        <SummaryCard title="완료 회의" value={`${finished.length}`} sub={`이번 달 ${finishedThisMonth}건`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)_370px] gap-5 min-h-[660px]">
        <MeetingSchedulePanel
          meetings={meetings}
          selectedId={selectedMeeting?.id || ''}
          usersById={usersById}
          onCreate={() => setCreateOpen(true)}
          onSelect={(meeting) => setSelectedMeetingId(meeting.id)}
        />

        <main className="flex flex-col gap-4 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 p-3">
          {selectedMeeting ? (
            <>
              <div className="px-1 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase text-toss-blue">선택한 회의</p>
                  <h2 className="text-base font-black text-slate-950 dark:text-slate-100 mt-1">{selectedMeeting.title}</h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-500">
                  {getMeetingStatusLabel(selectedMeeting)}
                </span>
              </div>
              <MeetingDetailCard
                meeting={selectedMeeting}
                currentUserId={user?.id || ''}
                onDelete={async () => {
                  await deleteMeeting(selectedMeeting.id);
                  setSelectedMeetingId('');
                  await load();
                }}
                onRespond={async (response) => {
                  await respondMeeting(selectedMeeting.id, response);
                  await load();
                }}
                onOpenMinutes={() => setMinutesMeeting(selectedMeeting)}
              />
              <AgendaCard meeting={selectedMeeting} onOpenMinutes={() => setMinutesMeeting(selectedMeeting)} />
              <MinutesPreviewCard meeting={selectedMeeting} notes={notes} onOpenMinutes={() => setMinutesMeeting(selectedMeeting)} />
            </>
          ) : (
            <div className="h-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-sm font-bold text-slate-400">회의를 선택해 주세요.</div>
          )}
        </main>

        <aside className="flex flex-col gap-4 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 p-3">
          {selectedMeeting && (
            <div className="px-1">
              <p className="text-[11px] font-black uppercase text-toss-blue">회의 보조 정보</p>
              <p className="text-xs font-bold text-slate-500 mt-1">{selectedMeeting.title} 기준</p>
            </div>
          )}
          <ParticipantsCard meeting={selectedMeeting} usersById={usersById} users={users} />
          <FollowUpCandidatesCard meeting={selectedMeeting} notes={notes} usersById={usersById} />
          <CommentsCard meeting={selectedMeeting} notes={notes} />
        </aside>
      </div>

      {createOpen && (
        <MeetingCreateModal
          projectId={activeProject.id}
          users={users}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            setSelectedMeetingId('');
            await load();
          }}
        />
      )}
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
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  value: string;
  sub: string;
  badge?: string;
  avatars?: string[];
  usersById?: Map<string, User>;
  prominent?: boolean;
  danger?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, sub, badge, avatars = [], usersById, prominent, danger }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-h-[126px] flex flex-col justify-between shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-500">{title}</p>
        <h3 className={`${prominent ? 'text-base' : 'text-3xl'} font-black text-slate-950 dark:text-slate-100 mt-2 truncate`}>{value}</h3>
        <p className={`text-xs font-bold mt-2 ${danger ? 'text-red-500' : 'text-slate-500'}`}>{sub}</p>
      </div>
      {badge && <span className="px-3 py-2 rounded-full bg-blue-50 text-toss-blue text-xs font-black shrink-0">{badge}</span>}
    </div>
    {avatars.length > 0 && <AvatarStack ids={avatars} usersById={usersById || new Map()} />}
  </section>
);

interface MeetingSchedulePanelProps {
  meetings: Meeting[];
  selectedId: string;
  usersById: Map<string, User>;
  onCreate: () => void;
  onSelect: (meeting: Meeting) => void;
}

const MeetingSchedulePanel: React.FC<MeetingSchedulePanelProps> = ({ meetings, selectedId, usersById, onCreate, onSelect }) => {
  const [statusFilter, setStatusFilter] = useState<MeetingStatusFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'week'>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const filteredMeetings = useMemo(() => {
    if (statusFilter === 'all') return meetings;
    return meetings.filter((meeting) => getMeetingStatus(meeting) === statusFilter);
  }, [meetings, statusFilter]);

  const tabItems: { key: MeetingStatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: meetings.length },
    { key: 'upcoming', label: '예정', count: meetings.filter((meeting) => getMeetingStatus(meeting) === 'upcoming').length },
    { key: 'ongoing', label: '진행', count: meetings.filter((meeting) => getMeetingStatus(meeting) === 'ongoing').length },
    { key: 'completed', label: '완료', count: meetings.filter((meeting) => getMeetingStatus(meeting) === 'completed').length },
  ];

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekStartStr = formatDateKey(weekDays[0]);
  const weekEndStr = formatDateKey(weekDays[6]);
  const weekMeetings = useMemo(() => {
    return filteredMeetings.filter((meeting) => meeting.start_date >= weekStartStr && meeting.start_date <= weekEndStr);
  }, [filteredMeetings, weekStartStr, weekEndStr]);
  const meetingsByDate = useMemo(() => {
    return weekMeetings.reduce<Record<string, Meeting[]>>((acc, meeting) => {
      acc[meeting.start_date] = acc[meeting.start_date] || [];
      acc[meeting.start_date].push(meeting);
      return acc;
    }, {});
  }, [weekMeetings]);
  const selectedDateMeetings = selectedDate ? meetingsByDate[selectedDate] || [] : [];
  const visibleMeetings = useMemo(() => {
    const source = selectedDate ? selectedDateMeetings : rangeFilter === 'all' ? filteredMeetings : weekMeetings;
    return sortMeetingsByNearest(source);
  }, [filteredMeetings, rangeFilter, selectedDate, selectedDateMeetings, weekMeetings]);
  const visibleRangeLabel = selectedDate ? `${selectedDate} 회의` : rangeFilter === 'all' ? '전체 기간 회의' : '이번 주 회의';
  const emptyRangeLabel = selectedDate ? '선택한 날짜에 표시할 회의가 없습니다.' : rangeFilter === 'all' ? '전체 기간에 표시할 회의가 없습니다.' : '이번 주에 표시할 회의가 없습니다.';

  useEffect(() => {
    if (selectedDate && (selectedDate < weekStartStr || selectedDate > weekEndStr)) {
      setSelectedDate(null);
      setRangeFilter('week');
    }
  }, [selectedDate, weekStartStr, weekEndStr]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">회의 일정</h3>
        <button onClick={onCreate} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          회의 생성
        </button>
      </div>
      <div className="px-4 pt-3">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 dark:bg-slate-850 p-1">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`py-1.5 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                statusFilter === tab.key
                  ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
          <span>{formatKoreanMonth(weekStart)} · {weekStart.getDate()}일 - {weekDays[6].getDate()}일</span>
          <div className="flex gap-1">
            <button
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
              aria-label="이전 주"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
              aria-label="다음 주"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-850 p-1">
          <button
            onClick={() => {
              setSelectedDate(null);
              setRangeFilter('all');
            }}
            className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              selectedDate === null && rangeFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            전체 기간 {filteredMeetings.length}
          </button>
          <button
            onClick={() => {
              setSelectedDate(null);
              setRangeFilter('week');
            }}
            className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              selectedDate === null && rangeFilter === 'week'
                ? 'bg-white dark:bg-slate-900 text-toss-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            이번 주 {weekMeetings.length}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((date) => {
            const dateStr = formatDateKey(date);
            const dayMeetings = meetingsByDate[dateStr] || [];
            const active = dateStr === selectedDate;
            const today = dateStr === todayStr();
            return (
              <button
                key={dateStr}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setRangeFilter('week');
                }}
                className={`relative h-12 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  active
                    ? 'border-toss-blue bg-blue-50/80 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <span className="text-[10px] font-black text-slate-400 leading-none">{['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}</span>
                <span className={`mt-1 text-xs font-black leading-none ${today ? 'text-toss-blue' : active ? 'text-toss-blue' : 'text-slate-700 dark:text-slate-200'}`}>
                  {date.getDate()}
                </span>
                {dayMeetings.length > 0 && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-toss-blue" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="px-1 flex items-center justify-between">
          <p className="text-xs font-black text-slate-800 dark:text-slate-100">{visibleRangeLabel}</p>
          <span className="text-[10px] font-black text-slate-400">{visibleMeetings.length}건</span>
        </div>
        {visibleMeetings.length === 0 ? (
          <div className="py-14 text-center text-xs font-bold text-slate-400">{emptyRangeLabel}</div>
        ) : visibleMeetings.map((meeting) => {
          const selected = meeting.id === selectedId;
          return (
            <button
              key={meeting.id}
              onClick={() => onSelect(meeting)}
              className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${selected ? 'border-toss-blue bg-blue-50/80 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{meeting.title}</p>
                  <p className="text-[11px] font-bold text-slate-500 mt-1">
                    {selectedDate ? '' : `${meeting.start_date} · `}{meeting.start_time} ~ {meeting.end_time}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-[10px] font-black text-toss-blue">{dDayLabel(meeting.start_date)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <AvatarStack ids={meeting.attendees} usersById={usersById} compact />
                <span className="text-[10px] font-black text-slate-400">{getMeetingStatusLabel(meeting)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

interface MeetingDetailCardProps {
  meeting: Meeting;
  currentUserId: string;
  onDelete: () => Promise<void>;
  onRespond: (response: 'accepted' | 'declined') => Promise<void>;
  onOpenMinutes: () => void;
}

const MeetingDetailCard: React.FC<MeetingDetailCardProps> = ({ meeting, currentUserId, onDelete, onRespond, onOpenMinutes }) => {
  const myResponse = meeting.responses?.[currentUserId] || 'pending';
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-100 truncate">{meeting.title}</h2>
            <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-toss-blue text-[10px] font-black">{getMeetingStatusLabel(meeting)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs font-bold text-slate-600 dark:text-slate-300">
            <MetaLine icon={<CalendarClock className="w-4 h-4" />} text={`${meeting.start_date} ${meeting.start_time} ~ ${meeting.end_time}`} />
            <MetaLine icon={<MapPin className="w-4 h-4" />} text={meeting.location || '장소 미정'} />
            <MetaLine icon={<Clock className="w-4 h-4" />} text={dDayLabel(meeting.start_date)} />
            <MetaLine icon={<Users className="w-4 h-4" />} text={`${meeting.attendees.length}명 참여 대상`} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onOpenMinutes} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black cursor-pointer">회의록</button>
          {!isFinished(meeting) && (
            <button onClick={() => onRespond('accepted')} className={`px-3 py-2 rounded-lg text-xs font-black cursor-pointer ${myResponse === 'accepted' ? 'bg-toss-blue text-white' : 'bg-toss-blue text-white'}`}>
              참석
            </button>
          )}
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      {meeting.meeting_url && (
        <a href={meeting.meeting_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-toss-blue">
          <Link className="w-3.5 h-3.5" />
          회의 링크 열기
        </a>
      )}
    </section>
  );
};

const MetaLine = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 min-w-0 text-slate-500">
    {icon}
    <span className="truncate">{text}</span>
  </div>
);

const AgendaCard = ({ meeting, onOpenMinutes }: { meeting: Meeting; onOpenMinutes: () => void }) => {
  const agenda = getAgendaItems(meeting);
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">안건 ({agenda.length})</h3>
        <button onClick={onOpenMinutes} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black cursor-pointer">안건 메모</button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {agenda.length === 0 ? (
          <p className="py-4 text-xs font-bold text-slate-400">등록된 안건이 없습니다.</p>
        ) : agenda.map((item, index) => (
          <div key={item.id} className="py-2.5 flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-500">{index + 1}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const MinutesPreviewCard = ({ meeting, notes, onOpenMinutes }: { meeting: Meeting; notes: MeetingNote[]; onOpenMinutes: () => void }) => {
  const fallback = notes.slice(0, 4).map((note) => `- ${note.note_time} ${note.content}`).join('\n');
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col gap-3 h-[340px] min-h-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">회의록</h3>
        <button onClick={onOpenMinutes} className="px-3 py-1.5 rounded-lg bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-black cursor-pointer flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          메모하기
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-y-auto p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
        {meeting.notes?.trim() || fallback || '회의 중 메모를 남기면 회의록 초안이 이곳에 표시됩니다.'}
      </div>
      <p className="text-[11px] font-bold text-slate-400">저장됨 {meeting.updated_at || '-'}</p>
    </section>
  );
};

const ParticipantsCard = ({ meeting, usersById, users }: { meeting: Meeting | null; usersById: Map<string, User>; users: User[] }) => {
  const ids = meeting?.attendees || [];
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">참여 인력 ({ids.length})</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{meeting?.title || '선택 회의'} 참여자</p>
        </div>
        <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black cursor-pointer">초대</button>
      </div>
      <div className="flex flex-col gap-3">
        {(ids.length ? ids.map((id) => usersById.get(id)).filter(Boolean) : users.slice(0, 5)).map((person) => (
          <div key={person!.id} className="flex items-center gap-3">
            <Avatar name={person!.name} profileImage={person!.profile_image} className="w-9 h-9 text-xs" />
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{person!.name}</p>
              <p className="text-[11px] font-bold text-slate-400 truncate">{[person!.position, person!.department].filter(Boolean).join(' · ') || '프로젝트 멤버'}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const FollowUpCandidatesCard = ({ meeting, notes, usersById }: { meeting: Meeting | null; notes: MeetingNote[]; usersById: Map<string, User> }) => {
  const agenda = getAgendaItems(meeting);
  const owners = meeting?.attendees || [];
  const memoCandidates = notes
    .filter((note) => /결정|진행|담당|마감|수정|확인|필요|이슈|리스크/.test(note.content))
    .slice(0, 3);
  const sourceItems = memoCandidates.length > 0
    ? memoCandidates.map((note, index) => ({ title: note.content, index }))
    : agenda.slice(0, 3).map((item, index) => ({ title: item.title, index }));
  const items = sourceItems.map((item) => ({
    title: item.title,
    priority: item.index === 0 ? '높음' : item.index === 1 ? '중간' : '낮음',
    owner: usersById.get(owners[item.index % Math.max(owners.length, 1)] || ''),
    due: meeting ? `D${dayDiff(meeting.start_date) >= 0 ? '-' + dayDiff(meeting.start_date) : '+' + Math.abs(dayDiff(meeting.start_date))}` : '-',
  }));
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">후속 작업 후보 ({items.length})</h3>
        <p className="text-[10px] font-bold text-slate-400 mt-0.5">안건과 회의 메모에서 작업으로 전환할 만한 항목입니다.</p>
      </div>
      <div className="flex flex-col gap-3">
        {items.length === 0 ? <p className="text-xs font-bold text-slate-400">안건이나 결정성 메모가 있으면 후속 작업 후보가 표시됩니다.</p> : items.map((item) => (
          <div key={item.title} className="grid grid-cols-[54px_1fr_auto] gap-2 items-center text-xs">
            <span className={`px-2 py-1 rounded-full text-[10px] font-black text-center ${item.priority === '높음' ? 'bg-red-50 text-red-500' : item.priority === '중간' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.priority}</span>
            <div className="min-w-0">
              <p className="font-black text-slate-700 dark:text-slate-200 truncate">{item.title}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{item.owner?.name || '담당 미정'}</p>
            </div>
            <span className="text-[11px] font-bold text-slate-400">{item.due}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const CommentsCard = ({ meeting, notes }: { meeting: Meeting | null; notes: MeetingNote[] }) => {
  return (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3">
    <div>
      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">댓글/메모 ({notes.length})</h3>
      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{meeting?.title || '선택 회의'}에서 작성된 기록</p>
    </div>
    <div className="flex flex-col gap-3 max-h-52 overflow-y-auto">
      {notes.length === 0 ? <p className="text-xs font-bold text-slate-400">아직 회의 메모가 없습니다.</p> : notes.slice(-4).reverse().map((note) => (
        <div key={note.id} className="flex items-start gap-3">
          <Avatar name={note.author_name || 'Me'} className="w-8 h-8 text-[10px]" />
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-800 dark:text-slate-100">{note.author_name || 'Me'} <span className="text-[10px] font-bold text-slate-400">{note.note_time}</span></p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{note.content}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-2 text-xs font-bold text-slate-400">
      댓글을 입력하세요...
      <Send className="w-4 h-4 ml-auto text-slate-300" />
    </div>
  </section>
  );
};

const AvatarStack = ({ ids, usersById, compact = false }: { ids: string[]; usersById: Map<string, User>; compact?: boolean }) => {
  const visible = ids.slice(0, compact ? 3 : 4);
  return (
    <div className="flex -space-x-2 items-center">
      {visible.map((id) => {
        const user = usersById.get(id);
        return <Avatar key={id} name={user?.name || id} profileImage={user?.profile_image} className={`${compact ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'} border-2 border-white dark:border-slate-900`} />;
      })}
      {ids.length > visible.length && (
        <span className={`${compact ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'} rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border-2 border-white dark:border-slate-900 flex items-center justify-center font-black`}>
          +{ids.length - visible.length}
        </span>
      )}
    </div>
  );
};

interface MeetingCreateModalProps {
  projectId: string;
  users: User[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const MeetingCreateModal: React.FC<MeetingCreateModalProps> = ({ projectId, users, onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    start_date: todayStr(),
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
            <button type="button" onClick={() => setForm({ ...form, agendaItems: [...form.agendaItems, { id: `agenda-${Date.now()}-${form.agendaItems.length}`, title: '' }] })} className="text-xs font-black text-toss-blue cursor-pointer">안건 추가</button>
          </div>
          {form.agendaItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-500 flex items-center justify-center shrink-0">{index + 1}</span>
              <input value={item.title} onChange={(e) => setForm((prev) => ({ ...prev, agendaItems: prev.agendaItems.map((agenda) => agenda.id === item.id ? { ...agenda, title: e.target.value } : agenda) }))} placeholder="논의할 안건" className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-semibold outline-none" />
              {form.agendaItems.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, agendaItems: form.agendaItems.filter((agenda) => agenda.id !== item.id) })} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
        <UserMultiSelect users={users} selectedIds={form.attendees} onChange={(ids, names) => setForm({ ...form, attendees: ids, attendeeNames: names })} placeholder="참석 인력 선택" />
        <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-black cursor-pointer disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
      </form>
    </ModalOverlay>
  );
};
