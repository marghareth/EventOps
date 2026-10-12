// src/app/api/import/route.ts
// Placeholder (B0-10, D-019). Replaced by this route's feature task. Even as a placeholder it
// answers 401 to signed-out callers, so no route ever responds to anonymous requests.
import { placeholderRouteResponse } from "@/lib/api-placeholder";

export async function POST() {
  return placeholderRouteResponse();
}