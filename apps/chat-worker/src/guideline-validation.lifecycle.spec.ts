import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeGuidelineValidation } from "./guideline-validation.lifecycle.ts";

describe("guideline validation lifecycle", () => {
  it("does not call a provider when the pending claim loses", async () => {
    let providerCalls = 0;
    let published = 0;

    await executeGuidelineValidation(
      {
        guidelineVersion: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => null,
        },
        $transaction: async () => {
          throw new Error("transaction must not run");
        },
      },
      { companyId: "company-1", versionId: "version-4" },
      async () => {
        providerCalls += 1;
        return { status: "valid" };
      },
      async () => {
        published += 1;
      },
    );

    assert.equal(providerCalls, 0);
    assert.equal(published, 0);
  });

  it("does not activate when the claimed version no longer owns processing", async () => {
    let companyUpdates = 0;
    const statuses: string[] = [];

    await executeGuidelineValidation(
      {
        guidelineVersion: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "version-4",
            companyId: "company-1",
            version: 4,
            content: "policy",
            status: "processing",
          }),
        },
        $transaction: async (callback) =>
          callback({
            guidelineVersion: {
              updateMany: async () => ({ count: 0 }),
              findFirst: async () => null,
            },
            company: {
              update: async () => {
                companyUpdates += 1;
              },
            },
          }),
      },
      { companyId: "company-1", versionId: "version-4" },
      async () => ({ status: "valid" }),
      async (event) => {
        statuses.push(event.status);
      },
    );

    assert.equal(companyUpdates, 0);
    assert.deepEqual(statuses, ["processing"]);
  });

  it("activates the newest valid version and publishes the terminal event", async () => {
    const statuses: string[] = [];
    let activatedId: string | null = null;

    await executeGuidelineValidation(
      {
        guidelineVersion: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "version-4",
            companyId: "company-1",
            version: 4,
            content: "new policy",
            status: "processing",
          }),
        },
        $transaction: async (callback) =>
          callback({
            guidelineVersion: {
              updateMany: async () => ({ count: 1 }),
              findFirst: async () => ({
                id: "version-4",
                version: 4,
                content: "new policy",
                fileName: "guidelines.txt",
              }),
            },
            company: {
              update: async ({ data }) => {
                activatedId = data.currentGuidelineVersionId;
              },
            },
          }),
      },
      { companyId: "company-1", versionId: "version-4" },
      async () => ({ status: "valid", reason: "safe" }),
      async (event) => {
        statuses.push(event.status);
      },
    );

    assert.equal(activatedId, "version-4");
    assert.deepEqual(statuses, ["processing", "valid"]);
  });
});
