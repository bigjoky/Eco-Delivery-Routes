import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InstallPwaButton from '@/components/InstallPwaButton';
import { Head } from '@inertiajs/react';

export default function Dashboard() {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Dashboard
                </h2>
            }
        >
            <Head title="Dashboard" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <p className="mb-4">
                                Bienvenido al backoffice de Eco Delivery Routes.
                            </p>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm text-gray-500">Operativa</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">Envios, rutas e incidencias</p>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm text-gray-500">Calidad</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">KPI por conductor y ruta</p>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm text-gray-500">API</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">OpenAPI y documentacion</p>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <a
                                    href="/ops"
                                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                >
                                    Abrir Operativa
                                </a>
                                <InstallPwaButton />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
