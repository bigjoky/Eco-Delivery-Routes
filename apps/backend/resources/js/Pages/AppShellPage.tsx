import { BrowserRouter } from 'react-router-dom';
import { usePage } from '@inertiajs/react';
import { App } from '../app/App';

export default function AppShellPage() {
  const page = usePage<{ auth?: { user?: { id: string; name: string; email: string } | null } }>();
  const initialSessionUser = page.props.auth?.user ?? null;

  return (
    <BrowserRouter basename="/ops">
      <App initialSessionUser={initialSessionUser} />
    </BrowserRouter>
  );
}
