import type { PropsWithChildren, ReactNode } from 'react';
import { Component } from 'react';

type Props = PropsWithChildren<{
  fallback?: ReactNode;
}>;

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    // Surface errors in console for faster debugging.
    console.error('ErrorBoundary caught error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
