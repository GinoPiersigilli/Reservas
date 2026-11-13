/**
 * Reemplazo de @clerk/clerk-react usado SOLO en el build de pruebas E2E
 * (vite --mode e2e). Simula a Clerk cargado y sin sesión, de modo que la
 * aplicación funcione con el inicio de sesión local sin depender de la red
 * ni de claves reales. El build de producción nunca incluye este archivo.
 */
const sinSesion = { isLoaded: true, isSignedIn: false, user: null };

export function ClerkProvider({ children }) {
  return children;
}

export function useUser() {
  return sinSesion;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: false,
    getToken: async () => null,
    signOut: async () => {}
  };
}

export function useSignIn() {
  return { isLoaded: false, signIn: null, setActive: async () => {} };
}

export function useSignUp() {
  return { isLoaded: false, signUp: null, setActive: async () => {} };
}

export function AuthenticateWithRedirectCallback() {
  return null;
}
