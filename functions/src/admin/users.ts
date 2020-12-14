import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { Roles, User } from '../entities';
import { UserDto } from './dtos/user.dto';
import { Collections } from '../collections';

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
    roles[doc.id] = doc.data() as Roles;
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
  try {
    await admin.auth().getUser(req.params.userId);
  } catch (e) {
    return res.status(404).json('User not found!');
  }

  const usersDocRef = _db.collection('users').doc(req.params.userId);
  const userEntryRef = await usersDocRef.get();
  if (!userEntryRef.exists) {
    return res.status(404).json('User not found in USERS table!');
  }

  const booleanValue = req.body.staff === 'true';
  //first update in leaderboard if entry exists
  const leaderboardDocRef = _db
    .collection(Collections.LEADERBOARD)
    .doc(req.params.userId);
  const leaderboardEntryRef = await leaderboardDocRef.get();
  if (leaderboardEntryRef.exists) {
    await leaderboardDocRef.set(
      {
        isStaff: booleanValue,
      },
      { merge: true },
    );
  }

  //update in USERS
  return usersDocRef
    .update({
      staff: booleanValue,
    })
    .then(() => res.sendStatus(200));
};

export default {
  retrieveAllStaffUsers,
  updateStaffMember,
};
