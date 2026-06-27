import { vi } from "vitest";

const MockRpcClient = vi.fn(function MockRpcClient() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    subscribeVirtualChainChanged: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
});

vi.mock("kaspa-wasm", () => ({
  RpcClient: MockRpcClient,
  initConsolePanicHook: vi.fn(),
  default: vi.fn(),
}));

vi.mock("cipher", () => ({
  default: vi.fn(),
}));
