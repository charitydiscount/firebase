import * as admin from "firebase-admin";
import { Request, Response } from 'express';
import { User } from "../entities";

const _db = admin.firestore();

/**
 * Retrieve all stored staff members
 *
 * @param req Express request
 * @param res Express response
 */
export const retrieveAllStaffUsers = async (req: Request, res: Response) => {
    //get admin members from ROLES table
    const admins = [] as string[];
    await _db
        .collection('roles')
        .get()
        .then((querySnap) =>
            querySnap.docs.map((docSnap) => {
                admins.push(docSnap.id.trim());
            }),
        );

    const result = [] as User[];
    //get staff members from users table
    await _db
        .collection('users')
        .where('staff', 'in', [true, false])
        .get()
        .then((querySnap) =>
            querySnap.docs.map((docSnap) => {
                result.push({...docSnap.data() as User, userId: docSnap.id, admin: admins.includes(docSnap.id)});
            }),
        );

    //get info about admin users which are not yet staff members
    const notYetStaffMemberAdmins = [] as string[];
    admins.forEach(userId => {
        if (!result.find((user) => user.userId === userId)) {
            notYetStaffMemberAdmins.push(userId.trim());
        }
    });

    if (notYetStaffMemberAdmins && notYetStaffMemberAdmins.length > 0) {
        await _db
            .collection('users')
            .where('userId', 'in', notYetStaffMemberAdmins)
            .get()
            .then((querySnap) =>
                querySnap.docs.map((docSnap) => {
                    result.push({...docSnap.data() as User, userId: docSnap.id, admin: true});
                }),
            );
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

    const usersDocRef = await _db
        .collection('users')
        .doc(req.params.userId);
    const userEntryRef = await usersDocRef.get();
    if (!userEntryRef.exists) {
        return res.status(404).json('User not found in USERS table!');
    }

    const booleanValue = (req.body.staff === 'true');
    //first update in leaderboard if entry exists
    const leaderboardDocRef = await _db
        .collection('leaderboard')
        .doc(req.params.userId);
    const leaderboardEntryRef = await leaderboardDocRef.get();
    if (leaderboardEntryRef.exists) {
        await leaderboardDocRef.set(
            {
                isStaff: booleanValue
            },
            {merge: true}
        );
    }

    //update in USERS
    return usersDocRef
        .update({
            staff: booleanValue
        })
        .then(() => res.sendStatus(200));
};

export default {
    retrieveAllStaffUsers,
    updateStaffMember
};

