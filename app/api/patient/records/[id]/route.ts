import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

// ── DELETE /api/patient/records/[id] ─────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PATIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const record = await prisma.healthRecord.findUnique({
    where: { id },
    select: { id: true, patientId: true, attachments: true },
  });

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  if (record.patientId !== patient.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete files from /public/uploads/
  for (const fileUrl of record.attachments) {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist on disk — safe to ignore
    }
  }

  await prisma.healthRecord.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
