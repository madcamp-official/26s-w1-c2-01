import { ApiInvitation } from "../../api/client";
import { MapData, MemberData, WorkspaceData, InvitationScreen, WorkspaceScreen } from "../MindSpaceScreens";

interface InvitationPageProps {
  user: { id?: number; name: string; email: string };
  workspaces: WorkspaceData[];
  invitations: ApiInvitation[];
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onClose: () => void;
  onLogout: () => void;
  onMemberRoleChange: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onAccept: (invitationId: number) => Promise<void>;
  onReject: (invitationId: number) => Promise<void>;
}

export function InvitationPage({
  user, workspaces, invitations, onOpenCanvas, onClose, onLogout, onMemberRoleChange, onInvite, onAccept, onReject,
}: InvitationPageProps) {
  return (
    <>
      <WorkspaceScreen
        user={user}
        initialWorkspaces={workspaces}
        pendingInvitationCount={invitations.length}
        onOpenCanvas={onOpenCanvas}
        onViewInvitation={() => undefined}
        onLogout={onLogout}
        onMemberRoleChange={onMemberRoleChange}
        onInvite={onInvite}
      />
      <InvitationScreen invitations={invitations} onAccept={onAccept} onReject={onReject} onClose={onClose} />
    </>
  );
}
