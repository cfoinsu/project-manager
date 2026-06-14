import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────
// POST /comments
// ─────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  const { project_id, assignment_id, workload_id, content, parent_id } = req.body;
  const user_id = req.user.id;

  if (!project_id || !content?.trim()) {
    return res.status(400).json({ message: 'project_id와 content는 필수입니다.' });
  }

  try {
    const id = `cmt-${uuidv4()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      `INSERT INTO comments (id, user_id, project_id, assignment_id, workload_id, content, parent_id, reactions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, project_id, assignment_id || null, workload_id || null, content.trim(), parent_id || null, '{}', nowStr]
    );

    const created = await dbGet(
      `SELECT c.*, u.name AS author_name, u.email AS author_email,
              u.department AS author_department, u.position AS author_position, u.job_role AS author_job_role,
              u.profile_image AS author_profile_image
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
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { project_id, assignment_id, workload_id } = req.query;

  try {
    let sql = `
      SELECT 
        c.*,
        u.name AS author_name,
        u.email AS author_email,
        u.department AS author_department,
        u.position AS author_position,
        u.job_role AS author_job_role,
        u.profile_image AS author_profile_image
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
    
    // Parse reactions JSON
    const parsedRows = rows.map(row => {
      let reactions = {};
      if (row.reactions) {
        try {
          reactions = JSON.parse(row.reactions);
        } catch (e) {
          reactions = {};
        }
      }
      return {
        ...row,
        reactions
      };
    });

    res.json({ comments: parsedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '댓글 조회 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /comments/:id
// ─────────────────────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const user_id = req.user.id;

  if (!content?.trim()) {
    return res.status(400).json({ message: 'content는 필수입니다.' });
  }

  try {
    const comment = await dbGet('SELECT * FROM comments WHERE id = ?', [id]);
    if (!comment) {
      return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
    }

    const isAuthor = comment.user_id === user_id;
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: '본인 댓글 또는 관리자만 수정할 수 있습니다.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun(
      'UPDATE comments SET content = ?, updated_at = ? WHERE id = ?',
      [content.trim(), nowStr, id]
    );

    const updated = await dbGet(
      `SELECT c.*, u.name AS author_name, u.email AS author_email,
              u.department AS author_department, u.position AS author_position, u.job_role AS author_job_role
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    // Parse reactions JSON
    let reactions = {};
    if (updated.reactions) {
      try {
        reactions = JSON.parse(updated.reactions);
      } catch (e) {
        reactions = {};
      }
    }
    updated.reactions = reactions;

    res.json({ comment: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '댓글 수정 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /comments/:id/react
// ─────────────────────────────────────────────
router.post('/:id/react', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const user_id = req.user.id;

  if (!emoji) {
    return res.status(400).json({ message: 'emoji는 필수입니다.' });
  }

  try {
    const comment = await dbGet('SELECT * FROM comments WHERE id = ?', [id]);
    if (!comment) {
      return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
    }

    let reactions = {};
    if (comment.reactions) {
      try {
        reactions = JSON.parse(comment.reactions);
      } catch (e) {
        reactions = {};
      }
    }

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const idx = reactions[emoji].indexOf(user_id);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(user_id);
    }

    const reactionsStr = JSON.stringify(reactions);
    await dbRun('UPDATE comments SET reactions = ? WHERE id = ?', [reactionsStr, id]);

    res.json({ id, reactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '반응 처리 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /comments/:id
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
