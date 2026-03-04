import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/stores/useAuthStore";

// Mock the auth store
vi.mock("@/stores/useAuthStore");

const mockLogin = vi.fn();
const mockReset = vi.fn();

function setupAuthStore(overrides: Partial<ReturnType<typeof useAuthStore>> = {}) {
  vi.mocked(useAuthStore).mockReturnValue({
    isAuthenticated: false,
    isFirstLaunch: false,
    isLoading: false,
    error: null,
    initialize: vi.fn(),
    login: mockLogin,
    setupPassword: vi.fn(),
    logout: vi.fn(),
    reset: mockReset,
    ...overrides,
  } as ReturnType<typeof useAuthStore>);
}

describe("AuthFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthStore();
  });

  it("renders the login screen on launch", () => {
    render(<LoginPage />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Master password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
  });

  it("displays the password input field", () => {
    render(<LoginPage />);
    const input = screen.getByPlaceholderText("Master password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows inline error message on wrong password", async () => {
    setupAuthStore({ error: "Invalid master password" });
    render(<LoginPage />);
    expect(screen.getByText("Invalid master password")).toBeInTheDocument();
    // Error is inline, not a popup
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not show error when error is null", () => {
    setupAuthStore({ error: null });
    render(<LoginPage />);
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it("calls login with entered password on submit", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    const input = screen.getByPlaceholderText("Master password");
    await user.type(input, "mysecretpassword");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(mockLogin).toHaveBeenCalledWith("mysecretpassword");
  });

  it("unlock button is disabled when password field is empty", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /unlock/i })).toBeDisabled();
  });

  it("unlock button becomes enabled when password is typed", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const btn = screen.getByRole("button", { name: /unlock/i });
    expect(btn).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Master password"), "abc");
    expect(btn).not.toBeDisabled();
  });

  it("shows 'Forgot password? Reset DBrice' link", () => {
    render(<LoginPage />);
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it("shows confirmation modal when Reset DBrice link is clicked", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText(/forgot password/i));

    await waitFor(() => {
      expect(screen.getByText("Reset DBrice")).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
    });
  });

  it("calls reset when confirm button is clicked in modal", async () => {
    const user = userEvent.setup();
    mockReset.mockResolvedValue(undefined);
    render(<LoginPage />);

    await user.click(screen.getByText(/forgot password/i));

    await waitFor(() => {
      expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /reset everything/i });
    await user.click(confirmBtn);

    expect(mockReset).toHaveBeenCalled();
  });

  it("does not call login when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const form = screen.getByPlaceholderText("Master password").closest("form");
    if (form) fireEvent.submit(form);

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("shows loading state while unlocking", async () => {
    const user = userEvent.setup();
    let resolveLogin: () => void;
    mockLogin.mockReturnValue(new Promise<void>((res) => { resolveLogin = res; }));

    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("Master password"), "password");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/unlocking/i)).toBeInTheDocument();
    });

    resolveLogin!();
  });

  it("can toggle password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const input = screen.getByPlaceholderText("Master password");
    expect(input).toHaveAttribute("type", "password");

    // Click the show/hide toggle button (the eye icon button)
    const toggleBtn = input.parentElement!.querySelector("button");
    await user.click(toggleBtn!);

    expect(input).toHaveAttribute("type", "text");
  });
});
