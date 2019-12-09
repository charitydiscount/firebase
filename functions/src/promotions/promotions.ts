import twoPerformant from '../two-performant';

const getForProgram = (req: any, res: any) =>
  twoPerformant
    .getPromotionsForProgram(parseInt(req.params.programId))
    .then((promotions) => res.json(promotions));

export default { getForProgram };
