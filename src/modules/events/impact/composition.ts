// src/modules/events/impact/composition.ts
// Wires the impact use cases to PostgreSQL and to the other contexts' reads. The only place that
// knows which implementations are used.
import "server-only";
import { getDb } from "@/lib/db";
import type { EventStateReader, ImpactRepository } from "./application/ports";
import { eventStateReader } from "./infrastructure/event-state-reader";
import { prismaImpactRepository } from "./infrastructure/prisma-impact-repository";

export const impactRepository = (): ImpactRepository => prismaImpactRepository(getDb());
export const impactStateReader = (): EventStateReader => eventStateReader;