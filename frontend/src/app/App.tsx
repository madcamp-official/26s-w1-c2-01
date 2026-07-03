import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";

import { MapData, WorkspaceData, WORKSPACES } from "./MindSpaceScreens";
import { InvitationPage } from "./pages/InvitationPage";
import { LoginPage } from "./pages/LoginPage";
import { MindMapPage } from "./pages/MindMapPage";
import { WorkspacePage } from "./pages/WorkspacePage";

type User = { name: string; email: string };

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData>(WORKSPACES[0]);
  const [activeMap, setActiveMap] = useState<MapData>(WORKSPACES[0].maps[0]);

  const openCanvas = (workspace: WorkspaceData, map: MapData) => {
    setActiveWorkspace(workspace);
    setActiveMap(map);
    navigate(`/workspaces/${workspace.id}/maps/${map.id}`);
  };

  const logout = () => {
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to="/workspaces" replace />
          : <LoginPage onLogin={(name, email) => { setUser({ name, email }); navigate("/workspaces"); }} />
      } />
      <Route path="/workspaces" element={
        user
          ? <WorkspacePage user={user} onOpenCanvas={openCanvas} onViewInvitation={() => navigate("/invitations")} onLogout={logout} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/invitations" element={
        user
          ? <InvitationPage user={user} onOpenCanvas={openCanvas} onClose={() => navigate("/workspaces")} onLogout={logout} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/workspaces/:workspaceId/maps/:mapId" element={
        user
          ? <MindMapPage
              workspace={activeWorkspace}
              map={activeMap}
              userInitials={user.name.split(" ").map(part => part[0]).join("")}
              onBack={() => navigate("/workspaces")}
            />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to={user ? "/workspaces" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

