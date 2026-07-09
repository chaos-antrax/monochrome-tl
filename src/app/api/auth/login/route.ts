import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { findUserByEmail } from "@/lib/repository";
import { setSessionCookie } from "@/lib/session";

const AuthSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, password } = AuthSchema.parse(await request.json());
    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setSessionCookie(user);
    return NextResponse.json({ user: { id: user._id.toHexString(), email: user.email } });
  } catch (error) {
    return apiErrorResponse(error, "Failed to sign in.");
  }
}