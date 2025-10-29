// /app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { getUserByEmail } from "@/app/lib/sheets"; // keep your path

// Local helper types (no global augmentation)
type TokenWithClaims = JWT & {
  department?: string | null;
  role?: string | null;
};
type SessionUserWithClaims = NonNullable<DefaultSession["user"]> & {
  department?: string | null;
  role?: string | null;
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/unauthorized",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // Use user.email (typed) instead of profile to avoid extra casts
    async signIn({ user }) {
      const email = user?.email;
      if (!email) return false;
      const sheetUser = await getUserByEmail(email);
      return !!sheetUser;
    },

    async jwt({ token }) {
      const email = token.email;
      if (email) {
        const sheetUser = await getUserByEmail(email);
        const t = token as TokenWithClaims;
        t.department = sheetUser?.department ?? null;
        t.role = sheetUser?.role ?? null;
        return t;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const t = token as TokenWithClaims;
        const u = session.user as SessionUserWithClaims;
        u.department = t.department ?? null;
        u.role = t.role ?? null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
