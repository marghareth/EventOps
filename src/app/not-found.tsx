// src/app/not-found.tsx
import { NotFoundState } from "@/components/shared/NotFoundState";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl bg-white shadow-sm">
        <NotFoundState />
      </div>
    </main>
  );
}