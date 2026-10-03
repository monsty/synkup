/**
 * Client HTTP de l'API Synkup : ajoute le jeton de session Clerk et traduit les erreurs.
 *
 * Adresse : `EXPO_PUBLIC_API_URL` si défini, sinon la machine qui sert Metro, port 3000. En
 * développement, le téléphone (ou le simulateur) joint ainsi l'API lancée sur le Mac.
 * Les routes sont versionnées : cette version de l'app parle à `/v1`.
 */
import Constants from 'expo-constants';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

const BASE_URL = `${resolveBaseUrl()}/v1`;

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;

/** Branché par `AuthProvider` : Clerk fournit (et rafraîchit) le jeton de session. */
export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Cas que l'app traite à part (`duplicate`, `quota_reached`…), quand l'API en donne un. */
    readonly code?: string
  ) {
    super(message);
  }

  /** Erreur passagère (réseau, serveur, jeton à rafraîchir) : réessayer a un sens. */
  get transient(): boolean {
    return this.status === 0 || this.status === 401 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible. Vérifie ton réseau.');
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Nest renvoie `message` en texte, ou en liste pour les erreurs de validation.
    const body = data as { message?: string | string[]; code?: string } | null;
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(response.status, message ?? 'Une erreur est survenue.', body?.code);
  }
  return data as T;
}
