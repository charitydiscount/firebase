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
    const programs = await getPrograms();
    await updateProgramsGeneral(db, programs);
    await updateFavoritePrograms(db, programs);

    const twoPCode = getAffiliateCodes()[0].code;
    await updateMeta(db, twoPCode, programs);

    await elastic
      .sendBulkRequest(elastic.buildBulkBodyForPrograms(programs))
      .catch((e) => console.log(e));

    console.log(`Saved ${programs.length} programs`);
  } catch (error) {
    console.log('Error updating programs: ' + error);
    return;
  }
}

/**
 * Update the overall metrics
 */
async function updateMeta(
  db: firestore.Firestore,
  uniqueCode: string,
  programs: entity.Program[],
) {
  if (!Array.isArray(programs)) {
    return;
  }

  await updateAffiliateMeta(db, uniqueCode);
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
      const favoritePrograms = q.data().programs;

      let updateNeeded = false;
      Object.keys(favoritePrograms).forEach((programUniqueCode) => {
        const favProgram = favoritePrograms[programUniqueCode];
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
            programs: favoritePrograms,
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
