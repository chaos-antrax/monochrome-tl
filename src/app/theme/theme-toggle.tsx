"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { mounted, theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={mounted ? `Switch to ${dark ? "light" : "dark"} mode` : "Toggle color theme"}
      title={mounted ? `Switch to ${dark ? "light" : "dark"} mode` : "Toggle color theme"}
      onClick={toggleTheme}
      className="fixed bottom-6 left-6 z-[80] hidden h-11 w-11 place-items-center border border-foreground/15 bg-background/80 text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-foreground/[0.04] md:grid"
    >
      <Sun aria-hidden="true" className={`absolute h-5 w-5 transition duration-200 ${mounted && dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`} />
      <Moon aria-hidden="true" className={`absolute h-5 w-5 transition duration-200 ${!mounted || !dark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-75 opacity-0"}`} />
    </button>
  );
}
