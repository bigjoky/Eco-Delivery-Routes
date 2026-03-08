import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InstallPwaButton from '@/components/InstallPwaButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';

export default function Dashboard() {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="page-title">Dashboard</h2>
            }
        >
            <Head title="Dashboard" />

            <div className="page-grid">
                <Card>
                    <CardHeader>
                        <CardTitle>Resumen</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="helper">
                            Bienvenido al backoffice de Eco Delivery Routes.
                        </p>
                    </CardContent>
                </Card>

                <div className="page-grid two">
                    <Card>
                        <CardHeader><CardTitle>Operativa</CardTitle></CardHeader>
                        <CardContent><div className="helper">Envíos, rutas e incidencias.</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Calidad</CardTitle></CardHeader>
                        <CardContent><div className="helper">KPI por conductor y por ruta.</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>API</CardTitle></CardHeader>
                        <CardContent><div className="helper">OpenAPI y documentación técnica.</div></CardContent>
                    </Card>
                </div>

                <div className="inline-actions">
                    <a href="/ops" className="btn btn-default">
                        Abrir Operativa
                    </a>
                    <InstallPwaButton />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
