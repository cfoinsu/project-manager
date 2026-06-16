import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

const selectSql = `
  SELECT t.*, p.name AS project_name, task.title AS task_title, m.title AS meeting_title
  FROM personal_todos t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN tasks task ON task.id = t.task_id
  LEFT JOIN meetings m ON m.id = t.meeting_id
`;

router.get('/', verifyToken, async (req, res) => {
  try {
    const todos = await dbAll(
      `${selectSql} WHERE t.user_id = ? ORDER BY t.status ASC, t.due_date ASC, t.created_at DESC`,
      [req.user.id]
    );
    return res.json({ todos });
  } catch (error) {
    console.error('Fetch todos failed:', error);
    return res.status(500).json({ message: '개인 투두를 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const { title, memo = '', due_date = '', priority = 'normal', project_id = null, task_id = null, meeting_id = null } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'title은 필수입니다.' });

  try {
    const id = `todo-${uuidv4().substring(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun(
      `INSERT INTO personal_todos (
        id, user_id, project_id, task_id, meeting_id, title, memo, due_date, priority, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?)`,
      [id, req.user.id, project_id, task_id, meeting_id, title.trim(), memo, due_date, priority, nowStr, nowStr]
    );
    await createNotification({
      user_id: req.user.id,
      type: 'todo',
      title: `새 개인 투두: ${title.trim()}`,
      body: due_date ? `마감일: ${due_date}` : '개인 체크리스트에 추가되었습니다.',
      link_view: 'my_work',
      link_id: id
    });
    const todo = await dbGet(`${selectSql} WHERE t.id = ?`, [id]);
    return res.status(201).json({ todo });
  } catch (error) {
    console.error('Create todo failed:', error);
    return res.status(500).json({ message: '개인 투두를 생성하지 못했습니다.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const existing = await dbGet('SELECT * FROM personal_todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ message: '개인 투두를 찾을 수 없습니다.' });

  const next = { ...existing, ...req.body };
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  try {
    await dbRun(
      `UPDATE personal_todos SET project_id = ?, task_id = ?, meeting_id = ?, title = ?, memo = ?,
       due_date = ?, priority = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [
        next.project_id || null, next.task_id || null, next.meeting_id || null, next.title,
        next.memo || '', next.due_date || '', next.priority || 'normal', next.status || 'todo',
        nowStr, req.params.id, req.user.id
      ]
    );
    const todo = await dbGet(`${selectSql} WHERE t.id = ?`, [req.params.id]);
    return res.json({ todo });
  } catch (error) {
    console.error('Update todo failed:', error);
    return res.status(500).json({ message: '개인 투두를 수정하지 못했습니다.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM personal_todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    return res.json({ message: '개인 투두를 삭제했습니다.' });
  } catch (error) {
    console.error('Delete todo failed:', error);
    return res.status(500).json({ message: '개인 투두를 삭제하지 못했습니다.' });
  }
});

export default router;
