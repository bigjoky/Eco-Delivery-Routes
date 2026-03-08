import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={cn('btn btn-default', className)}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
