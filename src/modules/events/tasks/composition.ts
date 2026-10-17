// src/modules/events/tasks/composition.ts
// Wires the task use cases to PostgreSQL. The only place that knows which repository is used.
import "server-only";
import { db } from "@/lib/db";
import type { TaskRepository } from "./application/ports";
import { prismaTaskRepository } from "./infrastructure/prisma-task-repository";

export const taskRepository = (): TaskRepository => prismaTaskRepository(db);