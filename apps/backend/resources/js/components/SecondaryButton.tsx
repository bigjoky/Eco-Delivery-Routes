import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function SecondaryButton({
    type = 'button',
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            type={type}
            className={cn('btn btn-outline', className)}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
