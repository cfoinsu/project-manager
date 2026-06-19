import express from 'express';
import { dbGet, dbRun } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();

const normalizeServerUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    const error = new Error('서버 주소는 http:// 또는 https:// 로 시작해야 합니다.');
    error.status = 400;
    throw error;
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

router.get('/', async (req, res) => {
  try {
    const settings = await dbGet('SELECT server_url FROM app_settings WHERE id = 1');
    res.json({ serverUrl: settings?.server_url || '' });
  } catch (error) {
    console.error('Failed to load app settings:', error);
    res.status(500).json({ message: '설정을 불러오지 못했습니다.' });
  }
});

router.put('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const serverUrl = normalizeServerUrl(req.body.serverUrl);
    await dbRun('UPDATE app_settings SET server_url = ? WHERE id = 1', [serverUrl]);
    res.json({ serverUrl });
  } catch (error) {
    console.error('Failed to update app settings:', error);
    res.status(error.status || 500).json({ message: error.message || '설정을 저장하지 못했습니다.' });
  }
});

export default router;
