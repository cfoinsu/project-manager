import type { FolderNode } from '../types';

// Check if running in Tauri desktop environment
// Tauri v1 injects window.__TAURI__ (NOT __TAURI_METADATA__)
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
};

// ─────────────────────────────────────────────────────────────
// Browser Fallback: Store selected files from webkitdirectory
// so scanDirectory can build a real tree from them.
// ─────────────────────────────────────────────────────────────
let _lastSelectedFiles: File[] = [];
let _lastSelectedRootName: string = '';

/**
 * Build a real FolderNode tree from webkitdirectory File objects.
 * Each file has .webkitRelativePath like "rootFolder/sub/file.txt"
 */
const buildTreeFromFiles = (files: File[], rootName: string, rootPath: string): FolderNode => {
  // Map to hold directory nodes by their path
  const dirMap = new Map<string, FolderNode>();

  // Create root node
  const root: FolderNode = {
    name: rootName,
    path: rootPath,
    is_dir: true,
    size: 0,
    depth: 0,
    children: [],
    file_count: 0,
    folder_count: 0
  };
  dirMap.set('', root);

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    // Split: ["rootFolder", "sub", "file.txt"]
    const parts = relativePath.split('/');
    
    // Skip the first part (root folder name) since we already have root
    const pathParts = parts.slice(1); // ["sub", "file.txt"]
    
    if (pathParts.length === 0) continue;

    // Ensure all parent directories exist
    let currentDirKey = '';
    let currentDepth = 0;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const dirName = pathParts[i];
      const parentKey = currentDirKey;
      currentDirKey = currentDirKey ? `${currentDirKey}/${dirName}` : dirName;
      currentDepth = i + 1;

      if (!dirMap.has(currentDirKey)) {
        const dirNode: FolderNode = {
          name: dirName,
          path: `${rootPath}\\${currentDirKey.replace(/\//g, '\\\\')}`,
          is_dir: true,
          size: 0,
          depth: currentDepth,
          children: [],
          file_count: 0,
          folder_count: 0,
          modified: Math.round(Date.now() / 1000)
        };
        dirMap.set(currentDirKey, dirNode);

        // Add to parent
        const parent = dirMap.get(parentKey);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(dirNode);
        }
      }
    }

    // Create file node
    const fileName = pathParts[pathParts.length - 1];
    const parentDirKey = pathParts.slice(0, -1).join('/');
    const fileDepth = pathParts.length;

    const fileNode: FolderNode = {
      name: fileName,
      path: `${rootPath}\\${pathParts.join('\\\\')}`,
      is_dir: false,
      size: file.size,
      depth: fileDepth,
      file_count: 1,
      folder_count: 0,
      modified: Math.round(file.lastModified / 1000)
    };

    const parentDir = dirMap.get(parentDirKey) || root;
    parentDir.children = parentDir.children || [];
    parentDir.children.push(fileNode);
  }

  // Recursively calculate sizes and counts
  const calcStats = (node: FolderNode): void => {
    if (!node.is_dir) return;

    let totalSize = 0;
    let totalFiles = 0;
    let totalFolders = 0;

    const children = node.children || [];
    
    // Sort: directories first, then alphabetically
    children.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return b.is_dir ? 1 : -1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    for (const child of children) {
      if (child.is_dir) {
        calcStats(child);
        totalFolders += 1 + child.folder_count;
        totalFiles += child.file_count;
        totalSize += child.size;
      } else {
        totalFiles += 1;
        totalSize += child.size;
      }
    }

    node.size = totalSize;
    node.file_count = totalFiles;
    node.folder_count = totalFolders;
  };

  calcStats(root);
  return root;
};

// ─────────────────────────────────────────────────────────────
// Fallback Mock Data Generator (demo mode when no real files)
// ─────────────────────────────────────────────────────────────
export const generateMockProject = (): FolderNode => {
  const rootPath = 'C:\\Projects\\Folder-Atlas-Demo';
  
  const makeFiles = (parentPath: string, names: [string, number, number?][], depth: number): FolderNode[] => {
    return names.map(([name, size, modDaysAgo]) => {
      const days = modDaysAgo !== undefined ? modDaysAgo : 10;
      const modifiedTime = Math.round((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
      return {
        name,
        path: `${parentPath}\\${name}`,
        is_dir: false,
        size,
        depth,
        file_count: 1,
        folder_count: 0,
        modified: modifiedTime
      };
    });
  };

  const createDir = (
    name: string,
    parentPath: string,
    depth: number,
    subDirs: FolderNode[] = [],
    files: FolderNode[] = []
  ): FolderNode => {
    const path = `${parentPath}\\${name}`;
    const children = [...subDirs, ...files];
    const size = children.reduce((acc, c) => acc + c.size, 0);
    const file_count = children.reduce((acc, c) => acc + c.file_count, 0);
    const folder_count = children.reduce((acc, c) => acc + c.folder_count + (c.is_dir ? 1 : 0), 0);
    const maxModified = children.reduce((max, c) => Math.max(max, c.modified || 0), 0);

    return {
      name,
      path,
      is_dir: true,
      size,
      depth,
      children,
      file_count,
      folder_count,
      modified: maxModified || Math.round(Date.now() / 1000)
    };
  };

  // 1. Planning/Product dir
  const designDocs = makeFiles(`${rootPath}\\01_기획\\디자인_시안`, [
    ['wireframe_v1.key', 45000000, 25],
    ['wireframe_v2_final.key', 58000000, 4],
    ['user_flow.pdf', 12500000, 2]
  ], 3);
  const designDir = createDir('디자인_시안', `${rootPath}\\01_기획`, 2, [], designDocs);

  const planningFiles = makeFiles(`${rootPath}\\01_기획`, [
    ['요구사항정의서.docx', 2400000, 8],
    ['스케줄표.xlsx', 1100000, 15],
    ['회의록_2026-06-10.md', 45000, 3]
  ], 2);
  const planningDir = createDir('01_기획', rootPath, 1, [designDir], planningFiles);

  // 2. Design dir
  const assetIcons = makeFiles(`${rootPath}\\02_디자인\\assets\\icons`, [
    ['home.svg', 1200, 22],
    ['search.svg', 850, 22],
    ['profile.svg', 1450, 22],
    ['settings.svg', 1800, 22],
    ['logo.png', 45000, 22]
  ], 4);
  const iconsDir = createDir('icons', `${rootPath}\\02_디자인\\assets`, 3, [], assetIcons);

  const assetImages = makeFiles(`${rootPath}\\02_디자인\\assets\\images`, [
    ['hero_banner.jpg', 2400000, 18],
    ['intro_bg.png', 5600000, 18],
    ['avatar_placeholder.jpg', 120000, 18]
  ], 4);
  const imagesDir = createDir('images', `${rootPath}\\02_디자인\\assets`, 3, [], assetImages);

  const assetsDir = createDir('assets', `${rootPath}\\02_디자인`, 2, [iconsDir, imagesDir], []);

  const rawPsdFiles = makeFiles(`${rootPath}\\02_디자인`, [
    ['app_layout_draft.psd', 245000000, 20],
    ['app_layout_v2.psd', 312000000, 12],
    ['app_layout_final.psd', 345000000, 5]
  ], 2);
  const designMainDir = createDir('02_디자인', rootPath, 1, [assetsDir], rawPsdFiles);

  // 3. Development dir (lots of files)
  const nodeModulesMock = createDir('node_modules', `${rootPath}\\03_개발`, 2, [
    createDir('react', `${rootPath}\\03_개발\\node_modules`, 3, [], makeFiles(`${rootPath}\\03_개발\\node_modules\\react`, [['index.js', 4500, 60], ['package.json', 1200, 60]], 4)),
    createDir('vite', `${rootPath}\\03_개발\\node_modules`, 3, [], makeFiles(`${rootPath}\\03_개발\\node_modules\\vite`, [['vite.js', 14500, 60]], 4))
  ], []);
  nodeModulesMock.size = 380 * 1024 * 1024; // 380MB
  nodeModulesMock.file_count = 14231;
  nodeModulesMock.folder_count = 542;

  const srcComponents = makeFiles(`${rootPath}\\03_개발\\src\\components`, [
    ['Button.tsx', 2300, 8],
    ['Card.tsx', 4100, 6],
    ['FolderTree.tsx', 12500, 1],
    ['MindmapView.tsx', 18400, 3],
    ['TreemapView.tsx', 15200, 2]
  ], 3);
  const componentsDir = createDir('components', `${rootPath}\\03_개발\\src`, 2, [], srcComponents);

  const srcUtils = makeFiles(`${rootPath}\\03_개발\\src\\utils`, [
    ['tauriBridge.ts', 4300, 1],
    ['helpers.ts', 2800, 12]
  ], 3);
  const utilsDir = createDir('utils', `${rootPath}\\03_개발\\src`, 2, [], srcUtils);

  const srcFiles = makeFiles(`${rootPath}\\03_개발\\src`, [
    ['App.tsx', 12500, 2],
    ['index.css', 4500, 4],
    ['main.tsx', 1200, 10],
    ['types.ts', 2400, 1]
  ], 2);
  const srcDir = createDir('src', `${rootPath}\\03_개발`, 1, [componentsDir, utilsDir], srcFiles);

  const devConfig = makeFiles(`${rootPath}\\03_개발`, [
    ['package.json', 1400, 5],
    ['tsconfig.json', 450, 40],
    ['vite.config.ts', 850, 10],
    ['tailwind.config.js', 1800, 4]
  ], 2);
  const devDir = createDir('03_개발', rootPath, 1, [nodeModulesMock, srcDir], devConfig);

  // 4. Output/Deliverables dir
  const reportsDir = createDir('reports', `${rootPath}\\04_산출물`, 2, [], makeFiles(`${rootPath}\\04_산출물\\reports`, [
    ['QA_report_v1.pdf', 3400000, 11],
    ['Performance_audit.xlsx', 4200000, 14]
  ], 3));
  const buildDir = createDir('build', `${rootPath}\\04_산출물`, 2, [], makeFiles(`${rootPath}\\04_산출물\\build`, [
    ['index.html', 1200, 10],
    ['bundle.js', 4200000, 10],
    ['style.css', 150000, 10]
  ], 3));
  const outputDir = createDir('04_산출물', rootPath, 1, [reportsDir, buildDir], makeFiles(`${rootPath}\\04_산출물`, [['설명서.txt', 25000, 15]], 2));

  // Overwrite sizes to match the beautiful demo GB sizes
  planningDir.size = Math.round(6.4 * 1024 * 1024 * 1024);
  designMainDir.size = Math.round(24.1 * 1024 * 1024 * 1024);
  devDir.size = Math.round(18.3 * 1024 * 1024 * 1024);
  outputDir.size = Math.round(5.4 * 1024 * 1024 * 1024);

  // 5. Create 05_운영 and 기타 directory
  const opsDir = createDir('05_운영', rootPath, 1, [], makeFiles(`${rootPath}\\05_운영`, [['운영노트.pdf', Math.round(2.1 * 1024 * 1024 * 1024), 25]], 2));
  const etcDir = createDir('기타', rootPath, 1, [], makeFiles(`${rootPath}\\기타`, [['아카이브.zip', Math.round(1.3 * 1024 * 1024 * 1024), 35]], 2));

  // Empty folders
  const emptyFolder1 = createDir('temp', `${rootPath}\\03_개발\\src`, 3, [], []);
  const emptyFolder2 = createDir('backup', `${rootPath}\\04_산출물\\reports`, 3, [], []);
  srcDir.children?.push(emptyFolder1);
  srcDir.folder_count += 1;
  reportsDir.children?.push(emptyFolder2);
  reportsDir.folder_count += 1;

  const rootChildren = [planningDir, designMainDir, devDir, outputDir, opsDir, etcDir];
  const totalSize = rootChildren.reduce((acc, c) => acc + c.size, 0);
  const totalFiles = rootChildren.reduce((acc, c) => acc + c.file_count, 0);
  const totalFolders = rootChildren.reduce((acc, c) => acc + c.folder_count + 1, 0);

  return {
    name: 'Folder-Atlas-Demo',
    path: rootPath,
    is_dir: true,
    size: totalSize,
    depth: 0,
    children: rootChildren,
    file_count: totalFiles,
    folder_count: totalFolders
  };
};

// Helper to extract project root path from any file/directory path
const getProjectRootPath = (path: string): string => {
  const match = path.match(/^(C:\\Projects\\[^\\]+)/i);
  return match ? match[1] : 'C:\\Projects\\Folder-Atlas-Demo';
};

// LocalStorage mock tree cache loader
const loadMockProject = (rootPath: string): FolderNode => {
  const key = `pa_mock_project_${rootPath}`;
  try {
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(e);
  }
  const mock = generateMockProject();
  const folderName = rootPath.split('\\').pop() || rootPath.split('/').pop() || 'Folder-Atlas-Demo';
  mock.name = folderName;
  mock.path = rootPath;
  const adjustPaths = (node: FolderNode, parentPath: string) => {
    node.path = `${parentPath}\\${node.name}`;
    if (node.children) {
      node.children.forEach(c => adjustPaths(c, node.path));
    }
  };
  adjustPaths(mock, rootPath);
  saveMockProject(rootPath, mock);
  return mock;
};

// LocalStorage mock tree cache saver with size/count calculations
const saveMockProject = (rootPath: string, tree: FolderNode) => {
  const key = `pa_mock_project_${rootPath}`;
  const calcStats = (node: FolderNode) => {
    if (!node.is_dir) {
      node.file_count = 1;
      node.folder_count = 0;
      return;
    }
    let size = 0;
    let fileCount = 0;
    let folderCount = 0;
    if (node.children) {
      node.children.forEach(c => {
        calcStats(c);
        size += c.size;
        fileCount += c.file_count;
        folderCount += c.folder_count + (c.is_dir ? 1 : 0);
      });
    }
    node.size = size;
    node.file_count = fileCount;
    node.folder_count = folderCount;
  };
  calcStats(tree);
  localStorage.setItem(key, JSON.stringify(tree));
};

const createDirectoryMock = (dirPath: string) => {
  const rootPath = getProjectRootPath(dirPath);
  const tree = loadMockProject(rootPath);
  const parts = dirPath.split('\\');
  const newDirName = parts.pop() || '';
  const parentPath = parts.join('\\');
  const findAndAdd = (node: FolderNode): boolean => {
    if (node.path === parentPath) {
      node.children = node.children || [];
      if (!node.children.some(c => c.name === newDirName)) {
        node.children.push({
          name: newDirName,
          path: dirPath,
          is_dir: true,
          size: 0,
          depth: node.depth + 1,
          children: [],
          file_count: 0,
          folder_count: 0,
          modified: Math.round(Date.now() / 1000)
        });
      }
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (child.is_dir && findAndAdd(child)) return true;
      }
    }
    return false;
  };
  findAndAdd(tree);
  saveMockProject(rootPath, tree);
};

const writeFileMock = (filePath: string, size: number) => {
  const rootPath = getProjectRootPath(filePath);
  const tree = loadMockProject(rootPath);
  const parts = filePath.split('\\');
  const fileName = parts.pop() || '';
  const parentPath = parts.join('\\');
  const findAndAdd = (node: FolderNode): boolean => {
    if (node.path === parentPath) {
      node.children = node.children || [];
      const existing = node.children.find(c => c.name === fileName);
      if (existing) {
        existing.size = size;
        existing.modified = Math.round(Date.now() / 1000);
      } else {
        node.children.push({
          name: fileName,
          path: filePath,
          is_dir: false,
          size: size,
          depth: node.depth + 1,
          file_count: 1,
          folder_count: 0,
          modified: Math.round(Date.now() / 1000)
        });
      }
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (child.is_dir && findAndAdd(child)) return true;
      }
    }
    return false;
  };
  findAndAdd(tree);
  saveMockProject(rootPath, tree);
};

const moveFileOrDirMock = (src: string, dest: string) => {
  const rootPath = getProjectRootPath(src);
  const tree = loadMockProject(rootPath);
  let movingNode: FolderNode | null = null;
  const removeNode = (node: FolderNode): boolean => {
    if (node.children) {
      const idx = node.children.findIndex(c => c.path === src);
      if (idx !== -1) {
        movingNode = node.children[idx];
        node.children.splice(idx, 1);
        return true;
      }
      for (const child of node.children) {
        if (child.is_dir && removeNode(child)) return true;
      }
    }
    return false;
  };
  removeNode(tree);
  if (!movingNode) return;
  const destParts = dest.split('\\');
  const newName = destParts.pop() || '';
  const destParentPath = destParts.join('\\');
  (movingNode as FolderNode).name = newName;
  const adjustPaths = (node: FolderNode, parentPath: string) => {
    node.path = `${parentPath}\\${node.name}`;
    if (node.children) {
      node.children.forEach(c => adjustPaths(c, node.path));
    }
  };
  adjustPaths(movingNode, destParentPath);
  const addNode = (node: FolderNode): boolean => {
    if (node.path === destParentPath) {
      node.children = node.children || [];
      node.children.push(movingNode!);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (child.is_dir && addNode(child)) return true;
      }
    }
    return false;
  };
  addNode(tree);
  saveMockProject(rootPath, tree);
};

// ─────────────────────────────────────────────────────────────
// Tauri native invoke wrappers with browser fallbacks
// ─────────────────────────────────────────────────────────────

export const scanDirectory = async (path: string): Promise<FolderNode> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('scan_directory', { path }) as Promise<FolderNode>;
  } else {
    // Browser fallback: If we have real files from webkitdirectory selection, build a real tree
    if (_lastSelectedFiles.length > 0 && _lastSelectedRootName) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const tree = buildTreeFromFiles(_lastSelectedFiles, _lastSelectedRootName, path);
          resolve(tree);
        }, 300);
      });
    }

    // Otherwise, check cached mock project
    return new Promise((resolve) => {
      setTimeout(() => {
        const rootPath = getProjectRootPath(path);
        const mockProj = loadMockProject(rootPath);
        resolve(mockProj);
      }, 500);
    });
  }
};

export const openInExplorer = async (path: string): Promise<void> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('open_in_explorer', { path }) as Promise<void>;
  } else {
    // Browser fallback: Show a visible notification instead of silent console.log
    console.log(`[Browser Mode] 탐색기 열기 요청: ${path}`);
    
    // Create a temporary toast-style notification
    const toast = document.createElement('div');
    toast.textContent = `📂 탐색기 열기: ${path.split('\\').pop() || path} (데스크톱 앱에서 실행 가능)`;
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #e2e8f0; padding: 12px 20px;
      border-radius: 12px; font-size: 13px; font-weight: 600;
      z-index: 99999; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: fadeInUp 0.3s ease-out;
      max-width: 480px; text-align: center;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);

    return Promise.resolve();
  }
};

export const openFile = async (path: string): Promise<void> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('open_file', { path }) as Promise<void>;
  } else {
    console.log(`[Browser Mode] 파일 열기 요청: ${path}`);

    // Create a temporary toast-style notification
    const toast = document.createElement('div');
    toast.textContent = `📄 파일 열기: ${path.split('\\').pop() || path} (데스크톱 앱에서 실행 가능)`;
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #e2e8f0; padding: 12px 20px;
      border-radius: 12px; font-size: 13px; font-weight: 600;
      z-index: 99999; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: fadeInUp 0.3s ease-out;
      max-width: 480px; text-align: center;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);

    return Promise.resolve();
  }
};

export const selectFolderNative = async (): Promise<string | null> => {
  if (isTauri()) {
    // @ts-ignore
    const { dialog } = await import('@tauri-apps/api');
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: '스캔할 폴더 선택'
    });
    if (Array.isArray(selected)) {
      return selected[0];
    }
    return selected;
  } else {
    // Browser fallback: Use webkitdirectory file input to trigger native OS directory picker
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.multiple = true; // Allow reading all files in directory

      input.onchange = (e: any) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const firstFile = files[0];
          const relativePath = firstFile.webkitRelativePath || '';
          // Extract root selected folder name
          const folderName = relativePath.split('/')[0] || 'SelectedFolder';
          
          // Store the actual files for scanDirectory to build a real tree
          _lastSelectedFiles = Array.from(files);
          _lastSelectedRootName = folderName;

          // Construct a representative path string
          resolve(`C:\\Projects\\${folderName}`);
        } else {
          resolve(null);
        }
      };

      // Handle cancel (click but no selection)
      input.addEventListener('cancel', () => {
        resolve(null);
      });

      input.click();
    });
  }
};

export const createDirectory = async (path: string): Promise<void> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('create_directory', { path }) as Promise<void>;
  } else {
    console.log(`[Browser Mode] 폴더 생성 요청: ${path}`);
    createDirectoryMock(path);
    return Promise.resolve();
  }
};

export const writeFileBytes = async (path: string, bytes: Uint8Array): Promise<void> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('write_file_bytes', { path, bytes: Array.from(bytes) }) as Promise<void>;
  } else {
    console.log(`[Browser Mode] 파일 쓰기 요청 (바이트): ${path} (크기: ${bytes.length} bytes)`);
    writeFileMock(path, bytes.length);
    return Promise.resolve();
  }
};

export const moveFileOrDir = async (src: string, dest: string): Promise<void> => {
  if (isTauri()) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api');
    return (invoke as any)('move_file_or_dir', { src, dest }) as Promise<void>;
  } else {
    console.log(`[Browser Mode] 파일/폴더 이동 요청: ${src} -> ${dest}`);
    moveFileOrDirMock(src, dest);
    return Promise.resolve();
  }
};
