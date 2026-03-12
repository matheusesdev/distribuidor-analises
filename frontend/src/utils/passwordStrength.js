export const getPasswordStrength = (password) => {
  const normalizedPassword = (password || "").trim();
  if (!normalizedPassword) return null;

  const checks = [
    normalizedPassword.length >= 8,
    normalizedPassword.length >= 12,
    /[a-z]/.test(normalizedPassword) && /[A-Z]/.test(normalizedPassword),
    /\d/.test(normalizedPassword),
    /[^A-Za-z0-9]/.test(normalizedPassword),
  ];
  const score = checks.filter(Boolean).length;

  if (score <= 2) {
    return {
      level: "weak",
      color: "bg-red-500",
      label: "Muito fraca",
      isAcceptable: false,
    };
  }

  if (score === 3) {
    return {
      level: "medium",
      color: "bg-yellow-500",
      label: "Média",
      isAcceptable: true,
    };
  }

  if (score === 4) {
    return {
      level: "strong",
      color: "bg-green-500",
      label: "Forte",
      isAcceptable: true,
    };
  }

  return {
    level: "verystrong",
    color: "bg-green-600",
    label: "Muito forte",
    isAcceptable: true,
  };
};