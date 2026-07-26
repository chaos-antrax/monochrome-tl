"use client";

import Image from "next/image";
import { useTheme } from "./theme-provider";

type ThemeLogoProps = {
  alt: string;
  width: number;
  height: number;
  className?: string;
};

export function ThemeLogo({ alt, width, height, className }: ThemeLogoProps) {
  const { mounted, theme } = useTheme();
  const src = mounted && theme === "dark" ? "/logo-white.png" : "/logo.png";

  return (
    <Image
      src={src}
      alt={alt}
      loading="eager"
      width={width}
      height={height}
      className={className}
    />
  );
}
