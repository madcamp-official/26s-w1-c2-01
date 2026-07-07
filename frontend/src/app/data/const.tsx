export const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
  { label: "8자 이상", test: value => value.length >= 8 },
  { label: "영문 포함", test: value => /[A-Za-z]/.test(value) },
  { label: "숫자 포함", test: value => /[0-9]/.test(value) },
  { label: "특수문자 포함", test: value => /[^A-Za-z0-9]/.test(value) },
];