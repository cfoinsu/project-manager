import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────
// Helper: week_start (월요일 기준) 계산
// ─────────────────────────────────────────────
function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=일, 1=월
  const diff = day === 0 ? -6 : 1 - day; // 월요일 기준
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// assignment 기간을 주 단위로 split
function splitIntoWeeks(startDate, endDate) {
  const weeks = [];
  let current = new Date(getWeekStart(startDate));
  const end = new Date(endDate);

  while (current <= end) {
    weeks.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

// ─────────────────────────────────────────────
// POST /workload/generate
// assignment 기반으로 주간 workload 자동 생성
// ─────────────────────────────────────────────
router.post('/generate', verifyToken, async (req, res) => {
  const { assignment_id } = req.body;

  if (!assignment_id) {
    return res.status(400).json({ message: 'assignment_id is required' });
  }

  try {
    const assignment = await dbGet(
      'SELECT * FROM assignments WHERE id = ?',
      [assignment_id]
    );

    if (!assignment) {
      return res.status(404).json({ message: '배정 내역을 찾을 수 없습니다.' });
    }

    // 기존 workload 삭제 (재생성)
    await dbRun('DELETE FROM workload WHERE assignment_id = ?', [assignment_id]);

    const weeks = splitIntoWeeks(assignment.start_date, assignment.end_date);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const created = [];

    for (const weekStart of weeks) {
      const id = `wl-${uuidv4()}`;
      await dbRun(
        `INSERT INTO workload (id, assignment_id, user_id, project_id, week_start, work_ratio, expected_hours, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
        [
          id,
          assignment_id,
          assignment.user_id,
          assignment.project_id,
          weekStart,
          assignment.allocation_percent, // 기본값: allocation_percent 그대로
          (assignment.allocation_percent / 100) * 40, // 주 40시간 기준
          nowStr
        ]
      );
      created.push({ id, week_start: weekStart, work_ratio: assignment.allocation_percent });
    }

    res.json({ message: `${created.length}개 주간 workload 생성 완료`, workloads: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '워크로드 생성 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /workload
// query: user_id, project_id (선택)
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { user_id, project_id, assignment_id } = req.query;

  try {
    let sql = `
      SELECT 
        w.*,
        u.name AS user_name,
        u.email AS user_email,
        p.name AS project_name,
        p.code AS project_code,
        a.role AS assignment_role,
        a.allocation_percent
      FROM workload w
      JOIN users u ON w.user_id = u.id
      JOIN projects p ON w.project_id = p.id
      JOIN assignments a ON w.assignment_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) { sql += ' AND w.user_id = ?'; params.push(user_id); }
    if (project_id) { sql += ' AND w.project_id = ?'; params.push(project_id); }
    if (assignment_id) { sql += ' AND w.assignment_id = ?'; params.push(assignment_id); }

    sql += ' ORDER BY w.week_start ASC';

    const rows = await dbAll(sql, params);

    // 사용자+주별 총 work_ratio 계산 (과부하 감지)
    const overloadMap = {};
    for (const row of rows) {
      const key = `${row.user_id}__${row.week_start}`;
      overloadMap[key] = (overloadMap[key] || 0) + row.work_ratio;
    }

    const enriched = rows.map(r => ({
      ...r,
      is_overloaded: (overloadMap[`${r.user_id}__${r.week_start}`] || 0) > 100
    }));

    res.json({ workloads: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '워크로드 조회 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /workload/:id
// work_ratio, status, expected_hours 수정
// ─────────────────────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { work_ratio, status, expected_hours } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM workload WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '워크로드 항목을 찾을 수 없습니다.' });
    }

    const newRatio = work_ratio !== undefined ? work_ratio : existing.work_ratio;
    const newStatus = status || existing.status;
    const newHours = expected_hours !== undefined ? expected_hours : existing.expected_hours;

    await dbRun(
      'UPDATE workload SET work_ratio = ?, status = ?, expected_hours = ? WHERE id = ?',
      [newRatio, newStatus, newHours, id]
    );

    const updated = await dbGet('SELECT * FROM workload WHERE id = ?', [id]);
    res.json({ workload: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '워크로드 수정 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /workload/summary?project_id=
// 프로젝트 인력별 주간 과부하 요약
// ─────────────────────────────────────────────
router.get('/summary', verifyToken, async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ message: 'project_id required' });

  try {
    const rows = await dbAll(
      `SELECT w.user_id, u.name AS user_name, w.week_start,
              SUM(w.work_ratio) AS total_ratio
       FROM workload w
       JOIN users u ON w.user_id = u.id
       WHERE w.project_id = ?
       GROUP BY w.user_id, w.week_start
       ORDER BY w.week_start ASC`,
      [project_id]
    );
    res.json({ summary: rows });
  } catch (err) {
    res.status(500).json({ message: '요약 조회 실패', error: err.message });
  }
});

export default router;
