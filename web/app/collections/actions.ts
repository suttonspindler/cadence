"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@cadence/db";
import { requireUserId } from "@/lib/session";

export async function createCollection(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;
  const isPublic = formData.get("isPublic") === "on";

  const collection = await prisma.collection.create({
    data: { userId, name, description, isPublic },
  });
  revalidatePath("/collections");
  redirect(`/collections/${collection.id}`);
}

export async function deleteCollection(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("collectionId") ?? "");
  await prisma.collection.deleteMany({ where: { id, userId } });
  revalidatePath("/collections");
  redirect("/collections");
}

async function assertOwnedCollection(collectionId: string, userId: string) {
  const owned = await prisma.collection.findFirst({ where: { id: collectionId, userId } });
  if (!owned) throw new Error("Collection not found.");
  return owned;
}

// Add/remove a recording to/from an existing collection (used on recording pages).
export async function toggleCollectionItem(formData: FormData) {
  const userId = await requireUserId();
  const collectionId = String(formData.get("collectionId") ?? "");
  const recordingId = String(formData.get("recordingId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await assertOwnedCollection(collectionId, userId);

  const existing = await prisma.collectionItem.findUnique({
    where: { collectionId_recordingId: { collectionId, recordingId } },
  });
  if (existing) {
    await prisma.collectionItem.delete({ where: { id: existing.id } });
  } else {
    const position = await prisma.collectionItem.count({ where: { collectionId } });
    await prisma.collectionItem.create({ data: { collectionId, recordingId, position } });
  }

  if (slug) revalidatePath(`/recordings/${slug}`);
  revalidatePath(`/collections/${collectionId}`);
}

// Create a new collection and drop a recording into it, in one step.
export async function createCollectionWithRecording(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const recordingId = String(formData.get("recordingId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!name || !recordingId) return;

  const collection = await prisma.collection.create({ data: { userId, name } });
  await prisma.collectionItem.create({ data: { collectionId: collection.id, recordingId, position: 0 } });

  if (slug) revalidatePath(`/recordings/${slug}`);
  revalidatePath("/collections");
}

// Remove from a collection (used on the collection detail page).
export async function removeFromCollection(formData: FormData) {
  const userId = await requireUserId();
  const collectionId = String(formData.get("collectionId") ?? "");
  const recordingId = String(formData.get("recordingId") ?? "");
  await assertOwnedCollection(collectionId, userId);

  await prisma.collectionItem.deleteMany({ where: { collectionId, recordingId } });
  revalidatePath(`/collections/${collectionId}`);
}
