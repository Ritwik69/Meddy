import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/patients/search?q=name_or_phone
// DOCTOR only — used for patient search in prescription form
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const patients = await prisma.patient.findMany({
    where: {
      user: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    select: {
      id: true,
      user: { select: { name: true, phone: true, email: true } },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(patients);
}
