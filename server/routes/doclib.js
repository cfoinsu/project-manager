import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 업로드 폴더 경로
const UPLOAD_DIR = join(__dirname, '..', 'uploads', 'documents');

// 폴더 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 허용 파일 형식
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/haansofthwp',
  'application/x-hwp',
  'application/hwp',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'application/zip',
  'application/octet-stream', // .hwp 일부 환경
];

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // 한글 파일명 깨짐 복구
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(decodedName);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // 한글 파일명 깨짐 복구
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(decodedName).toLowerCase();
    const allowedExts = ['.hwp', '.hwpx', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.txt', '.zip'];
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${file.mimetype}`));
    }
  }
});

// ─────────────────────────────────────────────
// POST /doclib/upload — 파일 업로드
// admin, manager 전용
// ─────────────────────────────────────────────
router.post('/upload', verifyToken, checkRole(['admin', 'manager']), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ message: 'Multer 업로드 에러', error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    console.error('Upload fail: req.file is undefined');
    return res.status(400).json({ message: '파일이 없습니다.' });
  }

  const { category = '기타', tags = '', description = '' } = req.body;

  try {
    const id = `doc-${uuidv4()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    // 한글 파일명 깨짐 방지 복구
    const decodedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    await dbRun(
      `INSERT INTO document_templates (id, original_name, stored_name, category, tags, description, file_size, mime_type, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        decodedOriginalName,
        req.file.filename,
        category,
        tags,
        description,
        req.file.size,
        req.file.mimetype,
        req.user.id,
        nowStr
      ]
    );

    const created = await dbGet(
      `SELECT d.*, u.name AS uploader_name
       FROM document_templates d
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = ?`,
      [id]
    );

    console.log('File uploaded successfully:', created.original_name);
    res.status(201).json({ document: created });
  } catch (err) {
    // 업로드된 파일 롤백
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('Database save error during upload:', err);
    res.status(500).json({ message: '파일 업로드 실패 (DB 저장 오류)', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /doclib — 목록 조회
// 검색(q), 카테고리 필터 지원
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { q = '', category = '' } = req.query;

  try {
    let sql = `
      SELECT d.*, u.name AS uploader_name
      FROM document_templates d
      JOIN users u ON d.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND d.category = ?';
      params.push(category);
    }

    if (q) {
      sql += ' AND (d.original_name LIKE ? OR d.tags LIKE ? OR d.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY d.created_at DESC';

    const rows = await dbAll(sql, params);
    res.json({ documents: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '목록 조회 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /doclib/:id/download — 파일 다운로드
// ─────────────────────────────────────────────
router.get('/:id/download', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await dbGet('SELECT * FROM document_templates WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ message: '파일을 찾을 수 없습니다.' });
    }

    const filePath = join(UPLOAD_DIR, doc.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: '파일이 서버에 존재하지 않습니다.' });
    }

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', doc.file_size);
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '다운로드 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /doclib/:id — 메타데이터 수정
// admin, manager 전용
// ─────────────────────────────────────────────
router.put('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { category, tags, description, original_name } = req.body;

  try {
    const doc = await dbGet('SELECT * FROM document_templates WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ message: '문서를 찾을 수 없습니다.' });
    }

    await dbRun(
      `UPDATE document_templates SET
        category = ?,
        tags = ?,
        description = ?,
        original_name = ?
       WHERE id = ?`,
      [
        category ?? doc.category,
        tags ?? doc.tags,
        description ?? doc.description,
        original_name ?? doc.original_name,
        id
      ]
    );

    const updated = await dbGet(
      `SELECT d.*, u.name AS uploader_name
       FROM document_templates d
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = ?`,
      [id]
    );

    res.json({ document: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '수정 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /doclib/:id — 파일 삭제
// admin, manager 전용
// ─────────────────────────────────────────────
router.delete('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await dbGet('SELECT * FROM document_templates WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ message: '문서를 찾을 수 없습니다.' });
    }

    // DB에서 삭제
    await dbRun('DELETE FROM document_templates WHERE id = ?', [id]);

    // 실제 파일 삭제
    const filePath = join(UPLOAD_DIR, doc.stored_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: '문서가 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '삭제 실패', error: err.message });
  }
});

export default router;
