import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { Roles } from '../entities';
import { UserDto } from './dtos/user.dto';
import { Collections } from '../collections';
import { User } from '../user/user.model';

const _db = admin.firestore();

/**
 * Retrieve all stored staff members
 *
 * @param req Express request
 * @param res Express response
 */
export const retrieveAllStaffUsers = async (req: Request, res: Response) => {
  //get admin members from ROLES table
  const rolesSnap = await _db.collection(Collections.ROLES).get();
  const roles: { [userId: string]: Roles } = {};
  rolesSnap.docs.forEach((doc) => {
    roles[doc.id.trim()] = doc.data() as Roles;
  });

  //get info about admin users which are not yet staff members
  const usersWithRoles = Object.keys(roles);

  const result = [] as UserDto[];
  if (usersWithRoles && usersWithRoles.length > 0) {
    const querySnap = await _db
      .collection(Collections.USERS)
      .where('userId', 'in', usersWithRoles)
      .get();

    querySnap.docs.forEach((docSnap) => {
      result.push({
        ...(docSnap.data() as User),
        userId: docSnap.id,
        roles: roles[docSnap.id],
      });
    });
  }

  return res.json(result);
};

/**
 * Update staff member info
 *
 * @param req Express request
 * @param res Express response
 */
export const updateStaffMember = async (req: Request, res: Response) => {
  const userId = req.params.userId;
  try {
    await admin.auth().getUser(userId);
  } catch (e) {
    return res.status(404).json('User not found!');
  }

  const isAdmin = req.body.admin === true;

  await _db
    .collection(Collections.ROLES)
    .doc(userId)
    .set({ admin: isAdmin }, { merge: true });

  return res.sendStatus(200);
};

export default {
  retrieveAllStaffUsers,
  updateStaffMember,
};
