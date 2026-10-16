import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      organizationId: string;
    };
  }

  interface User {
    organizationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
  }
}
