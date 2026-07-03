import { LoginScreen } from "../MindSpaceScreens";

export interface LoginPageProps {
  onLogin: (name: string, email: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return <LoginScreen onLogin={onLogin} />;
}

