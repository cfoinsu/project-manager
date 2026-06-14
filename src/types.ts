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
export interface SubRegion {
  code: string;
  name: string;
}

export interface RegionGroup {
  name: string;
  subRegions: SubRegion[];
}

export const KOREA_REGIONS: RegionGroup[] = [
  {
    name: '서울특별시',
    subRegions: [
      { code: 'SE', name: '서울 전역' },
      { code: 'SEGN', name: '강남구' },
      { code: 'SEGD', name: '강동구' },
      { code: 'SEGB', name: '강북구' },
      { code: 'SEGS', name: '강서구' },
      { code: 'SEGA', name: '관악구' },
      { code: 'SEGJ', name: '광진구' },
      { code: 'SEGR', name: '구로구' },
      { code: 'SEGC', name: '금천구' },
      { code: 'SENW', name: '노원구' },
      { code: 'SEDB', name: '도봉구' },
      { code: 'SEDD', name: '동대문구' },
      { code: 'SEDJ', name: '동작구' },
      { code: 'SEMP', name: '마포구' },
      { code: 'SESD', name: '서대문구' },
      { code: 'SESC', name: '서초구' },
      { code: 'SEST', name: '성동구' },
      { code: 'SESB', name: '성북구' },
      { code: 'SESP', name: '송파구' },
      { code: 'SEYC', name: '양천구' },
      { code: 'SEYD', name: '영등포구' },
      { code: 'SEYS', name: '용산구' },
      { code: 'SEEP', name: '은평구' },
      { code: 'SEJR', name: '종로구' },
      { code: 'SEJG', name: '중구' },
      { code: 'SEJL', name: '중랑구' },
    ]
  },
  {
    name: '부산광역시',
    subRegions: [
      { code: 'BS', name: '부산 전역' },
      { code: 'BSJG', name: '중구' },
      { code: 'BSSG', name: '서구' },
      { code: 'BSDG', name: '동구' },
      { code: 'BSYD', name: '영도구' },
      { code: 'BSBJ', name: '부산진구' },
      { code: 'BSDR', name: '동래구' },
      { code: 'BSNG', name: '남구' },
      { code: 'BSBG', name: '북구' },
      { code: 'BSHU', name: '해운대구' },
      { code: 'BSSH', name: '사하구' },
      { code: 'BSGJ', name: '금정구' },
      { code: 'BSGS', name: '강서구' },
      { code: 'BSYJ', name: '연제구' },
      { code: 'BSSY', name: '수영구' },
      { code: 'BSSS', name: '사상구' },
      { code: 'BSKG', name: '기장군' },
    ]
  },
  {
    name: '대구광역시',
    subRegions: [
      { code: 'DG', name: '대구 전역' },
      { code: 'DGJG', name: '중구' },
      { code: 'DGDG', name: '동구' },
      { code: 'DGSG', name: '서구' },
      { code: 'DGNG', name: '남구' },
      { code: 'DGBG', name: '북구' },
      { code: 'DGSS', name: '수성구' },
      { code: 'DGLS', name: '달서구' },
      { code: 'DGDS', name: '달성군' },
      { code: 'DGGW', name: '군위군' },
    ]
  },
  {
    name: '인천광역시',
    subRegions: [
      { code: 'IC', name: '인천 전역' },
      { code: 'ICJG', name: '중구' },
      { code: 'ICDG', name: '동구' },
      { code: 'ICMH', name: '미추홀구' },
      { code: 'ICYS', name: '연수구' },
      { code: 'ICND', name: '남동구' },
      { code: 'ICBP', name: '부평구' },
      { code: 'ICKY', name: '계양구' },
      { code: 'ICSG', name: '서구' },
      { code: 'ICGH', name: '강화군' },
      { code: 'ICOJ', name: '옹진군' },
    ]
  },
  {
    name: '광주광역시',
    subRegions: [
      { code: 'GJ', name: '광주 전역' },
      { code: 'GJDG', name: '동구' },
      { code: 'GJSG', name: '서구' },
      { code: 'GJNG', name: '남구' },
      { code: 'GJBG', name: '북구' },
      { code: 'GJKS', name: '광산구' },
    ]
  },
  {
    name: '대전광역시',
    subRegions: [
      { code: 'DJ', name: '대전 전역' },
      { code: 'DJDG', name: '동구' },
      { code: 'DJJG', name: '중구' },
      { code: 'DJSG', name: '서구' },
      { code: 'DJYS', name: '유성구' },
      { code: 'DJDD', name: '대덕구' },
    ]
  },
  {
    name: '울산광역시',
    subRegions: [
      { code: 'US', name: '울산 전역' },
      { code: 'USJG', name: '중구' },
      { code: 'USNG', name: '남구' },
      { code: 'USDG', name: '동구' },
      { code: 'USBG', name: '북구' },
      { code: 'USUJ', name: '울주군' },
    ]
  },
  {
    name: '세종특별자치시',
    subRegions: [
      { code: 'SJ', name: '세종 전역' },
      { code: 'SJS', name: '세종시' },
    ]
  },
  {
    name: '경기도',
    subRegions: [
      { code: 'GG', name: '경기 전역' },
      { code: 'GGSU', name: '수원시' },
      { code: 'GGSN', name: '성남시' },
      { code: 'GGYB', name: '의정부시' },
      { code: 'GGAY', name: '안양시' },
      { code: 'GGBC', name: '부천시' },
      { code: 'GGGM', name: '광명시' },
      { code: 'GGPT', name: '평택시' },
      { code: 'GGDC', name: '동두천시' },
      { code: 'GGAS', name: '안산시' },
      { code: 'GGGY', name: '고양시' },
      { code: 'GGGC', name: '과천시' },
      { code: 'GGGR', name: '구리시' },
      { code: 'GGNY', name: '남양주시' },
      { code: 'GGOS', name: '오산시' },
      { code: 'GGSH', name: '시흥시' },
      { code: 'GGNP', name: '군포시' },
      { code: 'GGUW', name: '의왕시' },
      { code: 'GGHN', name: '하남시' },
      { code: 'GGYI', name: '용인시' },
      { code: 'GGPJ', name: '파주시' },
      { code: 'GGIC', name: '이천시' },
      { code: 'GGAN', name: '안성시' },
      { code: 'GGKP', name: '김포시' },
      { code: 'GGHS', name: '화성시' },
      { code: 'GGGJ', name: '광주시' },
      { code: 'GGYJ', name: '양주시' },
      { code: 'GGPC', name: '포천시' },
      { code: 'GGYU', name: '여주시' },
      { code: 'GGYC', name: '연천군' },
      { code: 'GGAP', name: '가평군' },
      { code: 'GGYP', name: '양평군' },
    ]
  },
  {
    name: '강원특별자치도',
    subRegions: [
      { code: 'GW', name: '강원 전역' },
      { code: 'HC', name: '홍천군' },
      { code: 'YG', name: '양구군' },
      { code: 'CC', name: '춘천시' },
      { code: 'WJ', name: '원주시' },
      { code: 'SC', name: '속초시' },
      { code: 'GR', name: '강릉시' },
      { code: 'GWDH', name: '동해시' },
      { code: 'GWTB', name: '태백시' },
      { code: 'GWSC', name: '삼척시' },
      { code: 'GWHS', name: '횡성군' },
      { code: 'GWYW', name: '영월군' },
      { code: 'GWPC', name: '평창군' },
      { code: 'GWJS', name: '정선군' },
      { code: 'GWCW', name: '철원군' },
      { code: 'GWHC', name: '화천군' },
      { code: 'GWIJ', name: '인제군' },
      { code: 'GWGS', name: '고성군' },
      { code: 'GWYY', name: '양양군' },
    ]
  },
  {
    name: '충청북도',
    subRegions: [
      { code: 'CB', name: '충북 전역' },
      { code: 'CBCJ', name: '청주시' },
      { code: 'CBCU', name: '충주시' },
      { code: 'CBJC', name: '제천시' },
      { code: 'CBBE', name: '보은군' },
      { code: 'CBOC', name: '옥천군' },
      { code: 'CBYD', name: '영동군' },
      { code: 'CBZP', name: '증평군' },
      { code: 'CBJN', name: '진천군' },
      { code: 'CBGS', name: '괴산군' },
      { code: 'CBES', name: '음성군' },
      { code: 'CBDY', name: '단양군' },
    ]
  },
  {
    name: '충청남도',
    subRegions: [
      { code: 'CN', name: '충남 전역' },
      { code: 'CNCA', name: '천안시' },
      { code: 'CNGJ', name: '공주시' },
      { code: 'CNBR', name: '보령시' },
      { code: 'CNAS', name: '아산시' },
      { code: 'CNSS', name: '서산시' },
      { code: 'CNNS', name: '논산시' },
      { code: 'CNGR', name: '계룡시' },
      { code: 'CNDJ', name: '당진시' },
      { code: 'CNKS', name: '금산군' },
      { code: 'CNBY', name: '부여군' },
      { code: 'CNSC', name: '서천군' },
      { code: 'CNCY', name: '청양군' },
      { code: 'CNHS', name: '홍성군' },
      { code: 'CNYS', name: '예산군' },
      { code: 'CNTA', name: '태안군' },
    ]
  },
  {
    name: '전북특별자치도',
    subRegions: [
      { code: 'JB', name: '전북 전역' },
      { code: 'JBJJ', name: '전주시' },
      { code: 'JBGS', name: '군산시' },
      { code: 'JBIS', name: '익산시' },
      { code: 'JBJE', name: '정읍시' },
      { code: 'JBNW', name: '남원시' },
      { code: 'JBGJ', name: '김제시' },
      { code: 'JBWJ', name: '완주군' },
      { code: 'JBJA', name: '진안군' },
      { code: 'JBMJ', name: '무주군' },
      { code: 'JBJS', name: '장수군' },
      { code: 'JBIS2', name: '임실군' },
      { code: 'JBSC', name: '순창군' },
      { code: 'JBGC', name: '고창군' },
      { code: 'JBBA', name: '부안군' },
    ]
  },
  {
    name: '전라남도',
    subRegions: [
      { code: 'JN', name: '전남 전역' },
      { code: 'JNMP', name: '목포시' },
      { code: 'JNYS', name: '여수시' },
      { code: 'JNSC', name: '순천시' },
      { code: 'JNNJ', name: '나주시' },
      { code: 'JNGY', name: '광양시' },
      { code: 'JNDY', name: '담양군' },
      { code: 'JNGS', name: '곡성군' },
      { code: 'JNGR', name: '구례군' },
      { code: 'JNGH', name: '고흥군' },
      { code: 'JNBS', name: '보성군' },
      { code: 'JNHS', name: '화순군' },
      { code: 'JNJH', name: '장흥군' },
      { code: 'JNGJ', name: '강진군' },
      { code: 'JNHN', name: '해남군' },
      { code: 'JNYA', name: '영암군' },
      { code: 'JNMA', name: '무안군' },
      { code: 'JNHP', name: '함평군' },
      { code: 'JNYG', name: '영광군' },
      { code: 'JNJS', name: '장성군' },
      { code: 'JNWD', name: '완도군' },
      { code: 'JNDJ', name: '진도군' },
      { code: 'JNSA', name: '신안군' },
    ]
  },
  {
    name: '경상북도',
    subRegions: [
      { code: 'GB', name: '경북 전역' },
      { code: 'GBPH', name: '포항시' },
      { code: 'GBGJ', name: '경주시' },
      { code: 'GBGC', name: '김천시' },
      { code: 'GBAD', name: '안동시' },
      { code: 'GBGM', name: '구미시' },
      { code: 'GBYJ', name: '영주시' },
      { code: 'GBYC', name: '영천시' },
      { code: 'GBSJ', name: '상주시' },
      { code: 'GBMG', name: '문경시' },
      { code: 'GBGS2', name: '경산시' },
      { code: 'GBUS', name: '의성군' },
      { code: 'GBCS', name: '청송군' },
      { code: 'GBYY', name: '영양군' },
      { code: 'GBYD', name: '영덕군' },
      { code: 'GBCD', name: '청도군' },
      { code: 'GBGR', name: '고령군' },
      { code: 'GBSJ2', name: '성주군' },
      { code: 'GBCG', name: '칠곡군' },
      { code: 'GBYC2', name: '예천군' },
      { code: 'GBBH', name: '봉화군' },
      { code: 'GBUJ', name: '울진군' },
      { code: 'GBUR', name: '울릉군' },
    ]
  },
  {
    name: '경상남도',
    subRegions: [
      { code: 'GN', name: '경남 전역' },
      { code: 'GNCW', name: '창원시' },
      { code: 'GNJJ', name: '진주시' },
      { code: 'GNTY', name: '통영시' },
      { code: 'GNSC', name: '사천시' },
      { code: 'GNKH', name: '김해시' },
      { code: 'GNMY', name: '밀양시' },
      { code: 'GNGJ', name: '거제시' },
      { code: 'GNYS', name: '양산시' },
      { code: 'GNYR', name: '의령군' },
      { code: 'GNHA', name: '함안군' },
      { code: 'GNCN', name: '창녕군' },
      { code: 'GNGS2', name: '고성군' },
      { code: 'GNNH', name: '남해군' },
      { code: 'GNHD', name: '하동군' },
      { code: 'GNSC2', name: '산청군' },
      { code: 'GNHY', name: '함양군' },
      { code: 'GNGC', name: '거창군' },
      { code: 'GNHC', name: '합천군' },
    ]
  },
  {
    name: '제주특별자치도',
    subRegions: [
      { code: 'JJ', name: '제주 전역' },
      { code: 'JJJU', name: '제주시' },
      { code: 'JJSG', name: '서귀포시' },
    ]
  },
  {
    name: '기타',
    subRegions: [
      { code: 'ET', name: '기타' }
    ]
  }
];

export const getKoreaRegions = (): RegionGroup[] => {
  try {
    const saved = localStorage.getItem('pa_custom_regions');
    return saved ? JSON.parse(saved) : KOREA_REGIONS;
  } catch {
    return KOREA_REGIONS;
  }
};

export const getRegionCodes = (): { code: string; name: string }[] => {
  return getKoreaRegions().flatMap(group =>
    group.subRegions.map(sub => ({
      code: sub.code,
      name: sub.name === '서울 전역' || sub.name === '부산 전역' || sub.name === '대구 전역' || sub.name === '인천 전역' || sub.name === '광주 전역' || sub.name === '대전 전역' || sub.name === '울산 전역' || sub.name === '세종 전역' || sub.name === '경기 전역' || sub.name === '강원 전역' || sub.name === '충북 전역' || sub.name === '충남 전역' || sub.name === '전북 전역' || sub.name === '전남 전역' || sub.name === '경북 전역' || sub.name === '경남 전역' || sub.name === '제주 전역' || sub.name === '기타'
        ? sub.name
        : `${group.name} ${sub.name}`
    }))
  );
};

export const REGION_CODES: { code: string; name: string }[] = KOREA_REGIONS.flatMap(group =>
  group.subRegions.map(sub => ({
    code: sub.code,
    name: sub.name === '서울 전역' || sub.name === '부산 전역' || sub.name === '대구 전역' || sub.name === '인천 전역' || sub.name === '광주 전역' || sub.name === '대전 전역' || sub.name === '울산 전역' || sub.name === '세종 전역' || sub.name === '경기 전역' || sub.name === '강원 전역' || sub.name === '충북 전역' || sub.name === '충남 전역' || sub.name === '전북 전역' || sub.name === '전남 전역' || sub.name === '경북 전역' || sub.name === '경남 전역' || sub.name === '제주 전역' || sub.name === '기타'
      ? sub.name
      : `${group.name} ${sub.name}`
  }))
);

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

  // 사업 정보
  contract_amount?: string; // 계약금액
  importance?: string;     // 중요도 (Critical, High, Medium, Low)
  priority?: string;       // 우선순위 (P1, P2, P3, P4)

  // 발주처 정보
  client_name?: string;       // 발주처명
  client_region?: string;     // 지역
  client_department?: string; // 담당 부서
  client_contact_name?: string;  // 담당자
  client_contact_phone?: string; // 연락처
  client_contact_email?: string; // 이메일

  // 프로젝트 개요 추가 정보
  business_purpose?: string;  // 사업 목적
  major_scope?: string;       // 주요 범위
  special_notes?: string;     // 특이사항
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
  author_profile_image?: string | null;
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

export interface FolderTemplateNode {
  name: string;
  is_dir: boolean;
  template_doc_id?: string; // links to DocTemplate
  children?: FolderTemplateNode[];
}

export interface FolderTemplate {
  id: string;
  name: string;
  description?: string;
  structure_json: string; // JSON string of FolderTemplateNode[]
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
  phone?: string | null;
  profile_image?: string | null;
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
  user_profile_image?: string | null;
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
  author_profile_image?: string | null;
  author_department?: string | null;
  author_position?: string | null;
  author_job_role?: string | null;
  // Client-side assembled
  replies?: Comment[];
}
