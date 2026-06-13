#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(serde::Serialize)]
struct FolderNode {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    depth: usize,
    children: Vec<FolderNode>,
    file_count: usize,
    folder_count: usize,
    modified: u64,
}

// Recursively scan a path and return its tree structure
fn scan_node(path: &Path, depth: usize) -> FolderNode {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    let path_str = path.to_string_lossy().into_owned();

    let metadata = fs::metadata(path);
    let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
    let modified = metadata.as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    if !is_dir {
        let size = metadata.map(|m| m.len()).unwrap_or(0);
        return FolderNode {
            name,
            path: path_str,
            is_dir: false,
            size,
            depth,
            children: Vec::new(),
            file_count: 1,
            folder_count: 0,
            modified,
        };
    }

    let mut children = Vec::new();
    let mut total_size = 0;
    let mut file_count = 0;
    let mut folder_count = 0;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let child_node = scan_node(&entry.path(), depth + 1);
            total_size += child_node.size;
            file_count += child_node.file_count;
            folder_count += child_node.folder_count;
            if child_node.is_dir {
                folder_count += 1;
            }
            children.push(child_node);
        }
    }

    // Sort children: directories first, then alphabetically
    children.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir) // true (dir) comes before false
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    FolderNode {
        name,
        path: path_str,
        is_dir: true,
        size: total_size,
        depth,
        children,
        file_count,
        folder_count,
        modified,
    }
}

#[tauri::command]
fn scan_directory(path: String) -> Result<FolderNode, String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err(format!("경로가 존재하지 않습니다: {}", path));
    }
    
    // Perform scan
    let root = scan_node(target_path, 0);
    Ok(root)
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err(format!("경로가 존재하지 않습니다: {}", path));
    }

    let status = if target_path.is_file() {
        // For files, open containing folder and highlight the file
        Command::new("explorer.exe")
            .arg(format!("/select,\"{}\"", path))
            .status()
    } else {
        // For directories, open them directly
        Command::new("explorer.exe")
            .arg(&path)
            .status()
    };

    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("Explorer exited with status: {}", s)),
        Err(e) => Err(format!("Failed to start explorer: {}", e)),
    }
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err(format!("파일이 존재하지 않습니다: {}", path));
    }
    if target_path.is_dir() {
        return open_in_explorer(path);
    }

    // Spawn default system handler
    let status = Command::new("cmd")
        .args(["/C", "start", "", &path])
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("Cmd exited with status: {}", s)),
        Err(e) => Err(format!("Failed to start file: {}", e)),
    }
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    let target_path = Path::new(&path);
    std::fs::create_dir_all(target_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target_path = Path::new(&path);
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(target_path, bytes).map_err(|e| e.to_string())
}

mod db;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = db::get_db_path(&app.handle());
            if let Err(e) = db::init_db(&db_path) {
                eprintln!("Failed to initialize database: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            open_in_explorer,
            open_file,
            create_directory,
            write_file_bytes,
            db::db_get_projects,
            db::db_create_project,
            db::db_delete_project,
            db::db_get_processes,
            db::db_save_processes,
            db::db_get_tasks,
            db::db_save_tasks,
            db::db_get_documents,
            db::db_save_documents,
            db::db_get_templates,
            db::db_save_template,
            db::db_get_folder_templates,
            db::db_save_folder_template,
            db::db_delete_folder_template,
            db::db_update_project,
            db::db_update_project_health,
            db::db_get_users,
            db::db_create_user,
            db::db_update_user,
            db::db_delete_user,
            db::db_verify_admin_password,
            db::db_reset_user_device,
            db::db_reset_user_password,
            db::db_change_password,
            db::db_register_device,
            db::db_get_user_password_hash,
            db::get_raw_device_id,
            db::db_get_org_info,
            db::db_add_org_info,
            db::db_delete_org_info,
            db::db_get_assignments,
            db::db_create_assignment,
            db::db_update_assignment,
            db::db_delete_assignment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
