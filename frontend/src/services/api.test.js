import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: { request: { use: vi.fn() } },
};

vi.mock("axios", () => {
  return {
    __esModule: true,
    default: {
      create: vi.fn(() => mockClient),
    },
  };
});

let login;
let getPlants;

beforeAll(async () => {
  ({ login, getPlants } = await import("./api"));
});

describe("api service", () => {
  beforeEach(() => {
    mockClient.get.mockReset();
    mockClient.post.mockReset();
    mockClient.put.mockReset();
    mockClient.delete.mockReset();
  });

  it("sends credentials to /auth/login", async () => {
    mockClient.post.mockResolvedValue({
      data: {
        success: true,
        token: "abc",
        user: { username: "admin", role: "admin" },
      },
    });
    const res = await login("admin", "secret");
    expect(mockClient.post).toHaveBeenCalledWith("/auth/login", {
      username: "admin",
      password: "secret",
    });
    expect(res.success).toBe(true);
  });

  it("fetches plants with includeLatest flag", async () => {
    mockClient.get.mockResolvedValue({ data: { success: true, data: [] } });
    const res = await getPlants({ includeLatest: true });
    expect(mockClient.get).toHaveBeenCalledWith("/plants", {
      params: { includeLatest: true },
    });
    expect(res.data).toEqual([]);
  });
});
