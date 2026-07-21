// Lets any authenticated API call force a sign-out (e.g. refresh token rejected)
// without needing to thread the session context through every call site.
type Listener = () => void;
let listener: Listener | null = null;

export function onForceSignOut(cb: Listener) {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

export function emitForceSignOut() {
  listener?.();
}
