// src/modules/events/budget/composition.ts
// Wires the budget use cases to PostgreSQL. The only place that knows which repository is used.
// ASSUMPTION: src/lib/db.ts exports the PrismaClient as `db`. Change the import if it is named
// differently.
import "server-only";
import { db } from "@/lib/db";
import type { BudgetRepository } from "./application/ports";
import { prismaBudgetRepository } from "./infrastructure/prisma-budget-repository";

export const budgetRepository = (): BudgetRepository => prismaBudgetRepository(db);