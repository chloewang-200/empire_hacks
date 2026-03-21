import { mockAgents } from "./mockData";
import type { Agent, AgentValidationResult, PaginatedList } from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let agents = clone(mockAgents);

export const agentService = {
  async connectAgent(
    input: Omit<Agent, "agentId" | "apiKeyId" | "apiKeyPrefix" | "createdAt" | "updatedAt"> & {
      apiKey?: string;
    }
  ): Promise<Agent> {
    await wait();
    const now = new Date().toISOString();
    const agent: Agent = {
      ...input,
      agentId: `agt_${Date.now()}`,
      apiKeyId: `key_${Date.now()}`,
      apiKeyPrefix: input.apiKey ? input.apiKey.slice(0, 8) : "cust_new_",
      createdAt: now,
      updatedAt: now,
    };
    agents.push(agent);
    return clone(agent);
  },

  async listAgents(filters: {
    clientId: string;
    agentStatus?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedList<Agent>> {
    await wait();
    let items = agents.filter((agent) => agent.clientId === filters.clientId);
    if (filters.agentStatus) {
      items = items.filter((agent) => agent.agentStatus === filters.agentStatus);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter((agent) => agent.agentName.toLowerCase().includes(search));
    }
    return {
      items: clone(items.slice(0, filters.limit ?? items.length)),
      nextCursor: null,
    };
  },

  async getAgent(agentId: string): Promise<Agent> {
    await wait();
    const agent = agents.find((item) => item.agentId === agentId);
    if (!agent) throw new Error("Agent not found");
    return clone(agent);
  },

  async updateAgent(
    agentId: string,
    patch: Partial<Omit<Agent, "agentId" | "clientId" | "createdAt" | "updatedAt">>
  ): Promise<Agent> {
    await wait();
    const agent = agents.find((item) => item.agentId === agentId);
    if (!agent) throw new Error("Agent not found");
    Object.assign(agent, patch, { updatedAt: new Date().toISOString() });
    return clone(agent);
  },

  async deleteAgent(agentId: string): Promise<{ success: boolean }> {
    await wait();
    const agent = agents.find((item) => item.agentId === agentId);
    if (!agent) throw new Error("Agent not found");
    agent.agentStatus = "revoked";
    agent.updatedAt = new Date().toISOString();
    return { success: true };
  },

  async validateAgent(agentId: string): Promise<AgentValidationResult> {
    const agent = await this.getAgent(agentId);
    const checks = {
      isActive: agent.agentStatus === "active",
      hasApiKey: Boolean(agent.apiKeyId),
      hasValidAllowance: agent.monthlyAllowance > 0,
      hasValidApprovalThreshold: agent.approvalThreshold >= 0,
      hasValidMaxTransaction: agent.maxTransactionAmount > 0,
      hasNoAllowDenyConflict: agent.vendorAllowlist.every(
        (vendorId) => !agent.vendorDenylist.includes(vendorId)
      ),
    };
    const issues = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => key);
    return {
      agentId,
      valid: issues.length === 0,
      checks,
      issues,
    };
  },

  async pauseAgent(agentId: string): Promise<Agent> {
    return this.updateAgent(agentId, { agentStatus: "paused" });
  },

  async resumeAgent(agentId: string): Promise<Agent> {
    return this.updateAgent(agentId, { agentStatus: "active" });
  },
};
