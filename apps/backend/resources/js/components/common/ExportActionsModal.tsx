import { ReactNode, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';

export type ExportActionItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  run: () => Promise<void> | void;
};

export function ExportActionsModal({
  title = 'Exportar datos',
  triggerLabel = 'Exportar',
  triggerDisabled = false,
  actions,
  children,
}: {
  title?: string;
  triggerLabel?: string;
  triggerDisabled?: boolean;
  actions: ExportActionItem[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const enabledActions = useMemo(() => actions.filter((action) => !action.disabled), [actions]);

  const runAction = async (action: ExportActionItem) => {
    setRunningId(action.id);
    setError('');
    try {
      await action.run();
      setOpen(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo completar la exportación.');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={triggerDisabled || actions.length === 0}>
        {triggerLabel}
      </Button>
      <Modal
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        footer={(
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={runningId !== null}>
            Cerrar
          </Button>
        )}
      >
        <div className="page-grid">
          {children}
          {enabledActions.length === 0 ? (
            <div className="helper">No hay opciones de exportación disponibles.</div>
          ) : (
            enabledActions.map((action) => (
              <div key={action.id} className="card-row">
                <div>
                  <div className="kpi-label">{action.label}</div>
                  {action.description ? <div className="helper">{action.description}</div> : null}
                </div>
                <div className="inline-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void runAction(action);
                    }}
                    disabled={runningId !== null}
                  >
                    {runningId === action.id ? 'Exportando...' : 'Descargar'}
                  </Button>
                </div>
              </div>
            ))
          )}
          {error ? <div className="helper error">{error}</div> : null}
        </div>
      </Modal>
    </>
  );
}
