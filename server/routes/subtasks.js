import express from 'express';
import { dbGet, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// 1. PUT /subtasks/:id - 세부 업무(체크리스트) 수정 (title, done 등)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, done } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM subtasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '세부 업무를 찾을 수 없습니다.' });
    }

    let updateFields = [];
    let params = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title.trim());
    }

    if (done !== undefined) {
      updateFields.push('done = ?');
      params.push(done ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '수정할 데이터가 없습니다.' });
    }

    params.push(id);
    await dbRun(`UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const subtask = await dbGet('SELECT * FROM subtasks WHERE id = ?', [id]);
    return res.json({ subtask });
  } catch (error) {
    console.error('Update subtask failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. DELETE /subtasks/:id - 세부 업무 삭제
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM subtasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '세부 업무를 찾을 수 없습니다.' });
    }

    await dbRun('DELETE FROM subtasks WHERE id = ?', [id]);
    return res.json({ message: '세부 업무가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete subtask failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
