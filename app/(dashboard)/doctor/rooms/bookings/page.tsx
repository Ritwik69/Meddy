import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

export default async function DoctorRoomBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const justBooked = sp.booked === "1";

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) redirect("/login");

  const bookings = await prisma.roomBooking.findMany({
    where: { doctorId: doctor.id },
    include: {
      room: {
        include: {
          clinic: { select: { name: true, city: true, address: true, phone: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/doctor/dashboard" className="text-xl font-bold text-blue-600">
              meddy
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium text-slate-700">My Room Bookings</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/marketplace"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Browse Rooms
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {justBooked && (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 border border-green-100 rounded-2xl text-green-800 text-sm">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Room booked successfully! See your booking below.</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Room Bookings</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/doctor/marketplace"
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Book Another
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No bookings yet</h3>
            <p className="text-sm text-slate-400 mt-1 mb-6">Browse the marketplace to book a consultation room</p>
            <Link
              href="/doctor/marketplace"
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Rooms
            </Link>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800">{b.room.name}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        b.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {b.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate mt-0.5">
                    {b.room.clinic.name} · {b.room.clinic.city}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(b.date)} · {b.startTime}–{b.endTime}
                  </p>
                </div>

                {/* Price */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="font-bold text-slate-800">
                    {inr(Number(b.room.pricePerHour))}
                  </p>
                  <p className="text-xs text-slate-400">per hour</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
