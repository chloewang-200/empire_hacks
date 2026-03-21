import { mockVendors } from "./mockData";
import type { PaginatedList, Vendor, VendorValidationResult } from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let vendors = clone(mockVendors);

export const vendorService = {
  async createVendor(
    input: Omit<Vendor, "vendorId" | "createdAt" | "updatedAt"> & {
      vendorId?: string;
    }
  ): Promise<Vendor> {
    await wait();
    const now = new Date().toISOString();
    const vendor: Vendor = {
      ...input,
      vendorId: input.vendorId ?? `vendor_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    vendors.push(vendor);
    return clone(vendor);
  },

  async listVendors(filters: {
    clientId: string;
    vendorStatus?: string;
    vendorCategory?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedList<Vendor>> {
    await wait();
    let items = vendors.filter((vendor) => vendor.clientId === filters.clientId);

    if (filters.vendorStatus) {
      items = items.filter((vendor) => vendor.vendorStatus === filters.vendorStatus);
    }
    if (filters.vendorCategory) {
      items = items.filter((vendor) => vendor.vendorCategory === filters.vendorCategory);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(
        (vendor) =>
          vendor.vendorName.toLowerCase().includes(search) ||
          vendor.vendorLegalName?.toLowerCase().includes(search)
      );
    }

    return {
      items: clone(items.slice(0, filters.limit ?? items.length)),
      nextCursor: null,
    };
  },

  async getVendor(vendorId: string): Promise<Vendor> {
    await wait();
    const vendor = vendors.find((item) => item.vendorId === vendorId);
    if (!vendor) throw new Error("Vendor not found");
    return clone(vendor);
  },

  async updateVendor(
    vendorId: string,
    patch: Partial<Omit<Vendor, "vendorId" | "clientId" | "createdAt" | "updatedAt">>
  ): Promise<Vendor> {
    await wait();
    const vendor = vendors.find((item) => item.vendorId === vendorId);
    if (!vendor) throw new Error("Vendor not found");
    Object.assign(vendor, patch, { updatedAt: new Date().toISOString() });
    return clone(vendor);
  },

  async deleteVendor(vendorId: string): Promise<{ success: boolean }> {
    await wait();
    const vendor = vendors.find((item) => item.vendorId === vendorId);
    if (!vendor) throw new Error("Vendor not found");
    vendor.vendorStatus = "inactive";
    vendor.updatedAt = new Date().toISOString();
    return { success: true };
  },

  async validateVendor(vendorId: string): Promise<VendorValidationResult> {
    const vendor = await this.getVendor(vendorId);
    const checks = {
      hasPaymentMethod: vendor.paymentMethodsSupported.length > 0,
      hasValidRules: vendor.rules.maxAmountPerTransaction !== null,
      hasPaymentReference: Boolean(vendor.encryptedPaymentRefId),
      isNotBlocked: vendor.vendorStatus !== "blocked",
    };
    const issues = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => key);
    return {
      vendorId,
      valid: issues.length === 0,
      checks,
      issues,
    };
  },
};
