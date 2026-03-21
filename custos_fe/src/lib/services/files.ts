import type { UploadUrlResult } from "./types";

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const fileService = {
  async createUploadUrl(input: {
    clientId: string;
    fileName: string;
    contentType: string;
    purpose: "invoice" | "receipt" | "attachment";
  }): Promise<UploadUrlResult> {
    await wait();
    return {
      uploadUrl: `https://mock-upload.custos.local/${input.clientId}/${encodeURIComponent(input.fileName)}`,
      filePath: `${input.purpose}/${input.clientId}/${input.fileName}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },
};
