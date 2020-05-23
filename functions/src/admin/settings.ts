import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { checkObjectWithProperties, CheckResult } from "../checks";

const _db = admin.firestore();

/**
 * Update existing settings
 * @param req Express request with settings in the body
 * @param res Express response
 */
const updateSettings = async (req: Request, res: Response) => {
    console.log(req.body);
    const validationResult = validateSettings(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    const docRef = await _db
        .collection('meta')
        .doc('settings');
    const settingsRef = await docRef.get();
    if (settingsRef.exists) {
        return docRef.update(req.body).then(() => res.sendStatus(200));
    } else {
        return docRef.set(req.body).then(() => res.sendStatus(200));
    }
};

const validateSettings = (data: any): CheckResult => {
    return checkObjectWithProperties(data, [
        { key: 'cashoutEmails', type: 'object'},
    ]);
};

export default {
    updateSettings,
};
