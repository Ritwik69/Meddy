import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ── GET /api/patient/records ───────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PATIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const records = await prisma.healthRecord.findMany({
    where: { patientId: patient.id },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { recordedAt: "desc" },
  });

  return NextResponse.json(records);
}

// ── POST /api/patient/records ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PATIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const category = formData.get("category") as string | null;
  const recordedAt = formData.get("recordedAt") as string | null;

  if (!file || !title || !category || !recordedAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, JPG, and PNG files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be under 10 MB" },
      { status: 400 }
    );
  }

  // Save file to /public/uploads/
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  const filename = `${Date.now()}-${baseName}.${ext}`;

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));

  const fileUrl = `/uploads/${filename}`;

  const record = await prisma.healthRecord.create({
    data: {
      patientId: patient.id,
      doctorId: null,
      diagnosis: title,
      symptoms: [category],
      attachments: [fileUrl],
      recordedAt: new Date(recordedAt),
    },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
