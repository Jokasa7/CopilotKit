import { LitElement, css, html, nothing } from "lit";
import type {
  InspectorLearningInsight,
  InspectorLearningSnapshotV1,
} from "@copilotkit/shared";

export type LearningViewState =
  | "unsupported"
  | "loading"
  | "error"
  | "selection_required"
  | "invalid"
  | "results"
  | "first_run"
  | "ready"
  | "empty"
  | "setup"
  | "landing";

export function deriveLearningViewState(input: {
  readonly supported: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly snapshot: InspectorLearningSnapshotV1 | null;
  readonly setupActive: boolean;
}): LearningViewState {
  if (!input.supported) return "unsupported";
  if (!input.snapshot && input.loading) return "loading";
  if (!input.snapshot && input.error) return "error";
  const snapshot = input.snapshot;
  if (!snapshot) return "loading";
  if (snapshot.configuration.state === "selection_required") {
    return "selection_required";
  }
  if (snapshot.configuration.state === "invalid") return "invalid";
  const hasResults =
    snapshot.skillsPage.total > 0 || snapshot.insightsPage.total > 0;
  if (hasResults || snapshot.pendingCandidateCount > 0) return "results";
  if (snapshot.run.hasActiveRun) return "first_run";
  if (snapshot.run.hasEverSucceeded && snapshot.pendingThreadCount === 0)
    return "empty";
  if (
    snapshot.configuration.state === "configured" &&
    snapshot.pendingThreadCount > 0
  ) {
    return "ready";
  }
  if (input.setupActive || snapshot.configuration.state === "configured")
    return "setup";
  return "landing";
}

const arrow = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
`;
const chevron = (open: boolean) =>
  html`<svg class="chevron" data-open=${open} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

export class CpkLearningView extends LitElement {
  static properties = {
    supported: { type: Boolean },
    loading: { type: Boolean },
    refreshing: { type: Boolean },
    error: { attribute: false },
    snapshot: { attribute: false },
    setupActive: { type: Boolean },
    copyState: { attribute: false },
    setupPrompt: { attribute: false },
  };

  supported = false;
  loading = false;
  refreshing = false;
  error: string | null = null;
  snapshot: InspectorLearningSnapshotV1 | null = null;
  setupActive = false;
  copyState: "idle" | "copied" | "error" = "idle";
  setupPrompt = "";
  private promptOpen = false;
  private expandedSkillId: string | null = null;
  private selectedInsightId: string | null = null;
  private skillPageKey = "";

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: auto;
      background: #f7f7fa;
      color: #17171a;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    * {
      box-sizing: border-box;
    }
    .shell {
      min-height: 100%;
      padding: 28px 32px 44px;
    }
    .top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 24px;
    }
    .eyebrow {
      margin: 0 0 5px;
      color: #6b6b73;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .top h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: -0.025em;
    }
    .top p {
      max-width: 570px;
      margin: 7px 0 0;
      color: #66666e;
      font-size: 12px;
      line-height: 1.55;
    }
    .top-meta {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #777780;
      font-size: 11px;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .card,
    .state-card,
    .banner {
      border: 1px solid #dedee6;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(21, 21, 25, 0.03);
    }
    .state-wrap {
      min-height: calc(100vh - 190px);
      display: grid;
      place-items: center;
    }
    .state-card {
      width: min(520px, 100%);
      padding: 30px;
    }
    .state-card h2 {
      margin: 0 0 8px;
      font-size: 18px;
      letter-spacing: -0.015em;
    }
    .state-card p {
      margin: 0;
      color: #686870;
      font-size: 13px;
      line-height: 1.6;
    }
    .state-icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      margin-bottom: 17px;
      border-radius: 10px;
      background: #f0ecff;
      color: #6256ad;
    }
    .state-icon svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
    }
    .button,
    .link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 34px;
      border-radius: 7px;
      padding: 0 13px;
      font: 600 12px/1 inherit;
      text-decoration: none;
      cursor: pointer;
    }
    .button {
      border: 0;
      background: #141419;
      color: #fff;
    }
    .button.secondary {
      border: 1px solid #d9d9e1;
      background: #fff;
      color: #38383f;
    }
    .button:disabled {
      cursor: not-allowed;
      opacity: 0.42;
    }
    .link {
      padding: 0;
      color: #5b52a4;
    }
    .link svg,
    .button svg,
    .candidate svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .error {
      margin-top: 12px;
      color: #b82c36 !important;
    }
    .steps {
      display: grid;
      gap: 13px;
      margin-top: 23px;
    }
    .progress-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 22px;
      color: #72727a;
      font-size: 10px;
      font-weight: 700;
    }
    .progress-track {
      height: 4px;
      overflow: hidden;
      margin-top: 8px;
      border-radius: 999px;
      background: #ededf2;
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: #7163bb;
    }
    .step {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      gap: 10px;
      align-items: start;
    }
    .step-number {
      display: grid;
      place-items: center;
      width: 23px;
      height: 23px;
      border-radius: 50%;
      background: #ededf2;
      color: #5c5c63;
      font-size: 11px;
      font-weight: 700;
    }
    .step[data-state="done"] .step-number {
      background: #dff7ef;
      color: #087653;
    }
    .step[data-state="active"] .step-number {
      background: #eee8ff;
      color: #5f50aa;
    }
    .step strong {
      display: block;
      font-size: 12px;
    }
    .step span {
      display: block;
      margin-top: 3px;
      color: #777780;
      font-size: 11px;
      line-height: 1.45;
    }
    .status {
      border-radius: 999px;
      padding: 3px 8px;
      background: #f0f0f4;
      color: #66666e !important;
      font-size: 10px !important;
      font-weight: 700;
    }
    .step[data-state="active"] .status {
      background: #eee8ff;
      color: #5f50aa !important;
    }
    .step[data-state="done"] .status {
      background: #dff7ef;
      color: #087653 !important;
    }
    .step[data-state="attention"] .step-number,
    .step[data-state="attention"] .status {
      background: #fff0f0;
      color: #b82c36 !important;
    }
    .collection {
      margin-top: 22px;
      border: 1px solid #e1e1e7;
      border-radius: 9px;
      background: #fafafd;
      padding: 15px;
    }
    .collection h3 {
      margin: 0;
      font-size: 12px;
    }
    .collection-summary {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-top: 14px;
    }
    .collection-stat strong {
      display: block;
      font-size: 22px;
    }
    .collection-stat span {
      display: block;
      margin-top: 2px;
      color: #72727a;
      font-size: 10px;
      font-weight: 700;
    }
    .alert-box {
      margin-top: 12px;
      border-left: 3px solid #c43d46;
      border-radius: 4px;
      background: #fff4f4;
      padding: 10px 11px;
      color: #91242c;
      font-size: 11px;
      line-height: 1.5;
    }
    .outcome-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 19px;
      color: #85858d;
      font-size: 10px;
      font-weight: 700;
    }
    .outcome-preview b {
      color: #aaaab2;
      font-weight: 500;
    }
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
      padding: 15px 17px;
      border-color: #b9e7d9;
      background: #effbf7;
    }
    .banner h2 {
      margin: 0 0 3px;
      color: #075f46;
      font-size: 13px;
    }
    .banner p {
      margin: 0;
      color: #397565;
      font-size: 11px;
    }
    .banner .link {
      color: #087653;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 22px;
    }
    .metric {
      padding: 13px 14px;
    }
    .metric span {
      display: block;
      color: #777780;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }
    .metric strong {
      display: block;
      margin-top: 6px;
      font-size: 18px;
    }
    .section {
      margin-top: 22px;
    }
    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 9px;
    }
    .section-head h2 {
      margin: 0;
      font-size: 14px;
    }
    .section-head p {
      margin: 3px 0 0;
      color: #777780;
      font-size: 11px;
    }
    .candidate {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #6056a2;
      font-size: 11px;
      font-weight: 650;
      text-decoration: none;
    }
    .list {
      overflow: hidden;
    }
    .skill {
      border-bottom: 1px solid #ededf2;
    }
    .skill:last-child {
      border-bottom: 0;
    }
    .skill-button {
      display: grid;
      width: 100%;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
      border: 0;
      background: #fff;
      padding: 16px;
      text-align: left;
      cursor: pointer;
      list-style: none;
    }
    .skill-button::-webkit-details-marker {
      display: none;
    }
    .skill-button:hover,
    .insight-row:hover,
    .evidence-row:hover {
      background: #fafafd;
    }
    .skill-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .revision {
      border-radius: 999px;
      background: #f1f1f5;
      padding: 2px 7px;
      color: #6b6b73;
      font-size: 9px;
      font-weight: 700;
    }
    .description {
      margin-top: 5px;
      color: #6b6b73;
      font-size: 11px;
      line-height: 1.5;
    }
    .chevron {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: #81818a;
      stroke-width: 1.8;
      transition: transform 0.16s;
    }
    .chevron[data-open="true"] {
      transform: rotate(90deg);
    }
    .skill-detail {
      padding: 0 16px 17px;
    }
    .disclosure-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #676770;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .source {
      display: block;
      width: 100%;
      margin: 0 0 12px;
      border: 0;
      border-left: 2px solid #9d8be4;
      background: #faf8ff;
      padding: 11px 12px;
      text-align: left;
      cursor: pointer;
    }
    .source small {
      display: block;
      margin-bottom: 5px;
      color: #6d5eb0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .source strong {
      display: block;
      font-size: 11px;
      line-height: 1.5;
    }
    .source p {
      margin: 4px 0 0;
      color: #696970;
      font-size: 10px;
      line-height: 1.45;
    }
    .unavailable {
      color: #85858d !important;
      font-style: italic;
    }
    .md-label {
      margin: 0 0 6px;
      color: #777780;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    pre {
      max-height: 270px;
      overflow: auto;
      margin: 0;
      border: 1px solid #e1e1e7;
      border-radius: 8px;
      background: #17171b;
      padding: 14px;
      color: #e9e9ee;
      font:
        10px/1.55 ui-monospace,
        SFMono-Regular,
        Menlo,
        monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .insight-grid {
      display: grid;
    }
    .insight-row {
      display: grid;
      width: 100%;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
      border: 0;
      border-bottom: 1px solid #ededf2;
      background: #fff;
      padding: 0;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .insight-row > div {
      padding: 14px 16px;
      font-size: 11px;
      line-height: 1.5;
    }
    .insight-row:last-child {
      border-bottom: 0;
    }
    .insight-row[data-selected="true"] {
      background: #faf8ff;
    }
    .column-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
      border-bottom: 1px solid #e6e6ed;
      background: #fafafd;
    }
    .column-head span {
      padding: 8px 16px;
      color: #777780;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .impact {
      display: block;
      margin-top: 4px;
      color: #696970;
    }
    .evidence-count strong,
    .evidence-count span {
      display: block;
    }
    .evidence-count span {
      margin-top: 3px;
      color: #777780;
      font-size: 9px;
    }
    .evidence-panel {
      border-top: 1px solid #dedee6;
      padding: 14px 16px;
      background: #fafafd;
    }
    .evidence-panel h3 {
      margin: 0 0 9px;
      font-size: 11px;
    }
    .evidence-list {
      display: grid;
      gap: 6px;
    }
    .evidence-row {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #e1e1e7;
      border-radius: 7px;
      background: #fff;
      padding: 9px 10px;
      text-align: left;
      cursor: pointer;
    }
    .evidence-row strong {
      display: block;
      font-size: 10px;
    }
    .evidence-row svg {
      width: 14px;
      height: 14px;
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .evidence-row span {
      display: block;
      margin-top: 2px;
      color: #777780;
      font-size: 9px;
    }
    .empty-inline {
      padding: 20px 16px;
      color: #72727a;
      font-size: 11px;
      line-height: 1.5;
    }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 9px;
      color: #777780;
      font-size: 10px;
    }
    .pagination button {
      border: 1px solid #dcdce4;
      border-radius: 6px;
      background: #fff;
      padding: 5px 9px;
      color: #4b4b52;
      font: 600 10px inherit;
      cursor: pointer;
    }
    .pagination button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .retry-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border: 1px solid #f0c7ca;
      border-radius: 8px;
      background: #fff6f6;
      padding: 9px 11px;
      color: #a62d35;
      font-size: 10px;
    }
    .skeleton {
      display: grid;
      gap: 10px;
    }
    .sk {
      height: 54px;
      border-radius: 9px;
      background: linear-gradient(90deg, #eeeef2, #f8f8fa, #eeeef2);
      background-size: 200% 100%;
      animation: shimmer 1.3s infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    .dialog-backdrop {
      position: fixed;
      z-index: 50;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(15, 15, 20, 0.42);
      padding: 24px;
    }
    .dialog {
      width: min(620px, 100%);
      max-height: min(680px, 90vh);
      display: flex;
      flex-direction: column;
      border: 1px solid #d9d9e1;
      border-radius: 13px;
      background: #fff;
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
    }
    .dialog header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      padding: 18px 19px 13px;
    }
    .dialog h2 {
      margin: 0;
      font-size: 16px;
    }
    .dialog header p {
      margin: 4px 0 0;
      color: #6d6d75;
      font-size: 11px;
    }
    .dialog-close {
      border: 0;
      background: transparent;
      color: #777;
      font-size: 20px;
      cursor: pointer;
    }
    .dialog pre {
      margin: 0 19px;
      max-height: 420px;
    }
    .dialog > .error {
      margin: 10px 19px 0;
    }
    .dialog footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 19px 18px;
    }
    @media (max-width: 640px) {
      .shell {
        padding: 20px 16px 36px;
      }
      .top {
        display: block;
      }
      .top-meta {
        margin-top: 10px;
      }
      .summary {
        grid-template-columns: 1fr;
      }
      .insight-grid,
      .column-head,
      .insight-row {
        grid-template-columns: 1fr;
      }
      .column-head span:last-child {
        display: none;
      }
      .insight-row > div:first-child {
        padding-bottom: 4px;
      }
      .insight-row > div:last-child {
        padding-top: 0;
      }
      .banner {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }

  private externalLink(
    url: string | null,
    label: string,
    className = "link",
    category: "learning" | "runs" | "candidates" = "learning",
  ) {
    return url
      ? html`<a
          class=${className}
          href=${url}
          target="_blank"
          rel="noopener noreferrer"
          @click=${() => this.emit("learning-web-link", { category })}
          >${label}${arrow}</a
        >`
      : nothing;
  }

  private stateCard(input: {
    icon: unknown;
    title: string;
    copy: string;
    actions?: unknown;
    extra?: unknown;
  }) {
    return html`<div class="state-wrap"><section class="state-card"><div class="state-icon">${input.icon}</div><h2>${input.title}</h2><p>${input.copy}</p>${input.extra ?? nothing}${input.actions ? html`<div class="actions">${input.actions}</div>` : nothing}</section></div>`;
  }

  private setupPromptButton(label = "Copy the setup prompt") {
    return html`<button class="button" type="button" @click=${() => {
      if (label === "Open the setup prompt") {
        this.promptOpen = true;
        this.requestUpdate();
        return;
      }
      this.emit("learning-copy-setup");
    }}>${this.copyState === "copied" ? "Prompt copied" : label}</button>`;
  }

  private renderSetupProgress(
    mode: "setup" | "ready" | "running" | "attention",
  ) {
    const ready = mode === "ready";
    const running = mode === "running";
    const attention = mode === "attention";
    const completedSteps = ready || running ? 2 : 1;
    const pendingThreads = ready ? (this.snapshot?.pendingThreadCount ?? 0) : 0;
    const statusTitle = attention
      ? "Learning setup needs attention"
      : mode === "setup"
        ? "Waiting for the first Thread"
        : ready
          ? "Threads ready to analyze"
          : "Analysis is running in the web app.";
    const action =
      ready || running
        ? this.externalLink(
            this.snapshot?.links.runs ?? null,
            "Open in web app",
            "button",
            "runs",
          )
        : attention
          ? this.setupPromptButton("Open the setup prompt")
          : html`
              <button class="button" type="button" disabled>Analyze Threads</button>
            `;

    return html`<div class="state-wrap">
      <section class="state-card" aria-labelledby="learning-setup-title">
        <h2 id="learning-setup-title">
          ${attention ? "Learning setup needs attention" : "Set up Learning"}
        </h2>
        <p>
          Connect Rich Threads, capture a conversation, then review the patterns
          Learning finds.
        </p>
        <div class="progress-top">
          <span>Setup progress</span><span>${completedSteps} of 3 steps</span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div
            class="progress-fill"
            style="width: ${(completedSteps / 3) * 100}%"
          ></div>
        </div>
        <div class="steps">
          <div class="step" data-state="done">
            <span class="step-number">✓</span>
            <div>
              <strong>Copy the setup prompt</strong
              ><span>Rich Threads setup is connected for this app.</span>
            </div>
            <span class="status">Complete</span>
          </div>
          <div
            class="step"
            data-state=${
              attention ? "attention" : mode === "setup" ? "active" : "done"
            }
          >
            <span class="step-number">${ready || running ? "✓" : "2"}</span>
            <div>
              <strong>Create your first Thread</strong
              ><span>Complete a conversation in your app.</span>
            </div>
            <span class="status"
              >${
                attention
                  ? "Needs attention"
                  : mode === "setup"
                    ? "In progress"
                    : "Complete"
              }</span
            >
          </div>
          <div
            class="step"
            data-state=${ready || running ? "active" : "idle"}
          >
            <span class="step-number">3</span>
            <div>
              <strong>Analyze Threads</strong
              ><span>Find patterns and turn them into Insights and Skills.</span>
            </div>
            <span class="status"
              >${running ? "Running" : ready ? "Ready" : "Not started"}</span
            >
          </div>
        </div>
        <section class="collection">
          <h3>${statusTitle}</h3>
          ${
            attention
              ? html`
                  <div class="alert-box" role="alert">
                    Inspector did not find the Learning container or app instrumentation. Open the
                    setup prompt, run it in your coding agent, then try again.
                  </div>
                `
              : nothing
          }
          <div class="collection-summary">
            <div class="collection-stat">
              <strong>${pendingThreads}</strong><span>New Threads</span>
            </div>
            ${action}
          </div>
        </section>
        <div class="outcome-preview" aria-label="Learning flow">
          <span>Threads</span><b>→</b><span>Insights</span><b>→</b
          ><span>Skills</span>
        </div>
      </section>
    </div>`;
  }

  private renderPagination(
    section: "skills" | "insights",
    page: number,
    totalPages: number,
  ) {
    if (totalPages <= 1) return nothing;
    return html`<nav class="pagination" aria-label="${section} pages"><span aria-live="polite">Page ${page} of ${totalPages}</span><button ?disabled=${page <= 1} @click=${() => this.emit("learning-page", { section, page: page - 1 })}>Previous</button><button ?disabled=${page >= totalPages} @click=${() => this.emit("learning-page", { section, page: page + 1 })}>Next</button></nav>`;
  }

  private renderEvidence(insight: InspectorLearningInsight) {
    return html`<div class="evidence-panel"><h3>Evidence from ${insight.totalThreadCount} ${insight.totalThreadCount === 1 ? "Thread" : "Threads"}${insight.evidenceTruncated ? " · response shortened" : ""}</h3><div class="evidence-list">${
      insight.evidence.length === 0
        ? html`
            <p class="unavailable">Evidence is no longer available</p>
          `
        : insight.evidence.map(
            (evidence) =>
              html`<button class="evidence-row" type="button" @click=${() => this.emit("learning-open-evidence", { threadId: evidence.threadId, messageId: evidence.messageIds[0] })}><span><strong>${evidence.threadName ?? `Thread ${evidence.threadId.slice(0, 8)}`}</strong><span>${evidence.messageIds.length} ${evidence.messageIds.length === 1 ? "message" : "messages"}</span></span>${arrow}</button>`,
          )
    }</div></div>`;
  }

  private renderResults(snapshot: InspectorLearningSnapshotV1) {
    const firstSkillId = snapshot.skillsPage.items[0]?.id ?? null;
    const containerId =
      snapshot.configuration.state === "configured"
        ? snapshot.configuration.container.id
        : "";
    const skillPageKey = `${snapshot.projectKey}|${containerId}|${snapshot.skillsPage.page}|${snapshot.skillsPage.items.map((skill) => skill.id).join(",")}`;
    if (skillPageKey !== this.skillPageKey) {
      this.skillPageKey = skillPageKey;
      this.expandedSkillId =
        snapshot.skillsPage.page === 1 ? firstSkillId : null;
    }
    const allInsights = [
      ...snapshot.insightsPage.items,
      ...snapshot.skillsPage.items.flatMap((skill) =>
        skill.sourceInsight ? [skill.sourceInsight] : [],
      ),
    ];
    const selectedInsight = allInsights.find(
      (insight) => insight.id === this.selectedInsightId,
    );
    return html`
      ${snapshot.pendingThreadCount > 0 ? html`<section class="banner"><div><h2>Find new Insights and Skills</h2><p>You have new Threads ready to be analyzed.</p></div>${this.externalLink(snapshot.links.runs, "Open in web app", "link", "runs")}</section>` : nothing}
      ${this.error ? html`<div class="retry-strip" role="status"><span>${this.error}</span><button class="button secondary" @click=${() => this.emit("learning-retry")}>Retry</button></div>` : nothing}
      <div class="summary"><div class="card metric"><span>Skills in registry</span><strong>${snapshot.skillsPage.total}</strong></div><div class="card metric"><span>Active Insights</span><strong>${snapshot.insightsPage.total}</strong></div><div class="card metric"><span>Threads ready</span><strong>${snapshot.pendingThreadCount}</strong></div></div>
      <section class="section"><header class="section-head"><div><h2>Skills in registry</h2><p>Published guidance your team can review, edit, and ship.</p></div>${snapshot.pendingCandidateCount > 0 ? this.externalLink(snapshot.links.candidates, `${snapshot.pendingCandidateCount} ${snapshot.pendingCandidateCount === 1 ? "Skill" : "Skills"} for review in web app`, "candidate", "candidates") : nothing}</header><div class="card list">${
        snapshot.skillsPage.items.length === 0
          ? html`
              <div class="empty-inline">
                <strong>No Skills in registry yet.</strong><br />Learning has found Insights,
                but none have become registry Skills.
              </div>
            `
          : snapshot.skillsPage.items.map((skill) => {
              const open = this.expandedSkillId === skill.id;
              return html`<details class="skill" ?open=${open} @toggle=${(
                event: Event,
              ) => {
                const nextOpen = (event.currentTarget as HTMLDetailsElement)
                  .open;
                if (nextOpen === open) return;
                this.expandedSkillId = nextOpen ? skill.id : "";
                this.emit("learning-skill-toggle", {
                  action: nextOpen ? "expanded" : "collapsed",
                });
                this.requestUpdate();
              }}><summary class="skill-button"><div><div class="skill-name">${skill.name}<span class="revision">v${skill.revision}</span></div><div class="description">${skill.description}</div></div><span class="disclosure-label">View SKILL.md ${chevron(open)}</span></summary>${
                open
                  ? html`<div class="skill-detail">${
                      skill.sourceInsight
                        ? html`<button class="source" type="button" @click=${() => {
                            this.selectedInsightId = skill.sourceInsight!.id;
                            this.emit("learning-evidence-opened");
                            this.requestUpdate();
                          }}><small>Supporting Insight</small><strong>${skill.sourceInsight.statement}</strong><p>${skill.sourceInsight.impact} · ${skill.sourceInsight.totalThreadCount} supporting ${skill.sourceInsight.totalThreadCount === 1 ? "Thread" : "Threads"}</p></button>`
                        : html`
                            <p class="source unavailable">Supporting Insight unavailable</p>
                          `
                    }<p class="md-label">SKILL.md</p><pre>${skill.skillMd}</pre>${selectedInsight?.id === skill.sourceInsight?.id ? this.renderEvidence(selectedInsight!) : nothing}</div>`
                  : nothing
              }</details>`;
            })
      }</div>${this.renderPagination("skills", snapshot.skillsPage.page, snapshot.skillsPage.totalPages)}</section>
      <section class="section"><header class="section-head"><div><h2>${snapshot.skillsPage.total > 0 ? "More Insights" : "Insights"}</h2><p>Active patterns not already represented by a registry Skill.</p></div></header><div class="card list"><div class="column-head"><span>Pattern</span><span>Evidence</span></div>${
        snapshot.insightsPage.items.length === 0
          ? html`
              <div class="empty-inline">No active Insights.</div>
            `
          : html`<div class="insight-grid">${snapshot.insightsPage.items.map(
              (insight) =>
                html`<button class="insight-row" data-selected=${selectedInsight?.id === insight.id} type="button" @click=${() => {
                  const opening = this.selectedInsightId !== insight.id;
                  this.selectedInsightId = opening ? insight.id : null;
                  if (opening) this.emit("learning-evidence-opened");
                  this.requestUpdate();
                }}><div><strong>${insight.statement}</strong><span class="impact">${insight.impact}</span></div><div class="evidence-count"><strong>${insight.totalThreadCount} ${insight.totalThreadCount === 1 ? "Thread" : "Threads"}</strong><span>View evidence</span></div></button>`,
            )}</div>`
      }${selectedInsight && snapshot.insightsPage.items.some((insight) => insight.id === selectedInsight.id) ? this.renderEvidence(selectedInsight!) : nothing}</div>${this.renderPagination("insights", snapshot.insightsPage.page, snapshot.insightsPage.totalPages)}</section>`;
  }

  render() {
    const state = deriveLearningViewState({
      supported: this.supported,
      loading: this.loading,
      error: this.error,
      snapshot: this.snapshot,
      setupActive: this.setupActive,
    });
    const retry = html`<button class="button" type="button" @click=${() => this.emit("learning-retry")}>Retry</button>`;
    let content: unknown;
    if (state === "unsupported")
      content = this.stateCard({
        icon: html`
          <svg viewBox="0 0 24 24">
            <rect x="5" y="4" width="14" height="16" rx="2" />
            <path d="M9 8h6m-6 4h6m-6 4h3" />
          </svg>
        `,
        title: "Learning is not available with this runtime version.",
        copy: "Update the CopilotKit runtime to inspect Learning setup and results.",
      });
    else if (state === "loading")
      content = html`
        <div class="skeleton" aria-label="Loading Learning">
          <div class="sk"></div>
          <div class="sk"></div>
          <div class="sk"></div>
        </div>
      `;
    else if (state === "error")
      content = this.stateCard({
        icon: html`
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3h.01" />
          </svg>
        `,
        title: "Learning data is unavailable",
        copy: this.error ?? "The Learning snapshot could not be loaded.",
        actions: retry,
      });
    else if (state === "selection_required")
      content = this.stateCard({
        icon: html`
          <svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10m-7 5h4" /></svg>
        `,
        title: "Choose a Learning container",
        copy: "Inspector cannot choose a Learning container for this agent.",
        actions: this.externalLink(
          this.snapshot!.links.learning,
          "Open in web app",
          "button",
          "learning",
        ),
      });
    else if (state === "invalid")
      content = this.renderSetupProgress("attention");
    else if (state === "landing")
      content = this.stateCard({
        icon: html`
          <svg viewBox="0 0 24 24">
            <path d="m12 3 1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3Z" />
            <path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
          </svg>
        `,
        title: "Turn real conversations into better agent behavior",
        copy: "Set up Rich Threads so Learning can find evidence-backed Insights and turn approved patterns into reusable Skills.",
        actions: html`${this.setupPromptButton()}<a class="link" href="https://www.copilotkit.ai/contact" target="_blank" rel="noopener noreferrer">Talk to an Engineer${arrow}</a>`,
        extra:
          this.copyState === "error"
            ? html`
                <p class="error">Clipboard access failed. Retry to continue.</p>
              `
            : nothing,
      });
    else if (state === "setup") content = this.renderSetupProgress("setup");
    else if (state === "first_run")
      content = this.renderSetupProgress("running");
    else if (state === "ready") content = this.renderSetupProgress("ready");
    else if (state === "empty")
      content = this.stateCard({
        icon: html`
          <svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V4h8v3" /></svg>
        `,
        title: "No new Insights or Skills",
        copy: "Learning did not find a useful pattern in the analyzed Threads. New runs remain available in the web app.",
        actions: this.externalLink(
          this.snapshot!.links.runs,
          "Open in web app",
          "button secondary",
          "runs",
        ),
      });
    else content = this.renderResults(this.snapshot!);
    return html`<main class="shell" data-learning-state=${state}><header class="top"><div><p class="eyebrow">Intelligence</p><h1>Learning</h1><p>Review the evidence-backed patterns and published Skills produced from your agent’s Rich Threads.</p></div>${
      this.refreshing
        ? html`
            <span class="top-meta"
              ><svg
                class="spin"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path d="M20 12a8 8 0 1 1-5.5-7.6" /></svg
              >Refreshing</span
            >
          `
        : nothing
    }</header>${content}</main>${
      this.promptOpen
        ? html`<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="learning-prompt-title"><header><div><h2 id="learning-prompt-title">Set up Rich Threads</h2><p>Paste this prompt into your coding agent.</p></div><button class="dialog-close" aria-label="Close setup prompt" @click=${() => {
            this.promptOpen = false;
            this.requestUpdate();
          }}>×</button></header><pre>${this.setupPrompt}</pre>${
            this.copyState === "error"
              ? html`
                  <p class="error" role="alert">Clipboard access failed. Retry to continue.</p>
                `
              : nothing
          }<footer><button class="button secondary" @click=${() => {
            this.promptOpen = false;
            this.requestUpdate();
          }}>Close</button><button class="button" @click=${() => this.emit("learning-copy-setup")}>${this.copyState === "copied" ? "Prompt copied" : "Copy the setup prompt"}</button></footer></section></div>`
        : nothing
    }`;
  }
}

if (!customElements.get("cpk-learning-view")) {
  customElements.define("cpk-learning-view", CpkLearningView);
}
