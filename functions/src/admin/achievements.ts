import { Request, Response } from "express";
import { checkObjectWithProperties, CheckResult } from "../checks";
import * as admin from "firebase-admin";

const _db = admin.firestore();

export const getAchievements = (req: Request, res: Response) =>
    _db
        .collection('achievements')
        .get()
        .then((querySnap) =>
            res.json(
                querySnap.docs.map((docSnap) => {
                    return { ...docSnap.data(), id: docSnap.id };
                }),
            ),
        );

export const createNewAchievement = async (req: Request, res: Response) => {
    const validationResult = validateCommission(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    return _db.collection('achievements').add({
        ...req.body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).then((writeResult) => res.json(writeResult.id));
};

export const updateAchievement = async (req: Request, res: Response) => {
    const validationResult = validateCommission(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    const saveResult = await _db
        .collection('achievements')
        .doc(req.params.achievementId)
        .set(
            {
                ...req.body,
            },
            { merge: true },
        );
    return res.json(saveResult.writeTime);
};

const validateCommission = (data: any): CheckResult => {
    const baseFieldsResult = checkObjectWithProperties(data, [
        {key: 'name', type: 'object'},
        {key: 'description', type: 'object'},
        {key: 'badge', type: 'string'},
        {key: 'conditions', type: 'object'},
        {key: 'reward', type: 'object'},
        {key: 'weight', type: 'string'},
        {key: 'type', type: 'string'}
    ]);

    if (!baseFieldsResult.isValid) {
        return baseFieldsResult;
    }

    const nameFieldResult = checkObjectWithProperties(data['name'], [
        {key: 'en', type: 'string'},
        {key: 'ro', type: 'string'}
    ]);

    if (!nameFieldResult.isValid) {
        return nameFieldResult
    }

    const descriptionFieldResult = checkObjectWithProperties(data['description'], [
        {key: 'en', type: 'string'},
        {key: 'ro', type: 'string'}
    ]);

    if (!descriptionFieldResult.isValid) {
        return descriptionFieldResult
    }

    const reward = checkObjectWithProperties(data['reward'], [
        {key: 'amount', type: 'string'},
        {key: 'unit', type: 'string'}
    ]);

    if (!reward.isValid) {
        return reward
    }

    return reward;
};

export default {
    createNewAchievement,
    updateAchievement,
    getAchievements
};