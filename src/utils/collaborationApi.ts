import type { AppNotification, Meeting, MeetingNote, PersonalTodo } from '../types';
import { apiRequest } from './api';

const nowStr = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const readList = <T>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const writeList = <T>(key: string, list: T[]) => {
  localStorage.setItem(key, JSON.stringify(list));
};

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('pa_user') || '{}')?.id || 'local-user';
  } catch {
    return 'local-user';
  }
};

const withOfflineFallback = async <T>(request: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> => {
  try {
    return await request();
  } catch (error: any) {
    if (error?.message === 'SERVER_OFFLINE') return await fallback();
    throw error;
  }
};

export const getMeetings = async (projectId?: string): Promise<Meeting[]> => {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return withOfflineFallback(
    async () => (await apiRequest(`/meetings${query}`)).meetings || [],
    () => {
      const meetings = readList<Meeting>('pa_meetings');
      const userId = currentUserId();
      return meetings
        .filter((meeting) => !projectId || meeting.project_id === projectId)
        .filter((meeting) => projectId || meeting.attendees.includes(userId) || meeting.created_by === userId);
    }
  );
};

export const createMeeting = async (payload: Partial<Meeting>): Promise<Meeting> => {
  return withOfflineFallback(
    async () => (await apiRequest('/meetings', { method: 'POST', body: JSON.stringify(payload) })).meeting,
    () => {
      const meetings = readList<Meeting>('pa_meetings');
      const meeting: Meeting = {
        id: makeId('meet'),
        project_id: payload.project_id || '',
        title: payload.title || '',
        agenda: payload.agenda || '',
        agenda_items: payload.agenda_items || [],
        notes: payload.notes || '',
        decisions: payload.decisions || '',
        location: payload.location || '',
        meeting_url: payload.meeting_url || '',
        start_date: payload.start_date || '',
        start_time: payload.start_time || '',
        end_time: payload.end_time || '',
        attendees: payload.attendees || [],
        attendee_names: payload.attendee_names || [],
        responses: Object.fromEntries((payload.attendees || []).map((id) => [id, 'pending'])),
        created_by: currentUserId(),
        created_at: nowStr(),
        updated_at: nowStr(),
      };
      meetings.push(meeting);
      writeList('pa_meetings', meetings);
      return meeting;
    }
  );
};

export const updateMeeting = async (id: string, payload: Partial<Meeting>): Promise<Meeting> => {
  return withOfflineFallback(
    async () => (await apiRequest(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(payload) })).meeting,
    () => {
      const meetings = readList<Meeting>('pa_meetings');
      const idx = meetings.findIndex((meeting) => meeting.id === id);
      if (idx === -1) throw new Error('회의를 찾을 수 없습니다.');
      meetings[idx] = { ...meetings[idx], ...payload, updated_at: nowStr() };
      writeList('pa_meetings', meetings);
      return meetings[idx];
    }
  );
};

export const respondMeeting = async (id: string, response: 'accepted' | 'declined'): Promise<void> => {
  await withOfflineFallback(
    async () => {
      await apiRequest(`/meetings/${id}/respond`, { method: 'POST', body: JSON.stringify({ response }) });
    },
    () => {
      const meetings = readList<Meeting>('pa_meetings');
      const idx = meetings.findIndex((meeting) => meeting.id === id);
      if (idx !== -1) {
        meetings[idx].responses = { ...(meetings[idx].responses || {}), [currentUserId()]: response };
        meetings[idx].updated_at = nowStr();
        writeList('pa_meetings', meetings);
      }
    }
  );
};

export const deleteMeeting = async (id: string): Promise<void> => {
  await withOfflineFallback(
    async () => {
      await apiRequest(`/meetings/${id}`, { method: 'DELETE' });
    },
    () => writeList('pa_meetings', readList<Meeting>('pa_meetings').filter((meeting) => meeting.id !== id))
  );
};

export const getMeetingNotes = async (meetingId: string): Promise<MeetingNote[]> => {
  return withOfflineFallback(
    async () => (await apiRequest(`/meetings/${meetingId}/notes`)).notes || [],
    () => readList<MeetingNote>('pa_meeting_notes').filter((note) => note.meeting_id === meetingId)
  );
};

export const createMeetingNote = async (meetingId: string, content: string, noteTime?: string, agendaItemId?: string | null): Promise<MeetingNote> => {
  return withOfflineFallback(
    async () => (await apiRequest(`/meetings/${meetingId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, note_time: noteTime, agenda_item_id: agendaItemId || null }),
    })).note,
    () => {
      const notes = readList<MeetingNote>('pa_meeting_notes');
      const note: MeetingNote = {
        id: makeId('mnote'),
        meeting_id: meetingId,
        agenda_item_id: agendaItemId || null,
        user_id: currentUserId(),
        author_name: (() => {
          try { return JSON.parse(localStorage.getItem('pa_user') || '{}')?.name || 'Me'; } catch { return 'Me'; }
        })(),
        content,
        note_time: noteTime || new Date().toTimeString().slice(0, 5),
        created_at: nowStr(),
      };
      notes.push(note);
      writeList('pa_meeting_notes', notes);
      return note;
    }
  );
};

const summarizeMeetingNotes = (notes: MeetingNote[]) => {
  const ordered = [...notes].sort((a, b) => `${a.note_time}${a.created_at}`.localeCompare(`${b.note_time}${b.created_at}`));
  const cleaned = ordered.map((note) => ({ ...note, content: note.content.trim() })).filter((note) => note.content);
  const meetings = readList<Meeting>('pa_meetings');
  const agendaItems = meetings.flatMap((meeting) => meeting.agenda_items || []);
  const agendaById = new Map(agendaItems.map((item) => [item.id, item.title]));
  const grouped = cleaned.reduce<Record<string, MeetingNote[]>>((acc, note) => {
    const key = note.agenda_item_id || 'general';
    acc[key] = acc[key] || [];
    acc[key].push(note);
    return acc;
  }, {});
  const summary = Object.entries(grouped).map(([agendaId, group]) => {
    const title = agendaById.get(agendaId) || '공통 메모';
    return `[${title}]\n${group.map((note) => `- ${note.note_time || note.created_at.slice(11, 16)} ${note.author_name ? `${note.author_name}: ` : ''}${note.content}`).join('\n')}`;
  }).join('\n\n');
  const decisionKeywords = ['결정', '확정', '승인', '진행', '담당', '마감', '일정', '이슈', '리스크', '하기로', '필요'];
  const decisions = cleaned
    .filter((note) => decisionKeywords.some((keyword) => note.content.includes(keyword)))
    .map((note) => `- ${agendaById.get(note.agenda_item_id || '') ? `[${agendaById.get(note.agenda_item_id || '')}] ` : ''}${note.content}`)
    .join('\n');

  return {
    notes: summary,
    decisions: decisions || '- 별도 결정사항이 감지되지 않았습니다.',
  };
};

export const summarizeMeeting = async (meetingId: string): Promise<Meeting> => {
  return withOfflineFallback(
    async () => (await apiRequest(`/meetings/${meetingId}/summarize`, { method: 'POST' })).meeting,
    () => {
      const meetings = readList<Meeting>('pa_meetings');
      const idx = meetings.findIndex((meeting) => meeting.id === meetingId);
      if (idx === -1) throw new Error('회의를 찾을 수 없습니다.');
      const summary = summarizeMeetingNotes(readList<MeetingNote>('pa_meeting_notes').filter((note) => note.meeting_id === meetingId));
      meetings[idx] = { ...meetings[idx], ...summary, updated_at: nowStr() };
      writeList('pa_meetings', meetings);
      return meetings[idx];
    }
  );
};

export const getPersonalTodos = async (): Promise<PersonalTodo[]> => {
  return withOfflineFallback(
    async () => (await apiRequest('/todos')).todos || [],
    () => readList<PersonalTodo>('pa_personal_todos').filter((todo) => todo.user_id === currentUserId())
  );
};

export const createPersonalTodo = async (payload: Partial<PersonalTodo>): Promise<PersonalTodo> => {
  return withOfflineFallback(
    async () => (await apiRequest('/todos', { method: 'POST', body: JSON.stringify(payload) })).todo,
    () => {
      const todos = readList<PersonalTodo>('pa_personal_todos');
      const todo: PersonalTodo = {
        id: makeId('todo'),
        user_id: currentUserId(),
        title: payload.title || '',
        memo: payload.memo || '',
        due_date: payload.due_date || '',
        priority: payload.priority || 'normal',
        status: payload.status || 'todo',
        project_id: payload.project_id || null,
        task_id: payload.task_id || null,
        meeting_id: payload.meeting_id || null,
        created_at: nowStr(),
        updated_at: nowStr(),
      };
      todos.push(todo);
      writeList('pa_personal_todos', todos);
      return todo;
    }
  );
};

export const updatePersonalTodo = async (id: string, payload: Partial<PersonalTodo>): Promise<PersonalTodo> => {
  return withOfflineFallback(
    async () => (await apiRequest(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(payload) })).todo,
    () => {
      const todos = readList<PersonalTodo>('pa_personal_todos');
      const idx = todos.findIndex((todo) => todo.id === id);
      if (idx === -1) throw new Error('개인 투두를 찾을 수 없습니다.');
      todos[idx] = { ...todos[idx], ...payload, updated_at: nowStr() };
      writeList('pa_personal_todos', todos);
      return todos[idx];
    }
  );
};

export const deletePersonalTodo = async (id: string): Promise<void> => {
  await withOfflineFallback(
    async () => {
      await apiRequest(`/todos/${id}`, { method: 'DELETE' });
    },
    () => writeList('pa_personal_todos', readList<PersonalTodo>('pa_personal_todos').filter((todo) => todo.id !== id))
  );
};

export const getNotifications = async (): Promise<AppNotification[]> => {
  return withOfflineFallback(
    async () => (await apiRequest('/notifications')).notifications || [],
    () => readList<AppNotification>('pa_notifications').filter((item) => item.user_id === currentUserId())
  );
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await withOfflineFallback(
    async () => {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
    },
    () => {
      const notifications = readList<AppNotification>('pa_notifications');
      const idx = notifications.findIndex((item) => item.id === id);
      if (idx !== -1) {
        notifications[idx].read_at = nowStr();
        writeList('pa_notifications', notifications);
      }
    }
  );
};
