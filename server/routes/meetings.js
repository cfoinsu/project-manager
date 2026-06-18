import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';
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

/**
 * [고도화] 회의 메모를 구조화된 초안으로 변환
 *
 * 정렬 기준: 안건 순서 → 시간 순 → 생성 순
 * 그룹핑: 같은 시간 + 같은 안건이면 하나의 블록으로 표현
 */
const formatSummaryFromNotes = (notes, agendaItems = []) => {
  if (!notes.length) return { notes: '', decisions: '' };

  const normalized = notes
    .map((note) => ({ ...note, content: String(note.content || '').trim() }))
    .filter((note) => note.content);

  // 안건 순서 맵 (없으면 맨 뒤)
  const agendaOrder = new Map(agendaItems.map((item, idx) => [item.id, idx]));
  const agendaById  = new Map(agendaItems.map((item) => [item.id, item.title]));

  // 1차 정렬: 안건 순서 → 시간 → 생성 순
  const sorted = [...normalized].sort((a, b) => {
    const oA = agendaOrder.get(a.agenda_item_id) ?? 9999;
    const oB = agendaOrder.get(b.agenda_item_id) ?? 9999;
    if (oA !== oB) return oA - oB;
    const tA = `${a.note_time || a.created_at.slice(11,16)}${a.created_at}`;
    const tB = `${b.note_time || b.created_at.slice(11,16)}${b.created_at}`;
    return tA.localeCompare(tB);
  });

  // 2차 그룹핑: 안건별 → 그 안에서 시간+안건 동일이면 하나 블록
  const agendaGroups = {}; // agendaId → { title, blocks: [{time, entries:[]}] }
  const ORDER_KEY = (note) => note.agenda_item_id || 'general';

  for (const note of sorted) {
    const agendaKey = ORDER_KEY(note);
    if (!agendaGroups[agendaKey]) {
      agendaGroups[agendaKey] = {
        title: agendaById.get(agendaKey) || '공통 메모',
        blocks: []
      };
    }
    const time = note.note_time || note.created_at.slice(11, 16);
    const lastBlock = agendaGroups[agendaKey].blocks.at(-1);
    if (lastBlock && lastBlock.time === time) {
      lastBlock.entries.push(note);
    } else {
      agendaGroups[agendaKey].blocks.push({ time, entries: [note] });
    }
  }

  // 3차 포맷 출력
  const summaryParts = Object.values(agendaGroups).map(({ title, blocks }) => {
    const lines = blocks.flatMap(({ time, entries }) => {
      if (entries.length === 1) {
        const n = entries[0];
        const author = n.author_name ? `${n.author_name}: ` : '';
        return [`- ${time} ${author}${n.content}`];
      }
      // 같은 시간 + 같은 안건 → 들여쓰기로 묶음
      return [
        `- ${time}`,
        ...entries.map((n) => {
          const author = n.author_name ? `${n.author_name}: ` : '';
          return `  • ${author}${n.content}`;
        })
      ];
    });
    return `[${title}]\n${lines.join('\n')}`;
  });

  const summary = summaryParts.join('\n\n');

  // 결정사항 추출 (키워드 기반 + 우선순위 분류)
  const decisionKeywords = [
    { label: '결정', words: ['결정', '확정', '승인', '하기로', '채택'] },
    { label: '담당', words: ['담당', '책임자', '담당자'] },
    { label: '마감', words: ['마감', '일정', '기한', '납기'] },
    { label: '이슈', words: ['이슈', '리스크', '문제', '위험'] },
    { label: '진행', words: ['진행', '필요', '검토', '확인'] },
  ];
  const allDecisionWords = decisionKeywords.flatMap((g) => g.words);

  const decisionLines = sorted
    .filter((note) => allDecisionWords.some((kw) => note.content.includes(kw)))
    .map((note) => {
      const group = decisionKeywords.find((g) => g.words.some((w) => note.content.includes(w)));
      const agendaLabel = agendaById.get(note.agenda_item_id) ? `[${agendaById.get(note.agenda_item_id)}] ` : '';
      const label = group ? `[${group.label}] ` : '';
      return `- ${label}${agendaLabel}${note.content}`;
    });

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

    // [M-2] JWT 페이로드에는 name이 없으므로 DB에서 직접 조회
    const authorRow = await dbGet('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const authorName = authorRow?.name || '';

    await dbRun(
      `INSERT INTO meeting_notes (id, meeting_id, agenda_item_id, user_id, author_name, content, note_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, agenda_item_id, req.user.id, authorName, content.trim(), note_time || fallbackTime, nowStr]
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

// [H-5] admin/manager만 회의 삭제 가능 — 기존엔 일반 member도 삭제 가능했음
router.delete('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    await dbRun('DELETE FROM meetings WHERE id = ?', [req.params.id]);
    return res.json({ message: '회의를 삭제했습니다.' });
  } catch (error) {
    console.error('Delete meeting failed:', error);
    return res.status(500).json({ message: '회의를 삭제하지 못했습니다.' });
  }
});

export default router;
