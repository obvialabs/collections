import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

describe("object-source collection behavior", () => {
    test("object sources use the same Collection API as every other source", () => {
        const providers = collect({
            google: { label: "Google", enabled: true },
            github: { label: "GitHub", enabled: false },
        })

        expect(providers.get("google")?.label).toBe("Google")
        expect(providers.filter((provider) => provider.enabled).keys()).toEqual(["google"])
        expect(providers.map((provider) => provider.label).entries()).toEqual([
            ["google", "Google"],
            ["github", "GitHub"],
        ])
    })

    test("object-style access is explicit through toObject()", () => {
        const providers = collect({
            google: { label: "Google" },
            github: { label: "GitHub" },
        })

        expect(Object.prototype.hasOwnProperty.call(providers, "google")).toBe(false)

        const object = providers.toObject()
        expect(object.google.label).toBe("Google")
        expect(object.github.label).toBe("GitHub")
    })

    test("collection method names never collide with object keys", () => {
        const definitions = collect({
            map: { label: "Map" },
            filter: { label: "Filter" },
            count: { label: "Count" },
        })

        expect(typeof definitions.map).toBe("function")
        expect(typeof definitions.filter).toBe("function")
        expect(typeof definitions.count).toBe("function")
        expect(definitions.get("map")?.label).toBe("Map")
        expect(definitions.toObject().filter.label).toBe("Filter")
    })
})
