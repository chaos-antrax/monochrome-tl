import { ObjectId } from "mongodb";
import { getSafeUser } from "./repository";
import { canAccessTranslationPortal, canManageUsers } from "./roles";
import { getSession } from "./session";

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function requirePortalUser() {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Unauthorized");
  const user = await getSafeUser(session.userId);
  if (!user) throw new AuthError(401, "Unauthorized");
  if (!canAccessTranslationPortal(user.role)) throw new AuthError(403, "Writer access is required for the translation portal.");
  return { session, user };
}

export async function requireAdminUser() {
  const portal = await requirePortalUser();
  if (!canManageUsers(portal.user.role)) throw new AuthError(403, "Admin access is required.");
  return portal;
}

export function assertObjectId(id: string) {
  if (!ObjectId.isValid(id)) throw new AuthError(400, "Invalid user id.");
  return new ObjectId(id);
}
