import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import { dbRun, dbGet, dbAll } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 업로드 경로 (기존 /uploads 정적 서빙으로 공개 미리보기 가능)
const ASSET_DIR = join(__dirname, '..', 'uploads', 'project_assets'); // 디자인 이미지
const SITE_DIR = join(__dirname, '..', 'uploads', 'project_sites');    // 퍼블 HTML(압축해제 폴더)

[ASSET_DIR, SITE_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSET_DIR),
  filename: (req, file, cb) => {
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(decoded);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (퍼블 결과물 zip 대비)
  fileFilter: (req, file, cb) => {
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(decoded).toLowerCase();
    if (IMAGE_EXTS.includes(ext) || ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${ext} (이미지 또는 .zip만 가능)`));
    }
  }
});

// zip 안에서 진입 HTML(index.html 우선, 가장 얕은 경로) 탐색
function findEntryHtml(zip) {
  const entries = zip.getEntries().filter(e => !e.isDirectory);
  const htmls = entries.filter(e => e.entryName.toLowerCase().endsWith('.html'));
  if (htmls.length === 0) return null;
  const depth = (name) => name.split('/').length;
  // index.html 우선 → 그다음 경로 얕은 순
  htmls.sort((a, b) => {
    const ai = a.entryName.toLowerCase().endsWith('index.html') ? 0 : 1;
    const bi = b.entryName.toLowerCase().endsWith('index.html') ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return depth(a.entryName) - depth(b.entryName);
  });
  return htmls[0].entryName;
}

// ─────────────────────────────────────────────
// POST /project-assets/upload — 디자인 이미지 또는 퍼블 zip 업로드
// ─────────────────────────────────────────────
router.post('/upload', verifyToken, checkRole(['admin', 'manager']), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Asset upload error:', err);
      return res.status(400).json({ message: '업로드 에러', error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  const { project_id, type = 'image', title = '', description = '' } = req.body;
  if (!project_id) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: 'project_id가 필요합니다.' });
  }

  const decodedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(decodedOriginalName).toLowerCase();
  const id = `asset-${uuidv4()}`;
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  try {
    let storedName = req.file.filename;
    let entryPath = '';
    let assetType = type;

    if (type === 'site' || ext === '.zip') {
      assetType = 'site';
      // zip 압축해제 → uploads/project_sites/<id>/
      const targetDir = join(SITE_DIR, id);
      fs.mkdirSync(targetDir, { recursive: true });
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(targetDir, true);
      const entry = findEntryHtml(zip);
      // 업로드된 zip 원본 삭제
      fs.unlink(req.file.path, () => {});
      if (!entry) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return res.status(400).json({ message: 'zip 안에서 HTML 파일을 찾을 수 없습니다.' });
      }
      storedName = id;          // 폴더명
      entryPath = entry;        // index.html 상대경로
    }

    await dbRun(
      `INSERT INTO project_assets
        (id, project_id, type, original_name, stored_name, entry_path, title, description, file_size, mime_type, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, project_id, assetType, decodedOriginalName, storedName, entryPath, title, description,
       req.file.size, req.file.mimetype, req.user.id, nowStr]
    );

    const created = await dbGet(
      `SELECT a.*, u.name AS uploader_name FROM project_assets a
       JOIN users u ON a.uploaded_by = u.id WHERE a.id = ?`, [id]
    );
    res.status(201).json({ asset: created });
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlink(req.file.path, () => {});
    console.error('Asset save error:', err);
    res.status(500).json({ message: '자산 저장 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /project-assets?project_id=X — 목록
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { project_id = '', type = '' } = req.query;
  try {
    let sql = `SELECT a.*, u.name AS uploader_name FROM project_assets a
               JOIN users u ON a.uploaded_by = u.id WHERE 1=1`;
    const params = [];
    if (project_id) { sql += ' AND a.project_id = ?'; params.push(project_id); }
    if (type) { sql += ' AND a.type = ?'; params.push(type); }
    sql += ' ORDER BY a.created_at DESC';
    const rows = await dbAll(sql, params);
    res.json({ assets: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '목록 조회 실패', error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /project-assets/:id — 삭제 (파일/폴더 포함)
// ─────────────────────────────────────────────
router.delete('/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await dbGet('SELECT * FROM project_assets WHERE id = ?', [id]);
    if (!asset) return res.status(404).json({ message: '자산을 찾을 수 없습니다.' });

    await dbRun('DELETE FROM project_assets WHERE id = ?', [id]);

    if (asset.type === 'site') {
      const dir = join(SITE_DIR, asset.stored_name);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } else {
      const filePath = join(ASSET_DIR, asset.stored_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '삭제 실패', error: err.message });
  }
});

export default router;
