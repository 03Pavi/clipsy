'use client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../../store';
import dynamic from 'next/dynamic';

const GlobalCallListener = dynamic(
  () => import('../room/global-call-listener'),
  { ssr: false }
);

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GlobalCallListener />
        {children}
      </PersistGate>
    </Provider>
  );
}
