import { MapData, WorkspaceData } from "../data/type";
import { CanvasScreen } from "../components/screens/CanvasScreen";

interface MindMapPageProps {
  workspace: WorkspaceData;
  map: MapData;
  user: { name: string; email: string };
  currentUserId?: number;
  currentRole?: "owner" | "editor" | "viewer";
  onBack: () => void;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onProfileUpdate: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  onMapRename: (name: string) => Promise<void>;
  onMapDelete: () => Promise<void>;
}

export function MindMapPage({ workspace, map, user, currentUserId, currentRole, onBack, onInvite, onLogout, onDeleteAccount, onProfileUpdate, onMapRename, onMapDelete }: MindMapPageProps) {
  return (
    <CanvasScreen
      workspace={workspace}
      mapId={map.id}
      mapName={map.name}
      user={user}
      currentUserId={currentUserId}
      currentRole={currentRole}
      onBack={onBack}
      onInvite={onInvite}
      onLogout={onLogout}
      onDeleteAccount={onDeleteAccount}
      onProfileUpdate={onProfileUpdate}
      onMapRename={onMapRename}
      onMapDelete={onMapDelete}
    />
  );
}
