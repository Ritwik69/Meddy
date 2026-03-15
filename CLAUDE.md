# Meddy – Healthcare Platform (India)

## Project Overview
Meddy connects patients, doctors, clinics, and diagnostic centers in India. It supports appointment booking, health records, prescriptions, and multi-role dashboards.

## Stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v4 + @auth/prisma-adapter
- **Validation**: Zod v4
- **Forms**: React Hook Form
- **Data fetching**: TanStack React Query v5 + Axios
- **Runtime**: Node.js

## Key Rules
- Use App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- All API routes live under `app/api/` as Route Handlers
- Never use `pages/` directory
- Server Components by default; add `"use client"` only when needed (interactivity, hooks, browser APIs)
- Always validate inputs with Zod schemas defined in `schemas/`
- Use React Hook Form + Zod resolver for all forms
- Wrap all data-fetching in React Query hooks defined in `hooks/`
- Keep Prisma queries in `lib/db/` or server actions, never in client components
- Use `lib/prisma.ts` singleton for the Prisma client
- Auth config lives in `lib/auth.ts`; use `getServerSession` in server components/route handlers
- Keep types in `types/`; prefer deriving types from Prisma models and Zod schemas
- India-specific: phone numbers are 10 digits (no country code stored), support INR currency, use IST timezone
- Use `Decimal` for monetary values (consultationFee, etc.)
- Environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Roles
- `PATIENT` – books appointments, views health records and prescriptions
- `DOCTOR` – manages schedule, writes prescriptions and health records
- `CLINIC_ADMIN` – manages clinic profile and associated doctors
- `ADMIN` – platform superadmin

## Folder Structure
```
meddy/
├── app/
│   ├── (auth)/                  # Login, register, onboarding pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/             # Role-protected dashboards
│   │   ├── patient/
│   │   ├── doctor/
│   │   └── admin/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   ├── appointments/
│   │   ├── doctors/
│   │   ├── patients/
│   │   └── health-records/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                      # Reusable base components (Button, Input, Modal…)
│   ├── forms/                   # Form components
│   └── dashboard/               # Dashboard-specific components
├── hooks/                       # React Query hooks (useAppointments, useDoctors…)
├── lib/
│   ├── prisma.ts                # Prisma client singleton
│   ├── auth.ts                  # NextAuth config
│   ├── db/                      # Database query helpers
│   └── utils.ts                 # General utilities
├── schemas/                     # Zod validation schemas
├── types/                       # TypeScript type definitions
├── prisma/
│   └── schema.prisma
├── public/
├── CLAUDE.md
├── .env                         # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
└── package.json
```

## Common Commands
```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint
npx prisma migrate dev --name <name>   # Create and apply migration
npx prisma studio                      # Open Prisma Studio
npx prisma generate                    # Regenerate Prisma client
npx prisma db push                     # Push schema without migration (dev only)
```

## Database Notes
- All IDs use `cuid()`
- Soft deletes not implemented; use `isActive`/`isVerified` flags where needed
- `DoctorClinic` is the join table between Doctor and Clinic
- `medications` in Prescription is stored as JSON: `{ name, dosage, frequency, duration, instructions }[]`
- `schedule` in DoctorClinic is JSON: working hours per day of week
