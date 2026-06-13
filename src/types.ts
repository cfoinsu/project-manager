export interface FolderNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number; // in bytes
  depth: number;
  children?: FolderNode[];
  file_count: number;
  folder_count: number;
  modified?: number; // unix timestamp in seconds
}

export interface ScanMetrics {
  totalFolders: number;
  totalFiles: number;
  totalSize: number; // in bytes
  maxDepth: number;
}

export interface TemplateRule {
  id: string;
  name: string;
  path: string;
  is_dir: boolean;
  required: boolean;
}

export interface RuleCheckResult {
  rule: TemplateRule;
  status: 'matched' | 'missing' | 'unexpected';
  actualPath?: string;
}

export interface RuleCheckReport {
  templateName: string;
  missing: string[];
  unexpected: string[];
  matched: string[];
  isValid: boolean;
}

// Database models for Project Atlas
// 지역 코드 상수 정의
export const REGION_CODES: { code: string; name: string }[] = [
  { code: 'SE', name: '서울특별시' },
  { code: 'BS', name: '부산광역시' },
  { code: 'DG', name: '대구광역시' },
  { code: 'IC', name: '인천광역시' },
  { code: 'GJ', name: '광주광역시' },
  { code: 'DJ', name: '대전광역시' },
  { code: 'US', name: '울산광역시' },
  { code: 'SJ', name: '세종특별자치시' },
  { code: 'GG', name: '경기도' },
  { code: 'CB', name: '충청북도' },
  { code: 'CN', name: '충청남도' },
  { code: 'JB', name: '전라북도' },
  { code: 'JN', name: '전라남도' },
  { code: 'GB', name: '경상북도' },
  { code: 'GN', name: '경상남도' },
  { code: 'GW', name: '강원특별자치도' },
  { code: 'JJ', name: '제주특별자치도' },
  { code: 'HC', name: '홍천군' },
  { code: 'YG', name: '양구군' },
  { code: 'CC', name: '춘천시' },
  { code: 'WJ', name: '원주시' },
  { code: 'SC', name: '속초시' },
  { code: 'GR', name: '강릉시' },
  { code: 'ET', name: '기타' },
];

// 프로젝트 유형 코드 정의
export const PROJECT_TYPE_CODES: { code: string; name: string }[] = [
  { code: 'W', name: '웹 구축' },
  { code: 'M', name: '모바일 앱' },
  { code: 'S', name: '시스템 개발' },
  { code: 'D', name: '디자인' },
  { code: 'C', name: '컨설팅' },
  { code: 'R', name: '리뉴얼' },
  { code: 'O', name: '운영/유지보수' },
  { code: 'E', name: '기타' },
];

export interface Project {
  id: string;
  code: string; // 프로젝트 코드 (예: HC26001)
  name: string;
  path: string;
  status: string; // '진행중' | '완료'
  health_score: number;
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface Process {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  sort_order: number;
  progress: number; // 0.0 - 1.0 (representing 0% to 100%)
  status: string; // '대기' | '진행중' | '완료'
  start_date?: string;
  end_date?: string;
  difficulty?: string; // '낮음' | '보통' | '높음' | '매우높음'
}

export interface Task {
  id: string;
  process_id: string;
  title: string;
  description?: string;
  assignee?: string;          // 하위호환용 (단일)
  assignees?: string[];       // 다인원 담당자 (user_id 배열)
  assignee_names?: string[];  // 표시용 이름 배열
  status: string; // '대기' | '진행중' | '검토중' | '완료'
  priority: string; // '낮음' | '보통' | '높음' | '긴급'
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
}

export interface SubTask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface WorkLog {
  id: string;
  task_id: string;
  user_id?: string;
  author_name?: string;
  author_department?: string | null;
  author_position?: string | null;
  content: string;          // 수행 내용
  hours?: number | null;    // 작업 시간 (선택)
  log_date: string;         // YYYY-MM-DD
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  page_count: number;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  config_json: string; // JSON string of TempConfig
  created_at: string;
}

export interface TempTask {
  title: string;
  description?: string;
  priority: string; // '낮음' | '보통' | '높음' | '긴급'
  start_date?: string;
  end_date?: string;
}

export interface TempDoc {
  name: string;
  type: string;
  template_doc_id?: string;
}

export interface TempProcess {
  name: string;
  description?: string;
  tasks: TempTask[];
  required_docs: TempDoc[];
}

export interface TempConfig {
  processes: TempProcess[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: 'admin' | 'manager' | 'member' | 'user';
  status: 'active' | 'inactive';
  device_hash?: string | null;
  force_password_change: number; // 0 or 1
  department?: string | null;
  position?: string | null;
  job_role?: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export interface Assignment {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  allocation_percent: number;
  start_date: string;
  end_date: string;
  user_name?: string;
  user_email?: string;
  project_name?: string;
  project_code?: string;
}

export interface Workload {
  id: string;
  assignment_id: string;
  user_id: string;
  project_id: string;
  week_start: string;
  work_ratio: number;       // 0~100
  expected_hours?: number;
  status: 'planned' | 'done';
  created_at?: string;
  // Joined fields
  user_name?: string;
  user_email?: string;
  project_name?: string;
  project_code?: string;
  assignment_role?: string;
  allocation_percent?: number;
  is_overloaded?: boolean;
  total_ratio?: number; // Cumulative ratio across all projects
}

export interface Comment {
  id: string;
  user_id: string;
  project_id: string;
  assignment_id?: string | null;
  workload_id?: string | null;
  task_id?: string | null;           // 작업 댓글 전용 (기존 task_ 우회 대체)
  context_type?: 'project' | 'task' | 'assignment' | null; // 댓글 출처 유형
  context_id?: string | null;        // 출처 ID (project_id / task_id / assignment_id)
  parent_id?: string | null;         // null = 최상위 댓글, 값 = 답글
  content: string;
  created_at: string;
  updated_at?: string | null;
  reactions?: Record<string, string[]>; // emoji reactions: { "👍": ["userId1", "userId2"] }
  // Joined fields
  author_name?: string;
  author_email?: string;
  author_department?: string | null;
  author_position?: string | null;
  author_job_role?: string | null;
  // Client-side assembled
  replies?: Comment[];
}
