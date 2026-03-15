import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Required in Next.js 15+ — auth endpoints read cookies/headers at request
// time and must never be statically cached.
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
