import {
  CopilotKitCore,
  CopilotKitCoreRuntimeConnectionStatus,
} from "@copilotkit/core";
import {
  WEB_INSPECTOR_TAG,
  configureWebInspectorElement,
} from "@copilotkit/web-inspector";
import type { WebInspectorElement } from "@copilotkit/web-inspector";
import {
  isLearningScreenshotState,
  LEARNING_LAB_BASE_PATH,
} from "./learning-state-fixtures.js";
import type { LearningScreenshotState } from "./learning-state-fixtures.js";

const query = new URLSearchParams(window.location.search);
const requestedState = query.get("state");
const state: LearningScreenshotState = isLearningScreenshotState(requestedState)
  ? requestedState
  : "success";
const runtimeTransport =
  query.get("transport") === "single" ? "single" : "rest";
const narrow = window.innerWidth <= 900;

window.localStorage.removeItem("cpk:inspector:learning-setup:v1");
window.localStorage.setItem(
  "cpk:inspector:state",
  JSON.stringify({
    isOpen: true,
    hasOpenedInspector: true,
    selectedMenu: "memories",
    selectedContext: "Checkout Assistant",
    dockMode: narrow ? "docked-left" : "floating",
    sidebarCollapsed: false,
    colorSchemePreference: "light",
    window: {
      size: {
        width: narrow ? window.innerWidth - 32 : window.innerWidth - 96,
        height: narrow ? window.innerHeight : window.innerHeight - 48,
      },
      hasCustomPosition: false,
    },
  }),
);

if (state === "copy-error") {
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error("Clipboard denied")) },
  });
}

const runtimeUrl = `${window.location.origin}${LEARNING_LAB_BASE_PATH}/${state}`;
const core = new CopilotKitCore({
  runtimeUrl,
  runtimeTransport,
  deferInitialConnection: true,
});
const inspector = configureWebInspectorElement(
  document.createElement(WEB_INSPECTOR_TAG),
  core,
);
document.querySelector("#inspector-host")?.replaceChildren(inspector);

function waitFor<T>(
  read: () => T | null | undefined | false,
  label: string,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      const value = read();
      if (value) {
        resolve(value);
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${label}.`));
        return;
      }
      window.setTimeout(tick, 20);
    };
    tick();
  });
}

async function waitForConnection(): Promise<void> {
  if (
    core.runtimeConnectionStatus ===
      CopilotKitCoreRuntimeConnectionStatus.Connected ||
    core.runtimeConnectionStatus === CopilotKitCoreRuntimeConnectionStatus.Error
  ) {
    return;
  }
  await new Promise<void>((resolve) => {
    const subscription = core.subscribe({
      onRuntimeConnectionStatusChanged: ({ status }) => {
        if (
          status !== CopilotKitCoreRuntimeConnectionStatus.Connected &&
          status !== CopilotKitCoreRuntimeConnectionStatus.Error
        ) {
          return;
        }
        subscription.unsubscribe();
        resolve();
      },
    });
  });
}

function learningView():
  | (HTMLElement & { updateComplete: Promise<boolean> })
  | null {
  return (
    inspector.shadowRoot?.querySelector<
      HTMLElement & { updateComplete: Promise<boolean> }
    >("cpk-learning-view") ?? null
  );
}

async function readyIntegratedState(): Promise<void> {
  await inspector.updateComplete;
  const internals = inspector as unknown as {
    handleMenuSelect: (key: "memories") => void;
    learningError: string | null;
  };
  internals.handleMenuSelect("memories");
  await inspector.updateComplete;

  if (state === "landing" || state === "copy-error") {
    const landing = await waitFor(
      () =>
        inspector.shadowRoot?.querySelector<HTMLElement>(
          '[data-inspector-locked-feature="memory"]',
        ),
      "the existing Learning landing surface",
    );
    if (state === "copy-error") {
      landing
        .querySelector<HTMLButtonElement>(
          '[data-inspector-feature-setup-prompt="threads"]',
        )
        ?.click();
      await waitFor(
        () => landing.querySelector('[data-copy-state="error"]'),
        "the landing copy error",
      );
    }
    return;
  }

  const view = await waitFor(learningView, "the integrated Learning pane");
  const expectedState: Record<string, string> = {
    "no-threads": "setup",
    "threads-available": "ready",
    success: "results",
    "insights-only": "results",
    "multiple-skills": "results",
    "new-threads": "results",
    "empty-results": "empty",
    "setup-error": "invalid",
    unsupported: "unsupported",
    loading: "loading",
    "data-error": "error",
    "selection-required": "selection_required",
    "first-run": "first_run",
    "candidates-only": "results",
    "results-error": "results",
    "results-evidence": "results",
    "evidence-unavailable": "results",
    "setup-prompt": "invalid",
  };
  await waitFor(
    () =>
      view.shadowRoot?.querySelector(
        `[data-learning-state="${expectedState[state]}"]`,
      ),
    `${state} Learning state`,
  );

  if (state === "results-error") {
    internals.learningError =
      "Learning could not refresh. Existing results are still available.";
    inspector.requestUpdate();
    await inspector.updateComplete;
    await view.updateComplete;
  }
  if (state === "results-evidence" || state === "evidence-unavailable") {
    view.shadowRoot?.querySelector<HTMLButtonElement>(".insight-row")?.click();
    await view.updateComplete;
    await waitFor(
      () => view.shadowRoot?.querySelector(".detail-panel"),
      "Insight evidence",
    );
  }
  if (state === "setup-prompt") {
    view.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-link")?.click();
    await view.updateComplete;
    await waitFor(
      () => view.shadowRoot?.querySelector('[role="dialog"]'),
      "the setup prompt",
    );
  }
}

async function boot(): Promise<void> {
  core.connect();
  await waitForConnection();
  await readyIntegratedState();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  document.body.dataset.state = state;
  document.body.dataset.transport = runtimeTransport;
  document.documentElement.dataset.ready = "true";
}

void boot().catch((error: unknown) => {
  document.documentElement.dataset.ready = "error";
  document.body.dataset.error =
    error instanceof Error ? error.message : String(error);
  console.error("[Inspector Learning lab]", error);
});

declare global {
  interface Window {
    __learningInspector?: WebInspectorElement;
  }
}

window.__learningInspector = inspector;
