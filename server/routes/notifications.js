import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

export const createNotification = async ({ user_id, type = 'system', title, body = '', link_view = '', link_id = '' }) => {
  if (!user_id || !title) return null;
  const id = `noti-${uuidv4().substring(0, 8)}`;
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await dbRun(
    `INSERT INTO notifications (id, user_id, type, title, body, link_view, link_id, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, user_id, type, title, body, link_view, link_id, nowStr]
  );
  return { id, user_id, type, title, body, link_view, link_id, read_at: null, created_at: nowStr };
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const notifications = await dbAll(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    return res.json({ notifications });
  } catch (error) {
    console.error('Fetch notifications failed:', error);
    return res.status(500).json({ message: '알림 목록을 불러오지 못했습니다.' });
  }
});

router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', [nowStr, req.params.id, req.user.id]);
    return res.json({ message: '알림을 읽음 처리했습니다.' });
  } catch (error) {
    console.error('Read notification failed:', error);
    return res.status(500).json({ message: '알림 상태를 변경하지 못했습니다.' });
  }
});

router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowStr, req.user.id]);
    return res.json({ message: '모든 알림을 읽음 처리했습니다.' });
  } catch (error) {
    console.error('Read all notifications failed:', error);
    return res.status(500).json({ message: '알림 상태를 변경하지 못했습니다.' });
  }
});

export default router;
