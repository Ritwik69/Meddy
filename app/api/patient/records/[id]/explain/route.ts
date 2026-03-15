import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import path from "path";

// ── POST /api/patient/records/[id]/explain ────────────────────────────────────

export async function POST(
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
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  if (!record || record.patientId !== patient.id) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const category = (record.symptoms as string[])[0] ?? "medical report";
  const fileUrl = (record.attachments as string[])[0];
  const title = record.diagnosis ?? "Health Record";
  const date = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(record.recordedAt);
  const doctorName = record.doctor?.user.name;

  // ── Build content ─────────────────────────────────────────────────────────

  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png";
          data: string;
        };
      }
    | {
        type: "document";
        source: { type: "base64"; media_type: "application/pdf"; data: string };
        title: string;
      };

  const contentBlocks: ContentBlock[] = [];
  let hasFile = false;

  if (fileUrl) {
    const filename = path.basename(fileUrl);
    const ext = filename.split(".").pop()?.toLowerCase();
    const filePath = path.join(process.cwd(), "public", "uploads", filename);

    try {
      const fileBytes = await readFile(filePath);
      const base64 = fileBytes.toString("base64");

      if (ext === "pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
          title,
        });
        hasFile = true;
      } else if (ext === "jpg" || ext === "jpeg") {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: base64 },
        });
        hasFile = true;
      } else if (ext === "png") {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64 },
        });
        hasFile = true;
      }
    } catch {
      // File not on disk — fall back to metadata-only explanation
    }
  }

  const prompt = `You are a compassionate medical report explainer helping Indian patients understand their health records. Respond ONLY with a valid JSON object — no markdown, no extra text.

Record details:
- Title: ${title}
- Category: ${category}
- Date: ${date}
${doctorName ? `- Ordered by: Dr. ${doctorName}` : "- Uploaded by patient"}

${hasFile ? "Analyse the attached medical document and" : "Based on the record details above,"} provide a patient-friendly explanation.

Return this exact JSON shape:
{
  "summary": "2-3 sentence plain-English overview of what this report is and what it shows overall.",
  "whatThisMeans": "3-5 bullet points (as a single string, each point on a new line starting with '• ') explaining what the findings mean, what values are normal vs concerning, and what the patient should know.",
  "watchOutFor": "3-4 bullet points (as a single string, each point on a new line starting with '• ') covering warning signs to watch for, when to see a doctor urgently, and helpful lifestyle tips."
}

Use simple language suitable for a non-medical audience. Be empathetic and reassuring where appropriate. Do not diagnose.`;

  contentBlocks.push({ type: "text", text: prompt });

  // ── Call Claude ───────────────────────────────────────────────────────────

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const rawText =
    response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
      ?.text ?? "{}";

  // Strip any accidental markdown fences before parsing
  const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      summary: string;
      whatThisMeans: string;
      watchOutFor: string;
    };
    return NextResponse.json(parsed);
  } catch {
    // If Claude didn't return valid JSON, wrap the raw text gracefully
    return NextResponse.json({
      summary: cleaned,
      whatThisMeans: "",
      watchOutFor: "",
    });
  }
}
