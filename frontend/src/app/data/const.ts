export const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
  { label: "8자 이상", test: value => value.length >= 8 },
  { label: "영문 포함", test: value => /[A-Za-z]/.test(value) },
  { label: "숫자 포함", test: value => /[0-9]/.test(value) },
  { label: "특수문자 포함", test: value => /[^A-Za-z0-9]/.test(value) },
];

export const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

export const NODE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];

export const API_COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", violet: "#8b5cf6", cyan: "#06b6d4", emerald: "#10b981",
  amber: "#f59e0b", red: "#ef4444", pink: "#ec4899", blue: "#3b82f6",
};

export const HEX_API_COLOR = Object.fromEntries(Object.entries(API_COLOR_HEX).map(([name, hex]) => [hex, name]));
