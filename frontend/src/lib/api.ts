import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

// ─── Refresh Token Mutex ───
// Prevents multiple concurrent API calls from each triggering their own
// refresh, which would cause token-reuse detection and session invalidation.
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Acquire a refresh lock: if a refresh is already in-flight, wait for it.
 * Otherwise, start a new refresh and let others wait for it.
 */
async function acquireRefresh(): Promise<boolean> {
  if (refreshPromise) {
    // Another request is already refreshing — wait for it
    return refreshPromise;
  }

  refreshPromise = refreshToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;

  try {
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include', // Send cookies
      cache: 'no-store',
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    let response = await fetch(`${API_BASE}${endpoint}`, config);

    // Auto-refresh on 401
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));

      // Only attempt refresh if the token was expired or missing
      // (not for genuinely unauthorized requests like wrong credentials)
      if (
        errorData.code === 'TOKEN_EXPIRED' ||
        errorData.error === 'Authentication required'
      ) {
        const refreshed = await acquireRefresh();
        if (refreshed) {
          // Retry original request with new cookies
          response = await fetch(`${API_BASE}${endpoint}`, config);
        } else {
          return { data: null, error: 'Session expired', status: 401 };
        }
      } else {
        return {
          data: null,
          error: errorData.error || 'Unauthorized',
          status: 401,
        };
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.error || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return { data, error: null, status: response.status };
  } catch (error: any) {
    console.error('API request failed:', error);
    const errorMessage = 'Cannot connect to the backend server. Please make sure the backend process is running.';

    if (typeof window !== 'undefined') {
      toast.error('Backend server is unreachable. Please make sure the server is running.', {
        id: 'backend-server-down-toast',
        duration: 5000,
      });
    }

    return {
      data: null,
      error: errorMessage,
      status: 0,
    };
  }
}

// ─── Auth API ───
export const authApi = {
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  me: () =>
    request('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

// ─── Backup API ───
export const backupApi = {
  start: () =>
    request('/backup/start', { method: 'POST' }),

  stop: () =>
    request('/backup/stop', { method: 'POST' }),

  getStatus: () =>
    request('/backup/status'),

  getJobs: (page = 1, limit = 20, type?: string) =>
    request(`/backup/jobs?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`),

  getJob: (id: number) =>
    request(`/backup/jobs/${id}`),
};

// ─── Dashboard API ───
export const dashboardApi = {
  getStats: () =>
    request('/dashboard/stats'),
};

// ─── Logs API ───
export const logsApi = {
  getLogs: (page = 1, limit = 20, type?: string, status?: string) =>
    request(
      `/logs?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}${status ? `&status=${status}` : ''}`
    ),
};

// ─── Settings API ───
export const settingsApi = {
  get: () =>
    request('/settings'),

  update: (settings: Record<string, string>) =>
    request('/settings', { method: 'PUT', body: settings }),

  testDrive: (settings: Record<string, string>) =>
    request('/settings/drive/test', { method: 'POST', body: settings }),

  getDriveAuthUrl: () =>
    request('/settings/drive/auth-url'),

  exchangeDriveCode: (code: string) =>
    request('/settings/drive/exchange-code', { method: 'POST', body: { code } }),
};

// ─── File Manager API ───
export const fileManagerApi = {
  // Local filesystem
  listLocal: (dirPath: string) =>
    request(`/files/local/list?path=${encodeURIComponent(dirPath)}`),

  getLocalInfo: (filePath: string) =>
    request(`/files/local/info?path=${encodeURIComponent(filePath)}`),

  createLocalFolder: (parentPath: string, name: string) =>
    request('/files/local/create-folder', { method: 'POST', body: { parentPath, name } }),

  renameLocal: (filePath: string, newName: string) =>
    request('/files/local/rename', { method: 'POST', body: { filePath, newName } }),

  deleteLocal: (filePath: string) =>
    request('/files/local/delete', { method: 'POST', body: { filePath } }),

  // Google Drive
  listDrive: (folderId?: string) =>
    request(`/files/drive/list${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`),

  createDriveFolder: (parentId: string, name: string) =>
    request('/files/drive/create-folder', { method: 'POST', body: { parentId, name } }),

  renameDrive: (fileId: string, newName: string) =>
    request('/files/drive/rename', { method: 'POST', body: { fileId, newName } }),

  deleteDrive: (fileId: string) =>
    request('/files/drive/delete', { method: 'POST', body: { fileId } }),

  // Cross-operations
  compareWithDrive: (localPath: string, driveFolderId: string) =>
    request('/files/compare-with-drive', { method: 'POST', body: { localPath, driveFolderId } }),

  uploadToDrive: (localPath: string, driveFolderId: string, transferId?: string, overwrite?: boolean, existingDriveFileId?: string, overwriteMap?: Record<string, string>, skipPaths?: string[]) =>
    request('/files/upload-to-drive', { method: 'POST', body: { localPath, driveFolderId, transferId, overwrite, existingDriveFileId, overwriteMap, skipPaths } }),

  downloadFromDrive: (fileId: string, localPath: string, fileName?: string) =>
    request('/files/download-from-drive', { method: 'POST', body: { fileId, localPath, fileName } }),
};

// ─── Tasks API ───
export const tasksApi = {
  getTasks: () =>
    request('/tasks'),

  getTask: (taskId: string) =>
    request(`/tasks/${taskId}`),

  resumeTask: (taskId: string) =>
    request(`/tasks/${taskId}/resume`, { method: 'POST' }),
};

// ─── Audit Log API ───
export const auditApi = {
  getLogs: (page = 1, limit = 20, action?: string) =>
    request(
      `/audit?page=${page}&limit=${limit}${action ? `&action=${encodeURIComponent(action)}` : ''}`
    ),
};

