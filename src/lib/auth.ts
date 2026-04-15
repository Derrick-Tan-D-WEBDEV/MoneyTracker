import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { generateSalt, deriveKey, encryptExistingData, storeEncryptionKey } from "@/lib/encryption";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: { id: true, email: true, name: true, image: true, password: true, encryptionSalt: true, isDataEncrypted: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isPasswordValid) {
          return null;
        }

        // Derive encryption key from password
        let salt = user.encryptionSalt;
        if (!salt) {
          // First login after encryption feature: generate salt
          salt = generateSalt();
          await db.user.update({
            where: { id: user.id },
            data: { encryptionSalt: salt },
          });
        }

        const encryptionKey = deriveKey(credentials.password as string, salt);

        // Store encrypted key in DB for partner view (couple feature)
        storeEncryptionKey(user.id, encryptionKey).catch(() => {});

        // Lazy-encrypt existing plaintext data on first login
        if (!user.isDataEncrypted) {
          try {
            await encryptExistingData(user.id, encryptionKey);
          } catch {
            // Non-blocking: data stays plaintext until next login
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          encryptionKey,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Store encryption key in JWT (server-side only, not exposed to client)
        if ("encryptionKey" in user) {
          token.encryptionKey = (user as Record<string, unknown>).encryptionKey;
        }
      }
      // On sign-in, unlock the "Welcome Aboard" achievement
      if (token.id && trigger === "signIn") {
        const { tryUnlockDirect } = await import("@/actions/gamification");
        await tryUnlockDirect(token.id as string, "FIRST_LOGIN");
      }
      // Always refresh user data from DB to keep XP, level, streak in sync
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { currency: true, xp: true, level: true, streak: true },
        });
        if (dbUser) {
          token.currency = dbUser.currency;
          token.xp = dbUser.xp;
          token.level = dbUser.level;
          token.streak = dbUser.streak;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.currency = (token.currency as string) || "MYR";
        session.user.xp = (token.xp as number) || 0;
        session.user.level = (token.level as number) || 1;
        session.user.streak = (token.streak as number) || 0;
      }
      return session;
    },
  },
});
