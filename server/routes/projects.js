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
  const { name, code, path, templateId, startDate, endDate, description } = req.body;

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
      `INSERT INTO projects (
        id, name, code, path, status, health_score, start_date, end_date, description, created_at, updated_at
       ) VALUES (?, ?, ?, ?, '진행중', 100, ?, ?, ?, ?, ?)`,
      [
        projectId,
        name,
        code,
        path || '',
        startDate || '',
        endDate || '',
        description || '',
        nowStr,
        nowStr
      ]
    );

    // If templateId is provided, look up template and seed processes, tasks, and document requirements
    if (templateId) {
      const template = await dbGet('SELECT config_json FROM templates WHERE id = ?', [templateId]);
      if (template) {
        try {
          const config = JSON.parse(template.config_json);
          if (config && Array.isArray(config.processes)) {
            for (let procIdx = 0; procIdx < config.processes.length; procIdx++) {
              const tempProc = config.processes[procIdx];
              const processId = 'proc-' + Math.random().toString(36).substr(2, 9);

              await dbRun(
                `INSERT INTO processes (
                  id, project_id, name, description, sort_order, progress, status, start_date, end_date, difficulty
                 ) VALUES (?, ?, ?, ?, ?, 0.0, '대기', '', '', '보통')`,
                [
                  processId,
                  projectId,
                  tempProc.name,
                  tempProc.description || null,
                  procIdx
                ]
              );

              // Add tasks
              if (Array.isArray(tempProc.tasks)) {
                for (const tempTask of tempProc.tasks) {
                  const taskId = 'task-' + Math.random().toString(36).substr(2, 9);
                  await dbRun(
                    `INSERT INTO tasks (
                      id, process_id, title, description, assignee, status, priority,
                      created_at, updated_at, start_date, end_date, start_time, end_time
                     ) VALUES (?, ?, ?, ?, '', '대기', ?, ?, ?, '', '', '', '')`,
                    [
                      taskId,
                      processId,
                      tempTask.title,
                      tempTask.description || null,
                      tempTask.priority || '보통',
                      nowStr,
                      nowStr
                    ]
                  );
                }
              }

              // Add document requirements
              if (Array.isArray(tempProc.required_docs)) {
                for (const tempDoc of tempProc.required_docs) {
                  const docId = 'doc-' + Math.random().toString(36).substr(2, 9);
                  const docPath = path ? `${path}\\${tempProc.name}\\${tempDoc.name}` : `\\${tempProc.name}\\${tempDoc.name}`;
                  await dbRun(
                    `INSERT INTO documents (
                      id, project_id, name, path, type, size, page_count, updated_at
                     ) VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
                    [
                      docId,
                      projectId,
                      tempDoc.name,
                      docPath,
                      tempDoc.type,
                      nowStr
                    ]
                  );
                }
              }
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse template config_json during project creation:', parseErr);
        }
      }
    }

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

// 4. GET /projects/:projectId/documents - 프로젝트별 산출물 매핑 정보 조회
router.get('/:projectId/documents', verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const documents = await dbAll(
      'SELECT * FROM documents WHERE project_id = ? ORDER BY name ASC',
      [projectId]
    );
    return res.json({ documents });
  } catch (error) {
    console.error('Fetch documents failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 5. POST /projects/documents/save - 산출물 매핑 정보 일괄 업데이트
router.post('/documents/save', verifyToken, async (req, res) => {
  const { documents } = req.body;

  if (!Array.isArray(documents)) {
    return res.status(400).json({ message: 'documents 배열이 유효하지 않습니다.' });
  }

  try {
    for (const doc of documents) {
      await dbRun(
        `INSERT OR REPLACE INTO documents (
          id, project_id, name, path, type, size, page_count, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doc.id,
          doc.project_id,
          doc.name,
          doc.path,
          doc.type,
          doc.size || 0,
          doc.page_count || 0,
          doc.updated_at
        ]
      );
    }

    return res.json({ message: '산출물 매핑 정보가 성공적으로 업데이트되었습니다.' });
  } catch (error) {
    console.error('Save documents failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
