"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@cadence/db";
import { requireUserId } from "@/lib/session";
import { unstable_update } from "@/auth";

/** Update the signed-in user's display name and refresh the JWT session so the
 *  change shows immediately (no re-login). */
export async function updateDisplayName(formData: FormData) {
  const userId = await requireUserId();
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return;

  await prisma.user.update({ where: { id: userId }, data: { name } });
  await unstable_update({ user: { name } });
  revalidatePath("/settings");
  revalidatePath("/profile");
}
