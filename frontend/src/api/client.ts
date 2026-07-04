const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export interface ApiUser { id: number; email: string; name: string; }
export interface ApiMember { id: number; user: ApiUser; role: "owner" | "editor" | "viewer"; joined_at: string; }
export interface ApiWorkspace { id: number; name: string; owner_id: number; created_at: string; updated_at: string; members?: ApiMember[]; }
export interface ApiMindMap { id: number; workspace_id: number; name: string; root_block_id: number | null; node_count?: number; updated_at: string; }
export interface ApiBlock { id: number; map_id: number; parent_block_id: number | null; creator_id: number; content: string; color: string; }
export interface ApiComment { id: number; block_id: number; author: ApiUser; content: string; solved: boolean; created_at: string; updated_at: string; }
export interface ApiInvitation { id: number; workspace: ApiWorkspace; inviter: ApiUser; role: "editor" | "viewer"; status: "pending" | "accepted" | "rejected"; created_at: string; }
export interface ApiRecommendation { content: string; score: number; source: "semantic" | "search"; }
export interface ApiUserSearchResult { id: number; email: string; name: string; }

interface TokenResponse { access_token: string; refresh_token: string; user: ApiUser; }

let accessToken = localStorage.getItem("comind.accessToken");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? `API 요청 실패 (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  async login(email: string, password: string) {
    const result = await request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    accessToken = result.access_token;
    localStorage.setItem("comind.accessToken", result.access_token);
    localStorage.setItem("comind.refreshToken", result.refresh_token);
    return result.user;
  },
  signup: (email: string, password: string, name: string) =>
    request<ApiUser>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  me: () => request<ApiUser>("/users/me"),
  logout() {
    localStorage.removeItem("comind.accessToken");
    localStorage.removeItem("comind.refreshToken");
    accessToken = null;
  },
  listWorkspaces: () => request<ApiWorkspace[]>("/workspaces"),
  createWorkspace: (name: string) => request<ApiWorkspace>("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  updateWorkspace: (workspaceId: number, name: string) =>
    request<ApiWorkspace>(`/workspaces/${workspaceId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteWorkspace: (workspaceId: number) => request<{ message: string }>(`/workspaces/${workspaceId}`, { method: "DELETE" }),
  workspaceDetail: (workspaceId: number) => request<ApiWorkspace>(`/workspaces/${workspaceId}`),
  listMaps: (workspaceId: number) => request<ApiMindMap[]>(`/workspaces/${workspaceId}/maps`),
  createMap: (workspaceId: number, name: string) => request<ApiMindMap>(`/workspaces/${workspaceId}/maps`, { method: "POST", body: JSON.stringify({ name }) }),
  updateMap: (mapId: number, name: string) =>
    request<ApiMindMap>(`/maps/${mapId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteMap: (mapId: number) => request<{ message: string }>(`/maps/${mapId}`, { method: "DELETE" }),
  listBlocks: (mapId: number) => request<ApiBlock[]>(`/maps/${mapId}/blocks`),
  createBlock: (mapId: number, content: string, parentBlockId: number, color?: string) =>
    request<ApiBlock>(`/maps/${mapId}/blocks`, { method: "POST", body: JSON.stringify({ content, parent_block_id: parentBlockId, color }) }),
  updateBlock: (blockId: number, payload: { content?: string; color?: string }) =>
    request<ApiBlock>(`/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBlock: (blockId: number) => request<{ message: string }>(`/blocks/${blockId}`, { method: "DELETE" }),
  listComments: (blockId: number) => request<ApiComment[]>(`/blocks/${blockId}/comments`),
  listCommentsByMap: (mapId: number) => request<ApiComment[]>(`/maps/${mapId}/comments`),
  createComment: (blockId: number, content: string) =>
    request<ApiComment>(`/blocks/${blockId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  updateComment: (commentId: number, content: string) =>
    request<ApiComment>(`/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  resolveComment: (commentId: number, solved: boolean) =>
    request<ApiComment>(`/comments/${commentId}/solved`, { method: "PATCH", body: JSON.stringify({ solved }) }),
  updateMemberRole: (workspaceId: number, userId: number, role: "editor" | "viewer") =>
    request<ApiMember>(`/workspaces/${workspaceId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (workspaceId: number, userId: number) =>
    request<{ message: string }>(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
  leaveWorkspace: (workspaceId: number) =>
    request<{ message: string }>(`/workspaces/${workspaceId}/leave`, { method: "POST" }),
  searchUsers: (query: string) => request<ApiUserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`),
  inviteToWorkspace: (workspaceId: number, userId: number, role: "editor" | "viewer") =>
    request<ApiInvitation>(`/workspaces/${workspaceId}/invite`, { method: "POST", body: JSON.stringify({ user_id: userId, role }) }),
  listInvitations: () => request<ApiInvitation[]>("/invitations"),
  acceptInvitation: (invitationId: number) => request<{ message: string }>(`/invitations/${invitationId}/accept`, { method: "POST" }),
  rejectInvitation: (invitationId: number) => request<{ message: string }>(`/invitations/${invitationId}/reject`, { method: "POST" }),
  getRecommendations: (blockId: number, limit = 6) => request<ApiRecommendation[]>(`/blocks/${blockId}/recommendations?limit=${limit}`),
  applyRecommendation: (blockId: number, content: string) =>
    request<ApiBlock>(`/blocks/${blockId}/recommendations/apply`, { method: "POST", body: JSON.stringify({ content }) }),
  mapSocketUrl: (mapId: number) => `${WS_BASE_URL}/ws/maps/${mapId}?token=${encodeURIComponent(accessToken ?? "")}`,
  workspaceSocketUrl: (workspaceId: number) => `${WS_BASE_URL}/ws/workspaces/${workspaceId}?token=${encodeURIComponent(accessToken ?? "")}`,
  userSocketUrl: (userId: number) => `${WS_BASE_URL}/ws/users/${userId}?token=${encodeURIComponent(accessToken ?? "")}`,
};
