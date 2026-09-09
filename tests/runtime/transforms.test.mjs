import assert from "node:assert/strict"
import test from "node:test"

import { collect, createCollection } from "../../dist/index.js"

const users = createCollection({
    ada: {
        profile: { email: "ada@example.com", score: 90 },
        role: "admin",
        enabled: true,
    },
    grace: {
        profile: { email: "grace@example.com", score: 75 },
        role: "member",
        enabled: false,
    },
    linus: {
        profile: { email: "linus@example.com", score: 82 },
        role: "member",
        enabled: true,
    },
})

test("map, filter, reject and pluck stay chainable", () => {
    assert.deepEqual(
        users
            .filter((user) => user.enabled)
            .sortByDesc("profile.score")
            .pluck("profile.email")
            .items(),
        ["ada@example.com", "linus@example.com"],
    )

    assert.deepEqual(users.reject((user) => user.enabled).keys(), ["grace"])
})

test("groupBy, keyBy and countBy preserve useful keys", () => {
    assert.deepEqual(users.groupBy("role").get("member")?.keys(), ["grace", "linus"])
    assert.equal(users.keyBy("profile.email").get("ada@example.com")?.id, "ada")
    assert.equal(users.countBy("role").get("member"), 2)
})

test("flatMap, flatten and collapse flatten iterable values", () => {
    assert.deepEqual(
        collect([[1, 2], [3]])
            .collapse()
            .items(),
        [1, 2, 3],
    )

    assert.deepEqual(
        collect([1, 2])
            .flatMap((value) => [value, value * 10])
            .items(),
        [1, 10, 2, 20],
    )

    assert.deepEqual(
        collect([[[1]], [[2, 3]]]).flatten().items(),
        [1, 2, 3],
    )
})

test("where helpers support nested paths", () => {
    assert.deepEqual(users.where("role", "member").keys(), ["grace", "linus"])
    assert.deepEqual(users.whereIn("profile.score", [75, 90]).keys(), ["ada", "grace"])
})
