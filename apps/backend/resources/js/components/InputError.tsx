import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p
            {...props}
            className={cn('helper error', className)}
        >
            {message}
        </p>
    ) : null;
}
