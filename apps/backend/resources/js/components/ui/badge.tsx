import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  default: 'badge badge-default',
  secondary: 'badge badge-secondary',
  outline: 'badge badge-outline',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  destructive: 'badge badge-destructive',
};

export function Badge({ className, variant = 'default', ...props }: Props) {
  return <span className={cn(variants[variant], className)} {...props} />;
}
