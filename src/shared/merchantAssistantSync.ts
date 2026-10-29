export function clearOwnedAssistantSyncError(currentError: string, syncError: string): string {
  return syncError && currentError === syncError ? '' : currentError;
}
