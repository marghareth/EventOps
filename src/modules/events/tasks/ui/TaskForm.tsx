// src/modules/events/tasks/ui/TaskForm.tsx
// Add or edit a task (B6-F01 to B6-F07; D-094 to D-096). The server action re-validates
// everything (including that the assignee is a member of this event); this form only shows its
// answer. Edit carries the version the page loaded (D-032) as a hidden field. After
// a failed save every problem is listed at once in a summary that takes focus, and each line jumps
// to its field. Controls are 44 px tall and the buttons fill the width on a phone.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTaskAction, updateTaskAction } from "../actions";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_TITLE_MAX,
} from "../domain/task";
import { TASK_DUE_DATE_RANGE } from "../domain/due-date";
import type { TaskFormState } from "../form-state";

type Props = {
  eventId: string;
  cancelHref: string;
  /** The members of this event the task can be assigned to, labelled for display (D-095). */
  assignees: { id: string; label: string }[];
  /** Omit to add a task. */
  task?: {
    id: string;
    reference: string;
    title: string;
    description: string | null;
    priority: (typeof TASK_PRIORITIES)[number];
    status: (typeof TASK_STATUSES)[number];
    /** "YYYY-MM-DD", or null for no due date. */
    dueDate: string | null;
    /** The member ID the task is assigned to, or null. */
    assigneeId: string | null;
    version: string;
  };
};

const IDLE: TaskFormState = { status: "idle" };

export function TaskForm({ eventId, cancelHref, assignees, task }: Props) {
  const action = task
    ? updateTaskAction.bind(null, eventId, task.id)
    : createTaskAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, IDLE);

  const values =
    state.status === "error"
      ? state.values
      : {
          title: task?.title ?? "",
          description: task?.description ?? "",
          priority: task?.priority ?? DEFAULT_TASK_PRIORITY,
          status: task?.status ?? DEFAULT_TASK_STATUS,
          dueDate: task?.dueDate ?? "",
          assigneeId: task?.assigneeId ?? "",
        };
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const summary: FormErrorItem[] = [
    { fieldId: "task-title", message: fieldErrors.title },
    { fieldId: "task-description", message: fieldErrors.description },
    { fieldId: "task-status", message: fieldErrors.status },
    { fieldId: "task-due-date", message: fieldErrors.dueDate },
    { fieldId: "task-priority", message: fieldErrors.priority },
    { fieldId: "task-assignee", message: fieldErrors.assigneeId },
  ].filter((entry): entry is FormErrorItem => Boolean(entry.message));
  // Re-mount the fields after each server answer so defaultValue shows what the user typed.
  const formKey = JSON.stringify(values);

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      aria-busy={pending}
      className="flex w-full max-w-xl flex-col gap-5"
    >
      <FormErrorSummary errors={summary} />
      {state.status === "error" && state.message ? (
        <Banner severity="critical" title="Couldn't save the task">
          {state.message}
        </Banner>
      ) : null}
      {state.status === "success" ? <Banner severity="info" title={state.message} /> : null}
      {task ? <input type="hidden" name="version" value={task.version} /> : null}

      {task ? (
        <p className="text-sm text-ink-2">
          Task <span className="font-mono">{task.reference}</span>
        </p>
      ) : null}

      <FormField id="task-title" label="Title" required error={fieldErrors.title}>
        {(control) => (
          <Input
            {...control}
            name="title"
            defaultValue={values.title}
            maxLength={TASK_TITLE_MAX}
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="task-description"
        label="Description (optional)"
        hint="What needs to be done, and anything the person doing it should know."
        error={fieldErrors.description}
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            defaultValue={values.description}
            rows={5}
            maxLength={TASK_DESCRIPTION_MAX}
            className={`${fieldControlClass} py-2`}
          />
        )}
      </FormField>

      <FormField id="task-status" label="Status" required error={fieldErrors.status}>
        {(control) => (
          <select
            {...control}
            name="status"
            defaultValue={values.status}
            className={fieldControlClass}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="task-due-date"
        label="Due date (optional)"
        hint="Philippine date. Leave it empty if the task has no deadline."
        error={fieldErrors.dueDate}
      >
        {(control) => (
          <input
            {...control}
            name="dueDate"
            type="date"
            min={TASK_DUE_DATE_RANGE.min}
            max={TASK_DUE_DATE_RANGE.max}
            defaultValue={values.dueDate}
            className={`${fieldControlClass} sm:max-w-60`}
          />
        )}
      </FormField>

      <FormField
        id="task-priority"
        label="Priority"
        required
        hint="High priority tasks are the ones to do first."
        error={fieldErrors.priority}
      >
        {(control) => (
          <select
            {...control}
            name="priority"
            defaultValue={values.priority}
            className={fieldControlClass}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="task-assignee"
        label="Assigned to (optional)"
        hint="Choose who is responsible. Leave it as Unassigned if nobody is yet."
        error={fieldErrors.assigneeId}
      >
        {(control) => (
          <select
            {...control}
            name="assigneeId"
            defaultValue={values.assigneeId}
            className={fieldControlClass}
          >
            <option value="">Unassigned</option>
            {assignees.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : task ? "Save task" : "Add task"}
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}