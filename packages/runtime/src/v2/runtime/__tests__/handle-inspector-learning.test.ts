import { describe, expect, it, vi } from "vitest";
import type { CopilotRuntimeLike } from "../core/runtime";
import { handleInspectorLearning } from "../handlers/handle-inspector-learning";

const snapshot = {
  schemaVersion: 1,
  projectKey: "project-safe-key",
  snapshotVersion: "snapshot-1",
  configuration: {
    state: "configured",
    container: { id: "container-1", name: "Production" },
  },
  pendingThreadCount: 2,
  run: { hasActiveRun: false, hasEverSucceeded: true, latest: null },
  pendingCandidateCount: 0,
  skillsPage: {
    page: 1,
    pageSize: 3,
    total: 0,
    totalPages: 0,
    items: [],
  },
  insightsPage: {
    page: 1,
    pageSize: 4,
    total: 0,
    totalPages: 0,
    items: [],
  },
  links: {
    learning: "https://app.copilotkit.ai/learning",
    candidates: null,
    runs: "https://app.copilotkit.ai/learning/runs",
  },
} as const;

function runtime(overrides: Record<string, unknown> = {}): CopilotRuntimeLike {
  return {
    mode: "intelligence",
    debug: { enabled: true, events: false, lifecycle: false, verbose: false },
    intelligence: { getInspectorLearning: vi.fn().mockResolvedValue(snapshot) },
    learning: { containerId: "container-static" },
    ...overrides,
  } as unknown as CopilotRuntimeLike;
}

describe("handleInspectorLearning", () => {
  it("uses only server-owned container scope and preserves browser pagination", async () => {
    const fixture = runtime();
    const response = await handleInspectorLearning({
      runtime: fixture,
      request: new Request(
        "https://runtime.example/inspector-learning?agentId=support&skillsPage=2",
      ),
      threadEndpointsEnabled: true,
    });

    expect(response.status).toBe(200);
    expect(fixture.intelligence?.getInspectorLearning).toHaveBeenCalledWith({
      agentId: "support",
      skillsPage: 2,
      runtimeContainerId: "container-static",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("hides the route without debug mode and rejects unknown scope fields", async () => {
    const hidden = await handleInspectorLearning({
      runtime: runtime({
        debug: {
          enabled: false,
          events: false,
          lifecycle: false,
          verbose: false,
        },
      }),
      request: new Request("https://runtime.example/inspector-learning"),
      threadEndpointsEnabled: true,
    });
    expect(hidden.status).toBe(404);

    const rejected = await handleInspectorLearning({
      runtime: runtime(),
      request: new Request(
        "https://runtime.example/inspector-learning?runtimeContainerId=attacker-scope",
      ),
      threadEndpointsEnabled: true,
    });
    expect(rejected.status).toBe(400);
  });

  it("returns instrumentation-invalid data when Rich Threads are unavailable", async () => {
    const response = await handleInspectorLearning({
      runtime: runtime(),
      request: new Request("https://runtime.example/inspector-learning"),
      threadEndpointsEnabled: false,
    });
    const body = await response.json();

    expect(body).toMatchObject({
      configuration: { state: "invalid", reason: "instrumentation" },
      pendingThreadCount: 0,
      pendingCandidateCount: 0,
    });
    expect(body.skillsPage.items).toEqual([]);
    expect(body.insightsPage.items).toEqual([]);
  });
});
