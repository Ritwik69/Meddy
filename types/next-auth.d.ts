import { DefaultSession } from "next-auth";
import { Role } from "@/app/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    phone?: string | null;
  }
}
