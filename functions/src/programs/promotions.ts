import { getPromotions } from '../two-performant';
import { firestore } from 'firebase-admin';
import { groupBy, arrayToObject } from '../util';

export const updatePromotions = async (db: firestore.Firestore) => {
  const meta = await db.doc('meta/2performant').get();
  const promotions = await getPromotions(meta.data()!.uniqueCode);

  const programsPromotions = groupBy(promotions, 'programId');

  const promises: Promise<any>[] = [];
  for (const programId in programsPromotions) {
    promises.push(
      db
        .collection('promotions')
        .doc(programId)
        .set({
          ...arrayToObject(programsPromotions[programId], 'id'),
        }),
    );
  }

  return Promise.all(promises);
};
