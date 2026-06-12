import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────
// POST /comments
// ─────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  const { project_id, assignment_id, workload_id, content } = req.body;
  const user_id = req.user.id;

  if (!project_id || !content?.trim()) {
    return res.status(400).json({ message: 'project_id와 content는 필수입니다.' });
  }

  try {
    const id = `cmt-${uuidv4()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      `INSERT INTO comments (id, user_id, project_id, assignment_id, workload_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, project_id, assignment_id || null, workload_id || null, content.trim(), nowStr]
    );

    const created = await dbGet(
      `SELECT c.*, u.name AS author_name, u.email AS author_email
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    res.status(201).json({ comment: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '댓글 작성 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /comments
// query: project_id, assignment_id, workload_id
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { project_id, assignment_id, workload_id } = req.query;

  try {
    let sql = `
      SELECT 
        c.*,
        u.name AS author_name,
        u.email AS author_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) { sql += ' AND c.project_id = ?'; params.push(project_id); }
    if (assignment_id) { sql += ' AND c.assignment_id = ?'; params.push(assignment_id); }
    if (workload_id) { sql += ' AND c.workload_id = ?'; params.push(workload_id); }

    sql += ' ORDER BY c.created_at DESC';

    const rows = await dbAll(sql, params);
    res.json({ comments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '댓글 조회 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /comments/:id
// 작성자 본인 또는 admin만 삭제 가능
// ─────────────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const comment = await dbGet('SELECT * FROM comments WHERE id = ?', [id]);
    if (!comment) {
      return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
    }

    const isAuthor = comment.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: '본인 댓글 또는 관리자만 삭제할 수 있습니다.' });
    }

    await dbRun('DELETE FROM comments WHERE id = ?', [id]);
    res.json({ message: '댓글이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '댓글 삭제 실패', error: err.message });
  }
});

export default router;
