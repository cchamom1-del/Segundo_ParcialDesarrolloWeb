import { seed } from './seed.js';
import { getStore } from '../db/index.js';

const reset = process.argv.includes('--reset');
seed({ reset })
  .then(() => {
    getStore().flush?.();
    console.log(reset ? 'Base reiniciada con datos de demostración.' : 'Datos de demostración agregados.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
