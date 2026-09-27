/**
 * Fotografías reales de los vehículos de demostración.
 * Fuente: Wikimedia Commons, todas con licencia libre (CC BY, CC BY-SA, CC0 o dominio público).
 * Formato: [ruta hash, archivo codificado, autor, licencia]
 */
const BASE = 'https://thumb.wikimedia.org/wikipedia/commons/thumb';

const RAW = {
  corolla: [
    ['1/1c', 'TOYOTA_COROLLA_SEDAN_%28E210%29_China.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['d/d8', 'TOYOTA_COROLLA_SEDAN_%28E210%29_China_%282%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['4/44', 'TOYOTA_COROLLA_SEDAN_%28E210%29_China_%283%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['b/b9', 'TOYOTA_COROLLA_SEDAN_%28E210%29_China_%285%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['5/57', 'TOYOTA_COROLLA_SEDAN_%28E210%29_China_%284%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['5/58', 'Toyota_Corolla_E210_sedan_Sanming_01_2022-07-27.jpg', 'JamesYoung8167', 'CC BY-SA 4.0'],
  ],
  tacoma: [
    ['a/a1', '2019_Toyota_Tacoma_SR5_4WD_Access_Cab%2C_front_right%2C_09-03-2022.jpg', 'MercurySable99', 'CC BY-SA 4.0'],
    ['4/4a', '2019_Toyota_Tacoma_SR5_4WD_Access_Cab%2C_rear_right%2C_09-03-2022.jpg', 'MercurySable99', 'CC BY-SA 4.0'],
    ['8/8f', 'Toyota_Tacoma_%283rd_generation%29.jpg', 'SsmIntrigue', 'CC BY-SA 4.0'],
    ['1/1f', 'Toyota_Tacoma_%283rd_generation%29_2nd_angle.jpg', 'SsmIntrigue', 'CC BY-SA 4.0'],
    ['b/b9', 'Toyota_Tacoma_at_2019_SF_Auto_Show.jpg', 'DestinationFearFan', 'CC BY-SA 4.0'],
    ['9/91', '2019_Toyota_Tacoma_TRD_Sport_Double_Cab_in_Cement%2C_front_right.jpg', 'Mr.choppers', 'CC BY-SA 3.0'],
  ],
  crv: [
    ['e/e5', '2020_Honda_CR-V_2.4_ES_4WD.jpg', 'Chanokchon', 'CC BY-SA 4.0'],
    ['d/d6', '2020_Honda_CR-V_EX_i-MMD_CVT_2.0.jpg', 'Vauxford', 'CC BY-SA 4.0'],
    ['0/0e', 'Facelift_2020_Honda_CR-V_rearview.jpg', 'Ee2mba', 'CC BY-SA 4.0'],
    ['9/98', '2020_Honda_CR-V_SR_I-VTEC_CVT.jpg', 'Calreyn88', 'CC BY-SA 4.0'],
    ['3/3a', '2020_Honda_CR-V_2.4_ES_4WD_%28Rear%29.jpg', 'Chanokchon', 'CC BY-SA 4.0'],
    ['d/de', '2020_Honda_CR-V_EX-L_%28facelift%29%2C_front_11.30.21.jpg', 'Kevauto', 'CC BY-SA 4.0'],
  ],
  tucson: [
    ['5/53', 'Hyundai_Tucson_%28NX4%2C_SWB%29_PHEV_1X7A1858.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['a/ab', 'Hyundai_Tucson_%28NX4%2C_SWB%29_PHEV_1X7A1859.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['f/f1', 'Hyundai_Tucson_%28NX4%29_1X7A0424.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['2/21', 'Hyundai_Tucson_%28NX4%29_PHEV_IMG_4375.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['3/37', 'Hyundai_Tucson_%28NX4%2C_SWB%29_IMG_9135.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['4/40', 'Hyundai_Tucson_%28NX4%29_Washington_DC_Metro_Area%2C_USA_%283%29.jpg', 'OWS Photography', 'CC BY 4.0'],
  ],
  civic: [
    ['3/36', '2017_Honda_Civic_VTi-S_sedan_%282018-10-29%29_01.jpg', 'EurovisionNim', 'CC BY-SA 4.0'],
    ['2/2b', 'HONDA_CIVIC_SEDAN_%28FC%2CFK%29_China_%288%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['b/b8', 'HONDA_CIVIC_SEDAN_%28FC%2CFK%29_China_%287%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['4/4f', 'HONDA_CIVIC_SEDAN_%28FC%2CFK%29_China_%285%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['8/82', 'Honda_Civic_Si_Sedan_%28FC1%29_Washington_DC_Metro_Area%2C_USA.jpg', 'OWS Photography', 'CC BY 4.0'],
    ['0/0b', '2018_Honda_Civic_%28FC%29_sedan%2C_12.1.18.jpg', 'Ghostofakina', 'CC BY-SA 4.0'],
  ],
  model3: [
    ['a/ab', 'Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['9/97', 'Tesla_Model_3%2C_EMS_2024%2C_Essen_%28P1032260%29.jpg', 'Matti Blume', 'CC BY-SA 4.0'],
    ['0/09', 'Tesla_Model_3_in_M%C3%BCnchen_geparkt.jpg', 'AuHaidhausen', 'CC BY 4.0'],
    ['b/bf', 'Tesla_Model_3_1X7A6940.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['e/ed', 'Tesla_Model_3_%282023%29_1X7A1678.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
    ['e/e6', 'Tesla_Model_3_%282023%29_Auto_Zuerich_2023_1X7A1313.jpg', 'Alexander-93', 'CC BY-SA 4.0'],
  ],
  f150: [
    ['9/9a', '%2717_Ford_F-150_Crew_Cab.jpg', 'Bull-Doser', 'Dominio público'],
    ['c/c8', 'Ford_F-150_Lariat_FX4_2017_%2839303735594%29.jpg', 'RL GNZLZ', 'CC BY-SA 2.0'],
    ['2/2c', 'Ford_F-150_XLT_2017_%2834824683043%29.jpg', 'RL GNZLZ', 'CC BY-SA 2.0'],
    ['0/08', '2015-2017_Ford_F-150_XL_SuperCrew.jpg', 'LouieRBLX', 'CC BY-SA 4.0'],
    ['9/93', '2015-2017_Ford_F-150_Crew_Cab_Eurovia.jpg', 'Bull-Doser', 'Dominio público'],
    ['c/c2', '2017_Ford_F-150_Raptor_Crew_Cab.jpg', 'Bull-Doser', 'Dominio público'],
  ],
  wrangler: [
    ['a/a7', 'Jeep_Wrangler_Rubicon_%28JL%29_4xe_1X7A0285.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['9/97', 'Jeep_Wrangler_Rubicon_%28JL%29_4xe_1X7A0288.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['a/a7', 'JEEP_WRANGLER_%28JL%29_China.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['1/13', 'JEEP_WRANGLER_%28JL%29_China_%287%29.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['6/6c', 'JEEP_WRANGLER_SAHARA_%28JL%29_China.jpg', 'Dinkun Chen', 'CC BY-SA 4.0'],
    ['e/e0', 'Jeep_Wrangler_%28JL%29_Washington_DC_Metro_Area%2C_USA_%287%29.jpg', 'OWS Photography', 'CC BY 4.0'],
  ],
  mazda3: [
    ['c/cd', '%2716_Mazda3_Sedan_%28MIAS_%2716%29.jpg', 'Bull-Doser', 'Dominio público'],
    ['9/94', '%2716_Mazda3_Sedan_%28Carrefour_Angrignon%29.jpg', 'Bull-Doser', 'Dominio público'],
    ['b/b0', 'Mazda_3_Sedan_2016_%2824893119236%29.jpg', 'RL GNZLZ', 'CC BY-SA 2.0'],
    ['3/39', 'Mazda_3_Sport_2.5_GT_2016_%2852780848145%29.jpg', 'RL GNZLZ', 'CC BY-SA 2.0'],
    ['1/19', 'Mazda_3_2016.jpg', 'Almanzanaras', 'CC BY-SA 4.0'],
  ],
  sportage: [
    ['5/59', '0_Kia_Sportage_%28QL%29_1.jpg', 'Benespit', 'CC BY-SA 4.0'],
    ['7/7e', '0_Kia_Sportage_%28QL%29_3.jpg', 'Benespit', 'CC BY-SA 4.0'],
    ['b/ba', '00_Kia_Sportage_%28QL%29_1.jpg', 'Benespit', 'CC BY-SA 4.0'],
    ['0/0e', '0_Kia_Sportage_%28QL%29_2.jpg', 'Benespit', 'CC BY-SA 4.0'],
    ['3/3b', '0_Kia_Sportage_%28QL%29_4.jpg', 'Benespit', 'CC BY-SA 4.0'],
    ['c/ce', 'Kia_Sportage_%28QL%29_Interior.jpg', 'Milhouse35', 'CC BY-SA 4.0'],
  ],
  sentra: [
    ['d/d2', '2015_Nissan_Sentra_S_%286MT%29%2C_front_left.jpg', 'Mr.choppers', 'CC BY-SA 3.0'],
    ['b/b0', '2015_Nissan_Sentra_S_%286MT%29%2C_rear_left.jpg', 'Mr.choppers', 'CC BY-SA 3.0'],
    ['1/1f', 'Nissan_Sentra_%28B17%29_Washington_DC_Metro_Area%2C_USA.jpg', 'OWS Photography', 'CC BY 4.0'],
    ['e/eb', 'Nissan_Sentra_%28B17%29_Washington_DC_Metro_Area%2C_USA_%281%29.jpg', 'OWS Photography', 'CC BY 4.0'],
    ['e/ea', 'Nissan_Sentra_%28B17%29_Washington_DC_Metro_Area%2C_USA_%282%29.jpg', 'OWS Photography', 'CC BY 4.0'],
    ['2/2f', '15_Nissan_Sentra_SV.jpg', 'HJUdall', 'CC0'],
  ],
  l200: [
    ['9/91', 'Mitsubishi_L200_%282019%29_DSC_9302.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['0/05', 'Mitsubishi_L200_%282019%29_DSC_9304.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['a/af', 'Mitsubishi_L200_%282019%29_IMG_5591.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['2/2d', '2019_Mitsubishi_L200_Katana_CR.jpg', 'RL GNZLZ', 'CC BY-SA 2.0'],
    ['4/4e', 'Mitsubishi_L200_%282019%29_IMG_5590.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
    ['8/84', 'Mitsubishi_L200_%282019%29_Leonberg_2019_IMG_0070.jpg', 'Alexander Migl', 'CC BY-SA 4.0'],
  ],
};

const url = ([h, f], w) => `${BASE}/${h}/${f}/${w}px-${f}`;

/** Devuelve { photos, cover, credits } para un vehículo de demostración */
export function realPhotos(key) {
  const list = RAW[key];
  if (!list) return null;
  return {
    photos: list.map((p) => url(p, 1280)),
    cover: url(list[0], 640),
    credits: list.map(([, f, author, license]) => ({
      author,
      license,
      source: `https://commons.wikimedia.org/wiki/File:${f}`,
    })),
  };
}
