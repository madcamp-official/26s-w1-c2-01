import { CanvasScreen, MapData, WorkspaceData } from "../CoMindScreens";

interface MindMapPageProps {
  workspace: WorkspaceData;
  map: MapData;
  userInitials: string;
  currentUserId?: number;
  currentRole?: "owner" | "editor" | "viewer";
  onBack: () => void;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout: () => void;
  onMapRename: (name: string) => Promise<void>;
  onMapDelete: () => Promise<void>;
}

export function MindMapPage({ workspace, map, userInitials, currentUserId, currentRole, onBack, onInvite, onLogout, onMapRename, onMapDelete }: MindMapPageProps) {
  return (
    <CanvasScreen
      workspace={workspace}
      mapId={map.id}
      mapName={map.name}
      userInitials={userInitials}
      currentUserId={currentUserId}
      currentRole={currentRole}
      onBack={onBack}
      onInvite={onInvite}
      onLogout={onLogout}
      onMapRename={onMapRename}
      onMapDelete={onMapDelete}
    />
  );
}
