export const USER_ROLES = ["reader", "writer", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRole(role: unknown): UserRole {
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "reader";
}

export function canAccessTranslationPortal(role: unknown) {
  const normalized = normalizeUserRole(role);
  return normalized === "writer" || normalized === "admin";
}

export function canManageUsers(role: unknown) {
  return normalizeUserRole(role) === "admin";
}
