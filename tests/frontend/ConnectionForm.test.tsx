import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionFormModal } from "@/components/connections/ConnectionFormModal";
import { useConnectionStore } from "@/stores/useConnectionStore";
import * as tauriLib from "@/lib/tauri";

vi.mock("@/stores/useConnectionStore");
vi.mock("@/lib/tauri");

const mockCreateConnection = vi.fn();
const mockUpdateConnection = vi.fn();

function setupConnectionStore() {
  vi.mocked(useConnectionStore).mockReturnValue({
    folders: [],
    connections: [],
    filteredConnections: [],
    searchQuery: "",
    expandedFolders: new Set(),
    createConnection: mockCreateConnection,
    updateConnection: mockUpdateConnection,
    deleteConnection: vi.fn(),
    duplicateConnection: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveToFolder: vi.fn(),
    reorderConnections: vi.fn(),
    setSearchQuery: vi.fn(),
    toggleFolder: vi.fn(),
    loadConnections: vi.fn(),
  } as ReturnType<typeof useConnectionStore>);
}

describe("ConnectionFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupConnectionStore();
  });

  it("renders the New Connection modal when open", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText("New Connection")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ConnectionFormModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("New Connection")).not.toBeInTheDocument();
  });

  it("has a Connection Name input field", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("Production DB")).toBeInTheDocument();
  });

  it("Save button is disabled when connection name is empty", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("Save button becomes enabled after entering a name", async () => {
    const user = userEvent.setup();
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Production DB"), "My Connection");
    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });

  it("has MySQL tab with hostname and port fields", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("db.example.com")).toBeInTheDocument();
  });

  it("has default port 3306", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    const portInput = screen.getByDisplayValue("3306");
    expect(portInput).toBeInTheDocument();
  });

  it("has a Test Connection button", () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /test connection/i })).toBeInTheDocument();
  });

  it("shows SSH tab when method is TCP/IP over SSH", async () => {
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);

    // Radix Select: click the combobox trigger (not the inner span which has pointer-events:none)
    const methodTrigger = screen.getByText("Standard (TCP/IP)").closest('[role="combobox"]') as HTMLElement;
    fireEvent.click(methodTrigger);

    const sshOption = await screen.findByText("Standard TCP/IP over SSH");
    fireEvent.click(sshOption);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /ssh/i })).toBeInTheDocument();
    });
  });

  it("calls createConnection on Save with entered name", async () => {
    const user = userEvent.setup();
    mockCreateConnection.mockResolvedValue(undefined);
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Production DB"), "Test DB");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test DB" })
      );
    });
  });

  it("calls onClose after successful save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateConnection.mockResolvedValue(undefined);
    render(<ConnectionFormModal open={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("Production DB"), "Test DB");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConnectionFormModal open={true} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows test connection success status after successful test", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriTestConnection).mockResolvedValue(undefined);
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
    });
  });

  it("shows test connection error status on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriLib.tauriTestConnection).mockRejectedValue(new Error("Connection refused"));
    render(<ConnectionFormModal open={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
    });
  });

  it("renders in Edit mode with existing connection name", () => {
    const editConnection = {
      id: "conn-1",
      name: "Existing Connection",
      color: "#ff0000",
      folder_id: undefined,
      method: "tcp_ip" as const,
      mysql: { hostname: "db.example.com", port: 3306, username: "admin", default_schema: "" },
      ssh: undefined,
      created_at: "",
      updated_at: "",
      last_connected_at: undefined,
      sort_order: 0,
    };
    render(<ConnectionFormModal open={true} onClose={vi.fn()} editConnection={editConnection} />);

    expect(screen.getByText("Edit Connection")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Connection")).toBeInTheDocument();
  });

  it("calls updateConnection when saving an edited connection", async () => {
    const user = userEvent.setup();
    mockUpdateConnection.mockResolvedValue(undefined);
    const editConnection = {
      id: "conn-1",
      name: "Old Name",
      color: "#ff0000",
      folder_id: undefined,
      method: "tcp_ip" as const,
      mysql: { hostname: "db.example.com", port: 3306, username: "admin", default_schema: "" },
      ssh: undefined,
      created_at: "",
      updated_at: "",
      last_connected_at: undefined,
      sort_order: 0,
    };
    render(
      <ConnectionFormModal open={true} onClose={vi.fn()} editConnection={editConnection} />
    );

    const nameInput = screen.getByDisplayValue("Old Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateConnection).toHaveBeenCalledWith(
        "conn-1",
        expect.objectContaining({ name: "New Name" })
      );
    });
  });
});
