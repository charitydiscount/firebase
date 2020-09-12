import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { NotificationsDocument, NotificationType } from '../entities';
import { flatMap } from 'lodash';
import { sendNotification } from '../util';

const _db = admin.firestore();

/**
 * Send notifications about certain promotions
 * @param req Express request with case in body
 * @param res Express response
 */
const sendPromotionNotifications = async (req: Request, res: Response) => {
  const userDevicesSnap = await _db
    .collection('notifications')
    .doc('promotions')
    .get();

  // Store the sent notification
  await _db.collection('notifications').add(req.body);

  const tokens = flatMap(
    Object.values(userDevicesSnap.data() as NotificationsDocument),
  );

  const sendResult = await sendNotification(
    {
      title: req.body.title,
      body: req.body.body,
      type: NotificationType.CAMPAIGN,
    },
    tokens,
  );

  return !sendResult
    ? res.status(500).json({
        deviceCount: 0,
      })
    : res.json({
        deviceCount: sendResult.successCount,
      });
};

export default {
  sendPromotionNotifications,
};
