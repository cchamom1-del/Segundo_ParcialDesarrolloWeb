/** Catálogos del sistema (expuestos en GET /api/catalogs) */
export const MARCAS = {
  Toyota: ['Corolla', 'Camry', 'RAV4', 'Tacoma', 'Hilux', '4Runner', 'Yaris', 'Highlander', 'Prado'],
  Honda: ['Civic', 'Accord', 'CR-V', 'Pilot', 'HR-V', 'Fit'],
  Nissan: ['Sentra', 'Altima', 'Frontier', 'Rogue', 'Pathfinder', 'Versa', 'Kicks'],
  Ford: ['F-150', 'Escape', 'Explorer', 'Mustang', 'Ranger', 'Edge', 'Bronco'],
  Chevrolet: ['Silverado', 'Equinox', 'Malibu', 'Tahoe', 'Camaro', 'Colorado', 'Traverse'],
  Hyundai: ['Elantra', 'Tucson', 'Santa Fe', 'Sonata', 'Kona', 'Accent'],
  Kia: ['Sportage', 'Sorento', 'Rio', 'Soul', 'Forte', 'Seltos'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-5', 'CX-30', 'CX-9', 'BT-50'],
  Jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade'],
  Mitsubishi: ['L200', 'Outlander', 'Montero Sport', 'Mirage', 'ASX'],
  Volkswagen: ['Jetta', 'Tiguan', 'Golf', 'Amarok', 'Taos'],
  Subaru: ['Outback', 'Forester', 'Crosstrek', 'Impreza', 'WRX'],
  BMW: ['Serie 3', 'Serie 5', 'X3', 'X5', 'X1'],
  'Mercedes-Benz': ['Clase C', 'Clase E', 'GLC', 'GLE', 'Clase A'],
  Audi: ['A3', 'A4', 'Q5', 'Q7'],
  Tesla: ['Model 3', 'Model Y', 'Model S'],
  Dodge: ['Ram 1500', 'Charger', 'Durango', 'Challenger'],
  Suzuki: ['Swift', 'Vitara', 'Jimny', 'Ertiga'],
};

export const TIPOS = ['Automóvil', 'SUV', 'Pickup', 'Van / Microbús', 'Deportivo', 'Motocicleta', 'Camión'];
export const TRANSMISIONES = ['Automática', 'Manual', 'CVT', 'Doble embrague'];
export const COMBUSTIBLES = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)'];
export const TRACCIONES = ['FWD', 'RWD', 'AWD', '4WD'];
export const CILINDROS = [0, 3, 4, 5, 6, 8, 10, 12];
export const DANIOS = {
  verde: { label: 'Verde', descripcion: 'Daño menor / Limpio', color: '#1f9d55' },
  amarillo: { label: 'Amarillo', descripcion: 'Daño medio / Reparable', color: '#e6a700' },
  rojo: { label: 'Rojo', descripcion: 'Daño severo / Salvamento', color: '#e0474c' },
};

export function catalogs() {
  const year = new Date().getFullYear() + 1;
  return {
    marcas: MARCAS,
    tipos: TIPOS,
    transmisiones: TRANSMISIONES,
    combustibles: COMBUSTIBLES,
    tracciones: TRACCIONES,
    cilindros: CILINDROS,
    danios: DANIOS,
    anios: { min: 1980, max: year },
    reglas: { incrementoMinimo: 0.1, fotosMinimas: 5, fotosMaximas: 12 },
  };
}
