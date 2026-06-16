import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseMeetingRow = (row) => ({
  ...row,
  agenda_items: parseJson(row.agenda_items, []),
  attendees: parseJson(row.attendees, []),
  attendee_names: parseJson(row.attendee_names, []),
  responses: parseJson(row.responses, {})
});

const formatSummaryFromNotes = (notes, agendaItems = []) => {
  if (!notes.length) {
    return {
      notes: '',
      decisions: ''
    };
  }

  const normalized = notes
    .map((note) => ({
      ...note,
      content: String(note.content || '').trim()
    }))
    .filter((note) => note.content);

  const agendaById = new Map(agendaItems.map((item) => [item.id, item.title]));
  const grouped = normalized.reduce((acc, note) => {
    const key = note.agenda_item_id || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  const summary = Object.entries(grouped)
    .map(([agendaId, groupNotes]) => {
      const title = agendaById.get(agendaId) || '공통 메모';
      const lines = groupNotes.map((note) => `- ${note.note_time || note.created_at.slice(11, 16)} ${note.author_name ? `${note.author_name}: ` : ''}${note.content}`);
      return `[${title}]\n${lines.join('\n')}`;
    })
    .join('\n\n');

  const decisionKeywords = ['결정', '확정', '승인', '진행', '담당', '마감', '일정', '이슈', '리스크', '하기로', '필요'];
  const decisionLines = normalized
    .filter((note) => decisionKeywords.some((keyword) => note.content.includes(keyword)))
    .map((note) => `- ${agendaById.get(note.agenda_item_id) ? `[${agendaById.get(note.agenda_item_id)}] ` : ''}${note.content}`);

  return {
    notes: summary,
    decisions: decisionLines.length ? decisionLines.join('\n') : '- 별도 결정사항이 감지되지 않았습니다.'
  };
};

router.get('/', verifyToken, async (req, res) => {
  const { project_id } = req.query;
  try {
    const params = [];
    let where = '';
    if (project_id) {
      where = 'WHERE m.project_id = ?';
      params.push(project_id);
    } else if (req.user.role === 'member') {
      where = 'WHERE m.attendees LIKE ?';
      params.push(`%${req.user.id}%`);
    }
    const meetings = await dbAll(
      `SELECT m.*, p.name AS project_name, p.code AS project_code
       FROM meetings m
       JOIN projects p ON p.id = m.project_id
       ${where}
       ORDER BY m.start_date ASC, m.start_time ASC`,
      params
    );
    return res.json({ meetings: meetings.map(parseMeetingRow) });
  } catch (error) {
    console.error('Fetch meetings failed:', error);
    return res.status(500).json({ message: '회의 목록을 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const {
    project_id, title, agenda = '', agenda_items = [], notes = '', decisions = '', location = '',
    meeting_url = '', start_date, start_time = '', end_time = '', attendees = [], attendee_names = []
  } = req.body;

  if (!project_id || !title?.trim() || !start_date) {
    return res.status(400).json({ message: 'project_id, title, start_date는 필수입니다.' });
  }

  try {
    const id = `meet-${uuidv4().substring(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const responses = attendees.reduce((acc, userId) => ({ ...acc, [userId]: 'pending' }), {});

    await dbRun(
      `INSERT INTO meetings (
        id, project_id, title, agenda, agenda_items, notes, decisions, location, meeting_url,
        start_date, start_time, end_time, attendees, attendee_names, responses,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, project_id, title.trim(), agenda, JSON.stringify(agenda_items), notes, decisions, location, meeting_url,
        start_date, start_time, end_time, JSON.stringify(attendees), JSON.stringify(attendee_names),
        JSON.stringify(responses), req.user.id, nowStr, nowStr
      ]
    );

    const project = await dbGet('SELECT name FROM projects WHERE id = ?', [project_id]);
    for (const userId of attendees) {
      await createNotification({
        user_id: userId,
        type: 'meeting',
        title: `회의 초대: ${title.trim()}`,
        body: `${project?.name || '프로젝트'} / ${start_date} ${start_time}`,
        link_view: 'my_work',
        link_id: id
      });
    }

    const meeting = await dbGet(
      `SELECT m.*, p.name AS project_name, p.code AS project_code FROM meetings m JOIN projects p ON p.id = m.project_id WHERE m.id = ?`,
      [id]
    );
    return res.status(201).json({ meeting: parseMeetingRow(meeting) });
  } catch (error) {
    console.error('Create meeting failed:', error);
    return res.status(500).json({ message: '회의를 생성하지 못했습니다.' });
  }
});

router.get('/:id/notes', verifyToken, async (req, res) => {
  try {
    const meeting = await dbGet('SELECT id FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ message: '회의를 찾을 수 없습니다.' });

    const notes = await dbAll(
      `SELECT mn.*, u.name AS author_name
       FROM meeting_notes mn
       LEFT JOIN users u ON u.id = mn.user_id
       WHERE mn.meeting_id = ?
       ORDER BY mn.note_time ASC, mn.created_at ASC`,
      [req.params.id]
    );
    return res.json({ notes });
  } catch (error) {
    console.error('Fetch meeting notes failed:', error);
    return res.status(500).json({ message: '회의 메모를 불러오지 못했습니다.' });
  }
});

router.post('/:id/notes', verifyToken, async (req, res) => {
  const { content, note_time = '', agenda_item_id = null } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ message: 'content는 필수입니다.' });
  }

  try {
    const meeting = await dbGet('SELECT id FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ message: '회의를 찾을 수 없습니다.' });

    const id = `mnote-${uuidv4().substring(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const fallbackTime = nowStr.slice(11, 16);
    await dbRun(
      `INSERT INTO meeting_notes (id, meeting_id, agenda_item_id, user_id, author_name, content, note_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, agenda_item_id, req.user.id, req.user.name || '', content.trim(), note_time || fallbackTime, nowStr]
    );

    const note = await dbGet(
      `SELECT mn.*, u.name AS author_name
       FROM meeting_notes mn
       LEFT JOIN users u ON u.id = mn.user_id
       WHERE mn.id = ?`,
      [id]
    );
    return res.status(201).json({ note });
  } catch (error) {
    console.error('Create meeting note failed:', error);
    return res.status(500).json({ message: '회의 메모를 저장하지 못했습니다.' });
  }
});

router.post('/:id/summarize', verifyToken, async (req, res) => {
  try {
    const meeting = await dbGet('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ message: '회의를 찾을 수 없습니다.' });

    const notes = await dbAll(
      `SELECT * FROM meeting_notes
       WHERE meeting_id = ?
       ORDER BY note_time ASC, created_at ASC`,
      [req.params.id]
    );
    const summary = formatSummaryFromNotes(notes, parseJson(meeting.agenda_items, []));
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'UPDATE meetings SET notes = ?, decisions = ?, updated_at = ? WHERE id = ?',
      [summary.notes, summary.decisions, nowStr, req.params.id]
    );

    const updated = await dbGet(
      `SELECT m.*, p.name AS project_name, p.code AS project_code
       FROM meetings m
       JOIN projects p ON p.id = m.project_id
       WHERE m.id = ?`,
      [req.params.id]
    );
    return res.json({ meeting: parseMeetingRow(updated) });
  } catch (error) {
    console.error('Summarize meeting failed:', error);
    return res.status(500).json({ message: '회의록 초안을 만들지 못했습니다.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const existing = await dbGet('SELECT * FROM meetings WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ message: '회의를 찾을 수 없습니다.' });

  const next = { ...existing, ...req.body };
  const attendees = Array.isArray(next.attendees) ? next.attendees : parseJson(next.attendees, []);
  const attendeeNames = Array.isArray(next.attendee_names) ? next.attendee_names : parseJson(next.attendee_names, []);
  const oldResponses = parseJson(existing.responses, {});
  const responses = attendees.reduce((acc, userId) => ({ ...acc, [userId]: oldResponses[userId] || 'pending' }), {});
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  try {
    await dbRun(
      `UPDATE meetings SET title = ?, agenda = ?, agenda_items = ?, notes = ?, decisions = ?, location = ?, meeting_url = ?,
       start_date = ?, start_time = ?, end_time = ?, attendees = ?, attendee_names = ?, responses = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.title, next.agenda || '', JSON.stringify(Array.isArray(next.agenda_items) ? next.agenda_items : parseJson(next.agenda_items, [])),
        next.notes || '', next.decisions || '', next.location || '', next.meeting_url || '',
        next.start_date, next.start_time || '', next.end_time || '', JSON.stringify(attendees),
        JSON.stringify(attendeeNames), JSON.stringify(responses), nowStr, id
      ]
    );
    const meeting = await dbGet(
      `SELECT m.*, p.name AS project_name, p.code AS project_code FROM meetings m JOIN projects p ON p.id = m.project_id WHERE m.id = ?`,
      [id]
    );
    return res.json({ meeting: parseMeetingRow(meeting) });
  } catch (error) {
    console.error('Update meeting failed:', error);
    return res.status(500).json({ message: '회의를 수정하지 못했습니다.' });
  }
});

router.post('/:id/respond', verifyToken, async (req, res) => {
  const { response } = req.body;
  if (!['accepted', 'declined'].includes(response)) {
    return res.status(400).json({ message: 'response는 accepted 또는 declined 이어야 합니다.' });
  }

  try {
    const meeting = await dbGet('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!meeting) return res.status(404).json({ message: '회의를 찾을 수 없습니다.' });
    const responses = parseJson(meeting.responses, {});
    responses[req.user.id] = response;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE meetings SET responses = ?, updated_at = ? WHERE id = ?', [JSON.stringify(responses), nowStr, req.params.id]);
    return res.json({ responses });
  } catch (error) {
    console.error('Respond meeting failed:', error);
    return res.status(500).json({ message: '회의 응답을 저장하지 못했습니다.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM meetings WHERE id = ?', [req.params.id]);
    return res.json({ message: '회의를 삭제했습니다.' });
  } catch (error) {
    console.error('Delete meeting failed:', error);
    return res.status(500).json({ message: '회의를 삭제하지 못했습니다.' });
  }
});

export default router;
