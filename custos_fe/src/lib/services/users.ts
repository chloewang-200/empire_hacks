import { mockUsers } from "./mockData";
import type { PaginatedList, User } from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let users = clone(mockUsers);

export const userService = {
  async getCurrentUser(): Promise<User> {
    await wait();
    return clone(users[0]);
  },

  async updateCurrentUser(
    patch: Partial<Omit<User, "userId" | "clientId" | "email" | "role" | "status" | "createdAt" | "updatedAt">>
  ): Promise<User> {
    await wait();
    Object.assign(users[0], patch, { updatedAt: new Date().toISOString() });
    return clone(users[0]);
  },

  async listUsers(filters: {
    clientId: string;
    role?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedList<User>> {
    await wait();
    let items = users.filter((user) => user.clientId === filters.clientId);
    if (filters.role) items = items.filter((user) => user.role === filters.role);
    if (filters.status) items = items.filter((user) => user.status === filters.status);
    return {
      items: clone(items.slice(0, filters.limit ?? items.length)),
      nextCursor: null,
    };
  },

  async getUser(userId: string): Promise<User> {
    await wait();
    const user = users.find((item) => item.userId === userId);
    if (!user) throw new Error("User not found");
    return clone(user);
  },
};
