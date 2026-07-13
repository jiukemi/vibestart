export type Platform = "macos" | "windows" | "unknown";

export interface OsInfo {
  platform: Platform;
  arch: string;
  version: string;
}

export type BrowserPreset = "google_chrome" | "system_default";

export interface BrowserConfig {
  preset: BrowserPreset;
}

export type ToolsInstallMode = "recommended" | "custom";

export interface ToolsInstallInfo {
  mode: ToolsInstallMode;
  custom_dir: string | null;
  recommended_root: string;
  effective_npm_prefix: string;
  effective_gui_dir: string;
  git_node_note: string;
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

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string | null;
  latest_tag: string | null;
  update_available: boolean;
  download_url: string | null;
  release_page_url: string | null;
  mirror: string;
  message: string;
}

export interface DownloadUpdateResult {
  success: boolean;
  file_path: string | null;
  message: string;
}

export interface DeployResult {
  success: boolean;
  url: string | null;
  alt_urls?: string[];
  log: string;
}

export interface UrlProbeResult {
  url: string;
  reachable: boolean;
  status_code: number | null;
  latency_ms: number | null;
  final_url: string | null;
  looks_like_login_page: boolean;
  message: string;
  suggestions: string[];
}

export interface VercelAccountInfo {
  current_scope: string;
  personal_scope: string;
  display_label: string;
}

export interface CommandResult {
  success: boolean;
  log: string;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface DirEntry {
  name: string;
  path: string;
}

export interface InitProjectResult {
  message: string;
  files_added: string[];
  files_skipped: string[];
}

export interface ProjectDirStatus {
  path: string;
  exists: boolean;
  is_empty: boolean;
  has_index_html: boolean;
}

export interface LlmConfig {
  provider: string;
  api_key: string;
  base_url?: string | null;
}

export interface IdeSyncItemResult {
  ide: string;
  ide_name: string;
  success: boolean;
  message: string;
  details: string[];
}

export interface IdeSyncBatchResult {
  success: boolean;
  message: string;
  results: IdeSyncItemResult[];
}

export interface IdeSyncResult {
  success: boolean;
  message: string;
  details: string[];
}

export interface IdeSyncVerifyItem {
  ide: string;
  ide_name: string;
  ready: boolean;
  key_matched: boolean;
  base_url_ok: boolean;
  custom_enabled: boolean;
  message: string;
  manual_steps: string[];
}

export interface IdeLaunchState {
  running: boolean;
  ideName: string;
  isCli: boolean;
  hint: string;
}

export interface LlmTestResult {
  message: string;
}

export interface NetworkConfig {
  enabled: boolean;
  http_proxy: string;
  socks_proxy?: string | null;
}

export interface DetectedProxy {
  source: string;
  http_proxy: string | null;
  socks_proxy: string | null;
}

export interface NetworkStatus {
  config: NetworkConfig;
  detected_proxies: DetectedProxy[];
  git_proxy_applied: string | null;
}

export interface GithubConnectivity {
  reachable: boolean;
  latency_ms: number | null;
  message: string;
  detected_proxies: DetectedProxy[];
}

export type CodexBridgeModeId = "cc-switch" | "deepseek-bridge" | "none";

export interface CodexBridgeConfig {
  mode: CodexBridgeModeId;
  cc_switch_port: number;
  deepseek_bridge_port: number;
  last_provider: string | null;
}

export interface CodexBridgeHealth {
  mode: string;
  ready: boolean;
  port: number;
  message: string;
}
