import twoPerformant, { getPromotions } from '../two-performant';
import { Request, Response } from 'express';
import { firestore } from 'firebase-admin';
import { groupBy, arrayToObject } from '../util';

const getForProgram = (req: Request, res: Response) =>
  twoPerformant
    .getPromotionsForProgram(parseInt(req.params.programId))
    .then((promotions) => res.json(promotions));

export const updatePromotions = async (db: firestore.Firestore) => {
  const promotions = await getPromotions();

  const programsPromotions = groupBy(promotions, 'programId');

  const promises: Promise<any>[] = [];
  for (const programId in programsPromotions) {
    promises.push(
      db
        .collection('promotions')
        .doc(programId)
        .set(
          {
            ...arrayToObject(programsPromotions[programId], 'id'),
          },
          { merge: true },
        ),
    );
  }

  return Promise.all(promises);
};

export default { getForProgram };
