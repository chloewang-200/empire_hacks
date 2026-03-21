export type WorkspaceFundingPreference =
  | "BOTH"
  | "BALANCE_FIRST"
  | "CARD_AT_SPEND";

export type WorkspaceSpendMode = "STRIPE_TEST" | "MANUAL_REAL";

export interface Workspace {
  fundingPreference: WorkspaceFundingPreference;
  spendMode: WorkspaceSpendMode;
}

let workspaceState: Workspace = {
  fundingPreference: "BOTH",
  spendMode: "STRIPE_TEST",
};

const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getWorkspace(): Promise<Workspace> {
  await wait();
  return { ...workspaceState };
}

export async function patchWorkspace(
  patch: Partial<Workspace>
): Promise<Workspace> {
  await wait();
  workspaceState = {
    ...workspaceState,
    ...patch,
  };
  return { ...workspaceState };
}
