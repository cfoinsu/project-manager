import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const parseTaskRow = (task) => {
  const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    ...task,
    assignees: parseJsonArray(task.assignees),
    assignee_names: parseJsonArray(task.assignee_names)
  };
};

// 1. GET /tasks?process_id=xxx - 특정 공정의 세부 작업 목록 조회
router.get('/', verifyToken, async (req, res) => {
  const { process_id } = req.query;

  if (!process_id) {
    return res.status(400).json({ message: 'process_id는 필수 파라미터입니다.' });
  }

  try {
    const tasks = await dbAll(
      'SELECT * FROM tasks WHERE process_id = ? ORDER BY created_at ASC',
      [process_id]
    );
    return res.json({ tasks: tasks.map(parseTaskRow) });
  } catch (error) {
    console.error('Fetch tasks failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. POST /tasks/save - 작업 정보 일괄 저장 및 업데이트 (Upsert)
router.post('/save', verifyToken, async (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ message: 'tasks 배열이 유효하지 않습니다.' });
  }

  try {
    for (const task of tasks) {
      await dbRun(
        `INSERT INTO tasks (
          id, process_id, title, description, assignee, status, priority,
          created_at, updated_at, start_date, end_date, start_time, end_time, assignees, assignee_names
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          process_id = excluded.process_id,
          title = excluded.title,
          description = excluded.description,
          assignee = excluded.assignee,
          status = excluded.status,
          priority = excluded.priority,
          updated_at = excluded.updated_at,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          assignees = excluded.assignees,
          assignee_names = excluded.assignee_names`,
        [
          task.id,
          task.process_id,
          task.title,
          task.description || null,
          task.assignee || '',
          task.status || '대기',
          task.priority || '보통',
          task.created_at,
          task.updated_at,
          task.start_date || '',
          task.end_date || '',
          task.start_time || '',
          task.end_time || '',
          JSON.stringify(task.assignees || []),
          JSON.stringify(task.assignee_names || [])
        ]
      );
    }

    return res.json({ message: '작업 목록이 성공적으로 업데이트되었습니다.' });
  } catch (error) {
    console.error('Save tasks failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 3. GET /tasks/:taskId/subtasks - 특정 태스크의 하위 세부 업무 목록 조회
router.get('/:taskId/subtasks', verifyToken, async (req, res) => {
  const { taskId } = req.params;

  try {
    const subtasks = await dbAll(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC',
      [taskId]
    );
    return res.json({ subtasks });
  } catch (error) {
    console.error('Fetch subtasks failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 4. POST /tasks/:taskId/subtasks - 특정 태스크의 하위 세부 업무 생성
router.post('/:taskId/subtasks', verifyToken, async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: 'title은 필수 입력 항목입니다.' });
  }

  try {
    const id = `sub-${uuidv4().substring(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'INSERT INTO subtasks (id, task_id, title, done, created_at) VALUES (?, ?, ?, 0, ?)',
      [id, taskId, title.trim(), nowStr]
    );

    const subtask = await dbGet('SELECT * FROM subtasks WHERE id = ?', [id]);
    return res.status(201).json({ subtask });
  } catch (error) {
    console.error('Create subtask failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 5. GET /tasks/:taskId/worklogs - 특정 태스크의 업무 이력 목록 조회
router.get('/:taskId/worklogs', verifyToken, async (req, res) => {
  const { taskId } = req.params;

  try {
    const worklogs = await dbAll(
      'SELECT w.*, u.profile_image AS author_profile_image FROM worklogs w LEFT JOIN users u ON w.user_id = u.id WHERE w.task_id = ? ORDER BY w.created_at DESC',
      [taskId]
    );
    return res.json({ worklogs });
  } catch (error) {
    console.error('Fetch worklogs failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 6. POST /tasks/:taskId/worklogs - 특정 태스크의 업무 이력 생성
router.post('/:taskId/worklogs', verifyToken, async (req, res) => {
  const { taskId } = req.params;
  const { content, hours, log_date } = req.body;
  const user_id = req.user.id;

  if (!content?.trim() || !log_date) {
    return res.status(400).json({ message: 'content와 log_date는 필수 입력 항목입니다.' });
  }

  try {
    // Fetch author details
    const author = await dbGet(
      'SELECT name, department, position FROM users WHERE id = ?',
      [user_id]
    );
    if (!author) {
      return res.status(404).json({ message: '사용자 프로필을 찾을 수 없습니다.' });
    }

    const id = `wlog-${uuidv4().substring(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      `INSERT INTO worklogs (
        id, task_id, content, hours, log_date, user_id, author_name, author_department, author_position, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        taskId,
        content.trim(),
        hours !== undefined ? hours : null,
        log_date,
        user_id,
        author.name,
        author.department || null,
        author.position || null,
        nowStr
      ]
    );

    const worklog = await dbGet(
      'SELECT w.*, u.profile_image AS author_profile_image FROM worklogs w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = ?',
      [id]
    );
    return res.status(201).json({ worklog });
  } catch (error) {
    console.error('Create worklog failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
