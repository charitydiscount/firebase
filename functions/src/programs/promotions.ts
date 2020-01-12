import twoPerformant from '../two-performant';
import { Request, Response } from 'express';

const getForProgram = (req: Request, res: Response) =>
  twoPerformant
    .getPromotionsForProgram(parseInt(req.params.programId))
    .then((promotions) => res.json(promotions));

export default { getForProgram };
