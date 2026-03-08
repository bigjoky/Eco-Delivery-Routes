import { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function InputLabel({
    value,
    className = '',
    children,
    ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { value?: string }) {
    return (
        <label
            {...props}
            className={cn(className)}
        >
            {value ? value : children}
        </label>
    );
}
