import { BrowserRouter } from 'react-router-dom';
import { App } from '../app/App';

export default function AppShellPage() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
