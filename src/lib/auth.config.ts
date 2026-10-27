import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = (user as { organizationId?: string }).organizationId;
        token.role = (user as { role?: string }).role ?? "client";
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.organizationId = (token.organizationId as string) ?? "";
        session.user.role =
          token.role === "admin" || token.role === "staff" ? token.role : "client";
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isCabinet = request.nextUrl.pathname.startsWith("/cabinet");
      const isStaff = request.nextUrl.pathname.startsWith("/staff");
      const isLogin = request.nextUrl.pathname === "/login";

      if (isCabinet || isStaff) return isLoggedIn;
      if (isLogin && isLoggedIn) {
        return Response.redirect(new URL("/cabinet", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
