import express from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();

// 1. GET /assignments - 인력 배정 목록 조회
// 권한에 따른 조회 통제:
// - admin, manager: 전체 조회 가능
// - member: 본인에게 배정된 내용만 조회 가능
router.get('/', verifyToken, async (req, res) => {
  try {
    let sql = `
      SELECT a.*, u.name as user_name, u.email as user_email, p.name as project_name, p.code as project_code
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      JOIN projects p ON a.project_id = p.id
    `;
    let params = [];

    if (req.user.role === 'member') {
      sql += ' WHERE a.user_id = ?';
      params.push(req.user.id);
    }

    const assignments = await dbAll(sql, params);
    return res.json({ assignments });
  } catch (error) {
    console.error('Fetch assignments failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. POST /assignments - 인력 배정 등록 (admin, manager 가능)
router.post('/', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { user_id, project_id, role, allocation_percent, start_date, end_date } = req.body;

  if (!user_id || !project_id || !role || allocation_percent === undefined || !start_date || !end_date) {
    return res.status(400).json({ message: '필수 필드가 누락되었습니다.' });
  }

  const allocVal = parseInt(allocation_percent, 10);
  if (isNaN(allocVal) || allocVal < 0 || allocVal > 100) {
    return res.status(400).json({ message: '배정 비율은 0에서 100 사이의 숫자여야 합니다.' });
  }

  try {
    // Validate user exists
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ message: '지정한 사용자가 존재하지 않습니다.' });
    }

    // Validate project exists
    const project = await dbGet('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (!project) {
      return res.status(404).json({ message: '지정한 프로젝트가 존재하지 않습니다.' });
    }

    const assignmentId = 'assign-' + Math.random().toString(36).substr(2, 9);
    await dbRun(
      'INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [assignmentId, user_id, project_id, role, allocVal, start_date, end_date]
    );

    const newAssignment = await dbGet(`
      SELECT a.*, u.name as user_name, u.email as user_email, p.name as project_name, p.code as project_code
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `, [assignmentId]);

    return res.status(201).json({
      message: '인력 배정이 완료되었습니다.',
      assignment: newAssignment
    });
  } catch (error) {
    console.error('Create assignment failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 3. PUT /assignments/:id - 인력 배정 수정 (admin, manager 가능)
router.put('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { role, allocation_percent, start_date, end_date } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '해당 인력 배정 내역을 찾을 수 없습니다.' });
    }

    let updateFields = [];
    let params = [];

    if (role !== undefined) {
      updateFields.push('role = ?');
      params.push(role);
    }

    if (allocation_percent !== undefined) {
      const allocVal = parseInt(allocation_percent, 10);
      if (isNaN(allocVal) || allocVal < 0 || allocVal > 100) {
        return res.status(400).json({ message: '배정 비율은 0에서 100 사이의 숫자여야 합니다.' });
      }
      updateFields.push('allocation_percent = ?');
      params.push(allocVal);
    }

    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      params.push(start_date);
    }

    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      params.push(end_date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '수정할 필드가 전달되지 않았습니다.' });
    }

    params.push(id);
    await dbRun(`UPDATE assignments SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const updated = await dbGet(`
      SELECT a.*, u.name as user_name, u.email as user_email, p.name as project_name, p.code as project_code
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `, [id]);

    return res.json({
      message: '인력 배정 정보가 수정되었습니다.',
      assignment: updated
    });
  } catch (error) {
    console.error('Update assignment failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 4. DELETE /assignments/:id - 인력 배정 삭제 (admin, manager 가능)
router.delete('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: '해당 인력 배정 내역을 찾을 수 없습니다.' });
    }

    await dbRun('DELETE FROM assignments WHERE id = ?', [id]);
    return res.json({ message: '인력 배정 내역이 해제되었습니다.' });
  } catch (error) {
    console.error('Delete assignment failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
