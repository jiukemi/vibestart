import { useCallback, useEffect, useState } from "react";

import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { GithubConnectivity } from "@/lib/tauri-types";

/** GitHub 可达性作为「能否访问海外服务」的近似指标 */
export function useExternalReachability() {
  const { run, loading, data } = useTauriCommand<GithubConnectivity>();
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    await run("test_github_connectivity");
    setChecked(true);
  }, [run]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading: loading && !checked,
    checked,
    reachable: data?.reachable ?? null,
    message: data?.message ?? null,
    refresh,
  };
}
