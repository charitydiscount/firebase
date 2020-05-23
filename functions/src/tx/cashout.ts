import * as TxDefinitions from './types';
import { firestore } from 'firebase-admin';
import elastic from '../elastic';
import RejectHandler from './reject';
import { sendEmail } from "../email";

export default class CashoutHandler implements TxDefinitions.TxHandler {
  private walletRef: firestore.DocumentReference;
  private txRef: firestore.DocumentReference;
  private cashoutEmails: object;

  constructor(
    walletRef: firestore.DocumentReference,
    txRef: firestore.DocumentReference,
    cashoutEmails: object
  ) {
    this.walletRef = walletRef;
    this.txRef = txRef;
    this.cashoutEmails = cashoutEmails;
  }

  async process(
    tx: TxDefinitions.TxRequest,
  ): Promise<TxDefinitions.ProcessResult> {
    if (tx.amount < 50) {
      return new RejectHandler(this.txRef).process();
    }

    const txTimestamp = firestore.Timestamp.fromDate(new Date());
    const dueAmount = firestore.FieldValue.increment(-tx.amount);

    const userTxCashout: TxDefinitions.UserTransaction = {
      amount: tx.amount,
      currency: tx.currency,
      date: txTimestamp,
      type: TxDefinitions.TxType.CASHOUT,
      sourceTxId: tx.id,
      target: tx.target,
      userId: tx.userId,
    };

    await this.walletRef.update({
      'cashback.approved': dueAmount,
      'transactions': firestore.FieldValue.arrayUnion(userTxCashout),
    });

    await this.txRef.update({
      status: TxDefinitions.TxStatus.ACCEPTED,
      updatedAt: txTimestamp,
    });

    await elastic
      .sendBulkRequest(elastic.buildBulkBodyForTx([userTxCashout]))
      .catch((e) => console.log(e));

    //send notification emails
    if (this.cashoutEmails && this.cashoutEmails.toString().length > 0) {
      try {
        const body = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="ie=edge" />
            <title>New Cashout</title>
        </head>
        <body>
            <p>A new cashout was initiated, please visit admin page to view more info</p>
        </body>
        </html>
        `;
        await sendEmail(this.cashoutEmails.toString(), 'New Cashout', body);
      } catch (e) {
        console.log(e);
      }
    }

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
