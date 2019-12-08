import twoPerformant from '../two-performant';

const getForProgram = (req: any, res: any) =>
  res.json(
    twoPerformant.getPromotionsForProgram(parseInt(req.params.programId)),
  );

export default { getForProgram };
