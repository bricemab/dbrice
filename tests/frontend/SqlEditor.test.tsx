import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqlSheet } from "@/components/editor/SqlSheet";
import { useSessionStore } from "@/stores/useSessionStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import * as tauriLib from "@/lib/tauri";

vi.mock("@/stores/useSessionStore");
vi.mock("@/stores/useSettingsStore");
vi.mock("@/lib/tauri");

// CodeMirror doesn't work well in jsdom, so we mock it
vi.mock("@/components/editor/SqlEditor", () => ({
  SqlEditor: ({
    value,
    onChange,
    onExecute,
  }: {
    value: string;
    onChange: (v: string) => void;
    onExecute: (sql: string) => void;
  }) => (
    <textarea
      data-testid="sql-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.ctrlKey && e.key === "Enter") {
          onExecute(value);
        }
      }}
    />
  ),
}));

const mockSession = {
  connectionId: "conn-1",
  activeDatabase: "mydb",
  isConnected: true,
  isConnecting: false,
};

function setupStores() {
  vi.mocked(useSessionStore).mockReturnValue({
    sessions: new Map([["conn-1", mockSession]]),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setActiveDatabase: vi.fn(),
    setConnectionLost: vi.fn(),
    getSession: vi.fn().mockReturnValue(mockSession),
    isConnected: vi.fn().mockReturnValue(true),
  } as ReturnType<typeof useSessionStore>);

  vi.mocked(useSettingsStore).mockReturnValue({
    theme: "dark",
    defaultLimit: 1000,
    setTheme: vi.fn(),
    setDefaultLimit: vi.fn(),
  } as ReturnType<typeof useSettingsStore>);
}

describe("SqlSheet / SqlEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStores();
  });

  it("renders the SQL editor area", () => {
    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    expect(screen.getByTestId("sql-editor")).toBeInTheDocument();
  });

  it("renders the Execute button", () => {
    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    expect(screen.getByRole("button", { name: /execute/i })).toBeInTheDocument();
  });

  it("renders the Format button", () => {
    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    expect(screen.getByRole("button", { name: /format/i })).toBeInTheDocument();
  });

  it("renders the LIMIT selector", () => {
    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    expect(screen.getByText(/limit/i)).toBeInTheDocument();
  });

  it("executes query when Execute button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriExecuteQuery).mockResolvedValue({
      columns: [{ name: "1", type_name: "BIGINT", nullable: false, is_primary_key: false }],
      rows: [["1"]],
      rows_affected: 0,
      last_insert_id: 0,
      execution_time_ms: 5,
      query_type: "select" as const,
    });

    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);

    const editor = screen.getByTestId("sql-editor");
    await user.clear(editor);
    await user.type(editor, "SELECT 1");

    await user.click(screen.getByRole("button", { name: /execute/i }));

    await waitFor(() => {
      expect(tauriLib.tauriExecuteQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: "conn-1",
          sql: expect.stringContaining("SELECT 1"),
        })
      );
    });
  });

  it("displays query result after execution", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriExecuteQuery).mockResolvedValue({
      columns: [{ name: "result", type_name: "INT", nullable: false, is_primary_key: false }],
      rows: [["42"]],
      rows_affected: 0,
      last_insert_id: 0,
      execution_time_ms: 3,
      query_type: "select" as const,
    });

    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);

    const editor = screen.getByTestId("sql-editor");
    await user.type(editor, "SELECT 42 as result");
    await user.click(screen.getByRole("button", { name: /execute/i }));

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("result")).toBeInTheDocument();
    });
  });

  it("shows inline error banner when query fails", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriExecuteQuery).mockRejectedValue(
      new Error("You have an error in your SQL syntax")
    );

    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);

    const editor = screen.getByTestId("sql-editor");
    await user.type(editor, "SELEKT 1");
    await user.click(screen.getByRole("button", { name: /execute/i }));

    await waitFor(() => {
      expect(screen.getByText(/sql syntax/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while executing", async () => {
    const user = userEvent.setup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveQuery: (v: any) => void;
    vi.mocked(tauriLib.tauriExecuteQuery).mockReturnValue(
      new Promise((res) => { resolveQuery = res; })
    );

    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    const editor = screen.getByTestId("sql-editor");
    await user.type(editor, "SELECT SLEEP(1)");
    await user.click(screen.getByRole("button", { name: /execute/i }));

    await waitFor(() => {
      expect(screen.getByText(/executing/i)).toBeInTheDocument();
    });

    resolveQuery!({
      columns: [],
      rows: [],
      rows_affected: 0,
      last_insert_id: 0,
      execution_time_ms: 1000,
      query_type: "select" as const,
    });
  });

  it("executes query with Ctrl+Enter keyboard shortcut", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriExecuteQuery).mockResolvedValue({
      columns: [],
      rows: [],
      rows_affected: 0,
      last_insert_id: 0,
      execution_time_ms: 1,
      query_type: "select" as const,
    });

    render(<SqlSheet connectionId="conn-1" tabId="tab-1" />);
    const editor = screen.getByTestId("sql-editor");
    await user.type(editor, "SELECT 1");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(tauriLib.tauriExecuteQuery).toHaveBeenCalled();
    });
  });
});
