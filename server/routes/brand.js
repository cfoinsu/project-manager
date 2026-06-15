import express from 'express';
import { dbGet, dbRun } from '../db.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();

// 1. GET /brand - 브랜드 설정 정보 조회 (모든 사용자 접근 가능)
router.get('/', async (req, res) => {
  try {
    const config = await dbGet('SELECT * FROM brand_config WHERE id = 1');
    if (!config) {
      return res.json({
        companyName: 'Project Atlas',
        slogan: 'Project OS',
        logoDataUrl: '',
        primaryColor: '#3182F6'
      });
    }

    return res.json({
      companyName: config.company_name,
      slogan: config.slogan,
      logoDataUrl: config.logo_data_url,
      primaryColor: config.primary_color
    });
  } catch (error) {
    console.error('Fetch brand config failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 2. PUT /brand - 브랜드 설정 정보 수정 (admin 권한 필요)
router.put('/', verifyToken, checkRole(['admin']), async (req, res) => {
  const { companyName, slogan, logoDataUrl, primaryColor } = req.body;

  if (companyName === undefined) {
    return res.status(400).json({ message: '회사명(companyName)은 필수 항목입니다.' });
  }

  try {
    await dbRun(
      `UPDATE brand_config 
       SET company_name = ?, slogan = ?, logo_data_url = ?, primary_color = ? 
       WHERE id = 1`,
      [
        companyName,
        slogan || '',
        logoDataUrl || '',
        primaryColor || '#3182F6'
      ]
    );

    return res.json({
      message: '브랜드 설정이 성공적으로 저장되었습니다.',
      config: { companyName, slogan, logoDataUrl, primaryColor }
    });
  } catch (error) {
    console.error('Update brand config failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
