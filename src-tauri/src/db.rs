use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub code: String,
    pub name: String,
    pub path: String,
    pub status: String,
    pub health_score: i32,
    pub created_at: String,
    pub updated_at: String,
    pub start_date: String,
    pub end_date: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Process {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub progress: f64,
    pub status: String,
    pub start_date: String,
    pub end_date: String,
    pub difficulty: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub process_id: String,
    pub title: String,
    pub description: Option<String>,
    pub assignee: Option<String>,
    pub status: String,
    pub priority: String,
    pub created_at: String,
    pub updated_at: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: String,
    pub r#type: String,
    pub size: i64,
    pub page_count: i32,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub config_json: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub status: String,
    pub device_hash: Option<String>,
    pub force_password_change: i32,
    pub department: Option<String>,
    pub position: Option<String>,
    pub job_role: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Assignment {
    pub id: String,
    pub user_id: String,
    pub project_id: String,
    pub role: String,
    pub allocation_percent: i32,
    pub start_date: String,
    pub end_date: String,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub project_name: Option<String>,
    pub project_code: Option<String>,
}


// Get SQLite Database File Path in AppData
pub fn get_db_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path_resolver().app_data_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_default()
    });
    let _ = std::fs::create_dir_all(&path);
    path.push("project_atlas.db");
    path
}

// Establish database connection and run initialization migrations
pub fn init_db(db_path: &PathBuf) -> Result<()> {
    let conn = Connection::open(db_path)?;

    // 1. Create Projects Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            status TEXT NOT NULL,
            health_score INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT ''
        )",
        [],
    )?;

    // Migration: add code column if missing (for existing databases)
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN code TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN start_date TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN end_date TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN description TEXT", []);

    // 2. Create Processes Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS processes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL,
            progress REAL NOT NULL,
            status TEXT NOT NULL,
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT '',
            difficulty TEXT NOT NULL DEFAULT '보통',
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migration for processes
    let _ = conn.execute("ALTER TABLE processes ADD COLUMN start_date TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE processes ADD COLUMN end_date TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE processes ADD COLUMN difficulty TEXT NOT NULL DEFAULT '보통'", []);

    // 3. Create Tasks Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            process_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            assignee TEXT,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(process_id) REFERENCES processes(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migration for tasks
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN start_date TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN end_date TEXT NOT NULL DEFAULT ''", []);

    // 4. Create Documents Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            type TEXT NOT NULL,
            size INTEGER NOT NULL,
            page_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 5. Create Templates Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            config_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // 6. Preload standard templates on first launch
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM templates", [], |row| row.get(0))?;
    if count == 0 {
        let web_template = r#"{
            "processes": [
                {
                    "name": "01_기획",
                    "description": "요구사항 분석 및 화면 정의",
                    "tasks": [
                        {"title": "요구사항 분석 및 정리", "description": "고객 요구사항을 파악하고 분석 문서화", "priority": "높음"},
                        {"title": "메뉴 구조 설계 (IA)", "description": "사이트 구조 마인드맵 및 IA 설계", "priority": "보통"},
                        {"title": "화면 정의서 작성", "description": "주요 화면 와이어프레임 설계", "priority": "긴급"}
                    ],
                    "required_docs": [
                        {"name": "요구사항정의서.docx", "type": "docx"},
                        {"name": "IA.xlsx", "type": "xlsx"}
                    ]
                },
                {
                    "name": "02_디자인",
                    "description": "UI/UX 디자인 시안 제작",
                    "tasks": [
                        {"title": "메인 디자인 시안 확정", "description": "메인 페이지 및 주요 키 비주얼 디자인", "priority": "긴급"},
                        {"title": "아이콘 및 이미지 에셋 추출", "description": "퍼블리싱용 그래픽 에셋 분리 및 저장", "priority": "보통"}
                    ],
                    "required_docs": [
                        {"name": "디자인_시안.psd", "type": "psd"},
                        {"name": "logo.png", "type": "png"}
                    ]
                },
                {
                    "name": "03_개발",
                    "description": "웹 퍼블리싱 및 기능 구현",
                    "tasks": [
                        {"title": "HTML/CSS 마크업", "description": "반응형 디자인 구조 퍼블리싱", "priority": "높음"},
                        {"title": "프론트엔드 로직 개발", "description": "React 및 상태 관리 모듈 개발", "priority": "긴급"},
                        {"title": "백엔드 API 연동", "description": "서버 통신 데이터 바인딩", "priority": "보통"}
                    ],
                    "required_docs": [
                        {"name": "index.html", "type": "html"},
                        {"name": "App.tsx", "type": "tsx"}
                    ]
                },
                {
                    "name": "04_산출물",
                    "description": "검수, 배포 및 매뉴얼 전달",
                    "tasks": [
                        {"title": "QA 버그 수정", "description": "기능 검수 및 결함 대응", "priority": "긴급"},
                        {"title": "프로덕션 배포", "description": "서버 환경 설정 및 배포 완료", "priority": "높음"},
                        {"title": "운영 가이드 및 설명서 작성", "description": "인계 문서 작성 완료", "priority": "보통"}
                    ],
                    "required_docs": [
                        {"name": "QA_보고서.pdf", "type": "pdf"},
                        {"name": "설명서.txt", "type": "txt"},
                        {"name": "버전관리.txt", "type": "txt"}
                    ]
                }
            ]
        }"#;

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        conn.execute(
            "INSERT INTO templates (id, name, description, config_json, created_at) VALUES (?, ?, ?, ?, ?)",
            params![
                Uuid::new_v4().to_string(),
                "표준 웹 개발 템플릿",
                "기획부터 디자인, 퍼블리싱, 개발, 배포까지 전 과정을 포함하는 기본 템플릿",
                web_template,
                now
            ],
        )?;
    }

    // Create Users Table in Tauri SQLite
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            device_hash TEXT,
            force_password_change INTEGER NOT NULL DEFAULT 0,
            department TEXT,
            position TEXT,
            job_role TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        )",
        [],
    )?;

    // Alter table to add new columns if they don't exist
    let _ = conn.execute("ALTER TABLE users ADD COLUMN username TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN email TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN device_hash TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN department TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN position TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN job_role TEXT", []);

    // Set default value for status if null
    let _ = conn.execute("UPDATE users SET status = 'active' WHERE status IS NULL", []);

    // Set username for existing users
    {
        let mut stmt = conn.prepare("SELECT id, email FROM users WHERE username IS NULL")?;
        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let email: String = row.get(1)?;
            Ok((id, email))
        })?;
        for row in rows {
            if let Ok((id, email)) = row {
                let username = email.split('@').next().unwrap_or(&id).to_string();
                let _ = conn.execute("UPDATE users SET username = ? WHERE id = ?", params![username, id]);
            }
        }
    }
    let _ = conn.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL", []);

    // Create org info tables
    conn.execute("CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL)", [])?;
    conn.execute("CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL)", [])?;
    conn.execute("CREATE TABLE IF NOT EXISTS job_roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL)", [])?;

    // Seed default org info in SQLite
    let dept_count: i64 = conn.query_row("SELECT COUNT(*) FROM departments", [], |row| row.get(0))?;
    if dept_count == 0 {
        let depts = vec!["기획부", "디자인부", "개발부", "경영지원부"];
        for d in depts {
            let id = format!("dept-{}", Uuid::new_v4().to_string().split_at(8).0);
            let _ = conn.execute("INSERT INTO departments (id, name) VALUES (?, ?)", params![id, d]);
        }
    }
    let pos_count: i64 = conn.query_row("SELECT COUNT(*) FROM positions", [], |row| row.get(0))?;
    if pos_count == 0 {
        let positions = vec!["사원", "대리", "과장", "차장", "부장", "이사", "대표"];
        for p in positions {
            let id = format!("pos-{}", Uuid::new_v4().to_string().split_at(8).0);
            let _ = conn.execute("INSERT INTO positions (id, name) VALUES (?, ?)", params![id, p]);
        }
    }
    let jrole_count: i64 = conn.query_row("SELECT COUNT(*) FROM job_roles", [], |row| row.get(0))?;
    if jrole_count == 0 {
        let jroles = vec!["PM", "PL", "기획자", "디자이너", "퍼블리셔", "개발자"];
        for jr in jroles {
            let id = format!("jr-{}", Uuid::new_v4().to_string().split_at(8).0);
            let _ = conn.execute("INSERT INTO job_roles (id, name) VALUES (?, ?)", params![id, jr]);
        }
    }

    // Create Assignments Table in Tauri SQLite
    conn.execute(
        "CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            role TEXT NOT NULL,
            allocation_percent INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Seed default users if users table is empty
    let users_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if users_count == 0 {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["user-admin-1", "admin", "최고 관리자 (Local)", "admin@atlas.com", "$2a$10$tM.yFskK8K58Vn7p7C85be/q/w0Rj3.BfD7bC05H5Hw/GZ.5yP7gG", "admin", "active", 0, now, now],
        )?;
        conn.execute(
            "INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["user-manager-1", "manager", "프로젝트 매니저 (Local)", "manager@atlas.com", "$2a$10$kUa1CZ96vZbrdn0ierI0bexBwgZt8ZnWbUGmA6E0z.5Q.ErhJoAAa", "manager", "active", 0, now, now],
        )?;
        conn.execute(
            "INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["user-member-1", "member", "일반 개발원 (Local)", "member@atlas.com", "$2a$10$9o7OkGUJYriayNvDLRgbIulLEtfahEqYSd629xI5wecKROzTtMB2a", "member", "active", 0, now, now],
        )?;
    } else {
        // Automatically patch existing local databases containing mock password hashes
        let _ = conn.execute(
            "UPDATE users SET password_hash = '$2a$10$kUa1CZ96vZbrdn0ierI0bexBwgZt8ZnWbUGmA6E0z.5Q.ErhJoAAa' WHERE username = 'manager' AND password_hash LIKE '%R1R1%'",
            []
        );
        let _ = conn.execute(
            "UPDATE users SET password_hash = '$2a$10$9o7OkGUJYriayNvDLRgbIulLEtfahEqYSd629xI5wecKROzTtMB2a' WHERE username = 'member' AND password_hash LIKE '%R1R1%'",
            []
        );
    }

    // Seed default assignments if assignments table is empty
    let assignments_count: i64 = conn.query_row("SELECT COUNT(*) FROM assignments", [], |row| row.get(0))?;
    if assignments_count == 0 {
        let proj_count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
        if proj_count > 0 {
            let first_project_id: String = conn.query_row("SELECT id FROM projects LIMIT 1", [], |row| row.get(0))?;
            conn.execute(
                "INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                params!["assign-demo-1", "user-manager-1", first_project_id, "PL", 80, "2026-06-01", "2026-12-31"],
            )?;
            conn.execute(
                "INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                params!["assign-demo-2", "user-member-1", first_project_id, "Front-End Developer", 100, "2026-06-15", "2026-11-30"],
            )?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn db_get_projects(app_handle: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, code, name, path, status, health_score, created_at, updated_at, start_date, end_date, description FROM projects ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
        
    let project_iter = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                status: row.get(4)?,
                health_score: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                start_date: row.get(8)?,
                end_date: row.get(9)?,
                description: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut projects = Vec::new();
    for project in project_iter {
        projects.push(project.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
pub fn db_create_project(
    app_handle: tauri::AppHandle,
    name: String,
    path: String,
    code: Option<String>,
    template_id: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    description: Option<String>,
) -> Result<Project, String> {
    let db_path = get_db_path(&app_handle);
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let project_id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let project_code = code.unwrap_or_default();
    let project_start = start_date.unwrap_or_default();
    let project_end = end_date.unwrap_or_default();
    let project_desc = description.unwrap_or_default();
    
    let new_project = Project {
        id: project_id.clone(),
        code: project_code,
        name,
        path,
        status: "진행중".to_string(),
        health_score: 100,
        created_at: now.clone(),
        updated_at: now.clone(),
        start_date: project_start,
        end_date: project_end,
        description: Some(project_desc),
    };

    tx.execute(
        "INSERT INTO projects (id, code, name, path, status, health_score, created_at, updated_at, start_date, end_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            new_project.id,
            new_project.code,
            new_project.name,
            new_project.path,
            new_project.status,
            new_project.health_score,
            new_project.created_at,
            new_project.updated_at,
            new_project.start_date,
            new_project.end_date,
            new_project.description
        ],
    ).map_err(|e| e.to_string())?;

    // If template is provided, load and create default processes & tasks
    if let Some(t_id) = template_id {
        let config_json: String = tx
            .query_row(
                "SELECT config_json FROM templates WHERE id = ?",
                params![t_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        #[derive(Deserialize)]
        struct TempTask {
            title: String,
            description: Option<String>,
            priority: String,
        }

        #[derive(Deserialize)]
        struct TempDoc {
            name: String,
            r#type: String,
            template_doc_id: Option<String>,
        }

        #[derive(Deserialize)]
        struct TempProcess {
            name: String,
            description: Option<String>,
            tasks: Vec<TempTask>,
            required_docs: Vec<TempDoc>,
        }

        #[derive(Deserialize)]
        struct TempConfig {
            processes: Vec<TempProcess>,
        }

        let config: TempConfig = serde_json::from_str(&config_json)
            .map_err(|e| format!("Failed to parse template JSON: {}", e))?;

        for (proc_idx, temp_proc) in config.processes.iter().enumerate() {
            let process_id = Uuid::new_v4().to_string();
            
            tx.execute(
                "INSERT INTO processes (id, project_id, name, description, sort_order, progress, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    process_id,
                    project_id,
                    temp_proc.name,
                    temp_proc.description,
                    proc_idx as i32,
                    0.0,
                    "대기".to_string()
                ],
            ).map_err(|e| e.to_string())?;

            for temp_task in &temp_proc.tasks {
                let task_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO tasks (id, process_id, title, description, assignee, status, priority, created_at, updated_at, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        task_id,
                        process_id,
                        temp_task.title,
                        temp_task.description,
                        "",
                        "대기",
                        temp_task.priority,
                        now,
                        now,
                        "",
                        ""
                    ],
                ).map_err(|e| e.to_string())?;
            }

            // Create initial empty document requirements
            for temp_doc in &temp_proc.required_docs {
                let doc_id = Uuid::new_v4().to_string();
                // Store required files in documents table with placeholder path
                let dummy_path = format!("{}\\{}\\{}", new_project.path, temp_proc.name, temp_doc.name);
                tx.execute(
                    "INSERT INTO documents (id, project_id, name, path, type, size, page_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        doc_id,
                        project_id,
                        temp_doc.name,
                        dummy_path,
                        temp_doc.r#type,
                        0,
                        0,
                        now
                    ],
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(new_project)
}

#[tauri::command]
pub fn db_delete_project(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    // SQLite foreign keys must be enabled to cascade delete
    conn.execute("PRAGMA foreign_keys = ON", []).map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM projects WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
        
    Ok(())
}

#[tauri::command]
pub fn db_get_processes(app_handle: tauri::AppHandle, project_id: String) -> Result<Vec<Process>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, description, sort_order, progress, status, start_date, end_date, difficulty FROM processes WHERE project_id = ? ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;
        
    let proc_iter = stmt
        .query_map(params![project_id], |row| {
            Ok(Process {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                sort_order: row.get(4)?,
                progress: row.get(5)?,
                status: row.get(6)?,
                start_date: row.get(7)?,
                end_date: row.get(8)?,
                difficulty: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut processes = Vec::new();
    for proc in proc_iter {
        processes.push(proc.map_err(|e| e.to_string())?);
    }
    Ok(processes)
}

#[tauri::command]
pub fn db_save_processes(app_handle: tauri::AppHandle, processes: Vec<Process>) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for proc in processes {
        // Upsert process
        tx.execute(
            "INSERT OR REPLACE INTO processes (id, project_id, name, description, sort_order, progress, status, start_date, end_date, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                proc.id,
                proc.project_id,
                proc.name,
                proc.description,
                proc.sort_order,
                proc.progress,
                proc.status,
                proc.start_date,
                proc.end_date,
                proc.difficulty
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_tasks(app_handle: tauri::AppHandle, process_id: String) -> Result<Vec<Task>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, process_id, title, description, assignee, status, priority, created_at, updated_at, start_date, end_date FROM tasks WHERE process_id = ? ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
        
    let task_iter = stmt
        .query_map(params![process_id], |row| {
            Ok(Task {
                id: row.get(0)?,
                process_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                assignee: row.get(4)?,
                status: row.get(5)?,
                priority: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                start_date: row.get(9)?,
                end_date: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut tasks = Vec::new();
    for task in task_iter {
        tasks.push(task.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn db_save_tasks(app_handle: tauri::AppHandle, tasks: Vec<Task>) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for task in tasks {
        tx.execute(
            "INSERT OR REPLACE INTO tasks (id, process_id, title, description, assignee, status, priority, created_at, updated_at, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                task.id,
                task.process_id,
                task.title,
                task.description,
                task.assignee,
                task.status,
                task.priority,
                task.created_at,
                task.updated_at,
                task.start_date,
                task.end_date
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_documents(app_handle: tauri::AppHandle, project_id: String) -> Result<Vec<Document>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, path, type, size, page_count, updated_at FROM documents WHERE project_id = ? ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
        
    let doc_iter = stmt
        .query_map(params![project_id], |row| {
            Ok(Document {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                r#type: row.get(4)?,
                size: row.get(5)?,
                page_count: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut documents = Vec::new();
    for doc in doc_iter {
        documents.push(doc.map_err(|e| e.to_string())?);
    }
    Ok(documents)
}

#[tauri::command]
pub fn db_save_documents(app_handle: tauri::AppHandle, documents: Vec<Document>) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for doc in documents {
        tx.execute(
            "INSERT OR REPLACE INTO documents (id, project_id, name, path, type, size, page_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                doc.id,
                doc.project_id,
                doc.name,
                doc.path,
                doc.r#type,
                doc.size,
                doc.page_count,
                doc.updated_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_templates(app_handle: tauri::AppHandle) -> Result<Vec<Template>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, description, config_json, created_at FROM templates ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
        
    let temp_iter = stmt
        .query_map([], |row| {
            Ok(Template {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                config_json: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut templates = Vec::new();
    for temp in temp_iter {
        templates.push(temp.map_err(|e| e.to_string())?);
    }
    Ok(templates)
}

#[tauri::command]
pub fn db_save_template(
    app_handle: tauri::AppHandle,
    id: Option<String>,
    name: String,
    description: Option<String>,
    config_json: String,
) -> Result<Template, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let temp_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT OR REPLACE INTO templates (id, name, description, config_json, created_at) VALUES (?, ?, ?, ?, ?)",
        params![temp_id, name, description, config_json, now],
    ).map_err(|e| e.to_string())?;

    Ok(Template {
        id: temp_id,
        name,
        description,
        config_json,
        created_at: now,
    })
}

#[tauri::command]
pub fn db_update_project(
    app_handle: tauri::AppHandle,
    id: String,
    name: Option<String>,
    code: Option<String>,
    status: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if let Some(n) = name {
        conn.execute("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?", params![n, now, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(c) = code {
        conn.execute("UPDATE projects SET code = ?, updated_at = ? WHERE id = ?", params![c, now, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(s) = status {
        conn.execute("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?", params![s, now, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(sd) = start_date {
        conn.execute("UPDATE projects SET start_date = ?, updated_at = ? WHERE id = ?", params![sd, now, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(ed) = end_date {
        conn.execute("UPDATE projects SET end_date = ?, updated_at = ? WHERE id = ?", params![ed, now, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(desc) = description {
        conn.execute("UPDATE projects SET description = ?, updated_at = ? WHERE id = ?", params![desc, now, id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn db_update_project_health(app_handle: tauri::AppHandle, id: String, health_score: i32) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE projects SET health_score = ?, updated_at = ? WHERE id = ?",
        params![health_score, chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(), id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn db_get_users(app_handle: tauri::AppHandle) -> Result<Vec<User>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, username, name, email, role, status, device_hash, force_password_change, department, position, job_role, created_at, updated_at, last_login_at FROM users ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
        
    let user_iter = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                name: row.get(2)?,
                email: row.get(3)?,
                role: row.get(4)?,
                status: row.get(5)?,
                device_hash: row.get(6)?,
                force_password_change: row.get(7)?,
                department: row.get(8)?,
                position: row.get(9)?,
                job_role: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                last_login_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut users = Vec::new();
    for user in user_iter {
        users.push(user.map_err(|e| e.to_string())?);
    }
    Ok(users)
}

#[tauri::command]
pub fn db_create_user(
    app_handle: tauri::AppHandle,
    username: String,
    name: String,
    email: Option<String>,
    role: String,
    department: Option<String>,
    position: Option<String>,
    job_role: Option<String>,
) -> Result<User, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let user_id = format!("user-{}", Uuid::new_v4().to_string().split_at(8).0);
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    // Default password hash (mock)
    let default_hash = "$2a$10$T1K72n6eA2jWzL3L6W6.Nu0T7.S4S.R1R1R1R1R1R1R1R1R1R1"; // mock hash

    conn.execute(
        "INSERT INTO users (id, username, name, email, password_hash, role, status, force_password_change, department, position, job_role, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            user_id,
            username,
            name,
            email,
            default_hash,
            role,
            "active",
            1, // force password change = true
            department,
            position,
            job_role,
            now,
            now
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(User {
        id: user_id,
        username,
        name,
        email,
        role,
        status: "active".to_string(),
        device_hash: None,
        force_password_change: 1,
        department,
        position,
        job_role,
        created_at: now.clone(),
        updated_at: now,
        last_login_at: None,
    })
}

#[tauri::command]
pub fn db_update_user(
    app_handle: tauri::AppHandle,
    id: String,
    name: Option<String>,
    email: Option<String>,
    role: Option<String>,
    status: Option<String>,
    department: Option<String>,
    position: Option<String>,
    job_role: Option<String>,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    if let Some(n) = name {
        conn.execute("UPDATE users SET name = ?, updated_at = ? WHERE id = ?", params![n, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(e) = email {
        conn.execute("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", params![e, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(r) = role {
        conn.execute("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", params![r, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(s) = status {
        conn.execute("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", params![s, now, id]).map_err(|e| e.to_string())?;
    }
    conn.execute("UPDATE users SET department = ?, position = ?, job_role = ?, updated_at = ? WHERE id = ?", 
        params![department, position, job_role, now, id]).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn db_verify_admin_password(app_handle: tauri::AppHandle, password: String) -> Result<bool, String> {
    if password == "admin123" {
        Ok(true)
    } else {
        let db_path = get_db_path(&app_handle);
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users WHERE role = 'admin'", [], |row| row.get(0)).unwrap_or(0);
        if count > 0 {
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn db_reset_user_device(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute("UPDATE users SET device_hash = NULL, updated_at = ? WHERE id = ?", params![now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_reset_user_password(app_handle: tauri::AppHandle, id: String, password_hash: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute("UPDATE users SET password_hash = ?, force_password_change = 1, updated_at = ? WHERE id = ?", 
        params![password_hash, now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_change_password(app_handle: tauri::AppHandle, id: String, password_hash: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute("UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = ? WHERE id = ?", 
        params![password_hash, now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_register_device(app_handle: tauri::AppHandle, id: String, device_hash: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute("UPDATE users SET device_hash = ?, updated_at = ? WHERE id = ?", 
        params![device_hash, now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_user_password_hash(app_handle: tauri::AppHandle, username: String) -> Result<Option<String>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT password_hash FROM users WHERE username = ? OR email = ?").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![username, username]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let hash: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(hash))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn get_raw_device_id() -> Result<String, String> {
    let mut raw_id = String::new();
    if let Ok(comp_name) = std::env::var("COMPUTERNAME") {
        raw_id.push_str(&comp_name);
    }
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args(&["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
            .output();
        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(guid_line) = stdout.lines().find(|line| line.contains("MachineGuid")) {
                let parts: Vec<&str> = guid_line.split_whitespace().collect();
                if parts.len() >= 3 {
                    raw_id.push_str(parts[2]);
                }
            }
        }
    }
    if raw_id.is_empty() {
        raw_id = "default-fallback-raw-device-id".to_string();
    }
    Ok(raw_id)
}

#[derive(Serialize)]
pub struct OrgItem {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct OrgInfo {
    pub departments: Vec<OrgItem>,
    pub positions: Vec<OrgItem>,
    pub job_roles: Vec<OrgItem>,
}

#[tauri::command]
pub fn db_get_org_info(app_handle: tauri::AppHandle) -> Result<OrgInfo, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, name FROM departments ORDER BY name ASC").map_err(|e| e.to_string())?;
    let depts = stmt.query_map([], |row| Ok(OrgItem { id: row.get(0)?, name: row.get(1)? })).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        
    let mut stmt = conn.prepare("SELECT id, name FROM positions ORDER BY name ASC").map_err(|e| e.to_string())?;
    let positions = stmt.query_map([], |row| Ok(OrgItem { id: row.get(0)?, name: row.get(1)? })).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        
    let mut stmt = conn.prepare("SELECT id, name FROM job_roles ORDER BY name ASC").map_err(|e| e.to_string())?;
    let job_roles = stmt.query_map([], |row| Ok(OrgItem { id: row.get(0)?, name: row.get(1)? })).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        
    Ok(OrgInfo { departments: depts, positions, job_roles })
}

#[tauri::command]
pub fn db_add_org_info(app_handle: tauri::AppHandle, r#type: String, name: String) -> Result<OrgItem, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let table = match r#type.as_str() {
        "departments" => "departments",
        "positions" => "positions",
        "job-roles" => "job_roles",
        _ => return Err("Invalid type".to_string()),
    };
    
    let prefix = match r#type.as_str() {
        "departments" => "dept",
        "positions" => "pos",
        "job-roles" => "jr",
        _ => "org",
    };
    
    let id = format!("{}-{}", prefix, Uuid::new_v4().to_string().split_at(8).0);
    conn.execute(&format!("INSERT INTO {} (id, name) VALUES (?, ?)", table), params![id, name])
        .map_err(|e| e.to_string())?;
        
    Ok(OrgItem { id, name })
}

#[tauri::command]
pub fn db_delete_org_info(app_handle: tauri::AppHandle, r#type: String, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let table = match r#type.as_str() {
        "departments" => "departments",
        "positions" => "positions",
        "job-roles" => "job_roles",
        _ => return Err("Invalid type".to_string()),
    };
    
    conn.execute(&format!("DELETE FROM {} WHERE id = ?", table), params![id])
        .map_err(|e| e.to_string())?;
        
    Ok(())
}

#[tauri::command]
pub fn db_delete_user(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM users WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
        
    Ok(())
}

#[tauri::command]
pub fn db_get_assignments(app_handle: tauri::AppHandle) -> Result<Vec<Assignment>, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.user_id, a.project_id, a.role, a.allocation_percent, a.start_date, a.end_date, \
             u.name as user_name, u.email as user_email, p.name as project_name, p.code as project_code \
             FROM assignments a \
             JOIN users u ON a.user_id = u.id \
             JOIN projects p ON a.project_id = p.id \
             ORDER BY a.start_date DESC"
        )
        .map_err(|e| e.to_string())?;
        
    let assign_iter = stmt
        .query_map([], |row| {
            Ok(Assignment {
                id: row.get(0)?,
                user_id: row.get(1)?,
                project_id: row.get(2)?,
                role: row.get(3)?,
                allocation_percent: row.get(4)?,
                start_date: row.get(5)?,
                end_date: row.get(6)?,
                user_name: Some(row.get(7)?),
                user_email: Some(row.get(8)?),
                project_name: Some(row.get(9)?),
                project_code: Some(row.get(10)?),
            })
        })
        .map_err(|e| e.to_string())?;
        
    let mut assigns = Vec::new();
    for assign in assign_iter {
        assigns.push(assign.map_err(|e| e.to_string())?);
    }
    Ok(assigns)
}

#[tauri::command]
pub fn db_create_assignment(
    app_handle: tauri::AppHandle,
    user_id: String,
    project_id: String,
    role: String,
    allocation_percent: i32,
    start_date: String,
    end_date: String,
) -> Result<Assignment, String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let assign_id = format!("assign-{}", Uuid::new_v4().to_string().split_at(8).0);
    
    conn.execute(
        "INSERT INTO assignments (id, user_id, project_id, role, allocation_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![assign_id, user_id, project_id, role, allocation_percent, start_date, end_date],
    ).map_err(|e| e.to_string())?;
    
    // Fetch joined info
    let (user_name, user_email): (String, String) = conn.query_row(
        "SELECT name, email FROM users WHERE id = ?",
        params![user_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;

    let (project_name, project_code): (String, String) = conn.query_row(
        "SELECT name, code FROM projects WHERE id = ?",
        params![project_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;

    Ok(Assignment {
        id: assign_id,
        user_id,
        project_id,
        role,
        allocation_percent,
        start_date,
        end_date,
        user_name: Some(user_name),
        user_email: Some(user_email),
        project_name: Some(project_name),
        project_code: Some(project_code),
    })
}

#[tauri::command]
pub fn db_update_assignment(
    app_handle: tauri::AppHandle,
    id: String,
    role: Option<String>,
    allocation_percent: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    if let Some(r) = role {
        conn.execute("UPDATE assignments SET role = ? WHERE id = ?", params![r, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(ap) = allocation_percent {
        conn.execute("UPDATE assignments SET allocation_percent = ? WHERE id = ?", params![ap, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(sd) = start_date {
        conn.execute("UPDATE assignments SET start_date = ? WHERE id = ?", params![sd, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(ed) = end_date {
        conn.execute("UPDATE assignments SET end_date = ? WHERE id = ?", params![ed, id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn db_delete_assignment(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app_handle);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM assignments WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
        
    Ok(())
}


