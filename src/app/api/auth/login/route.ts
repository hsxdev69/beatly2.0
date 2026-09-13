import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
  if (!user || !verifyPassword(password, user.passwordHash))
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  await setSessionCookie(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
