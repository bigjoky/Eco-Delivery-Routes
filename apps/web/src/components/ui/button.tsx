import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'destructive';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  default: 'btn btn-default',
  secondary: 'btn btn-secondary',
  outline: 'btn btn-outline',
  destructive: 'btn btn-destructive',
};

export function Button({ className, variant = 'default', ...props }: Props) {
  return <button className={cn(variants[variant], className)} {...props} />;
}
