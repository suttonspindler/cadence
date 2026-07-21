import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@cadence/db";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
// Passwordless dev login is opt-in AND hard-disabled in production, so a
// misconfigured deploy (ENABLE_DEV_LOGIN accidentally "true") can never expose
// login-as-anyone. Google OAuth is the only production sign-in path.
export const devLoginEnabled =
  process.env.ENABLE_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

const providers: NextAuthConfig["providers"] = [];

if (googleEnabled) {
  providers.push(Google); // reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
}

if (devLoginEnabled) {
  // Local-only password-less login: upsert a real User so reviews/collections
  // can attach to a persistent id. Never enable in production.
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: {}, name: {} },
      async authorize(creds) {
        const email = ((creds?.email as string) || "dev@cadence.local").toLowerCase().trim();
        const name = (creds?.name as string)?.trim() || "Dev User";
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials (dev login) requires JWT sessions; Google users are still
  // persisted to the DB via the adapter on sign-in.
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) token.uid = user.id;
      // Reflect a display-name change (Settings page) without re-login.
      if (trigger === "update" && typeof session?.user?.name === "string") {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") {
        session.user.id = token.uid;
      }
      return session;
    },
  },
});
