import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle, Plug } from "lucide-react";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getAccounts() {
  try {
    return await prisma.adAccount.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        currency: true,
        lastSyncedAt: true,
        tokenExpiresAt: true,
      },
    });
  } catch {
    return [];
  }
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: { status?: string; message?: string };
}) {
  const accounts = await getAccounts();
  const metaConfigured = !!(
    process.env.META_APP_ID && process.env.META_APP_SECRET
  );
  const tokenKeySet = !!process.env.TOKEN_ENCRYPTION_KEY;

  const checks: Array<{ label: string; ok: boolean; hint?: string }> = [
    {
      label: "DATABASE_URL",
      ok: !!process.env.DATABASE_URL,
      hint: "SQLite default works out of the box; override for Postgres.",
    },
    {
      label: "TOKEN_ENCRYPTION_KEY",
      ok: tokenKeySet,
      hint: "Generate with: openssl rand -base64 32",
    },
    {
      label: "META_APP_ID",
      ok: !!process.env.META_APP_ID,
      hint: "Create an app at developers.facebook.com/apps.",
    },
    {
      label: "META_APP_SECRET",
      ok: !!process.env.META_APP_SECRET,
    },
    {
      label: "META_REDIRECT_URI",
      ok: !!process.env.META_REDIRECT_URI,
      hint: "Must match the OAuth redirect URI configured in your Meta app.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
        Connect Meta
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        OAuth flow for the Meta Marketing API. Long-lived user tokens are
        encrypted at rest with AES-256-GCM and refreshed on reconnect.
      </p>

      {searchParams.status === "error" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">Connection failed</div>
            <div className="text-xs text-danger/80">
              {searchParams.message ?? "Unknown error"}
            </div>
          </div>
        </div>
      )}

      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Setup checklist</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 text-warning" />
              )}
              <div className="flex-1">
                <code className="text-xs font-medium text-ink-700">
                  {c.label}
                </code>
                {!c.ok && c.hint && (
                  <div className="text-xs text-ink-500">{c.hint}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Next steps</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-600">
          <li>
            Create a Facebook app at{" "}
            <a
              className="underline"
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
            >
              developers.facebook.com/apps
            </a>
            . Add the Marketing API and Facebook Login products.
          </li>
          <li>
            Set the OAuth redirect URI to{" "}
            <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">
              {process.env.META_REDIRECT_URI ??
                "http://localhost:3000/api/auth/meta/callback"}
            </code>
            .
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill
            in <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, and{" "}
            <code>TOKEN_ENCRYPTION_KEY</code>.
          </li>
          <li>
            Run <code>npm run db:push</code> once to create the SQLite schema.
          </li>
          <li>
            Restart <code>npm run dev</code> and click the connect button below.
          </li>
        </ol>

        <div className="mt-5 flex items-center gap-2">
          <a
            href="/api/auth/meta/start"
            className={
              "btn-primary " +
              (metaConfigured && tokenKeySet
                ? ""
                : "pointer-events-none opacity-50")
            }
          >
            <Plug className="h-4 w-4" />
            {metaConfigured && tokenKeySet
              ? "Connect Meta"
              : "Connect Meta (set env first)"}
          </a>
        </div>
      </section>

      {accounts.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">
            Connected accounts
          </h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <div className="font-medium text-ink-900">{a.name}</div>
                  <div className="text-xs text-ink-500">
                    {a.id} · {a.currency}
                    {a.lastSyncedAt &&
                      ` · synced ${new Date(a.lastSyncedAt).toLocaleString()}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
