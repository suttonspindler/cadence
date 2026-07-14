// One-off maintenance: fold a dev-login demo account's user-generated data
// (reviews, listens, collections) into a real signed-in account, then delete
// the now-empty demo user. Idempotent — safe to re-run.
//
// Usage: tsx scripts/merge-user.ts <fromEmail> <toEmail>

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const [fromEmail, toEmail] = process.argv.slice(2);
  if (!fromEmail || !toEmail) {
    throw new Error("Usage: tsx scripts/merge-user.ts <fromEmail> <toEmail>");
  }

  const from = await prisma.user.findUnique({ where: { email: fromEmail } });
  const to = await prisma.user.findUnique({ where: { email: toEmail } });
  if (!to) throw new Error(`Target user ${toEmail} not found`);
  if (!from) {
    console.log(`Source user ${fromEmail} not found — nothing to merge (already done?).`);
    return;
  }
  if (from.id === to.id) throw new Error("Source and target are the same user");

  // Drop empty throwaway collections before reassigning.
  const emptyCollections = await prisma.collection.findMany({
    where: { userId: from.id, items: { none: {} } },
    select: { id: true, name: true },
  });
  for (const c of emptyCollections) {
    await prisma.collection.delete({ where: { id: c.id } });
    console.log(`  dropped empty collection "${c.name}"`);
  }

  // Reassign the rest. Review has a (userId, recordingId) unique — skip any that
  // would collide with a review the target already wrote for the same recording.
  const targetReviewed = new Set(
    (await prisma.review.findMany({ where: { userId: to.id }, select: { recordingId: true } })).map(
      (r) => r.recordingId,
    ),
  );
  const fromReviews = await prisma.review.findMany({ where: { userId: from.id } });
  let movedReviews = 0;
  for (const r of fromReviews) {
    if (targetReviewed.has(r.recordingId)) {
      console.log(`  skipped review on ${r.recordingId} (target already reviewed it)`);
      continue;
    }
    await prisma.review.update({ where: { id: r.id }, data: { userId: to.id } });
    movedReviews++;
  }

  const listens = await prisma.listen.updateMany({
    where: { userId: from.id },
    data: { userId: to.id },
  });
  const collections = await prisma.collection.updateMany({
    where: { userId: from.id },
    data: { userId: to.id },
  });

  console.log(
    `  moved ${movedReviews} review(s), ${listens.count} listen(s), ${collections.count} collection(s)`,
  );

  await prisma.user.delete({ where: { id: from.id } });
  console.log(`  deleted demo user ${fromEmail}`);
  console.log(`Merged ${fromEmail} → ${toEmail}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
