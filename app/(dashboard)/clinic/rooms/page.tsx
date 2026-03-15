import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";

function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

export default async function ClinicRoomsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const justCreated = sp.created === "1";

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC_ADMIN") redirect("/login");

  const clinic = await prisma.clinic.findUnique({
    where: { adminUserId: session.user.id },
    select: { id: true, name: true, city: true },
  });

  const rooms = clinic
    ? await prisma.room.findMany({
        where: { clinicId: clinic.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-600">meddy</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium text-slate-700">Rooms</span>
          </div>
          <div className="flex items-center gap-3">
            {clinic && (
              <span className="hidden sm:block text-sm text-slate-500">
                {clinic.name} · {clinic.city}
              </span>
            )}
            <Link
              href="/clinic/rooms/new"
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Room
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Success banner */}
        {justCreated && (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 border border-green-100 rounded-2xl text-green-800 text-sm">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Room listed successfully! It&apos;s now visible in the marketplace.</p>
          </div>
        )}

        {/* No clinic linked */}
        {!clinic && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No clinic linked</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Your account isn&apos;t linked to a clinic yet. Contact the platform admin to set this up.
            </p>
          </div>
        )}

        {/* Header */}
        {clinic && (
          <>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Your Rooms</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {rooms.length} room{rooms.length !== 1 ? "s" : ""} listed on the marketplace
              </p>
            </div>

            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">No rooms listed yet</h3>
                <p className="text-sm text-slate-400 mt-1 mb-6">List your first consultation room for doctors to rent</p>
                <Link
                  href="/clinic/rooms/new"
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  List a Room
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800 leading-snug">{room.name}</h3>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${room.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {room.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {room.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{room.description}</p>
                    )}

                    {(room.equipment as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(room.equipment as string[]).slice(0, 4).map((e) => (
                          <span key={e} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                            {e}
                          </span>
                        ))}
                        {(room.equipment as string[]).length > 4 && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                            +{(room.equipment as string[]).length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          {inr(Number(room.pricePerHour))}
                          <span className="text-xs font-normal text-slate-400">/hr</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {(room.availableDays as string[]).join(", ")} · {room.startTime}–{room.endTime}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
