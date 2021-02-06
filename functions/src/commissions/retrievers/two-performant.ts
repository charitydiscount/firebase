import * as admin from 'firebase-admin';
import { Commission, getCommissions2P } from '../../two-performant';
import { asyncForEach } from '../../util';
import * as entity from '../../entities';
import { CommissionRetriever } from '.';
import { convertAmount, BASE_CURRENCY, roundAmount } from '../../exchange';

export class TwoPerformantRetriever implements CommissionRetriever {
  private db: FirebaseFirestore.Firestore;

  constructor(firestore: FirebaseFirestore.Firestore) {
    this.db = firestore;
  }

  async getCommissions(userPercent: number): Promise<entity.CommissionsMap> {
    const commissions: {
      [userId: string]: { [commissionId: number]: entity.Commission };
    } = {};

    const meta = await this.db.doc('meta/2performant').get();
    const metaData = meta.data() as entity.MetaTwoPerformant;

    const commissions2p: Commission[] = await getCommissions2P(
      metaData.commissionsTwoPSince?.toDate(),
    );

    // Update the since date for 2p
    await this.updateSinceDate(commissions2p, meta);

    await asyncForEach(commissions2p, async (commission) => {
      let userIdOfCommission = this.getUserFor2PCommission(commission);

      if (!userIdOfCommission) {
        if (commission.publicActionData.sourceIp) {
          // Search based on the click and IP address
          const clicksWithSameIpSnap = await this.db
            .collection('clicks')
            .where('ipAddress', '==', commission.publicActionData.sourceIp)
            .where('programId', '==', commission.programId.toString())
            .get();
          if (clicksWithSameIpSnap.size === 1) {
            userIdOfCommission = clicksWithSameIpSnap.docs[0].data().userId;
          } else if (clicksWithSameIpSnap.size > 1) {
            console.log(
              `Multiple clicks found for commission ${commission.id}`,
            );
          }
        }

        if (!userIdOfCommission) {
          // Failed to find the userId
          // Save the commission to the DLQ and hope someone contacts us :D
          // In case someone does, we should add the click entry for now
          // and let the system handle the commission updates
          await this.db
            .collection('incomplete-commissions')
            .doc(commission.id.toString())
            .set(commission, { merge: true });
          return;
        }
      }

      const commissionToBeSaved = await this.toCommissionEntity(
        commission,
        userPercent,
      );

      commissions[userIdOfCommission] = {
        ...commissions[userIdOfCommission],
        [commissionToBeSaved.originId]: commissionToBeSaved,
      };
    });

    return commissions;
  }

  private async updateSinceDate(
    commissions2p: Commission[],
    meta: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>,
  ) {
    const oldestPendingComm = commissions2p
      .reverse()
      .find((c2p) => c2p.status === 'pending' || c2p.status === 'accepted');
    if (oldestPendingComm) {
      await meta.ref.update(<entity.MetaTwoPerformant>{
        commissionsTwoPSince: admin.firestore.Timestamp.fromMillis(
          Date.parse(oldestPendingComm.createdAt),
        ),
      });
    }
  }

  private async toCommissionEntity(
    comm: Commission,
    userPercent: number,
  ): Promise<entity.Commission> {
    const userAmount =
      Number.parseFloat(comm.amountInWorkingCurrency) * userPercent;
    let convertedUserAmount = userAmount;
    let currency = comm.workingCurrencyCode;
    if (comm.workingCurrencyCode !== BASE_CURRENCY) {
      const conversionResult = await convertAmount(
        userAmount,
        comm.workingCurrencyCode,
      );
      convertedUserAmount = conversionResult.amount;
      currency = conversionResult.currency;
    }
    const commission: entity.Commission = {
      originalAmount: roundAmount(
        Number.parseFloat(comm.amountInWorkingCurrency),
      ),
      saleAmount: roundAmount(
        Number.parseFloat(comm.publicActionData.amount || '0'),
      ),
      originalCurrency: comm.workingCurrencyCode,
      amount: roundAmount(convertedUserAmount),
      currency: currency,
      shopId: comm.programId,
      status: comm.status,
      originId: comm.id,
      program: comm.program,
      createdAt: admin.firestore.Timestamp.fromMillis(
        Date.parse(comm.createdAt),
      ),
      updatedAt: admin.firestore.Timestamp.fromMillis(
        Date.parse(comm.updatedAt),
      ),
      source: comm.source,
    };
    if (comm.reason && Array.isArray(comm.reason)) {
      commission.reason = comm.reason.join(' ');
    }
    return commission;
  }

  private getUserFor2PCommission(commission: Commission) {
    if (!commission.statsTags || commission.statsTags.length === 0) {
      return null;
    }

    return commission.statsTags.slice(1, commission.statsTags.length - 1);
  }
}
