import { beforeEach, describe, expect, it } from "vitest";
import { clearIdeCache, detectInstalledIdes, setDetectedIdes } from "./detection.js";

describe("ide-detection", () => {
    beforeEach(() => {
        clearIdeCache();
    });

    describe("setDetectedIdes", () => {
        it("overrides IDE detection", async () => {
            setDetectedIdes(["vscode", "cursor"]);

            const ides = await detectInstalledIdes();

            expect(ides).toEqual(["vscode", "cursor"]);
        });

        it("returns empty array when no IDEs set", async () => {
            setDetectedIdes([]);

            const ides = await detectInstalledIdes();

            expect(ides).toEqual([]);
        });

        it("caches detection results on second call", async () => {
            setDetectedIdes(["vscode"]);

            const ides1 = await detectInstalledIdes();
            const ides2 = await detectInstalledIdes();

            expect(ides1).toEqual(ides2);
            expect(ides1).toEqual(["vscode"]);
        });

        it("creates a copy of the provided array", async () => {
            const original = ["vscode", "cursor"];
            setDetectedIdes(original);

            original.push("zed");

            const ides = await detectInstalledIdes();
            expect(ides).toEqual(["vscode", "cursor"]);
        });
    });

    describe("clearIdeCache", () => {
        it("clears cached detection results", async () => {
            setDetectedIdes(["vscode"]);
            await detectInstalledIdes();

            clearIdeCache();
            setDetectedIdes(["jetbrains"]);

            const ides = await detectInstalledIdes();

            expect(ides).toEqual(["jetbrains"]);
        });
    });

    describe("detectInstalledIdes", () => {
        it("detects IDEs based on system state", async () => {
            // Without setDetectedIdes, runs actual system detection
            // This test verifies the function runs without errors
            // and returns an array of strings
            const ides = await detectInstalledIdes();

            expect(Array.isArray(ides)).toBe(true);
            for (const ide of ides) {
                expect(typeof ide).toBe("string");
            }
        });
    });
});
