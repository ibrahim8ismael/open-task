import { join } from "node:path";

export function exportDir(): string {
  return process.env.EXPORT_DIR ?? join(process.cwd(), "exports");
}
