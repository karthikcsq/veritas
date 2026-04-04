import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import {
  extractNullifierFromIdKitPayload,
  verifyIdKitPayload,
} from "./worldid";

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

        const researcher = await prisma.researcher.findUnique({
          where: { email: credentials.email },
        });
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
          const expectedAction = "researcher_login";
          const payloadAction =
            typeof idkitResponse === "object" &&
            idkitResponse !== null &&
            "action" in idkitResponse &&
            typeof (idkitResponse as { action?: unknown }).action === "string"
              ? (idkitResponse as { action: string }).action
              : null;

          if (payloadAction !== expectedAction) return null;

          const verifyResponse = await verifyIdKitPayload(idkitResponse);
          if (!verifyResponse.ok) return null;

          const nullifier = extractNullifierFromIdKitPayload(idkitResponse);
          if (!nullifier) return null;

          const worldIdIdentity = nullifier.toLowerCase();
          const researcherEmail = `worldid+${worldIdIdentity.slice(2)}@veritas.local`;
          const existingResearcher = await prisma.researcher.findUnique({
            where: { email: researcherEmail },
          });

          let researcher = existingResearcher;
          if (!researcher) {
            const randomPasswordHash = await bcrypt.hash(randomUUID(), 12);
            researcher = await prisma.researcher.create({
              data: {
                email: researcherEmail,
                name: WORLD_ID_DEFAULT_NAME,
                passwordHash: randomPasswordHash,
              },
            });
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
        const currentResearcher = await prisma.researcher.findUnique({
          where: { id: token.id },
          select: { name: true },
        });
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
