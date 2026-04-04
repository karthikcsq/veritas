import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { pool, generateId } from "./db";
import { extractNullifierFromIdKitPayload } from "./worldid";

const WORLD_ID_DEFAULT_NAME = "World ID Researcher";

function getUserOnboardingStatus(user: { name: string }) {
  return user.name === WORLD_ID_DEFAULT_NAME;
}

type AuthUser = {
  id: string;
  email: string;
  name: string;
  requiresOnboarding: boolean;
};

function isTokenWithId(token: JWT): token is JWT & { id: string } {
  return typeof token.id === "string";
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const result = await pool.query(
          'SELECT "id", "email", "name", "passwordHash" FROM "Researcher" WHERE "email" = $1',
          [credentials.email]
        );
        const researcher = result.rows[0];
        if (!researcher) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          researcher.passwordHash
        );
        if (!valid) return null;

        const authUser: AuthUser = {
          id: researcher.id,
          email: researcher.email,
          name: researcher.name,
          requiresOnboarding: false,
        };
        return authUser;
      },
    }),
    CredentialsProvider({
      id: "world-id",
      name: "World ID",
      credentials: {
        idkitResponse: { label: "IDKit Response", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idkitResponse) return null;

        try {
          const idkitResponse = JSON.parse(credentials.idkitResponse);

          const nullifier = extractNullifierFromIdKitPayload(idkitResponse);
          if (!nullifier) return null;

          const worldIdIdentity = nullifier.toLowerCase();
          const researcherEmail = `worldid+${worldIdIdentity.slice(2)}@veritas.local`;

          const existingResult = await pool.query(
            'SELECT "id", "email", "name" FROM "Researcher" WHERE "email" = $1',
            [researcherEmail]
          );

          let researcher = existingResult.rows[0];
          if (!researcher) {
            const randomPasswordHash = await bcrypt.hash(randomUUID(), 12);
            const id = generateId();
            const insertResult = await pool.query(
              'INSERT INTO "Researcher" ("id", "email", "name", "passwordHash", "createdAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING "id", "email", "name"',
              [id, researcherEmail, WORLD_ID_DEFAULT_NAME, randomPasswordHash]
            );
            researcher = insertResult.rows[0];
          }

          const authUser: AuthUser = {
            id: researcher.id,
            email: researcher.email,
            name: researcher.name,
            requiresOnboarding: getUserOnboardingStatus(researcher),
          };
          return authUser;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.requiresOnboarding = (user as AuthUser).requiresOnboarding;
      }
      if (isTokenWithId(token)) {
        const result = await pool.query(
          'SELECT "name" FROM "Researcher" WHERE "id" = $1',
          [token.id]
        );
        const currentResearcher = result.rows[0];
        if (currentResearcher) {
          token.requiresOnboarding = getUserOnboardingStatus(currentResearcher);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") {
          (session.user as { id?: string }).id = token.id;
        }
        (session.user as { requiresOnboarding?: boolean }).requiresOnboarding =
          Boolean(token.requiresOnboarding);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
};
