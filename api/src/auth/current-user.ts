/** Utilisateur authentifié, posé sur la requête par `AuthGuard`. */
export type CurrentUser = {
  id: string;
  email: string;
};

declare module 'express' {
  interface Request {
    user?: CurrentUser;
  }
}
