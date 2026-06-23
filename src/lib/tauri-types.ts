export type Platform = "macos" | "windows" | "unknown";

export interface OsInfo {
  platform: Platform;
  arch: string;
  version: string;
}

export interface ToolStatus {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  meets_minimum: boolean;
}

export interface SshKeyInfo {
  exists: boolean;
  public_key: string | null;
  key_path: string;
}
