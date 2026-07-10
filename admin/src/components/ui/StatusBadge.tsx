import type { ReactNode } from 'react';

interface StatusBadgeProps {
  variant: string;
  label: string;
}

/** Colored pill badge for room and booking statuses. */
export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

interface LoadingStateProps {
  message?: string;
}

/** Centered spinner for section-level loading. */
export function LoadingState({ message = 'Loading data…' }: LoadingStateProps) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <h4>{message}</h4>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

/** Friendly empty state when no records match filters. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state-block">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <h4>{title}</h4>
      <p>{description}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'gold' | 'success' | 'info' | 'warning';
}

/** Analytics metric card for the dashboard overview. */
export function MetricCard({ label, value, icon, tone = 'gold' }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}>{icon}</div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  );
}
