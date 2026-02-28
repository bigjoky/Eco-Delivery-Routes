import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { apiClient } from '../../services/apiClient';

export function LoginPage() {
  const [email, setEmail] = useState('admin@eco.local');
  const [password, setPassword] = useState('password123');
  const [message, setMessage] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await apiClient.login({ email, password });
    setMessage(result.message);
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Acceso Backoffice</CardTitle>
          <CardDescription>Autenticacion sobre API /v1 con token Bearer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <Button type="submit">Entrar</Button>
          </form>
          {message && <p className="helper">{message}</p>}
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
