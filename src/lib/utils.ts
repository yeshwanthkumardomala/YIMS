import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the display label for a location type.
 * Shows custom_type_label if set, otherwise falls back to location_type.
 */
export function getLocationTypeDisplay(
  location: { location_type: string; custom_type_label?: string | null }
): string {
  return location.custom_type_label || location.location_type;
}

/**
 * Get the full display string for a location (name + type).
 */
export function getLocationDisplay(
  location: { name: string; location_type: string; custom_type_label?: string | null }
): string {
  return `${location.name} (${getLocationTypeDisplay(location)})`;
}
