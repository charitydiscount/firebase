export interface User {
  userId: string;
  name: string;
  email: string;
  photoUrl: string;
  disableMailNotification: boolean;
  isStaff: boolean;
  privateName?: boolean;
  privatePhoto?: boolean;
}
