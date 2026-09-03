"use client";

import React from "react";
import { Copy, SquareTerminal } from "lucide-react";
import { RICH_THREADS_SETUP_PROMPT } from "@/lib/rich-threads-setup-prompt";

export { RICH_THREADS_SETUP_PROMPT } from "@/lib/rich-threads-setup-prompt";

type CopyState = "idle" | "copied" | "error";

/** Copies the Inspector recovery prompt from the Runtime endpoints guide. */
export function RichThreadsSetupPrompt(): React.JSX.Element {
  const titleId = React.useId();
  const [copyState, setCopyState] = React.useState<CopyState>("idle");
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const copyGenerationRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      copyGenerationRef.current += 1;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    };
  }, []);

  async function copyPrompt(): Promise<void> {
    const generation = (copyGenerationRef.current += 1);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
    setCopyState("idle");

    try {
      await navigator.clipboard.writeText(RICH_THREADS_SETUP_PROMPT);
    } catch {
      if (!mountedRef.current || generation !== copyGenerationRef.current) {
        return;
      }
      setCopyState("error");
      resetTimerRef.current = setTimeout(() => {
        if (mountedRef.current && generation === copyGenerationRef.current) {
          setCopyState("idle");
          resetTimerRef.current = null;
        }
      }, 2600);
      return;
    }

    if (!mountedRef.current || generation !== copyGenerationRef.current) {
      return;
    }
    setCopyState("copied");
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current && generation === copyGenerationRef.current) {
        setCopyState("idle");
        resetTimerRef.current = null;
      }
    }, 1800);
  }

  return (
    <section
      aria-labelledby={titleId}
      className="shell-docs-radius-surface not-prose my-6 overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
      data-docs-copy-surface="docs_rich_threads_setup_agent_prompt"
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
          <span className="shell-docs-radius-control flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-inset ring-[var(--border)]">
            <SquareTerminal
              aria-hidden="true"
              className="h-5 w-5"
              strokeWidth={1.8}
            />
          </span>
          <div className="min-w-0">
            <p
              id={titleId}
              className="m-0 text-base font-semibold tracking-[-0.01em] text-[var(--text)]"
            >
              Finish setup with your coding agent
            </p>
            <p className="mt-1.5 mb-0 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)]">
              Copy this prompt. Your agent will inspect your app, make the
              required Runtime changes, and verify Rich Threads.
            </p>
          </div>
        </div>

        <div className="flex items-center border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 sm:min-w-[184px] sm:border-l sm:border-t-0 sm:px-5">
          <button
            type="button"
            onClick={copyPrompt}
            className="shell-docs-radius-control inline-flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-[background-color,transform] hover:bg-[var(--accent-strong)] active:translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] focus-visible:outline-none"
          >
            <Copy aria-hidden="true" className="h-4 w-4" />
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Copy blocked"
                : "Copy setup prompt"}
          </button>
        </div>
      </div>
      <span aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? "Prompt copied"
          : copyState === "error"
            ? "Prompt copy failed. Try again."
            : ""}
      </span>
    </section>
  );
}
