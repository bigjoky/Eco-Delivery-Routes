import ApplicationLogo from '@/components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="guest-shell">
            <div className="guest-brand">
                <Link href="/">
                    <ApplicationLogo className="guest-logo" />
                </Link>
            </div>
            <div className="guest-card card">
                {children}
            </div>
        </div>
    );
}
