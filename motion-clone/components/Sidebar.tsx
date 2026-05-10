import {
  LayoutDashboard,
  Sparkles,
  ImagePlay,
  Tags,
  Users2,
  FlaskConical,
  Settings2,
  LifeBuoy,
} from "lucide-react";
import clsx from "clsx";

const top = [
  { icon: LayoutDashboard, label: "Snapshots", active: true },
  { icon: ImagePlay, label: "Creatives" },
  { icon: Sparkles, label: "Insights" },
  { icon: Tags, label: "Tags" },
  { icon: FlaskConical, label: "Experiments" },
  { icon: Users2, label: "Audiences" },
];
const bottom = [
  { icon: LifeBuoy, label: "Help" },
  { icon: Settings2, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-ink-100 px-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-white">
          <span className="text-sm font-bold">b.</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink-900">
          Beatreel
        </span>
        <span className="ml-auto rounded-md border border-ink-200 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
          Beta
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Workspace
        </div>
        <div className="mb-3 rounded-lg border border-ink-100 bg-ink-50 p-2">
          <div className="text-sm font-semibold text-ink-900">
            Northwind Coffee Co.
          </div>
          <div className="text-xs text-ink-500">Creative Strategy</div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {top.map((item) => (
            <button
              key={item.label}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                item.active
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          {bottom.map((item) => (
            <button
              key={item.label}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
