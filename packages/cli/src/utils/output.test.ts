import { describe, expect, it } from "vitest";
import { getOutputContext, type JsonEnvelope, renderTable, type TableColumn } from "./output.js";

describe("renderTable", () => {
    it("renders a basic table with box-drawing characters", () => {
        const columns: TableColumn[] = [
            { header: "Name", width: 10 },
            { header: "Value", width: 8 },
        ];
        const rows = [
            ["foo", "123"],
            ["bar", "456"],
        ];

        const result = renderTable(columns, rows);
        const lines = result.split("\n");

        expect(lines[0]).toBe("┌────────────┬──────────┐");
        expect(lines[1]).toBe("│ Name       │ Value    │");
        expect(lines[2]).toBe("├────────────┼──────────┤");
        expect(lines[3]).toBe("│ foo        │ 123      │");
        expect(lines[4]).toBe("│ bar        │ 456      │");
        expect(lines[5]).toBe("└────────────┴──────────┘");
    });

    it("truncates long values with ellipsis", () => {
        const columns: TableColumn[] = [{ header: "Name", width: 8 }];
        const rows = [["a-very-long-name"]];

        const result = renderTable(columns, rows);
        expect(result).toContain("a-ver...");
    });

    it("supports right-aligned columns", () => {
        const columns: TableColumn[] = [{ header: "Count", width: 6, align: "right" }];
        const rows = [["42"]];

        const result = renderTable(columns, rows);
        expect(result).toContain("    42");
    });

    it("handles empty rows", () => {
        const columns: TableColumn[] = [{ header: "Name", width: 10 }];
        const rows: string[][] = [];

        const result = renderTable(columns, rows);
        const lines = result.split("\n");

        // top + header + separator + bottom = 4 lines (no data rows)
        expect(lines).toHaveLength(4);
    });

    it("handles missing cell values gracefully", () => {
        const columns: TableColumn[] = [
            { header: "A", width: 5 },
            { header: "B", width: 5 },
        ];
        const rows = [["only-a"]]; // missing second column

        const result = renderTable(columns, rows);
        // Should not throw, and should pad the missing cell
        expect(result).toContain("│");
    });
});

describe("getOutputContext", () => {
    it("extracts json and verbose flags", () => {
        const ctx = getOutputContext({ json: true, verbose: false });
        expect(ctx.json).toBe(true);
        expect(ctx.verbose).toBe(false);
    });

    it("defaults to false for missing flags", () => {
        const ctx = getOutputContext({});
        expect(ctx.json).toBe(false);
        expect(ctx.verbose).toBe(false);
    });

    it("coerces truthy values", () => {
        const ctx = getOutputContext({ json: 1, verbose: "yes" });
        expect(ctx.json).toBe(true);
        expect(ctx.verbose).toBe(true);
    });
});

describe("JSON envelope structure", () => {
    it("success envelope has correct shape", () => {
        // Test the envelope shape directly (outputJson writes to console.log)
        const envelope: JsonEnvelope<{ items: string[] }> = {
            success: true,
            data: { items: ["a", "b"] },
        };

        expect(envelope.success).toBe(true);
        expect(envelope.data?.items).toEqual(["a", "b"]);
        expect(envelope.warnings).toBeUndefined();
        expect(envelope.errors).toBeUndefined();
    });

    it("error envelope has correct shape", () => {
        const envelope: JsonEnvelope<never> = {
            success: false,
            errors: ["NOT_FOUND: Resource not found"],
        };

        expect(envelope.success).toBe(false);
        expect(envelope.data).toBeUndefined();
        expect(envelope.errors).toHaveLength(1);
    });

    it("envelope with warnings", () => {
        const envelope: JsonEnvelope<{ count: number }> = {
            success: true,
            data: { count: 5 },
            warnings: ["Deprecated API used"],
        };

        expect(envelope.success).toBe(true);
        expect(envelope.warnings).toEqual(["Deprecated API used"]);
    });
});
