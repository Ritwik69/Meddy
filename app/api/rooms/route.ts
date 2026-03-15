import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/rooms  (marketplace browse) ─────────────────────────────────────
// Query params: city?, day? (Mon | Tue | Wed | Thu | Fri | Sat | Sun)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const city = searchParams.get("city")?.trim() || undefined;
  const day = searchParams.get("day")?.trim() || undefined;

  const rooms = await prisma.room.findMany({
    where: {
      isActive: true,
      ...(city
        ? { clinic: { city: { contains: city, mode: "insensitive" } } }
        : {}),
    },
    include: {
      clinic: {
        select: { id: true, name: true, city: true, state: true, address: true, phone: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter by day of week client-hint (server-side for clean API)
  const filtered = day
    ? rooms.filter((r) => r.availableDays.includes(day))
    : rooms;

  // Serialize Decimal → number
  const serialized = filtered.map((r) => ({
    ...r,
    pricePerHour: Number(r.pricePerHour),
  }));

  return NextResponse.json(serialized);
}
