import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'local.db');

// Connect to SQLite local.db file
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite local.db at:', dbPath);
  }
});

// Wrap db.run/get/all in promises for async/await
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize Database Schemas and Seeds
export const initDatabase = async () => {
  try {
    // Enable foreign keys
    await dbRun('PRAGMA foreign_keys = ON');

    // 1. Create Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'member')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        device_hash TEXT,
        force_password_change INTEGER NOT NULL DEFAULT 0,
        department TEXT,
        position TEXT,
        job_role TEXT,
        phone TEXT,
        profile_image TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      )
    `);

    // Migration to add columns to users if they don't exist (support database upgrade)
    const columnsToAlter = [
      'ALTER TABLE users ADD COLUMN username TEXT',
      'ALTER TABLE users ADD COLUMN email TEXT',
      'ALTER TABLE users ADD COLUMN status TEXT DEFAULT "active"',
      'ALTER TABLE users ADD COLUMN device_hash TEXT',
      'ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0',
      'ALTER TABLE users ADD COLUMN last_login_at TEXT',
      'ALTER TABLE users ADD COLUMN updated_at TEXT',
      'ALTER TABLE users ADD COLUMN department TEXT',
      'ALTER TABLE users ADD COLUMN position TEXT',
      'ALTER TABLE users ADD COLUMN job_role TEXT',
      'ALTER TABLE users ADD COLUMN phone TEXT',
      'ALTER TABLE users ADD COLUMN profile_image TEXT',
    ];
    for (const sql of columnsToAlter) {
      try {
        await dbRun(sql);
      } catch (e) {
        // Ignore errors (e.g. column already exists)
      }
    }

    // Set default value for status if null
    await dbRun("UPDATE users SET status = 'active' WHERE status IS NULL");

    // Populate username from email for existing users where username is null
    const usersWithoutUsername = await dbAll('SELECT id, email FROM users WHERE username IS NULL');
    for (const u of usersWithoutUsername) {
      const defaultUsername = u.email ? u.email.split('@')[0] : 'user_' + Math.random().toString(36).substr(2, 5);
      await dbRun('UPDATE users SET username = ? WHERE id = ?', [defaultUsername, u.id]);
    }
    // Set updated_at if null
    await dbRun('UPDATE users SET updated_at = created_at WHERE updated_at IS NULL');

    // 1.0.1 Create additional user device registry.
    // users.device_hash remains as the legacy primary device for compatibility.
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        UNIQUE(user_id, device_hash),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const usersWithLegacyDevices = await dbAll('SELECT id, device_hash, created_at, last_login_at FROM users WHERE device_hash IS NOT NULL AND device_hash != ""');
    for (const u of usersWithLegacyDevices) {
      await dbRun(
        'INSERT OR IGNORE INTO user_devices (id, user_id, device_hash, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)',
        [
          `udev-${u.id}-legacy`,
          u.id,
          u.device_hash,
          u.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19),
          u.last_login_at || null
        ]
      );
    }

    // 1.1 Create departments, positions, job_roles tables
    await dbRun(`
      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS job_roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Seed default organization data if empty
    const deptCount = await dbGet('SELECT COUNT(*) as count FROM departments');
    if (deptCount.count === 0) {
      const depts = ['기획부', '디자인부', '개발부', '경영지원부'];
      for (const d of depts) {
        const id = 'dept-' + Math.random().toString(36).substr(2, 9);
        await dbRun('INSERT INTO departments (id, name) VALUES (?, ?)', [id, d]);
      }
    }
    const posCount = await dbGet('SELECT COUNT(*) as count FROM positions');
    if (posCount.count === 0) {
      const positions = ['사원', '대리', '과장', '차장', '부장', '이사', '대표'];
      for (const p of positions) {
        const id = 'pos-' + Math.random().toString(36).substr(2, 9);
        await dbRun('INSERT INTO positions (id, name) VALUES (?, ?)', [id, p]);
      }
    }
    const jroleCount = await dbGet('SELECT COUNT(*) as count FROM job_roles');
    if (jroleCount.count === 0) {
      const jRoles = ['PM', 'PL', '기획자', '디자이너', '퍼블리셔', '개발자'];
      for (const jr of jRoles) {
        const id = 'jr-' + Math.random().toString(36).substr(2, 9);
        await dbRun('INSERT INTO job_roles (id, name) VALUES (?, ?)', [id, jr]);
      }
    }

    // 2. Create Projects Table (Prepared for future expansion)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        path TEXT DEFAULT "",
        created_at TEXT NOT NULL
      )
    `);

    // Migration to add columns to projects if they don't exist
    const projectColumnsToAlter = [
      'ALTER TABLE projects ADD COLUMN path TEXT DEFAULT ""',
      'ALTER TABLE projects ADD COLUMN start_date TEXT DEFAULT ""',
      'ALTER TABLE projects ADD COLUMN end_date TEXT DEFAULT ""',
      'ALTER TABLE projects ADD COLUMN status TEXT DEFAULT "진행중"',
      'ALTER TABLE projects ADD COLUMN health_score INTEGER DEFAULT 100',
      'ALTER TABLE projects ADD COLUMN updated_at TEXT',
      'ALTER TABLE projects ADD COLUMN description TEXT DEFAULT ""',
      'ALTER TABLE projects ADD COLUMN contract_amount TEXT',
      'ALTER TABLE projects ADD COLUMN importance TEXT',
      'ALTER TABLE projects ADD COLUMN priority TEXT',
      'ALTER TABLE projects ADD COLUMN client_name TEXT',
      'ALTER TABLE projects ADD COLUMN client_region TEXT',
      'ALTER TABLE projects ADD COLUMN client_department TEXT',
      'ALTER TABLE projects ADD COLUMN client_contact_name TEXT',
      'ALTER TABLE projects ADD COLUMN client_contact_phone TEXT',
      'ALTER TABLE projects ADD COLUMN client_contact_email TEXT',
      'ALTER TABLE projects ADD COLUMN business_purpose TEXT',
      'ALTER TABLE projects ADD COLUMN major_scope TEXT',
      'ALTER TABLE projects ADD COLUMN special_notes TEXT',
    ];
    for (const sql of projectColumnsToAlter) {
      try {
        await dbRun(sql);
      } catch (e) {
        // Ignore errors (e.g. column already exists)
      }
    }

    // 2.1 Create Brand Config Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS brand_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT DEFAULT 'Project Atlas',
        slogan TEXT DEFAULT 'Project OS',
        logo_data_url TEXT DEFAULT '',
        primary_color TEXT DEFAULT '#3182F6'
      )
    `);
    
    // Seed default brand config if not exist
    await dbRun(`
      INSERT OR IGNORE INTO brand_config (id, company_name, slogan, logo_data_url, primary_color)
      VALUES (1, 'Project Atlas', 'Project OS', '', '#3182F6')
    `);

    // 2.2 Create App Settings Table (global client configuration)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        server_url TEXT DEFAULT ''
      )
    `);

    await dbRun(`
      INSERT OR IGNORE INTO app_settings (id, server_url)
      VALUES (1, '')
    `);

    // 3. Create Assignments Table (Resource Allocation)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role TEXT NOT NULL,
        allocation_percent INTEGER NOT NULL CHECK(allocation_percent BETWEEN 0 AND 100),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 4. Create Workload Table (기간별 작업량)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS workload (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        week_start TEXT NOT NULL,
        work_ratio INTEGER NOT NULL DEFAULT 0 CHECK(work_ratio BETWEEN 0 AND 100),
        expected_hours REAL,
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'done')),
        created_at TEXT NOT NULL,
        FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 5. Create Comments Table (업무 코멘트)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        assignment_id TEXT,
        workload_id TEXT,
        content TEXT NOT NULL,
        parent_id TEXT,
        updated_at TEXT,
        reactions TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE SET NULL,
        FOREIGN KEY(workload_id) REFERENCES workload(id) ON DELETE SET NULL
      )
    `);

    const commentColumnsToAlter = [
      'ALTER TABLE comments ADD COLUMN parent_id TEXT',
      'ALTER TABLE comments ADD COLUMN updated_at TEXT',
      'ALTER TABLE comments ADD COLUMN reactions TEXT',
      'ALTER TABLE comments ADD COLUMN task_id TEXT',
      'ALTER TABLE comments ADD COLUMN context_type TEXT',
      'ALTER TABLE comments ADD COLUMN context_id TEXT'
    ];
    for (const sql of commentColumnsToAlter) {
      try {
        await dbRun(sql);
      } catch (e) {
        // Ignore errors if columns already exist
      }
    }

    // 6. Create Document Templates Table (서류 양식 라이브러리)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS document_templates (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '기타',
        tags TEXT DEFAULT '',
        description TEXT DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        uploaded_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 7. Create Processes Table (공정 관리)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS processes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL,
        progress REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT '대기',
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT '보통',
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 8. Create Tasks Table (업무 관리)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        process_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assignee TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT '대기',
        priority TEXT NOT NULL DEFAULT '보통',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        start_time TEXT NOT NULL DEFAULT '',
        end_time TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(process_id) REFERENCES processes(id) ON DELETE CASCADE
      )
    `);

    const taskColumnsToAlter = [
      'ALTER TABLE tasks ADD COLUMN start_time TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE tasks ADD COLUMN end_time TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE tasks ADD COLUMN assignees TEXT DEFAULT "[]"',
      'ALTER TABLE tasks ADD COLUMN assignee_names TEXT DEFAULT "[]"'
    ];
    for (const sql of taskColumnsToAlter) {
      try {
        await dbRun(sql);
      } catch (e) {
        // Ignore errors if columns already exist
      }
    }

    // 9. Create Subtasks Table (세부 체크리스트)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // 10. Create Worklogs Table (업무 이력 등록)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS worklogs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        content TEXT NOT NULL,
        hours REAL,
        log_date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_department TEXT,
        author_position TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // 11. Create Documents Table (산출물 파일 및 현황 매핑)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        page_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 12. Create Folders Metadata Table (공유 디렉토리 스캔 캐시)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS folders_metadata (
        project_id TEXT PRIMARY KEY,
        tree_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 13. Create Project Templates Table (공정 템플릿 라이브러리)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create Folder Templates Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS folder_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        structure_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Seed default template
    const templatesCount = await dbGet('SELECT COUNT(*) as count FROM templates');
    if (templatesCount.count === 0) {
      console.log('Seeding default project template...');
      const defaultWebTemplateConfig = {
        processes: [
          {
            name: "01_기획",
            description: "요구사항 정의 및 화면 설계",
            tasks: [
              { title: "요구사항 분석 및 정리", description: "고객 요구사항을 파악하고 분석 문서화", priority: "높음" },
              { title: "메뉴 구조 설계 (IA)", description: "사이트 구조 마인드맵 및 IA 설계", priority: "보통" },
              { title: "화면 정의서 작성", description: "주요 화면 와이어프레임 설계", priority: "긴급" }
            ],
            required_docs: [
              { name: "요구사항정의서.docx", type: "docx" },
              { name: "IA.xlsx", type: "xlsx" }
            ]
          },
          {
            name: "02_디자인",
            description: "UI/UX 디자인 시안 제작",
            tasks: [
              { title: "메인 디자인 시안 확정", description: "메인 페이지 및 주요 키 비주얼 디자인", priority: "긴급" },
              { title: "아이콘 및 이미지 에셋 추출", description: "퍼블리싱용 그래픽 에셋 분리 및 저장", priority: "보통" }
            ],
            required_docs: [
              { name: "디자인_시안.psd", type: "psd" },
              { name: "logo.png", type: "png" }
            ]
          },
          {
            name: "03_개발",
            description: "웹 퍼블리싱 및 기능 구현",
            tasks: [
              { title: "HTML/CSS 마크업", description: "반응형 디자인 구조 퍼블리싱", priority: "높음" },
              { title: "프론트엔드 로직 개발", description: "React 및 상태 관리 모듈 개발", priority: "긴급" },
              { title: "백엔드 API 연동", description: "서버 통신 데이터 바인딩", priority: "보통" }
            ],
            required_docs: [
              { name: "index.html", type: "html" },
              { name: "App.tsx", type: "tsx" }
            ]
          },
          {
            name: "04_산출물",
            description: "검수, 배포 및 매뉴얼 전달",
            tasks: [
              { title: "QA 버그 수정", description: "기능 검수 및 결함 대응", priority: "긴급" },
              { title: "프로덕션 배포", description: "서버 환경 설정 및 배포 완료", priority: "높음" },
              { title: "운영 가이드 및 설명서 작성", description: "인계 문서 작성 완료", priority: "보통" }
            ],
            required_docs: [
              { name: "QA_보고서.pdf", type: "pdf" },
              { name: "설명서.txt", type: "txt" },
              { name: "버전관리.txt", type: "txt" }
            ]
          }
        ]
      };
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await dbRun(
        'INSERT INTO templates (id, name, description, config_json, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          'template-default-web',
          '표준 웹 개발 템플릿',
          '기획부터 디자인, 퍼블리싱, 개발, 배포까지 전 과정을 포함하는 기본 웹 구축 템플릿',
          JSON.stringify(defaultWebTemplateConfig),
          nowStr
        ]
      );
    }

    console.log('SQLite tables initialized successfully.');

    // Seed default users if users table is empty
    const usersCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (usersCount.count === 0) {
      console.log('Seeding default users...');
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // Create Admin
      const adminHash = await bcrypt.hash('admin123', 10);
      await dbRun(
        'INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['user-admin-1', 'admin', '최고 관리자', 'admin@atlas.com', adminHash, 'admin', 'active', 0, nowStr, nowStr]
      );

      // Create Manager
      const managerHash = await bcrypt.hash('manager123', 10);
      await dbRun(
        'INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['user-manager-1', 'manager', '프로젝트 매니저', 'manager@atlas.com', managerHash, 'manager', 'active', 0, nowStr, nowStr]
      );

      // Create Member
      const memberHash = await bcrypt.hash('member123', 10);
      await dbRun(
        'INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['user-member-1', 'member', '일반 개발원', 'member@atlas.com', memberHash, 'member', 'active', 0, nowStr, nowStr]
      );

      console.log('Default users seeded successfully:');
      console.log('  - Admin: admin / admin123');
      console.log('  - Manager: manager / manager123');
      console.log('  - Member: member / member123');
    }
    
    // Ensure default seeded users have department and role info populated
    await dbRun("UPDATE users SET department = '경영지원부', position = '대표', job_role = 'PM' WHERE id = 'user-admin-1' AND department IS NULL");
    await dbRun("UPDATE users SET department = '개발부', position = '팀장', job_role = 'PL' WHERE id = 'user-manager-1' AND department IS NULL");
    await dbRun("UPDATE users SET department = '디자인부', position = '사원', job_role = '디자이너' WHERE id = 'user-member-1' AND department IS NULL");
    
    // Seed default projects if projects table is empty
    const projectsCount = await dbGet('SELECT COUNT(*) as count FROM projects');
    if (projectsCount.count === 0) {
      console.log('Seeding demo projects...');
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      await dbRun(
        'INSERT INTO projects (id, name, code, created_at) VALUES (?, ?, ?, ?)',
        ['proj-demo-1', '스마트 관광 플랫폼 구축', 'HC26W001', nowStr]
      );
      await dbRun(
        'INSERT INTO projects (id, name, code, created_at) VALUES (?, ?, ?, ?)',
        ['proj-demo-2', '공공 데이터 개방 사업', 'HC26D002', nowStr]
      );
      
      // Seed default assignments
      await dbRun(
        'INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['assign-demo-1', 'user-manager-1', 'proj-demo-1', 'PL', 80, '2026-06-01', '2026-12-31']
      );
      await dbRun(
        'INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['assign-demo-2', 'user-member-1', 'proj-demo-1', 'Front-End Developer', 100, '2026-06-15', '2026-11-30']
      );
      
      console.log('Demo projects and assignments seeded.');
    }

  } catch (error) {
    console.error('Failed to initialize database schema/seeds:', error);
  }
};

export default db;
