import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@bmn/database";
import { hit } from "./rate-limit";

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        if (!hit(`login:${email}`, 10, 15 * 60_000).ok) return null;
        const user = await db.user.findUnique({ where: { email } });
        // Compare against a dummy hash when the user is missing to keep timing uniform.
        const hash =
          user?.passwordHash ?? "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.0e1n1n9nqBq9y1bYQ3v4mB5Y5G2u";
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
});
