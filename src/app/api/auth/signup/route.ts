import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { createUser, findUserByEmail } from "@/lib/repository";

const AuthSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const { email, password } = AuthSchema.parse(await request.json());
    const existing = await findUserByEmail(email);
    if (existing) return NextResponse.json({ error: "Email is already registered." }, { status: 409 });

    const user = await createUser(email, await bcrypt.hash(password, 12));
    return NextResponse.json(
      {
        user: { id: user._id.toHexString(), email: user.email, role: user.role },
        error: "Account created as a reader. Ask an admin to grant writer access before using the translation portal.",
      },
      { status: 403 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create account.");
  }
}
