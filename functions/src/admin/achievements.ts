import { Request, Response } from 'express';
import { checkObjectWithProperties, CheckResult } from '../checks';
import { firestore } from 'firebase-admin';
import { FirestoreCollections } from '../collections';

const _db = firestore();

export const getAchievements = (req: Request, res: Response) =>
  _db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .get()
    .then((querySnap) =>
      res.json(
        querySnap.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })),
      ),
    );

export const createNewAchievement = async (req: Request, res: Response) => {
  const validationResult = validateCommission(req.body);
  if (!validationResult.isValid) {
    return res.status(422).json(validationResult.violations);
  }

  return _db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .add({
      ...req.body,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    })
    .then((writeResult) => res.json(writeResult.id));
};

export const updateAchievement = async (req: Request, res: Response) => {
  const validationResult = validateCommission(req.body);
  if (!validationResult.isValid) {
    return res.status(422).json(validationResult.violations);
  }

  const saveResult = await _db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .doc(req.params.achievementId)
    .set(
      {
        ...req.body,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return res.json(saveResult.writeTime);
};

const validateCommission = (data: any): CheckResult => {
  const baseFieldsResult = checkObjectWithProperties(data, [
    { key: 'name', type: 'object' },
    { key: 'description', type: 'object' },
    { key: 'badge', type: 'string' },
    { key: 'conditions', type: 'object' },
    { key: 'reward', type: 'object' },
    { key: 'weight', type: 'number' },
    { key: 'type', type: 'string' },
    { key: 'order', type: 'number', optional: true },
  ]);

  if (!baseFieldsResult.isValid) {
    return baseFieldsResult;
  }

  const nameFieldResult = checkObjectWithProperties(data['name'], [
    { key: 'en', type: 'string' },
    { key: 'ro', type: 'string' },
  ]);

  if (!nameFieldResult.isValid) {
    return nameFieldResult;
  }

  const descriptionFieldResult = checkObjectWithProperties(
    data['description'],
    [
      { key: 'en', type: 'string' },
      { key: 'ro', type: 'string' },
    ],
  );

  if (!descriptionFieldResult.isValid) {
    return descriptionFieldResult;
  }

  const reward = checkObjectWithProperties(data['reward'], [
    { key: 'amount', type: 'number' },
    { key: 'unit', type: 'string' },
  ]);

  if (!reward.isValid) {
    return reward;
  }

  return reward;
};

export default {
  createNewAchievement,
  updateAchievement,
  getAchievements,
};
