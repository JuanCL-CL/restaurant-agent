import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await upsertUser(user.email, user.name || undefined, user.image || undefined);
      }
      return true;
    },
    async session({ session }) {
      // session.user.email is already set by default
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
