import { Bell, Share2, Download, ChevronDown, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-ink-100 bg-white px-4 md:px-6">
      <div className="relative hidden w-72 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
        <input
          aria-label="Search"
          placeholder="Search ads, tags, audiences…"
          className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 pl-8 pr-3 text-sm text-ink-700 placeholder:text-ink-400 focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="btn">
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <button className="btn">
          <Download className="h-4 w-4" />
          Export
        </button>
        <button className="btn-primary">
          New snapshot
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          aria-label="Notifications"
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-sm font-semibold text-white">
          JR
        </div>
      </div>
    </header>
  );
}
