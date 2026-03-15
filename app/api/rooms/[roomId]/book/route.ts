import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── POST /api/rooms/[roomId]/book ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId, isActive: true },
    select: { id: true, startTime: true, endTime: true, availableDays: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await req.json() as {
    date: string;      // "YYYY-MM-DD"
    startTime: string; // "09:00"
    endTime: string;   // "10:00"
  };

  const { date, startTime, endTime } = body;

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the day of week is in the room's availableDays
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const bookingDate = new Date(date);
  const dayName = DOW[bookingDate.getUTCDay()];
  if (!room.availableDays.includes(dayName)) {
    return NextResponse.json(
      { error: `Room is not available on ${dayName}` },
      { status: 400 }
    );
  }

  // Check for conflicts on this room for the same date/time
  const conflict = await prisma.roomBooking.findFirst({
    where: {
      roomId,
      date: new Date(date),
      status: "CONFIRMED",
      OR: [
        // New slot overlaps with an existing slot
        { startTime: { lt: endTime }, endTime: { gt: startTime } },
      ],
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "This time slot is already booked" },
      { status: 409 }
    );
  }

  const booking = await prisma.roomBooking.create({
    data: {
      roomId,
      doctorId: doctor.id,
      date: new Date(date),
      startTime,
      endTime,
      status: "CONFIRMED",
    },
    include: {
      room: {
        include: {
          clinic: { select: { name: true, address: true, city: true, phone: true } },
        },
      },
    },
  });

  return NextResponse.json(booking, { status: 201 });
}
