import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { db } from './services/db';

async function boot() {
  await db.init();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="padding:16px;font-family:monospace;color:#b91c1c;">Failed to start application:\n${String(error)}</pre>`;
});
