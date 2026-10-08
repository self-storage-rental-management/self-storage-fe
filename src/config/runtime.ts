/**
 * Demo fixtures are opt-in only. Production and API-backed environments must
 * render data returned by the backend instead of silently fabricating records.
 */
export const DEMO_DATA_ENABLED = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
