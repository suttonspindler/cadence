"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@cadence/db";
import { auth } from "@/auth";
import { RATING_DIMENSIONS } from "@/lib/ratings";

function parseRating(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in.");
  return session.user.id;
}

export async function saveReview(formData: FormData) {
  const userId = await requireUserId();
  const recordingId = String(formData.get("recordingId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!recordingId) throw new Error("Missing recording.");

  const body = String(formData.get("body") ?? "").trim() || null;
  const scores = Object.fromEntries(
    RATING_DIMENSIONS.map((d) => [d.key, parseRating(formData.get(d.key))]),
  );

  await prisma.review.upsert({
    where: { userId_recordingId: { userId, recordingId } },
    update: { body, ...scores },
    create: { userId, recordingId, body, ...scores },
  });

  if (slug) revalidatePath(`/recordings/${slug}`);
}

export async function deleteReview(formData: FormData) {
  const userId = await requireUserId();
  const recordingId = String(formData.get("recordingId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  await prisma.review.deleteMany({ where: { userId, recordingId } });
  if (slug) revalidatePath(`/recordings/${slug}`);
}

export async function toggleListened(formData: FormData) {
  const userId = await requireUserId();
  const recordingId = String(formData.get("recordingId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const existing = await prisma.listen.findFirst({ where: { userId, recordingId } });
  if (existing) {
    await prisma.listen.deleteMany({ where: { userId, recordingId } });
  } else {
    await prisma.listen.create({ data: { userId, recordingId } });
  }

  if (slug) revalidatePath(`/recordings/${slug}`);
}
