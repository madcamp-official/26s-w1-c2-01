import { MapData, MemberData, WorkspaceData, WorkspaceScreen } from "../MindSpaceScreens";

export interface WorkspacePageProps {
  user: { id?: number; name: string; email: string };
  workspaces: WorkspaceData[];
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
  onMemberRoleChange: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
}

export function WorkspacePage({ workspaces, ...props }: WorkspacePageProps) {
  return <WorkspaceScreen initialWorkspaces={workspaces} {...props} />;
}

