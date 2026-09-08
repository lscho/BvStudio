import assert from "node:assert/strict";
import test from "node:test";
import { clearNamespace } from "./clear-kv.mjs";

test("deletes all keys page by page until listing is empty", async () => {
  // 首页始终从第 1 页取：删除后剩余键自然前移
  const remaining = ["card:a", "device:b", "card:c", "fail:d"];
  const deleted = [];
  const { deleted: count, failures } = await clearNamespace({
    namespace: "bv_studio",
    listKeys: async () => remaining.splice(0, 2),
    deleteKey: async (_ns, key) => {
      deleted.push(key);
    }
  });

  assert.equal(count, 4);
  assert.equal(failures.length, 0);
  assert.deepEqual(deleted, ["card:a", "device:b", "card:c", "fail:d"]);
});

test("terminates when the namespace is empty", async () => {
  let listCalls = 0;
  const { deleted, failures } = await clearNamespace({
    namespace: "ns",
    listKeys: async () => {
      listCalls += 1;
      return [];
    },
    deleteKey: async () => {
      throw new Error("should not be called");
    }
  });

  assert.equal(listCalls, 1);
  assert.equal(deleted, 0);
  assert.equal(failures.length, 0);
});

test("collects delete failures and keeps draining the rest", async () => {
  const queue = ["a", "b", "c"];
  const failures = [];
  let deletedCount = 0;
  const result = await clearNamespace({
    namespace: "ns",
    listKeys: async () => queue.splice(0),
    deleteKey: async (_ns, key) => {
      if (key === "b") {
        failures.push({ key, error: "boom" });
        throw new Error("boom");
      }
      deletedCount += 1;
    }
  });

  // 失败键仍在清单里，下一轮列表只剩它，再次删除仍失败后列表耗尽
  assert.equal(deletedCount, 2);
  assert.equal(result.deleted, 2);
  assert.equal(result.failures.length, 1);
});
