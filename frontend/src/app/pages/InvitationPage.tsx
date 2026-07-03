import { MapData, WorkspaceData, InvitationScreen, WorkspaceScreen } from "../MindSpaceScreens";

interface InvitationPageProps {
  user: { name: string; email: string };
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onClose: () => void;
  onLogout: () => void;
}

export function InvitationPage({ user, onOpenCanvas, onClose, onLogout }: InvitationPageProps) {
  return (
    <>
      <WorkspaceScreen
        user={user}
        onOpenCanvas={onOpenCanvas}
        onViewInvitation={() => undefined}
        onLogout={onLogout}
      />
      <InvitationScreen onAccept={onClose} onDecline={onClose} />
    </>
  );
}

