import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { checkObjectWithProperties, CheckResult } from '../checks';
import * as entity from "../entities";

const _db = admin.firestore();

/**
 * Retrieve all stored clicks
 *
 * @param req Express request
 * @param res Express response
 */
export const getClicks = (req: Request, res: Response) =>
    _db
        .collection('clicks')
        .get()
        .then((querySnap) =>
            res.json(
                querySnap.docs.map((docSnap) => {
                    return { ...docSnap.data(), id: docSnap.id };
                }),
            ),
        );


/**
 * Create a click for a given user
 *
 * @param req Express request with click body
 * @param res Express response
 */
export const createClick = async (req: Request, res: Response) => {
    const validationResult = validateClick(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    //verify if user exists
    try {
        await admin.auth().getUser(req.body.userId);
    } catch (e) {
        return res.status(404).json('User not found');
    }

    const newClick: entity.Click = {
        userId: req.body.userId,
        programId: req.body.programId,
        ipv6Address: req.body.ipv6Address,
        ipAddress: req.body.ipAddress,
        deviceType: req.body.deviceType,
        createdAt: admin.firestore.Timestamp.fromMillis(Date.now()),
    };

    await _db
        .collection('clicks')
        .add(
            newClick
        ).then((writeResult) => res.json(writeResult.id));

    return res.json;
};

/**
 * Update a click
 *
 * @param req Express request with click in body
 *            and clickId in params
 * @param res Express response
 */
export const updateClick = async (req: Request, res: Response) => {
    const validationResult = validateClick(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    try {
        await admin.auth().getUser(req.body.userId);
    } catch (e) {
        return res.status(404).json('User not found');
    }

    const saveResult = await _db
        .collection('clicks')
        .doc(req.params.clickId)
        .set(
            {
                ...req.body,
            },
            { merge: true },
        );
    return res.json(saveResult.writeTime);
};


const validateClick = (data: any): CheckResult => {
    return checkObjectWithProperties(data, [
        {key: 'deviceType', type: 'string'},
        {key: 'ipAddress', type: 'string'},
        {key: 'ipv6Address', type: 'string', optional: true},
        {key: 'programId', type: 'string'},
        {key: 'userId', type: 'string'},
    ]);
};

export default {
    getClicks,
    updateClick,
    createClick,
};
