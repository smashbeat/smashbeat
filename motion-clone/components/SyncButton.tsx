"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";

export function SyncButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sync?accountId=${encodeURIComponent(accountId)}&days=28`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? "Sync failed");
      }
      const r = body.results?.[0];
      if (r?.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={onClick} disabled={loading} className="btn">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCcw className="h-4 w-4" />
        )}
        {loading ? "Syncing…" : "Sync"}
      </button>
      {error && (
        <span className="max-w-[18rem] truncate text-xs text-danger" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
