"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

type Props = {
  accounts: Array<{ id: string; name: string }>;
  currentId: string;
};

export function AccountSwitcher({ accounts, currentId }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params);
    next.set("accountId", e.target.value);
    router.push(`/?${next.toString()}`);
  };

  return (
    <label className="relative">
      <span className="sr-only">Ad account</span>
      <select
        value={currentId}
        onChange={onChange}
        className="appearance-none rounded-lg border border-ink-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-ink-700 hover:bg-ink-50 focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-ink-400" />
    </label>
  );
}
