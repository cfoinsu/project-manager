import express from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();

// 1. GET /projects - 프로젝트 목록 조회
router.get('/', verifyToken, async (req, res) => {
  try {
    const projects = await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
    return res.json({ projects });
  } catch (error) {
    console.error('Fetch projects failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. POST /projects - 프로젝트 등록 (admin, manager 가능)
router.post('/', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { name, code } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: '이름(name)과 코드(code)는 필수 항목입니다.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM projects WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ message: '이미 동일한 프로젝트 코드가 존재합니다.' });
    }

    const projectId = 'proj-' + Math.random().toString(36).substr(2, 9);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await dbRun(
      'INSERT INTO projects (id, name, code, created_at) VALUES (?, ?, ?, ?)',
      [projectId, name, code, nowStr]
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
    return res.status(201).json({
      message: '프로젝트가 등록되었습니다.',
      project
    });
  } catch (error) {
    console.error('Create project failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 3. DELETE /projects/:id - 프로젝트 삭제 (admin, manager 가능)
router.delete('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT id FROM projects WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '프로젝트를 찾을 수 없습니다.' });
    }

    await dbRun('DELETE FROM projects WHERE id = ?', [id]);
    return res.json({ message: '프로젝트가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete project failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
