import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

const users = collect({
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

describe("collection transformations", () => {
    test("map, filter, reject and pluck stay chainable", () => {
        expect(
            users
                .filter((user) => user.enabled)
                .sortByDesc("profile.score")
                .pluck("profile.email")
                .items(),
        ).toEqual(["ada@example.com", "linus@example.com"])

        expect(users.reject((user) => user.enabled).keys()).toEqual(["grace"])
    })

    test("groupBy, keyBy and countBy preserve useful keys", () => {
        expect(users.groupBy("role").get("member")?.keys()).toEqual(["grace", "linus"])
        expect(users.keyBy("profile.email").get("ada@example.com")?.profile.score).toBe(90)
        expect(users.countBy("role").get("member")).toBe(2)
    })

    test("flatMap, flatten and collapse flatten iterable values", () => {
        expect(collect([[1, 2], [3]]).collapse().items()).toEqual([1, 2, 3])

        expect(
            collect([1, 2])
                .flatMap((value) => [value, value * 10])
                .items(),
        ).toEqual([1, 10, 2, 20])

        expect(collect([[[1]], [[2, 3]]]).flatten().items()).toEqual([1, 2, 3])
    })

    test("where helpers support nested paths", () => {
        expect(users.where("role", "member").keys()).toEqual(["grace", "linus"])
        expect(users.whereIn("profile.score", [75, 90]).keys()).toEqual(["ada", "grace"])
    })
})
