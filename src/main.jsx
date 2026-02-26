import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getMissingClientEnv } from './envValidation'

function ConfigErrorPage({ missingKeys }) {
  return (
    <div className="app-config-error-page">
      <div className="app-config-error-card">
        <h1>Configuration required</h1>
        <p>
          This deployment is missing required Firebase environment variables. Add these in Netlify Site Settings and redeploy.
        </p>
        <ul>
          {missingKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const missingKeys = getMissingClientEnv();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {missingKeys.length > 0 ? <ConfigErrorPage missingKeys={missingKeys} /> : <App />}
  </StrictMode>,
)
