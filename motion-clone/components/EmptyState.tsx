import Link from "next/link";
import { Sparkles, Plug, ArrowRight } from "lucide-react";

type Props = {
  metaConfigured: boolean;
};

export function EmptyState({ metaConfigured }: Props) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-900 text-white">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Connect a Meta ad account to get started
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
          We pull spend, revenue, and creative-level performance directly from
          the Meta Marketing API. Per-user OAuth, daily sync, encrypted at
          rest.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {metaConfigured ? (
          <a href="/api/auth/meta/start" className="btn-primary">
            <Plug className="h-4 w-4" />
            Connect Meta
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <Link href="/connect" className="btn-primary">
            <Plug className="h-4 w-4" />
            Set up Meta
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Link href="/demo" className="btn">
          View sample report
        </Link>
      </div>
      {!metaConfigured && (
        <p className="max-w-md text-xs text-ink-400">
          Meta credentials aren&apos;t set yet. Open <code>/connect</code> for
          step-by-step setup, or paste your <code>META_APP_ID</code> and{" "}
          <code>META_APP_SECRET</code> into <code>.env.local</code>.
        </p>
      )}
    </div>
  );
}
