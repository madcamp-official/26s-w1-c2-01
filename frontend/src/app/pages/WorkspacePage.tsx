import { MapData, MemberData, WorkspaceData, WorkspaceScreen } from "../CoMindScreens";

export interface WorkspacePageProps {
  user: { id?: number; name: string; email: string };
  workspaces: WorkspaceData[];
  pendingInvitationCount: number;
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onProfileUpdate: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  onMemberRoleChange: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onWorkspaceRename: (workspaceId: string, name: string) => Promise<void>;
  onWorkspaceDelete: (workspaceId: string) => Promise<void>;
  onMemberRemove: (workspaceId: string, member: MemberData) => Promise<void>;
  onWorkspaceLeave: (workspaceId: string) => Promise<void>;
  onMapRename: (workspaceId: string, mapId: string, name: string) => Promise<void>;
  onMapDelete: (workspaceId: string, mapId: string) => Promise<void>;
}

export function WorkspacePage({ workspaces, ...props }: WorkspacePageProps) {
  return <WorkspaceScreen initialWorkspaces={workspaces} {...props} />;
}
