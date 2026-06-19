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
import { requestDeleteConfirmation } from '../utils/deleteConfirm';
import { getUsers } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Meeting, MeetingAgendaItem, MeetingNote, User } from '../types';
import { ModalOverlay } from './ModalOverlay';
import { Avatar } from './Avatar';
import { MeetingMinutesModal } from './MeetingMinutesModal';
import { CustomDatePicker } from './CustomDatePicker';
import { CustomTimePicker } from './CustomTimePicker';
import { UserMultiSelect } from './UserMultiSelect';
import { Badge, Button, DashboardGrid, DashboardGridItem, EmptyState, IconButton, Page, PageBody, PageHeader, Panel } from './ui';

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
    <Page scroll className="h-full text-left">
      <PageHeader
        title="회의"
        description={`${activeProject.name} 회의 일정과 회의록을 관리합니다.`}
        actions={(
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            회의 생성
          </Button>
        )}
      />

      <DashboardGrid>
        <DashboardGridItem span={4}>
        <SummaryCard
          title="다음 예정 회의"
          value={nextMeeting?.title || '예정 없음'}
          sub={nextMeeting ? formatDateLine(nextMeeting) : '등록된 예정 회의가 없습니다.'}
          badge={nextMeeting ? dDayLabel(nextMeeting.start_date) : '-'}
          avatars={nextMeeting?.attendees || []}
          usersById={usersById}
          prominent
        />
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <SummaryCard title="예정 회의" value={`${upcoming.length}`} sub={`이번 주 ${upcoming.filter((m) => dayDiff(m.start_date) <= 7).length}건`} />
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <SummaryCard title="진행 중 회의" value={`${ongoing.length}`} sub="현재 시간 기준" />
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <SummaryCard title="마감 임박 회의" value={`${urgent}`} sub="D-1 이내" danger />
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <SummaryCard title="완료 회의" value={`${finished.length}`} sub={`이번 달 ${finishedThisMonth}건`} />
        </DashboardGridItem>
      </DashboardGrid>

      <PageBody>
      <div className="pm-meeting-workspace">
        <MeetingSchedulePanel
          meetings={meetings}
          selectedId={selectedMeeting?.id || ''}
          usersById={usersById}
          onCreate={() => setCreateOpen(true)}
          onSelect={(meeting) => setSelectedMeetingId(meeting.id)}
        />

        <main className="pm-meeting-main">
          {selectedMeeting ? (
            <>
              <div className="pm-meeting-section-head">
                <div>
                  <p className="pm-meeting-section-head__eyebrow">선택한 회의</p>
                  <h2 className="pm-meeting-section-head__title">{selectedMeeting.title}</h2>
                </div>
                <Badge tone="meeting">{getMeetingStatusLabel(selectedMeeting)}</Badge>
              </div>
              <MeetingDetailCard
                meeting={selectedMeeting}
                currentUserId={user?.id || ''}
                onDelete={async () => {
                  if (!requestDeleteConfirmation({
                    title: '회의 삭제',
                    targetName: selectedMeeting.title,
                    description: '회의 일정, 참석 응답, 회의록 메모가 함께 삭제될 수 있습니다.',
                  })) return;
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
            <EmptyState text="회의를 선택해 주세요." variant="dashed" className="pm-meeting-empty-fill" />
          )}
        </main>

        <aside className="pm-meeting-aside">
          {selectedMeeting && (
            <div className="pm-meeting-section-head">
              <div>
                <p className="pm-meeting-section-head__eyebrow">회의 보조 정보</p>
                <p className="pm-meeting-section-head__sub">{selectedMeeting.title} 기준</p>
              </div>
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
      </PageBody>
    </Page>
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
  <Panel flush className="pm-meeting-summary">
    <div className="pm-meeting-summary__header">
      <div className="min-w-0">
        <p className="pm-meeting-summary__label">{title}</p>
        <h3 className={`pm-meeting-summary__value ${prominent ? 'pm-meeting-summary__value--prominent' : 'pm-meeting-summary__value--metric'}`}>{value}</h3>
        <p className={`pm-meeting-summary__sub ${danger ? 'pm-meeting-summary__sub--danger' : ''}`}>{sub}</p>
      </div>
      {badge && <Badge tone="task">{badge}</Badge>}
    </div>
    {avatars.length > 0 && <AvatarStack ids={avatars} usersById={usersById || new Map()} />}
  </Panel>
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
    <Panel className="pm-meeting-schedule">
      <div className="pm-meeting-schedule__header">
        <h3 className="pm-meeting-schedule__title">회의 일정</h3>
        <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onCreate}>
          회의 생성
        </Button>
      </div>
      <div className="pm-meeting-schedule__tabs">
        <div className="pm-segmented pm-segmented--4">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`pm-segmented__button ${statusFilter === tab.key ? 'pm-segmented__button--active' : ''}`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>
      </div>
      <div className="pm-meeting-schedule__section">
        <div className="pm-meeting-week__top">
          <span>{formatKoreanMonth(weekStart)} · {weekStart.getDate()}일 - {weekDays[6].getDate()}일</span>
          <div className="pm-meeting-week__nav">
            <IconButton label="이전 주" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => setWeekStart((prev) => addDays(prev, -7))} />
            <IconButton label="다음 주" icon={<ChevronRight className="w-4 h-4" />} onClick={() => setWeekStart((prev) => addDays(prev, 7))} />
          </div>
        </div>
        <div className="pm-segmented pm-segmented--2 pm-meeting-range-tabs">
          <button
            onClick={() => {
              setSelectedDate(null);
              setRangeFilter('all');
            }}
            className={`pm-segmented__button ${selectedDate === null && rangeFilter === 'all' ? 'pm-segmented__button--active' : ''}`}
          >
            전체 기간 {filteredMeetings.length}
          </button>
          <button
            onClick={() => {
              setSelectedDate(null);
              setRangeFilter('week');
            }}
            className={`pm-segmented__button ${selectedDate === null && rangeFilter === 'week' ? 'pm-segmented__button--active' : ''}`}
          >
            이번 주 {weekMeetings.length}
          </button>
        </div>
        <div className="pm-meeting-week__days">
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
                className={`pm-meeting-day ${active ? 'pm-meeting-day--active' : ''}`}
              >
                <span className="pm-meeting-day__name">{['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}</span>
                <span className={`pm-meeting-day__number ${today || active ? 'pm-meeting-day__number--active' : ''}`}>
                  {date.getDate()}
                </span>
                {dayMeetings.length > 0 && (
                  <span className="pm-meeting-day__dot" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pm-meeting-list">
        <div className="pm-meeting-list__header">
          <p className="pm-meeting-list__title">{visibleRangeLabel}</p>
          <Badge tone="neutral">{visibleMeetings.length}건</Badge>
        </div>
        {visibleMeetings.length === 0 ? (
          <EmptyState text={emptyRangeLabel} />
        ) : visibleMeetings.map((meeting) => {
          const selected = meeting.id === selectedId;
          return (
            <button
              key={meeting.id}
              onClick={() => onSelect(meeting)}
              className={`pm-meeting-card ${selected ? 'pm-meeting-card--selected' : ''}`}
            >
              <div className="pm-meeting-card__head">
                <div className="min-w-0">
                  <p className="pm-meeting-card__title">{meeting.title}</p>
                  <p className="pm-meeting-card__time">
                    {selectedDate ? '' : `${meeting.start_date} · `}{meeting.start_time} ~ {meeting.end_time}
                  </p>
                </div>
                <Badge tone="task">{dDayLabel(meeting.start_date)}</Badge>
              </div>
              <div className="pm-meeting-card__footer">
                <AvatarStack ids={meeting.attendees} usersById={usersById} compact />
                <Badge tone="meeting">{getMeetingStatusLabel(meeting)}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
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
    <Panel className="pm-meeting-detail">
      <div className="pm-meeting-detail__top">
        <div className="pm-meeting-detail__content">
          <div className="pm-meeting-detail__title-row">
            <h2 className="pm-meeting-detail__title">{meeting.title}</h2>
            <Badge tone="meeting">{getMeetingStatusLabel(meeting)}</Badge>
          </div>
          <div className="pm-meeting-detail__meta-grid">
            <MetaLine icon={<CalendarClock className="w-4 h-4" />} text={`${meeting.start_date} ${meeting.start_time} ~ ${meeting.end_time}`} />
            <MetaLine icon={<MapPin className="w-4 h-4" />} text={meeting.location || '장소 미정'} />
            <MetaLine icon={<Clock className="w-4 h-4" />} text={dDayLabel(meeting.start_date)} />
            <MetaLine icon={<Users className="w-4 h-4" />} text={`${meeting.attendees.length}명 참여 대상`} />
          </div>
        </div>
        <div className="pm-meeting-detail__actions">
          <Button variant="secondary" size="sm" onClick={onOpenMinutes}>회의록</Button>
          {!isFinished(meeting) && (
            <Button variant="primary" size="sm" onClick={() => onRespond('accepted')} data-response={myResponse}>
              참석
            </Button>
          )}
          <IconButton label="?뚯쓽 ??젣" icon={<Trash2 className="w-4 h-4" />} onClick={onDelete} />
          <IconButton label="?뷀꽣蹂닿린" icon={<MoreHorizontal className="w-4 h-4" />} />
        </div>
      </div>
      {meeting.meeting_url && (
        <a href={meeting.meeting_url} target="_blank" rel="noreferrer" className="pm-meeting-detail__link">
          <Link className="w-3.5 h-3.5" />
          회의 링크 열기
        </a>
      )}
    </Panel>
  );
};

const MetaLine = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="pm-meeting-meta-line">
    {icon}
    <span>{text}</span>
  </div>
);

const AgendaCard = ({ meeting, onOpenMinutes }: { meeting: Meeting; onOpenMinutes: () => void }) => {
  const agenda = getAgendaItems(meeting);
  return (
    <section className="pm-panel pm-meeting-info-card">
      <div className="pm-meeting-card-head">
        <h3 className="pm-meeting-card-head__title">안건 ({agenda.length})</h3>
        <Button variant="secondary" size="sm" onClick={onOpenMinutes}>안건 메모</Button>
      </div>
      <div className="pm-meeting-agenda-list">
        {agenda.length === 0 ? (
          <p className="pm-meeting-empty-text">등록된 안건이 없습니다.</p>
        ) : agenda.map((item, index) => (
          <div key={item.id} className="pm-meeting-agenda-item">
            <span className="pm-meeting-agenda-item__index">{index + 1}</span>
            <span className="pm-meeting-agenda-item__title">{item.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const MinutesPreviewCard = ({ meeting, notes, onOpenMinutes }: { meeting: Meeting; notes: MeetingNote[]; onOpenMinutes: () => void }) => {
  const fallback = notes.slice(0, 4).map((note) => `- ${note.note_time} ${note.content}`).join('\n');
  return (
    <section className="pm-panel pm-meeting-minutes-preview">
      <div className="pm-meeting-card-head">
        <h3 className="pm-meeting-card-head__title">회의록</h3>
        <Button variant="primary" size="sm" onClick={onOpenMinutes}>
          메모하기
        </Button>
      </div>
      <div className="pm-meeting-minutes-preview__body">
        {meeting.notes?.trim() || fallback || '회의 중 메모를 남기면 회의록 초안이 이곳에 표시됩니다.'}
      </div>
      <p className="pm-meeting-muted">저장됨 {meeting.updated_at || '-'}</p>
    </section>
  );
};

const ParticipantsCard = ({ meeting, usersById, users }: { meeting: Meeting | null; usersById: Map<string, User>; users: User[] }) => {
  const ids = meeting?.attendees || [];
  return (
    <section className="pm-panel pm-meeting-side-card">
      <div className="pm-meeting-card-head">
        <div>
          <h3 className="pm-meeting-card-head__title">참여 인력 ({ids.length})</h3>
          <p className="pm-meeting-muted">{meeting?.title || '선택 회의'} 참여자</p>
        </div>
        <Button variant="secondary" size="sm">초대</Button>
      </div>
      <div className="pm-meeting-person-list">
        {(ids.length ? ids.map((id) => usersById.get(id)).filter(Boolean) : users.slice(0, 5)).map((person) => (
          <div key={person!.id} className="pm-meeting-person">
            <Avatar name={person!.name} profileImage={person!.profile_image} className="w-9 h-9 text-xs" />
            <div className="pm-meeting-person__content">
              <p className="pm-meeting-person__name">{person!.name}</p>
              <p className="pm-meeting-person__meta">{[person!.position, person!.department].filter(Boolean).join(' · ') || '프로젝트 멤버'}</p>
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
    <section className="pm-panel pm-meeting-side-card">
      <div className="pm-meeting-card-head pm-meeting-card-head--stacked">
        <h3 className="pm-meeting-card-head__title">후속 작업 후보 ({items.length})</h3>
        <p className="pm-meeting-muted">안건과 회의 메모에서 작업으로 전환할 만한 항목입니다.</p>
      </div>
      <div className="pm-meeting-follow-list">
        {items.length === 0 ? <p className="pm-meeting-empty-text">안건이나 결정성 메모가 있으면 후속 작업 후보가 표시됩니다.</p> : items.map((item) => (
          <div key={item.title} className="pm-meeting-follow-item">
            <span className={`px-2 py-1 rounded-full text-[10px] font-black text-center ${item.priority === '높음' ? 'bg-red-50 text-red-500' : item.priority === '중간' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.priority}</span>
            <div className="pm-meeting-follow-item__content">
              <p className="pm-meeting-follow-item__title">{item.title}</p>
              <p className="pm-meeting-follow-item__owner">{item.owner?.name || '담당 미정'}</p>
            </div>
            <span className="pm-meeting-muted">{item.due}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const CommentsCard = ({ meeting, notes }: { meeting: Meeting | null; notes: MeetingNote[] }) => {
  return (
  <section className="pm-panel pm-meeting-side-card pm-meeting-comments">
    <div>
      <h3 className="pm-meeting-card-head__title">댓글/메모 ({notes.length})</h3>
      <p className="pm-meeting-muted">{meeting?.title || '선택 회의'}에서 작성된 기록</p>
    </div>
    <div className="pm-meeting-comments__list">
      {notes.length === 0 ? <p className="pm-meeting-empty-text">아직 회의 메모가 없습니다.</p> : notes.slice(-4).reverse().map((note) => (
        <div key={note.id} className="pm-meeting-comment">
          <Avatar name={note.author_name || 'Me'} className="w-8 h-8 text-[10px]" />
          <div className="pm-meeting-comment__content">
            <p className="pm-meeting-comment__author">{note.author_name || 'Me'} <span>{note.note_time}</span></p>
            <p className="pm-meeting-comment__text">{note.content}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="pm-meeting-comment-input">
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
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="pm-meeting-create">
        <div className="pm-meeting-create__header">
          <h3 className="pm-meeting-create__title">회의 추가</h3>
          <IconButton label="닫기" icon={<X className="w-4 h-4" />} onClick={onClose} />
        </div>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="회의 제목" className="pm-input" />
        <div className="pm-meeting-create__grid pm-meeting-create__grid--3">
          <CustomDatePicker value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} />
          <CustomTimePicker value={form.start_time} onChange={(value) => setForm({ ...form, start_time: value })} positionDirection="down" />
          <CustomTimePicker value={form.end_time} onChange={(value) => setForm({ ...form, end_time: value })} positionDirection="down" />
        </div>
        <div className="pm-meeting-create__grid pm-meeting-create__grid--2">
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="장소" className="pm-input" />
          <input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="온라인 링크" className="pm-input" />
        </div>
        <div className="pm-meeting-create__agenda">
          <div className="pm-meeting-create__section-head">
            <span>안건</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, agendaItems: [...form.agendaItems, { id: `agenda-${Date.now()}-${form.agendaItems.length}`, title: '' }] })}>안건 추가</Button>
          </div>
          {form.agendaItems.map((item, index) => (
            <div key={item.id} className="pm-meeting-create__agenda-row">
              <span className="pm-meeting-create__agenda-index">{index + 1}</span>
              <input value={item.title} onChange={(e) => setForm((prev) => ({ ...prev, agendaItems: prev.agendaItems.map((agenda) => agenda.id === item.id ? { ...agenda, title: e.target.value } : agenda) }))} placeholder="논의할 안건" className="pm-input" />
              {form.agendaItems.length > 1 && (
                <IconButton label="안건 삭제" icon={<X className="w-4 h-4" />} onClick={() => setForm({ ...form, agendaItems: form.agendaItems.filter((agenda) => agenda.id !== item.id) })} />
              )}
            </div>
          ))}
        </div>
        <UserMultiSelect users={users} selectedIds={form.attendees} onChange={(ids, names) => setForm({ ...form, attendees: ids, attendeeNames: names })} placeholder="참석 인력 선택" />
        <div className="pm-meeting-create__footer">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </div>
      </form>
    </ModalOverlay>
  );
};
