import { ApiInvitation } from "../../api/client";
import { MapData, MemberData, WorkspaceData, InvitationScreen, WorkspaceScreen } from "../CoMindScreens";

interface InvitationPageProps {
  user: { id?: number; name: string; email: string };
  workspaces: WorkspaceData[];
  invitations: ApiInvitation[];
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onClose: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onMemberRoleChange: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onAccept: (invitationId: number) => Promise<void>;
  onReject: (invitationId: number) => Promise<void>;
  onWorkspaceRename: (workspaceId: string, name: string) => Promise<void>;
  onWorkspaceDelete: (workspaceId: string) => Promise<void>;
  onMemberRemove: (workspaceId: string, member: MemberData) => Promise<void>;
  onWorkspaceLeave: (workspaceId: string) => Promise<void>;
  onMapRename: (workspaceId: string, mapId: string, name: string) => Promise<void>;
  onMapDelete: (workspaceId: string, mapId: string) => Promise<void>;
}

export function InvitationPage({
  user, workspaces, invitations, onOpenCanvas, onClose, onLogout, onDeleteAccount, onMemberRoleChange, onInvite, onAccept, onReject,
  onWorkspaceRename, onWorkspaceDelete, onMemberRemove, onWorkspaceLeave, onMapRename, onMapDelete,
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
        onDeleteAccount={onDeleteAccount}
        onMemberRoleChange={onMemberRoleChange}
        onInvite={onInvite}
        onWorkspaceRename={onWorkspaceRename}
        onWorkspaceDelete={onWorkspaceDelete}
        onMemberRemove={onMemberRemove}
        onWorkspaceLeave={onWorkspaceLeave}
        onMapRename={onMapRename}
        onMapDelete={onMapDelete}
      />
      <InvitationScreen invitations={invitations} onAccept={onAccept} onReject={onReject} onClose={onClose} />
    </>
  );
}
