import { afterEach, describe, expect, it } from "vitest";

import {
  controlTowerAssistLlmCapable,
  savedReportAssistHints,
  savedWorkbenchFilterAssistHints,
} from "./assist-llm";

describe("controlTowerAssistLlmCapable", () => {
  const openai = process.env.OPENAI_API_KEY;
  const assist = process.env.CONTROL_TOWER_ASSIST_LLM;

  afterEach(() => {
    if (openai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = openai;
    if (assist === undefined) delete process.env.CONTROL_TOWER_ASSIST_LLM;
    else process.env.CONTROL_TOWER_ASSIST_LLM = assist;
  });

  it("is false without OpenAI API key", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.CONTROL_TOWER_ASSIST_LLM = "1";
    expect(controlTowerAssistLlmCapable()).toBe(false);
  });

  it("is false when assist LLM flag is off", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.CONTROL_TOWER_ASSIST_LLM = "0";
    expect(controlTowerAssistLlmCapable()).toBe(false);
  });

  it("is true when API key and assist flag are enabled", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.CONTROL_TOWER_ASSIST_LLM = "true";
    expect(controlTowerAssistLlmCapable()).toBe(true);
  });
});

describe("savedWorkbenchFilterAssistHints", () => {
  const brief = [{ name: "Hot lanes" }, { name: "Cold storage queue" }];

  it("returns empty when query has structured assist tokens", () => {
    expect(savedWorkbenchFilterAssistHints("lane:CNSHA", brief)).toEqual([]);
  });

  it("returns empty for short query or empty brief list", () => {
    expect(savedWorkbenchFilterAssistHints("x", brief)).toEqual([]);
    expect(savedWorkbenchFilterAssistHints("hot", [])).toEqual([]);
  });

  it("nudges toward workbench when a single saved view matches", () => {
    const hints = savedWorkbenchFilterAssistHints("hot lane", brief);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain("Hot lanes");
    expect(hints[0]).toContain("Workbench");
  });

  it("lists multiple matches when ambiguous", () => {
    const hints = savedWorkbenchFilterAssistHints("queue", [{ name: "A queue" }, { name: "B queue" }]);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain("Several");
  });
});

describe("savedReportAssistHints", () => {
  const brief = [
    { name: "Weekly OTIF", shared: false, mine: true },
    { name: "Monthly volume", shared: true, mine: false },
  ];

  it("returns empty when structured tokens present", () => {
    expect(savedReportAssistHints("status:BOOKED", brief)).toEqual([]);
  });

  it("hints at Reports when one saved report matches", () => {
    const hints = savedReportAssistHints("weekly otif", brief);
    expect(hints[0]).toContain("Weekly OTIF");
    expect(hints[0]).toContain("Reports");
  });
});
