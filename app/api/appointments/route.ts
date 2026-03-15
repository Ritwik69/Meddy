import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── GET: booked appointment times for a doctor on a given IST date ───────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId") ?? "";
  const date = searchParams.get("date") ?? ""; // "YYYY-MM-DD" in IST

  if (!doctorId || !date) {
    return NextResponse.json({ appointments: [] });
  }

  // Build IST-based day boundaries
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(`${date}T23:59:59+05:30`);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED"] },
    },
    select: { scheduledAt: true },
  });

  return NextResponse.json({ appointments });
}

// ─── POST: create appointment ─────────────────────────────────────────────────

const createSchema = z.object({
  doctorId: z.string().min(1),
  clinicId: z.string().min(1).optional(),
  scheduledAt: z.string().min(1), // ISO 8601 with offset, e.g. "2026-03-16T09:00:00+05:30"
  type: z.enum(["IN_PERSON", "ONLINE"]),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { doctorId, clinicId, scheduledAt, type, reason } = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  });
  if (!patient) {
    return NextResponse.json(
      { error: "Patient profile not found" },
      { status: 404 }
    );
  }

  const scheduledDate = new Date(scheduledAt);

  // Conflict check: same doctor, same time, not cancelled
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      scheduledAt: scheduledDate,
      status: { notIn: ["CANCELLED"] },
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "This slot has just been booked. Please pick another time." },
      { status: 409 }
    );
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId,
      clinicId: clinicId ?? null,
      scheduledAt: scheduledDate,
      type,
      reason: reason ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
