import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView (used by Radix UI Select)
window.HTMLElement.prototype.scrollIntoView = vi.fn();
// jsdom doesn't implement ResizeObserver (used by Radix UI popovers)
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
