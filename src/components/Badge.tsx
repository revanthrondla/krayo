import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  variant?: 'solid' | 'soft' | 'outline';
}

export function Badge({ children, color = '#5B6472', variant = 'soft' }: BadgeProps) {
  let styles: Record<string, string> = {};
  if (variant === 'solid') {
    styles = { backgroundColor: color, color: '#fff' };
  } else if (variant === 'soft') {
    styles = { backgroundColor: `${color}1A`, color };
  } else {
    styles = { backgroundColor: 'transparent', color, border: `1px solid ${color}40` };
  }
  return <span className="badge" style={styles}>{children}</span>;
}

interface StatusBadgeProps {
  status: string;
  statusColors: Record<string, string>;
}

export function StatusBadge({ status, statusColors }: StatusBadgeProps) {
  const color = statusColors[status] ?? '#5B6472';
  return <Badge color={color}>{status}</Badge>;
}
