export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}
