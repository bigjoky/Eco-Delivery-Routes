import { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function Checkbox({
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            type="checkbox"
            className={cn('checkbox', className)}
        />
    );
}
