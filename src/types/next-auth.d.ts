import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      organizationId: string;
      role: "client" | "admin";
    };
  }

  interface User {
    organizationId?: string;
    role?: "client" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
    role?: string;
  }
}
