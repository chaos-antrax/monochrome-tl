"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Download,
  FileText,
  Library,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  ShieldCheck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceProvider, useAuth, useLibrary, useToast } from "../workspace/state";

const baseNav: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/app/library", label: "Library", Icon: Library },
  { href: "/app/styles", label: "Styles", Icon: PenLine },
  { href: "/app/export", label: "Export", Icon: Download },
  { href: "/app/usage", label: "Usage", Icon: BarChart3 },
  { href: "/app/account", label: "Account", Icon: User },
];

function MobileMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid h-10 w-10 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-950 hover:text-neutral-950"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
    >
      <Menu
        aria-hidden="true"
        className={`absolute h-5 w-5 transition duration-200 ${open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
      <X
        aria-hidden="true"
        className={`absolute h-5 w-5 transition duration-200 ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
      />
    </button>
  );
}

function CollapseButton({
  compact,
  onClick,
}: {
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group absolute -right-4 top-8 z-20 grid h-9 w-9 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-[0_12px_35px_rgba(0,0,0,0.12)] transition duration-200 hover:border-neutral-950 hover:text-neutral-950 hover:shadow-[0_16px_45px_rgba(0,0,0,0.16)]"
      aria-label={compact ? "Expand navigation" : "Collapse navigation"}
      aria-expanded={!compact}
    >
      <span
        aria-hidden="true"
        className={`absolute transition duration-200 ${compact ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
      >
        <PanelLeftOpen className="h-4 w-4" />
      </span>
      <span
        aria-hidden="true"
        className={`absolute transition duration-200 ${compact ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      >
        <PanelLeftClose className="h-4 w-4" />
      </span>
    </button>
  );
}

function SidebarLabel({
  compact,
  alignRight,
  children,
}: {
  compact: boolean;
  alignRight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${alignRight ? "text-right" : ""} ${compact ? "max-w-0 translate-x-1 opacity-0" : "max-w-[190px] translate-x-0 opacity-100"}`}
    >
      {children}
    </span>
  );
}

function Sidebar({
  compact = false,
  alignRight = false,
  closing = false,
  onNavigate,
}: {
  compact?: boolean;
  alignRight?: boolean;
  closing?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { novels, jobs } = useLibrary();
  const { account } = useAuth();
  const nav = account.role === "admin" ? [...baseNav, { href: "/app/admin/users", label: "Users", Icon: ShieldCheck }] : baseNav;
  const activeJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "processing",
  ).length;
  const rowAlign =
    alignRight && !compact
      ? "flex-row-reverse justify-start gap-3 text-right"
      : compact
        ? "justify-center gap-0"
        : "gap-3";
  const rowAnimation = alignRight
    ? closing
      ? "animate-menu-row-out"
      : "animate-menu-row"
    : "";
  const shellWidth = alignRight ? "w-fit min-w-[15rem]" : "w-full min-w-0";

  return (
    <div
      className={`flex h-full ${shellWidth} flex-col rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.05)] transition-all duration-300 ease-out ${compact ? "items-center" : ""} ${alignRight ? "items-end text-right" : ""}`}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className={`block w-full border-b border-neutral-200 pb-4 transition-all duration-300 ${compact ? "text-center" : ""} ${alignRight ? "text-right" : ""}`}
        title="Home"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
          {compact ? "MT" : "Monochrome"}
        </p>
        <h1
          className={`mt-1 overflow-hidden font-serif text-2xl font-semibold transition-all duration-300 ${compact ? "max-h-0 translate-y-1 opacity-0" : "max-h-10 translate-y-0 opacity-100"}`}
        >
          Translation Desk
        </h1>
      </Link>

      <nav className="mt-5 grid w-full gap-1">
        {nav.map(({ href, label, Icon }, index) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-label={label}
              style={
                alignRight ? { animationDelay: `${index * 35}ms` } : undefined
              }
              className={`group flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${rowAlign} ${rowAnimation} ${active ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`}
            >
              <Icon
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition duration-200 ${active ? "text-white" : "text-neutral-500 group-hover:text-neutral-950"}`}
              />
              <SidebarLabel compact={compact} alignRight={alignRight}>
                {label}
              </SidebarLabel>
            </Link>
          );
        })}
      </nav>

      <div
        className={`mt-6 w-full border-t border-neutral-200 pt-4 transition-all duration-300 ${compact ? "text-center" : ""} ${alignRight ? "text-right" : ""}`}
      >
        <p
          className={`px-3 text-xs uppercase tracking-[0.18em] text-neutral-500 transition-all duration-300 ${compact ? "max-h-0 overflow-hidden opacity-0" : "max-h-6 opacity-100"}`}
        >
          Novels
        </p>
        <div className="mt-2 grid gap-1">
          {novels.slice(0, compact ? 4 : 6).map((novel, index) => {
            const initial = novel.title.trim().slice(0, 1).toUpperCase() || "N";
            return (
              <Link
                key={novel.id}
                href={`/app/novels/${novel.id}`}
                onClick={onNavigate}
                title={novel.title}
                aria-label={novel.title}
                style={
                  alignRight
                    ? { animationDelay: `${(index + nav.length) * 35}ms` }
                    : undefined
                }
                className={`group flex min-h-10 items-center rounded-lg px-3 py-2 text-sm transition-all duration-200 ${rowAlign} ${rowAnimation} ${pathname.includes(novel.id) ? "bg-neutral-100 text-neutral-950" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-neutral-200 text-[11px] font-semibold text-neutral-600 transition group-hover:border-neutral-300 group-hover:text-neutral-950"
                >
                  {compact ? initial : <FileText className="h-3.5 w-3.5" />}
                </span>
                <SidebarLabel compact={compact} alignRight={alignRight}>
                  <span className="block truncate font-medium">
                    {novel.title}
                  </span>
                  <span className="block text-xs text-neutral-400">
                    {novel.chapters.length} chapters
                  </span>
                </SidebarLabel>
              </Link>
            );
          })}
        </div>
      </div>

      <div
        className={`mt-auto w-full space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500 transition-all duration-300 ${compact ? "text-center" : ""} ${alignRight ? "text-right" : ""}`}
      >
        <Link
          href="/app/account"
          onClick={onNavigate}
          title={account.email || "Account"}
          style={
            alignRight
              ? { animationDelay: `${(nav.length + novels.length) * 35}ms` }
              : undefined
          }
          className={`flex min-h-10 items-center rounded-lg bg-neutral-100 px-3 py-2 font-semibold text-neutral-700 transition hover:text-neutral-950 ${rowAlign} ${rowAnimation}`}
        >
          <User aria-hidden="true" className="h-4 w-4 shrink-0" />
          <SidebarLabel compact={compact} alignRight={alignRight}>
            {account.email || "Account"}
          </SidebarLabel>
        </Link>
        <div
          className={`grid gap-2 overflow-hidden transition-all duration-300 ${compact ? "max-h-0 opacity-0" : "max-h-32 opacity-100"}`}
        >
          <div className="flex justify-between gap-8">
            <span>Provider</span>
            <span>{account.verified ? "ready" : "not set"}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span>Active jobs</span>
            <span>{activeJobs}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-white/55 px-6 backdrop-blur-2xl animate-page"
      role="status"
      aria-live="polite"
      aria-label="Loading workspace"
    >
      <div className="grid place-items-center rounded-full">
        <Image
          src="/logo.png"
          alt="Monochrome Translations"
          width={112}
          height={112}
          loading="eager"
          className="h-24 w-24 animate-logo-shake object-contain sm:h-28 sm:w-28"
        />
      </div>
    </div>
  );
}
function ToastLayer() {
  const { message, setMessage } = useToast();

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [message, setMessage]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(92vw,360px)] justify-end sm:right-6 sm:top-6"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto animate-toast-in rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neutral-950" />
          <p className="min-w-0 flex-1 leading-6">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            aria-label="Dismiss notification"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
function ShellInner({ children }: { children: React.ReactNode }) {
  const { isBooting } = useAuth();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const drawerVisible = drawerOpen || drawerClosing;

  useEffect(() => {
    function collapseSidebar() {
      setDesktopCollapsed(true);
    }
    window.addEventListener("monochrome:collapse-sidebar", collapseSidebar);
    return () =>
      window.removeEventListener(
        "monochrome:collapse-sidebar",
        collapseSidebar,
      );
  }, []);

  useEffect(() => {
    if (!drawerClosing) return;
    const timeout = window.setTimeout(() => {
      setDrawerClosing(false);
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [drawerClosing]);

  function openDrawer() {
    setDrawerClosing(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (!drawerOpen || drawerClosing) return;
    setDrawerOpen(false);
    setDrawerClosing(true);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-[#f7f7f5]/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/app/library"
            className="font-serif text-xl font-semibold"
          >
            Monochrome
          </Link>
          <MobileMenuButton
            open={drawerOpen}
            onClick={drawerVisible ? closeDrawer : openDrawer}
          />
        </div>
      </div>

      <div
        className={`mx-auto grid min-h-screen w-full max-w-[1540px] gap-5 px-4 py-4 transition-[grid-template-columns] duration-300 ease-out sm:px-6 lg:px-8 ${desktopCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}
      >
        <aside className="relative hidden transition-all duration-300 lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
          <CollapseButton
            compact={desktopCollapsed}
            onClick={() => setDesktopCollapsed((value) => !value)}
          />
          <Sidebar compact={desktopCollapsed} />
        </aside>

        {drawerVisible ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className={`absolute inset-0 bg-neutral-950/30 backdrop-blur-sm ${drawerClosing ? "animate-mobile-backdrop-out" : "animate-mobile-backdrop"}`}
              onClick={closeDrawer}
            />
            <aside
              className={`absolute right-0 top-0 h-full w-fit max-w-[calc(100vw-1.5rem)] p-3 ${drawerClosing ? "animate-mobile-drawer-out" : "animate-mobile-drawer"}`}
            >
              <Sidebar
                alignRight
                closing={drawerClosing}
                onNavigate={closeDrawer}
              />
            </aside>
          </div>
        ) : null}

        <section className="animate-page min-w-0 pb-10">{children}</section>
      </div>
      <ToastLayer />
      {isBooting ? <LoadingOverlay /> : null}
    </main>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ShellInner>{children}</ShellInner>
    </WorkspaceProvider>
  );
}



