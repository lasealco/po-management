import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => {
  const key = (resource: string, action: string) => `${resource}\0${action}`;
  return {
    requireApiGrant: vi.fn().mockResolvedValue(null),
    getActorUserId: vi.fn().mockResolvedValue("user-1"),
    loadGlobalGrantsForUser: vi.fn(),
    viewerHas: (grantSet: Set<string>, resource: string, action: string) =>
      grantSet.has(key(resource, action)),
  };
});

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    supplierOnboardingTask: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/srm/ensure-supplier-onboarding-tasks", () => ({
  ensureSupplierOnboardingTasks: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH as patchOnboardingTask } from "@/app/api/suppliers/[id]/onboarding-tasks/[taskId]/route";
import { PATCH as patchSupplier } from "@/app/api/suppliers/[id]/route";
import { POST as postApproval } from "@/app/api/suppliers/[id]/approval/route";
import { POST as postCreateSupplier } from "@/app/api/suppliers/route";
import { loadGlobalGrantsForUser } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";

const grantKey = (resource: string, action: string) =>
  `${resource}\0${action}`;

const create = vi.mocked(prisma.supplier.create);
const findFirst = vi.mocked(prisma.supplier.findFirst);
const update = vi.mocked(prisma.supplier.update);
const taskFindMany = vi.mocked(prisma.supplierOnboardingTask.findMany);
const taskFindFirst = vi.mocked(prisma.supplierOnboardingTask.findFirst);
const taskUpdate = vi.mocked(prisma.supplierOnboardingTask.update);
const loadGrants = vi.mocked(loadGlobalGrantsForUser);
const ensureTasks = vi.mocked(ensureSupplierOnboardingTasks);
const mockedGetDemoTenant = vi.mocked(getDemoTenant);

describe("SRM supplier API workflow (create → onboarding seed → approval gate)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    create.mockReset();
    findFirst.mockReset();
    update.mockReset();
    taskFindMany.mockReset();
    taskFindFirst.mockReset();
    taskUpdate.mockReset();
    loadGrants.mockReset();
    ensureTasks.mockReset();
    mockedGetDemoTenant.mockResolvedValue({
      id: "tenant-1",
      name: "Demo",
      slug: "demo",
    } as never);
  });

  it("POST /api/suppliers seeds onboarding after create for non-approver", async () => {
    loadGrants.mockResolvedValue(
      new Set([grantKey("org.suppliers", "edit")]),
    );
    create.mockResolvedValue({
      id: "sup-new",
      name: "Acme Logistics",
      code: null,
      email: null,
      phone: null,
      isActive: false,
      srmCategory: "product",
      approvalStatus: "pending_approval",
    } as never);

    const res = await postCreateSupplier(
      new Request("http://localhost/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Logistics",
          internalNotes: "Intake note",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(ensureTasks).toHaveBeenCalledWith(
      prisma,
      "tenant-1",
      "sup-new",
    );
    const body = (await res.json()) as { supplier: { id: string } };
    expect(body.supplier.id).toBe("sup-new");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: "pending_approval",
          isActive: false,
          qualificationStatus: "in_progress",
          internalNotes: "Intake note",
        }),
      }),
    );
  });

  it("POST /api/suppliers activates immediately when actor can approve", async () => {
    loadGrants.mockResolvedValue(
      new Set([
        grantKey("org.suppliers", "edit"),
        grantKey("org.suppliers", "approve"),
      ]),
    );
    create.mockResolvedValue({
      id: "sup-appr",
      name: "Big Co",
      code: null,
      email: null,
      phone: null,
      isActive: true,
      srmCategory: "product",
      approvalStatus: "approved",
    } as never);

    const res = await postCreateSupplier(
      new Request("http://localhost/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Big Co" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(ensureTasks).toHaveBeenCalledWith(prisma, "tenant-1", "sup-appr");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: "approved",
          isActive: true,
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty(
      "qualificationStatus",
    );
  });

  it("POST /api/suppliers/[id]/approval returns 409 when checklist incomplete", async () => {
    findFirst.mockResolvedValue({ id: "sup-1" } as never);
    taskFindMany.mockResolvedValue([
      { status: "done" },
      { status: "pending" },
    ] as never);

    const res = await postApproval(
      new Request("http://localhost/api/suppliers/sup-1/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(409);
    const err = (await res.json()) as { error: string };
    expect(err.error).toMatch(/complete or waive/i);
    expect(update).not.toHaveBeenCalled();
    expect(ensureTasks).toHaveBeenCalledWith(prisma, "tenant-1", "sup-1");
  });

  it("POST /api/suppliers/[id]/approval returns 409 when no onboarding rows yet", async () => {
    findFirst.mockResolvedValue({ id: "sup-1" } as never);
    taskFindMany.mockResolvedValue([] as never);

    const res = await postApproval(
      new Request("http://localhost/api/suppliers/sup-1/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("POST /api/suppliers/[id]/approval updates supplier when every task is done or waived", async () => {
    findFirst.mockResolvedValue({ id: "sup-1" } as never);
    taskFindMany.mockResolvedValue([
      { status: "done" },
      { status: "waived" },
    ] as never);
    update.mockResolvedValue({
      id: "sup-1",
      name: "Acme",
      isActive: true,
      approvalStatus: "approved",
    } as never);

    const res = await postApproval(
      new Request("http://localhost/api/suppliers/sup-1/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sup-1" },
        data: expect.objectContaining({
          approvalStatus: "approved",
          isActive: true,
        }),
      }),
    );
  });

  it("POST /api/suppliers/[id]/approval reject skips onboarding gate", async () => {
    findFirst.mockResolvedValue({ id: "sup-1" } as never);
    update.mockResolvedValue({
      id: "sup-1",
      name: "Acme",
      isActive: false,
      approvalStatus: "rejected",
    } as never);

    const res = await postApproval(
      new Request("http://localhost/api/suppliers/sup-1/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reject" }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(200);
    expect(taskFindMany).not.toHaveBeenCalled();
    expect(ensureTasks).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it("PATCH onboarding task to done passes completedAt into Prisma update", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00.000Z"));
    const doneAt = new Date();
    taskFindFirst.mockResolvedValue({
      id: "task-1",
      supplierId: "sup-1",
      tenantId: "tenant-1",
      taskKey: "kyb",
      label: "KYB",
      sortOrder: 1,
      status: "pending",
      notes: null,
      completedAt: null,
    } as never);
    taskFindMany.mockResolvedValue([
      { taskKey: "kyb", status: "pending" },
    ] as never);
    taskUpdate.mockResolvedValue({
      id: "task-1",
      taskKey: "kyb",
      label: "KYB",
      sortOrder: 1,
      status: "done",
      notes: null,
      completedAt: doneAt,
    } as never);

    const res = await patchOnboardingTask(
      new Request("http://localhost/api/suppliers/sup-1/onboarding-tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "sup-1", taskId: "task-1" }) },
    );

    expect(res.status).toBe(200);
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: "done",
          completedAt: doneAt,
        }),
      }),
    );
  });

  it("PATCH activation_decision to done is blocked until approval_chain is complete", async () => {
    taskFindFirst.mockResolvedValue({
      id: "task-act",
      supplierId: "sup-1",
      tenantId: "tenant-1",
      taskKey: "activation_decision",
      label: "Activation",
      sortOrder: 99,
      status: "pending",
      notes: null,
      completedAt: null,
    } as never);
    taskFindMany.mockResolvedValue([
      { taskKey: "approval_chain", status: "pending" },
      { taskKey: "activation_decision", status: "pending" },
    ] as never);

    const res = await patchOnboardingTask(
      new Request("http://localhost/api/suppliers/sup-1/onboarding-tasks/task-act", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "sup-1", taskId: "task-act" }) },
    );

    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string };
    expect(err.error).toMatch(/approval chain/i);
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("PATCH /api/suppliers/[id] returns 409 when activating via PATCH with open onboarding", async () => {
    loadGrants.mockResolvedValue(
      new Set([
        grantKey("org.suppliers", "edit"),
        grantKey("org.suppliers", "approve"),
      ]),
    );
    findFirst
      .mockResolvedValueOnce({ id: "sup-1" } as never)
      .mockResolvedValueOnce({
        isActive: false,
        approvalStatus: "pending_approval",
      } as never);
    taskFindMany.mockResolvedValue([{ status: "pending" }] as never);

    const res = await patchSupplier(
      new Request("http://localhost/api/suppliers/sup-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: true,
          approvalStatus: "approved",
        }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(409);
    expect(ensureTasks).toHaveBeenCalledWith(prisma, "tenant-1", "sup-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("PATCH /api/suppliers/[id] activates when checklist is complete", async () => {
    loadGrants.mockResolvedValue(
      new Set([
        grantKey("org.suppliers", "edit"),
        grantKey("org.suppliers", "approve"),
      ]),
    );
    findFirst
      .mockResolvedValueOnce({ id: "sup-1" } as never)
      .mockResolvedValueOnce({
        isActive: false,
        approvalStatus: "pending_approval",
      } as never);
    taskFindMany.mockResolvedValue([{ status: "done" }, { status: "waived" }] as never);
    update.mockResolvedValue({
      id: "sup-1",
      name: "Acme",
      isActive: true,
      approvalStatus: "approved",
      offices: [],
      contacts: [],
      _count: { productSuppliers: 0, orders: 0 },
    } as never);

    const res = await patchSupplier(
      new Request("http://localhost/api/suppliers/sup-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: true,
          approvalStatus: "approved",
        }),
      }),
      { params: Promise.resolve({ id: "sup-1" }) },
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });
});
