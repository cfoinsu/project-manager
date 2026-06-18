import express from 'express';
import { dbGet, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// 1. DELETE /worklogs/:id - 업무 이력 삭제
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM worklogs WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '업무 이력을 찾을 수 없습니다.' });
    }

    // [M-4] 본인 이력 또는 admin만 삭제 가능
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '본인 이력 또는 관리자만 삭제할 수 있습니다.' });
    }

    await dbRun('DELETE FROM worklogs WHERE id = ?', [id]);
    return res.json({ message: '업무 이력이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete worklog failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
