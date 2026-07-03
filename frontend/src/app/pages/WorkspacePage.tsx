import { MapData, WorkspaceData, WorkspaceScreen } from "../MindSpaceScreens";

export interface WorkspacePageProps {
  user: { name: string; email: string };
  onOpenCanvas: (workspace: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
}

export function WorkspacePage(props: WorkspacePageProps) {
  return <WorkspaceScreen {...props} />;
}

