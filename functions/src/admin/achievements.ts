import { Request, Response } from "express";
import { checkObjectWithProperties, CheckResult } from "../checks";
import * as admin from "firebase-admin";

const _db = admin.firestore();

export const createNewAchievement = async (req: Request, res: Response) => {
    const validationResult = validateNewCommission(req.body);
    if (!validationResult.isValid) {
        return res.status(422).json(validationResult.violations);
    }

    return _db.collection('achievements').add({
        ...req.body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).then((writeResult) => res.json(writeResult.id));
};

const validateNewCommission = (data: any): CheckResult => {
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
    createNewAchievement
};