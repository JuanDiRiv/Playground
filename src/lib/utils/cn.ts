import { clsx, type ClassValue } from "clsx";

/** Concatenate class names, ignoring falsy values. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
