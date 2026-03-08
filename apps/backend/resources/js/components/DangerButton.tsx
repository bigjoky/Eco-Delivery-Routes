import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={cn('btn btn-destructive', className)}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
