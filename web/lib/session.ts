import { auth } from "@/auth";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in.");
  return session.user.id;
}
