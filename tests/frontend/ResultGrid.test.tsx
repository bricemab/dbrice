import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultGrid } from "@/components/editor/ResultGrid";
import type { QueryResult } from "@/types/mysql";

vi.mock("@/lib/tauri");

const makeResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  columns: [
    { name: "id", type_name: "INT", nullable: false, is_primary_key: true },
    { name: "name", type_name: "VARCHAR", nullable: false, is_primary_key: false },
    { name: "email", type_name: "VARCHAR", nullable: true, is_primary_key: false },
  ],
  rows: [
    ["1", "Alice", "alice@example.com"],
    ["2", "Bob", "bob@example.com"],
    ["3", "Charlie", null],
  ],
  rows_affected: 0,
  last_insert_id: 0,
  execution_time_ms: 12,
  query_type: "select" as const,
  ...overrides,
});

describe("ResultGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders column headers", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("displays NULL values as italic gray NULL", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    const nullCell = screen.getByText("NULL");
    expect(nullCell).toBeInTheDocument();
    expect(nullCell).toHaveClass("italic");
  });

  it("shows row count in results", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    expect(screen.getByText(/3 rows/i)).toBeInTheDocument();
  });

  it("renders export buttons (CSV and JSON)", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    expect(screen.getByRole("button", { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /json/i })).toBeInTheDocument();
  });

  it("renders filter inputs for each column", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    const filterInputs = screen.getAllByRole("textbox");
    // Should have at least 3 filter inputs (one per column)
    expect(filterInputs.length).toBeGreaterThanOrEqual(3);
  });

  it("filters rows when typing in column filter", async () => {
    const user = userEvent.setup();
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);

    // Get filter inputs - they're in the header row
    const filterInputs = screen.getAllByRole("textbox");
    // Filter by name column (index 1)
    await user.type(filterInputs[1], "Alice");

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    });
  });

  it("sorts rows ASC when clicking a column header", async () => {
    const user = userEvent.setup();
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);

    await user.click(screen.getByText("name"));

    // After sorting ASC, Alice should come before Bob
    const cells = screen.getAllByText(/Alice|Bob|Charlie/);
    const names = cells.map((c) => c.textContent);
    expect(names.indexOf("Alice")).toBeLessThan(names.indexOf("Bob"));
  });

  it("sorts rows DESC when clicking a column header twice", async () => {
    const user = userEvent.setup();
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);

    await user.click(screen.getByText("name"));
    await user.click(screen.getByText("name"));

    const cells = screen.getAllByText(/Alice|Bob|Charlie/);
    const names = cells.map((c) => c.textContent);
    expect(names.indexOf("Charlie")).toBeLessThan(names.indexOf("Alice"));
  });

  it("renders empty state when no rows", () => {
    render(
      <ResultGrid
        result={makeResult({ rows: [], rows_affected: 0 })}
        connectionId="conn-1"
      />
    );
    expect(screen.getByText(/0 rows/i)).toBeInTheDocument();
  });

  it("shows execution time", () => {
    render(<ResultGrid result={makeResult()} connectionId="conn-1" />);
    expect(screen.getByText(/12\s*ms/i)).toBeInTheDocument();
  });

  it("allows inline cell editing with double-click", async () => {
    const user = userEvent.setup();
    render(
      <ResultGrid
        result={makeResult()}
        connectionId="conn-1"
        tableName="users"
        primaryKeys={["id"]}
      />
    );

    const aliceCell = screen.getByText("Alice");
    await user.dblClick(aliceCell);

    await waitFor(() => {
      const input = screen.getByDisplayValue("Alice");
      expect(input).toBeInTheDocument();
    });
  });

  it("shows rows_affected for non-SELECT queries", () => {
    render(
      <ResultGrid
        result={makeResult({
          columns: [],
          rows: [],
          rows_affected: 5,
          last_insert_id: 0,
          query_type: "update" as const,
        })}
        connectionId="conn-1"
      />
    );
    expect(screen.getByText(/5\s*rows? affected/i)).toBeInTheDocument();
  });

  it("paginates when row count exceeds PAGE_SIZE", () => {
    const manyRows = Array.from({ length: 1500 }, (_, i) => [
      String(i + 1),
      `User ${i + 1}`,
      `user${i + 1}@example.com`,
    ]);
    render(
      <ResultGrid
        result={makeResult({ rows: manyRows })}
        connectionId="conn-1"
      />
    );
    // Should show pagination controls
    expect(screen.getByText(/page/i)).toBeInTheDocument();
  });
});
