"use client";

import { createContext } from "react";
import type { AuthContextValue, LibraryContextValue, ReaderContextValue, SettingsContextValue, ToastContextValue } from "./types";

export const AuthContext = createContext<AuthContextValue | null>(null);
export const LibraryContext = createContext<LibraryContextValue | null>(null);
export const ReaderContext = createContext<ReaderContextValue | null>(null);
export const SettingsContext = createContext<SettingsContextValue | null>(null);
export const ToastContext = createContext<ToastContextValue | null>(null);
