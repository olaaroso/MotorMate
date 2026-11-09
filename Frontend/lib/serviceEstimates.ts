export type ServiceEstimate = {
  name: string;
  estimated_price?: number | null;
  estimated_duration_minutes?: number | null;
};

export const DEFAULT_SERVICE_MINUTES = 30;

export const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;

  const hourLabel = `${hours} hr${hours === 1 ? "" : "s"}`;
  return rest ? `${hourLabel} ${rest} min` : hourLabel;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function findServiceEstimate(
  estimates: ServiceEstimate[] | null | undefined,
  serviceName: string
): ServiceEstimate | undefined {
  const key = serviceName.trim().toLowerCase();
  if (!key) return undefined;
  return (estimates || []).find((estimate) => estimate.name.trim().toLowerCase() === key);
}

export function hasEstimateValues(
  estimate: Pick<ServiceEstimate, "estimated_price" | "estimated_duration_minutes"> | null | undefined
): boolean {
  return (
    typeof estimate?.estimated_price === "number" ||
    typeof estimate?.estimated_duration_minutes === "number"
  );
}

/** e.g. "$59.99 · 1 hr", "$60", "1 hr 30 min", or "" when nothing is set. */
export function describeEstimate(
  estimate: Pick<ServiceEstimate, "estimated_price" | "estimated_duration_minutes"> | null | undefined
): string {
  const parts: string[] = [];
  if (typeof estimate?.estimated_price === "number") {
    parts.push(formatPrice(estimate.estimated_price));
  }
  if (typeof estimate?.estimated_duration_minutes === "number") {
    parts.push(formatDuration(estimate.estimated_duration_minutes));
  }
  return parts.join(" · ");
}
