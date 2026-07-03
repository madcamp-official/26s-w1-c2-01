import { CanvasScreen, MapData, WorkspaceData } from "../MindSpaceScreens";

interface MindMapPageProps {
  workspace: WorkspaceData;
  map: MapData;
  userInitials: string;
  currentUserId?: number;
  currentRole?: "owner" | "editor" | "viewer";
  onBack: () => void;
}

export function MindMapPage({ workspace, map, userInitials, currentUserId, currentRole, onBack }: MindMapPageProps) {
  return (
    <CanvasScreen
      workspace={workspace}
      mapId={map.id}
      mapName={map.name}
      userInitials={userInitials}
      currentUserId={currentUserId}
      currentRole={currentRole}
      onBack={onBack}
    />
  );
}

