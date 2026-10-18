import { describe, expect, it } from "vitest";

import { SerializedOperationQueue } from "../../src/background/serialized-operation-queue";

describe("SerializedOperationQueue", () => {
  it("does not start a later operation until the preceding operation settles", async () => {
    const queue = new SerializedOperationQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run(async () => {
      events.push("first-start");
      await firstGate;
      events.push("first-end");
    });
    const second = queue.run(async () => {
      events.push("second-start");
    });

    await Promise.resolve();
    expect(events).toEqual(["first-start"]);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("continues with the next operation after a failure", async () => {
    const queue = new SerializedOperationQueue();
    await expect(queue.run(async () => Promise.reject(new Error("expected")))).rejects.toThrow("expected");
    await expect(queue.run(async () => "next")).resolves.toBe("next");
  });
});
