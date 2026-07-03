import { CanvasScreen, MapData, WorkspaceData } from "../MindSpaceScreens";

interface MindMapPageProps {
  workspace: WorkspaceData;
  map: MapData;
  userInitials: string;
  onBack: () => void;
}

export function MindMapPage({ workspace, map, userInitials, onBack }: MindMapPageProps) {
  return (
    <CanvasScreen
      workspace={workspace}
      mapName={map.name}
      userInitials={userInitials}
      onBack={onBack}
    />
  );
}

