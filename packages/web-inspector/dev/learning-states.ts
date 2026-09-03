import type { InspectorLearningSnapshotV1 } from "@copilotkit/shared";
import { CpkLearningView } from "../src/components/learning-view.js";
import type { LearningViewState } from "../src/components/learning-view.js";

type ScreenshotState =
  | LearningViewState
  | "candidates-only"
  | "copy-error"
  | "insights-only"
  | "refreshing-results"
  | "results-error"
  | "results-evidence"
  | "setup-prompt";

const page = <T>(pageSize: 3 | 4, items: readonly T[]) => ({
  page: 1,
  pageSize,
  total: items.length,
  totalPages: items.length === 0 ? 0 : 1,
  items,
});

const sourceInsight = {
  id: "insight-source",
  statement:
    "Users ask for a concise status before they ask for implementation details.",
  impact:
    "Leading with the outcome shortens support loops and makes the next action obvious.",
  totalThreadCount: 3,
  evidenceTruncated: false,
  evidence: [
    {
      threadId: "thread-onboarding",
      threadName: "Enterprise onboarding",
      messageIds: ["message-1", "message-2"],
      updatedAt: "2026-03-09T14:00:00.000Z",
    },
    {
      threadId: "thread-support",
      threadName: "Support escalation",
      messageIds: ["message-3"],
      updatedAt: "2026-03-08T12:00:00.000Z",
    },
  ],
} as const;

const insights = [
  {
    id: "insight-standalone-1",
    statement:
      "Teams verify evidence before accepting a generated recommendation.",
    impact:
      "Direct Thread links increase trust and let reviewers resolve ambiguity without leaving their workflow.",
    totalThreadCount: 5,
    evidenceTruncated: false,
    evidence: [
      {
        threadId: "thread-review",
        threadName: "Quarterly quality review",
        messageIds: ["message-4", "message-5", "message-6"],
        updatedAt: "2026-03-10T09:15:00.000Z",
      },
    ],
  },
  {
    id: "insight-standalone-2",
    statement: "Operators retry setup after the first captured Thread appears.",
    impact:
      "A persistent progress state prevents duplicate configuration work during the first Learning run.",
    totalThreadCount: 2,
    evidenceTruncated: false,
    evidence: [],
  },
] as const;

const skills = [
  {
    id: "skill-outcome-first",
    name: "Lead with the outcome",
    description:
      "Answer with the completed result or current state before implementation detail.",
    revision: 3,
    skillMd:
      "# Lead with the outcome\n\nState the result in the first sentence. Follow with only the context needed to verify it.\n\n## Guardrail\n\nDo not expose private identifiers, credentials, or raw conversation content.",
    sourceInsight,
  },
  {
    id: "skill-evidence-links",
    name: "Keep evidence navigable",
    description:
      "Link a recommendation back to the exact Thread evidence that supports it.",
    revision: 1,
    skillMd:
      "# Keep evidence navigable\n\nGroup supporting messages by Thread and preserve their stable order.",
    sourceInsight: null,
  },
] as const;

const baseSnapshot = (
  overrides: Partial<InspectorLearningSnapshotV1> = {},
): InspectorLearningSnapshotV1 => ({
  schemaVersion: 1,
  projectKey: "project-safe-key",
  snapshotVersion: "snapshot-1",
  configuration: { state: "not_configured" },
  pendingThreadCount: 0,
  run: { hasActiveRun: false, hasEverSucceeded: false, latest: null },
  pendingCandidateCount: 0,
  skillsPage: page(3, []),
  insightsPage: page(4, []),
  links: {
    learning: "https://app.copilotkit.ai/learning",
    candidates: null,
    runs: null,
  },
  ...overrides,
});

const configured = {
  state: "configured" as const,
  container: { id: "production", name: "Production agent" },
};

const results = baseSnapshot({
  configuration: configured,
  pendingThreadCount: 4,
  run: {
    hasActiveRun: false,
    hasEverSucceeded: true,
    latest: { status: "succeeded", completedAt: "2026-03-10T09:00:00.000Z" },
  },
  pendingCandidateCount: 2,
  skillsPage: page(3, skills),
  insightsPage: page(4, insights),
  links: {
    learning: "https://app.copilotkit.ai/learning?container=production",
    candidates:
      "https://app.copilotkit.ai/learning?container=production&tab=candidates",
    runs: "https://app.copilotkit.ai/learning?container=production&tab=runs",
  },
});

const query = new URLSearchParams(window.location.search);
const requested = (query.get("state") ?? "results") as ScreenshotState;
const view = document.querySelector("cpk-learning-view");
if (!(view instanceof CpkLearningView))
  throw new Error("Learning view did not mount.");

view.supported = true;
view.loading = false;
view.error = null;
view.snapshot = baseSnapshot();
view.setupActive = false;
view.setupPrompt =
  "Implement Rich Threads for this CopilotKit application. Preserve the host application's authentication policy, enable debug-only Inspector access, and verify one Thread can be captured without starting a Learning run.";

switch (requested) {
  case "unsupported":
    view.supported = false;
    view.snapshot = null;
    break;
  case "loading":
    view.loading = true;
    view.snapshot = null;
    break;
  case "error":
    view.error =
      "The runtime could not reach CopilotKit Intelligence. Check the connection and retry.";
    view.snapshot = null;
    break;
  case "selection_required":
    view.snapshot = baseSnapshot({
      configuration: { state: "selection_required" },
    });
    break;
  case "invalid":
  case "setup-prompt":
    view.snapshot = baseSnapshot({
      configuration: { state: "invalid", reason: "instrumentation" },
    });
    break;
  case "landing":
    break;
  case "copy-error":
    view.copyState = "error";
    break;
  case "setup":
    view.setupActive = true;
    break;
  case "first_run":
    view.snapshot = baseSnapshot({
      configuration: configured,
      run: {
        hasActiveRun: true,
        hasEverSucceeded: false,
        latest: { status: "reducing", completedAt: null },
      },
      links: {
        learning: "https://app.copilotkit.ai/learning?container=production",
        candidates: null,
        runs: "https://app.copilotkit.ai/learning?container=production&tab=runs",
      },
    });
    break;
  case "ready":
    view.snapshot = baseSnapshot({
      configuration: configured,
      pendingThreadCount: 3,
      links: {
        learning: "https://app.copilotkit.ai/learning?container=production",
        candidates: null,
        runs: "https://app.copilotkit.ai/learning?container=production&tab=runs",
      },
    });
    break;
  case "empty":
    view.snapshot = baseSnapshot({
      configuration: configured,
      run: {
        hasActiveRun: false,
        hasEverSucceeded: true,
        latest: {
          status: "succeeded",
          completedAt: "2026-03-10T09:00:00.000Z",
        },
      },
      links: {
        learning: "https://app.copilotkit.ai/learning?container=production",
        candidates: null,
        runs: "https://app.copilotkit.ai/learning?container=production&tab=runs",
      },
    });
    break;
  case "results":
  case "results-evidence":
    view.snapshot = results;
    break;
  case "insights-only":
    view.snapshot = baseSnapshot({
      ...results,
      pendingCandidateCount: 1,
      skillsPage: page(3, []),
      insightsPage: page(4, insights),
    });
    break;
  case "candidates-only":
    view.snapshot = baseSnapshot({
      configuration: configured,
      pendingCandidateCount: 2,
      links: results.links,
    });
    break;
  case "results-error":
    view.snapshot = results;
    view.error =
      "Learning could not refresh. Existing results are still available.";
    break;
  case "refreshing-results":
    view.snapshot = results;
    view.refreshing = true;
    break;
}

await view.updateComplete;
if (requested === "results-evidence") {
  view.shadowRoot?.querySelector<HTMLButtonElement>(".source")?.click();
  await view.updateComplete;
}
if (requested === "setup-prompt") {
  view.shadowRoot
    ?.querySelector<HTMLButtonElement>(".state-card .button")
    ?.click();
  await view.updateComplete;
}
document.documentElement.dataset.ready = "true";
