import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { OsInfo, Platform } from "@/lib/tauri-types";

let cached: OsInfo | null = null;
let inflight: Promise<OsInfo> | null = null;

async function fetchOsInfo(): Promise<OsInfo> {
  if (cached) return cached;
  if (!inflight) {
    inflight = invoke<OsInfo>("get_os_info").then((info) => {
      cached = info;
      return info;
    });
  }
  return inflight;
}

export function useOsInfo() {
  const [osInfo, setOsInfo] = useState<OsInfo | null>(cached);

  useEffect(() => {
    let cancelled = false;
    void fetchOsInfo().then((info) => {
      if (!cancelled) setOsInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const platform: Platform = osInfo?.platform ?? "unknown";

  return { osInfo, platform, loading: !osInfo };
}
