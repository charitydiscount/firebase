import { Roles } from '../../entities';

export interface UserDto {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string;
  disableMailNotification: boolean;
  roles: Roles;
}
