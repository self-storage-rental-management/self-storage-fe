// Shared entry point for the confirmed-reservation to handover workflow.
// The existing implementation is kept in the manager folder for compatibility
// with the manager portal, while Staff and other operational portals consume
// this actor-neutral entry point.
export { default } from './manager/ManagerUnitAssignmentPanel'
