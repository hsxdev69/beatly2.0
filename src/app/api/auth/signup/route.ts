import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password, name } = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password || password.length < 6 || !name?.trim()) {
    return NextResponse.json(
      { error: "Name, email and a password of at least 6 characters are required" },
      { status: 400 },
    );
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail));
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  const [user] = await db
    .insert(users)
    .values({ email: cleanEmail, name: name.trim(), passwordHash: hashPassword(password) })
    .returning({ id: users.id, email: users.email, name: users.name });
  await setSessionCookie(user.id);
  return NextResponse.json({ user });
}
