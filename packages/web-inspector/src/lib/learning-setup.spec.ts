import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEARNING_SETUP_MAX_AGE_MS,
  LEARNING_SETUP_STORAGE_KEY,
  _test,
  clearLearningSetupMarker,
  learningSetupMarkerMatches,
  normalizeLearningRuntimeUrl,
  readLearningSetupMarker,
  writeLearningSetupMarker,
} from "./learning-setup.js";

beforeEach(() => {
  localStorage.clear();
  _test.resetMemory();
});

describe("Learning setup marker", () => {
  it("normalizes runtime identity and expires after seven days", () => {
    expect(
      normalizeLearningRuntimeUrl(
        "/api/copilotkit/?secret=hidden#fragment",
        "https://example.test/app/",
      ),
    ).toBe("https://example.test/api/copilotkit");

    const startedAt = new Date("2026-03-01T00:00:00.000Z");
    const marker = writeLearningSetupMarker({
      runtimeUrl: "/api/copilotkit/?secret=hidden",
      agentId: "support",
      now: startedAt,
    });
    expect(marker.runtimeUrl).not.toContain("secret");
    expect(
      learningSetupMarkerMatches(marker, "/api/copilotkit", "support"),
    ).toBe(true);
    expect(learningSetupMarkerMatches(marker, "/api/copilotkit", "other")).toBe(
      false,
    );
    expect(
      readLearningSetupMarker(
        startedAt.getTime() + LEARNING_SETUP_MAX_AGE_MS + 1,
      ),
    ).toBeNull();
  });

  it("retains a page-local marker when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const marker = writeLearningSetupMarker({
      runtimeUrl: "https://runtime.example/api/copilotkit",
      agentId: null,
    });

    expect(readLearningSetupMarker()).toEqual(marker);
    clearLearningSetupMarker();
    expect(readLearningSetupMarker()).toBeNull();
    expect(localStorage.getItem(LEARNING_SETUP_STORAGE_KEY)).toBeNull();
  });
});
