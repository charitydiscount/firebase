import { Roles } from '../../entities';

export interface UserDto {
  userId: string;
  name: string;
  email: string;
  photoUrl: string;
  disableMailNotification: boolean;
  roles: Roles;
}
