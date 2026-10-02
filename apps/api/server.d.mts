import type { Server } from "node:http";
export function validate(body: unknown): boolean;
export function validateReview(body: unknown): boolean;
export function validateMinimize(body: unknown): boolean;
export function validateFields(body: unknown): boolean;
export function createApi(options?: {
  key?: string;
  model?: string;
  origin?: string;
  providerFetch?: (url: string, options: RequestInit) => Promise<Response>;
}): Server;
