"use client";

import { type Context, type FormEvent, useContext } from "react";
import { AuthContext, LibraryContext, ReaderContext, SettingsContext, ToastContext } from "./contexts";
import type { WorkspaceContextValue } from "./types";

function useRequiredContext<T>(context: Context<T | null>, name: string) {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used inside WorkspaceProvider.`);
  return value;
}

export function useAuth() {
  return useRequiredContext(AuthContext, "useAuth");
}

export function useLibrary() {
  return useRequiredContext(LibraryContext, "useLibrary");
}

export function useReader() {
  return useRequiredContext(ReaderContext, "useReader");
}

export function useSettings() {
  return useRequiredContext(SettingsContext, "useSettings");
}

export function useToast() {
  return useRequiredContext(ToastContext, "useToast");
}

export function useWorkspace(): WorkspaceContextValue {
  return { ...useAuth(), ...useLibrary(), ...useReader(), ...useSettings(), ...useToast() };
}

export function preventSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

