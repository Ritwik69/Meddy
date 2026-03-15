import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/clinic/rooms  (list this clinic's rooms) ─────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { adminUserId: session.user.id },
    select: { id: true },
  });
  if (!clinic) {
    return NextResponse.json({ error: "No clinic found for this admin" }, { status: 404 });
  }

  const rooms = await prisma.room.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rooms);
}

// ── POST /api/clinic/rooms  (create a room) ───────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { adminUserId: session.user.id },
    select: { id: true },
  });
  if (!clinic) {
    return NextResponse.json({ error: "No clinic found for this admin" }, { status: 404 });
  }

  const body = await req.json() as {
    name: string;
    description?: string;
    equipment: string[];
    pricePerHour: number;
    availableDays: string[];
    startTime: string;
    endTime: string;
  };

  const { name, description, equipment, pricePerHour, availableDays, startTime, endTime } = body;

  if (!name?.trim() || !availableDays?.length || !startTime || !endTime || !pricePerHour) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      clinicId: clinic.id,
      name: name.trim(),
      description: description?.trim() || null,
      equipment: equipment ?? [],
      pricePerHour,
      availableDays,
      startTime,
      endTime,
    },
  });

  return NextResponse.json(room, { status: 201 });
}
