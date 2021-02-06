import { CommissionsMap } from '../../entities';
import { TwoPerformantRetriever } from './two-performant';

export interface CommissionRetriever {
  getCommissions(userPercent: number): Promise<CommissionsMap>;
}

const buildRetrievers = async (db: FirebaseFirestore.Firestore) => {
  const retrievers: CommissionRetriever[] = [];

  retrievers.push(new TwoPerformantRetriever(db));

  // TODO: Configurable retrievers

  return retrievers;
};

export const getCommissionsFromAllPlatforms = async (
  db: FirebaseFirestore.Firestore,
  userPercent: number,
) => {
  const retrievers = await buildRetrievers(db);

  // Retrieve commissions from all platforms and merge them
  const commissions: CommissionsMap = {};
  for (const retriever of retrievers) {
    try {
      const retrievedCommissions = await retriever.getCommissions(userPercent);
      for (const userId in retrievedCommissions) {
        commissions[userId] = {
          ...commissions[userId],
          ...retrievedCommissions[userId],
        };
      }
    } catch (e) {
      console.log(e);
    }
  }

  return commissions;
};
