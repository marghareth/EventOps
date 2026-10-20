// src/modules/events/tasks/task-list-query.test.ts
// Filtering the task list (B6-F09; D-097): what the address may say, how filters combine, and the
// wording of "No tasks match". Pure functions, no database.
import { describe, expect, it } from "vitest";
import {
  assigneeFilterOptions,
  describeTaskListQuery,
  filterTasks,
  isNarrowed,
  parseTaskListQuery,
  type FilterableTask,
  type TaskListQuery,
} from "./task-list-query";

const ANA = "b0000000-0000-4000-8000-00000000000a";
const BEN = "b0000000-0000-4000-8000-00000000000b";
const ana = { id: ANA, name: "Ana Reyes" };
const ben = { id: BEN, name: "Ben Cruz" };

const task = (over: Partial<FilterableTask> & { id: string }) => ({
  status: "NOT_STARTED" as const,
  priority: "MEDIUM" as const,
  dueDate: null,
  assignee: null,
  ...over,
});
const tasks = [
  task({ id: "1", status: "DONE", priority: "HIGH", dueDate: "2026-11-01", assignee: ana }),
  task({ id: "2", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-15", assignee: ben }),
  task({ id: "3", status: "NOT_STARTED", priority: "LOW", dueDate: "2026-11-30" }),
  task({ id: "4", status: "NOT_STARTED", priority: "MEDIUM", dueDate: null, assignee: ana }),
];
const ids = (list: { id: string }[]) => list.map((t) => t.id);
const members = new Set([ANA, BEN]);
const none: TaskListQuery = parseTaskListQuery({});

describe("parseTaskListQuery", () => {
  it("is no filter for an empty address", () => {
    expect(none).toEqual({
      status: null,
      priority: null,
      assignee: null,
      due: null,
      dueFrom: null,
      dueTo: null,
      overdue: null,
    });
    expect(isNarrowed(none)).toBe(false);
  });

  it("reads every filter from the address", () => {
    const query = parseTaskListQuery(
      {
        status: "in-progress",
        priority: "high",
        assignee: ANA,
        due: "set",
        dueFrom: "2026-11-01",
        dueTo: "2026-11-30",
        overdue: "only",
      },
      members,
    );
    expect(query).toEqual({
      status: "IN_PROGRESS",
      priority: "HIGH",
      assignee: ANA,
      due: "set",
      dueFrom: "2026-11-01",
      dueTo: "2026-11-30",
      overdue: "only",
    });
    expect(isNarrowed(query)).toBe(true);
  });

  it.each(["", "DONE", "blocked", "in_progress", "done "])(
    "ignores the status %j unless it is exact",
    (value) => {
      const query = parseTaskListQuery({ status: value });
      expect(query.status).toBe(value === "done " ? "DONE" : null);
    },
  );

  it("ignores unknown priorities, due choices and an array's later values", () => {
    expect(parseTaskListQuery({ priority: "urgent" }).priority).toBeNull();
    expect(parseTaskListQuery({ due: "late" }).due).toBeNull();
    expect(parseTaskListQuery({ status: ["done", "not-started"] }).status).toBe("DONE");
  });

  it("accepts Unassigned and a member who has a task, and ignores anyone else", () => {
    expect(parseTaskListQuery({ assignee: "unassigned" }).assignee).toBe("unassigned");
    expect(parseTaskListQuery({ assignee: ANA }, members).assignee).toBe(ANA);
    expect(parseTaskListQuery({ assignee: ANA }).assignee).toBeNull();
    const stranger = "b0000000-0000-4000-8000-0000000000ff";
    expect(parseTaskListQuery({ assignee: stranger }, members).assignee).toBeNull();
    expect(parseTaskListQuery({ assignee: "' OR 1=1 --" }, members).assignee).toBeNull();
  });

  it.each(["2026-02-30", "2026-13-01", "15/11/2026", "tomorrow", "1999-12-31", "2101-01-01"])(
    "ignores the date %j",
    (value) => {
      const query = parseTaskListQuery({ dueFrom: value, dueTo: value });
      expect(query.dueFrom).toBeNull();
      expect(query.dueTo).toBeNull();
    },
  );

  it("accepts the range's first and last day and a leap day", () => {
    expect(parseTaskListQuery({ dueFrom: "2000-01-01" }).dueFrom).toBe("2000-01-01");
    expect(parseTaskListQuery({ dueTo: "2100-12-31" }).dueTo).toBe("2100-12-31");
    expect(parseTaskListQuery({ dueTo: "2028-02-29" }).dueTo).toBe("2028-02-29");
  });
});

describe("filterTasks", () => {
  const run = (params: Record<string, string>) =>
    ids(filterTasks(tasks, parseTaskListQuery(params, members)));

  it("returns every task, in order, when nothing is on", () => {
    expect(run({})).toEqual(["1", "2", "3", "4"]);
    expect(filterTasks(tasks, none)).not.toBe(tasks);
  });

  it("filters by status", () => {
    expect(run({ status: "done" })).toEqual(["1"]);
    expect(run({ status: "not-started" })).toEqual(["3", "4"]);
  });

  it("filters by priority", () => {
    expect(run({ priority: "high" })).toEqual(["1", "2"]);
    expect(run({ priority: "low" })).toEqual(["3"]);
  });

  it("filters by assignee, and by Unassigned", () => {
    expect(run({ assignee: ANA })).toEqual(["1", "4"]);
    expect(run({ assignee: BEN })).toEqual(["2"]);
    expect(run({ assignee: "unassigned" })).toEqual(["3"]);
  });

  it("filters by whether there is a due date", () => {
    expect(run({ due: "set" })).toEqual(["1", "2", "3"]);
    expect(run({ due: "none" })).toEqual(["4"]);
  });

  it("filters by a due date range, inclusive at both ends, never matching a task with no date", () => {
    expect(run({ dueFrom: "2026-11-15" })).toEqual(["2", "3"]);
    expect(run({ dueTo: "2026-11-15" })).toEqual(["1", "2"]);
    expect(run({ dueFrom: "2026-11-02", dueTo: "2026-11-29" })).toEqual(["2"]);
    expect(run({ dueFrom: "2026-11-01", dueTo: "2026-11-01" })).toEqual(["1"]);
    expect(run({ dueFrom: "2000-01-01" })).not.toContain("4");
  });

  it("combines every filter with AND", () => {
    expect(run({ status: "not-started", assignee: ANA })).toEqual(["4"]);
    expect(run({ priority: "high", dueFrom: "2026-11-10" })).toEqual(["2"]);
    expect(run({ status: "done", priority: "low" })).toEqual([]);
  });

  it("matches nothing for contradictory filters instead of guessing", () => {
    expect(run({ due: "none", dueFrom: "2026-11-01" })).toEqual([]);
    expect(run({ dueFrom: "2026-12-01", dueTo: "2026-11-01" })).toEqual([]);
  });

  it("never invents a task and does not change the list it is given", () => {
    const before = JSON.stringify(tasks);
    filterTasks(tasks, parseTaskListQuery({ status: "done" }));
    expect(JSON.stringify(tasks)).toBe(before);
  });
});

describe("assigneeFilterOptions", () => {
  it("lists each assigned member once, in list order, and nobody else", () => {
    expect(assigneeFilterOptions(tasks)).toEqual([
      { id: ANA, label: "Ana Reyes" },
      { id: BEN, label: "Ben Cruz" },
    ]);
    expect(assigneeFilterOptions([task({ id: "x" })])).toEqual([]);
  });

  it("tells two members with the same name apart", () => {
    const other = { id: "b0000000-0000-4000-8000-00000000000c", name: "Ana Reyes" };
    expect(
      assigneeFilterOptions([task({ id: "1", assignee: ana }), task({ id: "2", assignee: other })]),
    ).toEqual([
      { id: ANA, label: "Ana Reyes (1)" },
      { id: other.id, label: "Ana Reyes (2)" },
    ]);
  });
});

describe("describeTaskListQuery", () => {
  it("is empty with no filter", () => {
    expect(describeTaskListQuery(none)).toEqual([]);
  });

  it("words every filter that is on", () => {
    const query = parseTaskListQuery(
      {
        status: "in-progress",
        priority: "high",
        assignee: ANA,
        due: "set",
        dueFrom: "2026-11-01",
        dueTo: "2026-11-30",
      },
      members,
    );
    expect(describeTaskListQuery(query, (id) => (id === ANA ? "Ana Reyes" : undefined))).toEqual([
      "Status: In progress",
      "Priority: High",
      "Assigned to Ana Reyes",
      "Has a due date",
      "Due on or after Nov 1, 2026",
      "Due on or before Nov 30, 2026",
    ]);
  });

  it("words Unassigned and No due date", () => {
    expect(
      describeTaskListQuery(parseTaskListQuery({ assignee: "unassigned", due: "none" })),
    ).toEqual(["Unassigned", "No due date"]);
  });
});