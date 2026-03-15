import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";
import RoomBookingClient from "@/components/dashboard/doctor/RoomBookingClient";

export default async function BookRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  const room = await prisma.room.findUnique({
    where: { id: roomId, isActive: true },
    include: {
      clinic: {
        select: { name: true, city: true, state: true, address: true, phone: true },
      },
    },
  });

  if (!room) redirect("/doctor/marketplace");

  const serialized = {
    id: room.id,
    name: room.name,
    description: room.description,
    equipment: room.equipment as string[],
    pricePerHour: Number(room.pricePerHour),
    availableDays: room.availableDays as string[],
    startTime: room.startTime,
    endTime: room.endTime,
    clinic: room.clinic,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/marketplace"
              className="text-xl font-bold text-blue-600"
            >
              meddy
            </Link>
            <span className="text-slate-300 select-none">|</span>
            <Link
              href="/doctor/marketplace"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Marketplace
            </Link>
            <span className="text-slate-300 select-none">/</span>
            <span className="text-sm font-medium text-slate-700">Book Room</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Room summary card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{room.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {room.clinic.name} · {room.clinic.city}, {room.clinic.state}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-slate-900">
                ₹{Number(room.pricePerHour).toLocaleString("en-IN")}
                <span className="text-sm font-normal text-slate-400">/hr</span>
              </p>
            </div>
          </div>

          {room.description && (
            <p className="text-sm text-slate-600">{room.description}</p>
          )}

          {(room.equipment as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(room.equipment as string[]).map((e) => (
                <span
                  key={e}
                  className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium"
                >
                  {e}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-0.5">Available days</p>
              <p className="text-sm font-medium text-slate-700">
                {(room.availableDays as string[]).join(", ")}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-0.5">Hours</p>
              <p className="text-sm font-medium text-slate-700">
                {room.startTime} – {room.endTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {room.clinic.address}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {room.clinic.phone}
          </div>
        </div>

        {/* Booking form */}
        <RoomBookingClient room={serialized} />
      </main>
    </div>
  );
}
