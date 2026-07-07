export type Role = "owner" | "editor" | "viewer";

export interface MemberData {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  color: string;
  userId?: number;
}

export interface MapData {
    id: string;
    name: string;
    nodeCount: number;
    updatedAt: string;
}

export interface WorkspaceData {
    id: string;
    name: string;
    members: MemberData[];
    maps: MapData[];
    ownerId?: number;
    currentRole?: Role;
}

export interface NodeData {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    parentId: string | null;
}

export interface EdgeData {
    from: string;
    to: string;
}

export interface CommentData {
    id: string;
    nodeId: string;
    authorId?: number;
    author: string;
    content: string;
    solved: boolean;
}