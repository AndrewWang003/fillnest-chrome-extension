export function isExpectedActivationBootstrapState(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Invalid FillNest activation state" || error.message === "Activation state uninitialized")
  );
}
