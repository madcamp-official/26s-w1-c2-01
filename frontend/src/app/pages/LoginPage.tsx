import { LoginScreen } from "../MindSpaceScreens";

export interface LoginPageProps {
  onLogin: (name: string, email: string, password: string, isSignUp: boolean) => Promise<void>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return <LoginScreen onLogin={onLogin} />;
}

