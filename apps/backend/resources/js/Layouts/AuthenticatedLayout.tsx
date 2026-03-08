import ApplicationLogo from '@/components/ApplicationLogo';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = usePage().props.auth.user;

    return (
        <div className="auth-shell">
            <header className="auth-topbar">
                <div className="auth-topbar-left">
                    <Link href={route('dashboard')} className="brand">
                        <ApplicationLogo className="brand-logo" />
                        <span>Eco Delivery Routes</span>
                    </Link>
                    <nav className="auth-nav">
                        <Link href={route('dashboard')} className="auth-link">
                            Dashboard
                        </Link>
                        <Link href="/ops" className="auth-link">
                            Operativa
                        </Link>
                        <Link href={route('profile.edit')} className="auth-link">
                            Perfil
                        </Link>
                    </nav>
                </div>
                <div className="auth-topbar-right">
                    <div className="helper">
                        {user.name} · {user.email}
                    </div>
                    <Link href={route('logout')} method="post" as="button" className="btn btn-outline">
                        Cerrar sesión
                    </Link>
                </div>
            </header>

            <main className="auth-main">
                {header ? <div className="auth-header">{header}</div> : null}
                {children}
            </main>
        </div>
    );
}
