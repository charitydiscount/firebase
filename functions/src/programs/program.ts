import * as entity from '../entities';
import { Request, Response } from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { getAffiliateCodes, getPrograms } from '../two-performant';
import elastic from '../elastic';
import { asyncForEach, arrayToObject } from '../util';

export const getAffiliatePrograms = async (req: Request, res: Response) => {
  const { body } = await elastic.client.search({
    index: elastic.indeces.PROGRAMS_INDEX,
    body: {
      size: 1000,
      query: {
        match_all: {},
      },
    },
  });

  return res.json(body.hits.map((hit: any) => hit._source));
};

export const getAffiliateProgram = async (req: Request, res: Response) => {
  const { body } = await elastic.client.get({
    index: elastic.indeces.PROGRAMS_INDEX,
    id: req.params.programId,
  });

  return res.json(body._source);
};

/**
 * Update the stored programs
 * @param {Firestore} db Firestore DB reference
 */
export async function updatePrograms(db: firestore.Firestore) {
  try {
    const newPrograms = await getPrograms();
    const currentPrograms = await getCurrentPrograms(db);
    const programs = await getProgramsIncludingRemoved(
      db,
      newPrograms,
      currentPrograms,
    );
    await updateProgramsGeneral(db, programs);
    await updateFavoritePrograms(db, programs);
    await updateMeta(db, programs);

    await elastic
      .sendBulkRequest(elastic.buildBulkBodyForPrograms(programs))
      .catch((e) => console.log(e));

    console.log(`Saved ${programs.length} programs`);
  } catch (error) {
    console.log('Error updating programs: ' + error);
    return;
  }
}

const getCurrentPrograms = async (
  db: firestore.Firestore,
): Promise<{ [uniqueCode: string]: entity.Program }> => {
  const currentSnap = await db
    .collection('programs')
    .doc('all')
    .get();
  if (!currentSnap.exists) {
    return {};
  }
  const { updatedAt, ...programs } = currentSnap.data() || {};
  return programs;
};

async function getProgramsIncludingRemoved(
  db: firestore.Firestore,
  programs: entity.Program[],
  currentPrograms: { [uniqueCode: string]: entity.Program },
): Promise<entity.Program[]> {
  const currentSnap = await db
    .collection('programs')
    .doc('all')
    .get();
  if (!currentSnap.exists) {
    return programs;
  }
  const result = programs.slice();
  Object.keys(currentPrograms).forEach((programUniqueCode) => {
    const currentProgram = currentPrograms[programUniqueCode];
    if (
      currentProgram.source === '2p' &&
      !programs.find(
        (newProgram) => newProgram.uniqueCode === currentProgram.uniqueCode,
      )
    ) {
      result.push({ ...currentProgram, status: 'removed' });
    }
  });

  return result;
}

/**
 * Update the overall metrics
 */
async function updateMeta(db: firestore.Firestore, programs: entity.Program[]) {
  if (!Array.isArray(programs)) {
    return;
  }

  const twoPCode = getAffiliateCodes()[0].code;

  await updateAffiliateMeta(db, twoPCode);
  await updateProgramsMeta(db, programs);
}

async function updateProgramsGeneral(
  db: firestore.Firestore,
  programs: entity.Program[],
) {
  await db
    .collection('programs')
    .doc('all')
    .set(
      {
        ...arrayToObject(programs, 'uniqueCode'),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function updateProgramsMeta(
  db: firestore.Firestore,
  programs: entity.Program[],
) {
  const categories = programs.map((p) => p.category);
  const uniqueCategories = [...new Set(categories)];
  uniqueCategories.sort((c1, c2) => c1.localeCompare(c2));

  return db
    .collection('meta')
    .doc('programs')
    .set(
      {
        count: programs.length,
        categories: uniqueCategories,
      },
      { merge: true },
    );
}

function getProgramStatus(program?: entity.Program) {
  if (program) {
    return program.status;
  } else {
    return 'removed';
  }
}

async function updateFavoritePrograms(
  db: firestore.Firestore,
  programs: entity.Program[],
) {
  const querySnaps = await db.collection('favoriteShops').get();
  if (!querySnaps || querySnaps.empty) {
    return;
  }

  await asyncForEach(
    querySnaps.docs,
    async (q: firestore.QueryDocumentSnapshot) => {
      const userFavoritePrograms = q.data().programs;
      if (!userFavoritePrograms) {
        return;
      }

      let updateNeeded = false;
      Object.keys(userFavoritePrograms).forEach((programUniqueCode) => {
        const favProgram = userFavoritePrograms[programUniqueCode];
        const program = programs.find(
          (p) => p.uniqueCode === favProgram.uniqueCode,
        );
        const currentStatus = getProgramStatus(program);

        if (favProgram.status !== currentStatus) {
          updateNeeded = true;
          favProgram.status = currentStatus;
        }
      });

      if (updateNeeded) {
        try {
          await q.ref.update({
            programs: userFavoritePrograms,
          });
        } catch (e) {
          console.log(`Failed favorite program update: ${e.message}`);
        }
      }
    },
  );
}

async function updateAffiliateMeta(
  db: firestore.Firestore,
  uniqueCode: string,
) {
  return db
    .collection('meta')
    .doc('2performant')
    .set({ uniqueCode: uniqueCode }, { merge: true });
}
