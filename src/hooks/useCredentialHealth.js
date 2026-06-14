// Hook: returns live credential health for display in Settings or any component.
// Refreshes whenever the CredentialHealthMonitor fires 'credential-health-update'.

import { useState, useEffect } from 'react'
import { checkAllCredentials, getStoredHealth } from '../utils/credentialHealth'

export function useCredentialHealth() {
  const [health, setHealth] = useState(() => getStoredHealth() || checkAllCredentials())

  useEffect(() => {
    const refresh = () => setHealth(checkAllCredentials())
    window.addEventListener('credential-health-update', refresh)
    window.addEventListener('credential-reconnected', refresh)
    return () => {
      window.removeEventListener('credential-health-update', refresh)
      window.removeEventListener('credential-reconnected', refresh)
    }
  }, [])

  return health
}
