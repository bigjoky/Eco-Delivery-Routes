import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { sessionStore } from '../../core/auth/sessionStore';
import { apiClient } from '../../services/apiClient';

export function LoginPage() {
  const [email, setEmail] = useState('admin@eco.local');
  const [password, setPassword] = useState('password123');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStore.isAuthenticated()) {
      navigate('/shipments', { replace: true });
    }
  }, [navigate]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.login({ email, password });
      setMessage(result.message);
      navigate('/shipments', { replace: true });
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : 'No se ha podido iniciar sesion';
      setError(nextError);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    await apiClient.logout();
    setMessage('Sesion cerrada');
    setError('');
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">
            <span className="brand">
              <img src="/logo.svg" alt="Eco Delivery Routes" className="brand-logo" />
              <span>Acceso Backoffice</span>
            </span>
          </CardTitle>
          <CardDescription>Autenticacion sobre API /v1 con token Bearer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
            <Button type="button" variant="outline" onClick={onLogout}>Cerrar sesion</Button>
          </form>
          {message && <p className="helper">{message}</p>}
          {error && <p className="helper">{error}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alcance MVP</CardTitle>
          <CardDescription>Operaciones, calidad e inicio de liquidaciones.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item">
              <div className="kpi-label">Modulo</div>
              <div className="kpi-value">Ops</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">API</div>
              <div className="kpi-value">/v1</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">UX</div>
              <div className="kpi-value">shadcn</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
