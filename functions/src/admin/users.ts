import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { Roles } from '../entities';
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
    roles[doc.id.trim()] = doc.data() as Roles;  //trim the ID because some ID has white space as prefix
  });

  const usersWithRoles = Object.keys(roles);

  const result = [] as User[];
  if (usersWithRoles && usersWithRoles.length > 0) {
    const querySnap = await _db
      .collection(Collections.USERS)
      .where('userId', 'in', usersWithRoles)
      .get();

    querySnap.docs.forEach((docSnap) => {
      result.push({
        ...(docSnap.data() as User),
        userId: docSnap.id
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

  const booleanValue = req.body.isStaff === 'true';

  //update in roles
  return await _db.collection(Collections.ROLES)
      .doc(req.params.userId.trim())
      .set({admin: booleanValue}, {merge: true})
      .then(() => res.sendStatus(200))
      .catch(() => res.status(500).json('Server error'));
};

export default {
  retrieveAllStaffUsers,
  updateStaffMember,
};
