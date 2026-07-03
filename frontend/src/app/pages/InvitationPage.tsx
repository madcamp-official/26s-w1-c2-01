import { MapData, MemberData, WorkspaceData, InvitationScreen, WorkspaceScreen } from "../MindSpaceScreens";

interface InvitationPageProps {
  user: { id?: number; name: string; email: string };
  workspaces: WorkspaceData[];
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onClose: () => void;
  onLogout: () => void;
  onMemberRoleChange: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
}

export function InvitationPage({ user, workspaces, onOpenCanvas, onClose, onLogout, onMemberRoleChange }: InvitationPageProps) {
  return (
    <>
      <WorkspaceScreen
        user={user}
        initialWorkspaces={workspaces}
        onOpenCanvas={onOpenCanvas}
        onViewInvitation={() => undefined}
        onLogout={onLogout}
        onMemberRoleChange={onMemberRoleChange}
      />
      <InvitationScreen onAccept={onClose} onDecline={onClose} />
    </>
  );
}

