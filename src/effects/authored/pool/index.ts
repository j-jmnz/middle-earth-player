import type { Effect } from "../../../catalog/boundary.ts";

import * as packASitE from "./ASitE.ts";
import * as packAoO from "./AoO.ts";
import * as packAtE from "./AtE.ts";
import * as packBoCD from "./BoCD.ts";
import * as packBoG from "./BoG.ts";
import * as packBtS from "./BtS.ts";
import * as packCS from "./CS.ts";
import * as packCatC from "./CatC.ts";
import * as packCoC from "./CoC.ts";
import * as packCoP from "./CoP.ts";
import * as packCore from "./Core.ts";
import * as packCotW from "./CotW.ts";
import * as packDR from "./DR.ts";
import * as packDoCG from "./DoCG.ts";
import * as packEaAD from "./EaAD.ts";
import * as packEfMG from "./EfMG.ts";
import * as packFitN from "./FitN.ts";
import * as packFoS from "./FoS.ts";
import * as packFotS from "./FotS.ts";
import * as packFotW from "./FotW.ts";
import * as packHfG from "./HfG.ts";
import * as packHoEM from "./HoEM.ts";
import * as packHoN from "./HoN.ts";
import * as packJtR from "./JtR.ts";
import * as packKD from "./KD.ts";
import * as packLoS from "./LoS.ts";
import * as packM from "./M.ts";
import * as packMG from "./MG.ts";
import * as packMoF from "./MoF.ts";
import * as packMotKA from "./MotKA.ts";
import * as packNiE from "./NiE.ts";
import * as packOHaUH from "./OHaUH.ts";
import * as packOtD from "./OtD.ts";
import * as packRAH from "./RAH.ts";
import * as packRAR from "./RAR.ts";
import * as packRevCore from "./RevCore.ts";
import * as packRtM from "./RtM.ts";
import * as packRtR from "./RtR.ts";
import * as packSaF from "./SaF.ts";
import * as packSoCH from "./SoCH.ts";
import * as packTAC from "./TAC.ts";
import * as packTBR from "./TBR.ts";
import * as packTBS from "./TBS.ts";
import * as packTCoU from "./TCoU.ts";
import * as packTDF from "./TDF.ts";
import * as packTDM from "./TDM.ts";
import * as packTDoM from "./TDoM.ts";
import * as packTDR from "./TDR.ts";
import * as packTDT from "./TDT.ts";
import * as packTFoN from "./TFoN.ts";
import * as packTFoW from "./TFoW.ts";
import * as packTGH from "./TGH.ts";
import * as packTGoF from "./TGoF.ts";
import * as packTHftD from "./THftD.ts";
import * as packTLD from "./TLD.ts";
import * as packTLR from "./TLR.ts";
import * as packTLoS from "./TLoS.ts";
import * as packTMV from "./TMV.ts";
import * as packTRD from "./TRD.ts";
import * as packTRG from "./TRG.ts";
import * as packTSF from "./TSF.ts";
import * as packTSoH from "./TSoH.ts";
import * as packTTT from "./TTT.ts";
import * as packTWH from "./TWH.ts";
import * as packTWoR from "./TWoR.ts";
import * as packTiT from "./TiT.ts";
import * as packTitD from "./TitD.ts";
import * as packToR from "./ToR.ts";
import * as packToS from "./ToS.ts";
import * as packTotD from "./TotD.ts";
import * as packUtAM from "./UtAM.ts";
import * as packVoI from "./VoI.ts";
import * as packWaR from "./WaR.ts";
import * as packWitW from "./WitW.ts";
import * as packWoE from "./WoE.ts";

// Every player pack with deck-legal cards (data/cards). Each file holds the authored records of its own cards only.
const PACKS: readonly { RECORDS: readonly Effect[]; REPLACES: readonly string[] }[] = [
  packASitE,
  packAoO,
  packAtE,
  packBoCD,
  packBoG,
  packBtS,
  packCS,
  packCatC,
  packCoC,
  packCoP,
  packCore,
  packCotW,
  packDR,
  packDoCG,
  packEaAD,
  packEfMG,
  packFitN,
  packFoS,
  packFotS,
  packFotW,
  packHfG,
  packHoEM,
  packHoN,
  packJtR,
  packKD,
  packLoS,
  packM,
  packMG,
  packMoF,
  packMotKA,
  packNiE,
  packOHaUH,
  packOtD,
  packRAH,
  packRAR,
  packRevCore,
  packRtM,
  packRtR,
  packSaF,
  packSoCH,
  packTAC,
  packTBR,
  packTBS,
  packTCoU,
  packTDF,
  packTDM,
  packTDoM,
  packTDR,
  packTDT,
  packTFoN,
  packTFoW,
  packTGH,
  packTGoF,
  packTHftD,
  packTLD,
  packTLR,
  packTLoS,
  packTMV,
  packTRD,
  packTRG,
  packTSF,
  packTSoH,
  packTTT,
  packTWH,
  packTWoR,
  packTiT,
  packTitD,
  packToR,
  packToS,
  packTotD,
  packUtAM,
  packVoI,
  packWaR,
  packWitW,
  packWoE,
];

export const POOL_AUTHORED_EFFECTS: readonly Effect[] = PACKS.flatMap((pack) => pack.RECORDS);
export const POOL_AUTHORED_REPLACES: readonly string[] = PACKS.flatMap((pack) => pack.REPLACES);
