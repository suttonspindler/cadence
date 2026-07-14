import Link from "next/link";
import { prisma } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { CoverArt } from "@/components/CoverArt";
import { SignedOutNotice } from "@/components/SignedOutNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listening history" };

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default async function ListeningPage() {
  const user = await getSessionUser();
  if (!user?.id) {
    return <SignedOutNotice title="Listening history" what="see everything you've listened to" />;
  }

  const listens = await prisma.listen.findMany({
    where: { userId: user.id },
    orderBy: { listenedAt: "desc" },
    include: {
      recording: {
        include: {
          work: { include: { composer: true } },
          credits: { include: { artist: true } },
          album: { select: { imageUrl: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight">Listening history</h1>
      <p className="mb-6 text-sm text-ink-faint">
        {listens.length} {listens.length === 1 ? "listen" : "listens"}
      </p>

      {listens.length === 0 ? (
        <p className="text-ink-soft">
          Nothing yet. Mark a{" "}
          <Link href="/recordings" className="text-accent hover:underline">
            recording
          </Link>{" "}
          as listened to start building your history.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {listens.map((l) => (
            <li key={l.id}>
              <Link
                href={`/recordings/${l.recording.slug}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-paper"
              >
                <span className="flex items-center gap-4">
                  <CoverArt
                    title={l.recording.work.title}
                    imageUrl={l.recording.album?.imageUrl ?? l.recording.imageUrl}
                    size={44}
                  />
                  <span>
                    <span className="font-medium">{l.recording.work.composer.name}</span>
                    <span className="text-ink-soft"> — {l.recording.work.title}</span>
                    <span className="block text-sm text-ink-faint">
                      {l.recording.credits.map((cr) => cr.artist.name).join(", ")}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink-faint">
                  {dateFmt.format(l.listenedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
