// src/modules/events/tasks/ui/TaskForm.tsx
// Add or edit a task (B6-F01, B6-F02; D-094). The server action re-validates everything; this form
// only shows its answer. Edit carries the version the page loaded (D-032) as a hidden field. After
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
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from "../domain/task";
import type { TaskFormState } from "../form-state";

type Props = {
  eventId: string;
  cancelHref: string;
  /** Omit to add a task. */
  task?: {
    id: string;
    reference: string;
    title: string;
    description: string | null;
    version: string;
  };
};

const IDLE: TaskFormState = { status: "idle" };

export function TaskForm({ eventId, cancelHref, task }: Props) {
  const action = task
    ? updateTaskAction.bind(null, eventId, task.id)
    : createTaskAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, IDLE);

  const values =
    state.status === "error"
      ? state.values
      : { title: task?.title ?? "", description: task?.description ?? "" };
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const summary: FormErrorItem[] = [
    { fieldId: "task-title", message: fieldErrors.title },
    { fieldId: "task-description", message: fieldErrors.description },
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