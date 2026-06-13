import express from 'express';
import { dbAll, dbRun } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// 1. GET /processes?project_id=xxx - 특정 프로젝트의 전체 공정 조회
router.get('/', verifyToken, async (req, res) => {
  const { project_id } = req.query;

  if (!project_id) {
    return res.status(400).json({ message: 'project_id는 필수 파라미터입니다.' });
  }

  try {
    const processes = await dbAll(
      'SELECT * FROM processes WHERE project_id = ? ORDER BY sort_order ASC',
      [project_id]
    );
    return res.json({ processes });
  } catch (error) {
    console.error('Fetch processes failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. POST /processes/save - 공정 정보 일괄 저장 및 업데이트 (Upsert)
router.post('/save', verifyToken, async (req, res) => {
  const { processes } = req.body;

  if (!Array.isArray(processes)) {
    return res.status(400).json({ message: 'processes 배열이 유효하지 않습니다.' });
  }

  try {
    // SQLite 트랜잭션 수동 모방 또는 개별 루프 실행
    // 단순 루프로 여러 개 저장 (보통 5~10개 내외이므로 루프도 충분히 빠름)
    for (const proc of processes) {
      await dbRun(
        `INSERT OR REPLACE INTO processes (
          id, project_id, name, description, sort_order, progress, status, start_date, end_date, difficulty
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proc.id,
          proc.project_id,
          proc.name,
          proc.description || null,
          proc.sort_order,
          proc.progress || 0.0,
          proc.status || '대기',
          proc.start_date || '',
          proc.end_date || '',
          proc.difficulty || '보통'
        ]
      );
    }

    return res.json({ message: '공정 목록이 성공적으로 업데이트되었습니다.' });
  } catch (error) {
    console.error('Save processes failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
