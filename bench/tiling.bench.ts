import './setup-worker-stub';
import { bench, describe } from 'vitest';
import { adaptiveRealEsrganTiling, planRealEsrganTiles } from '../src/shared/realesrgan-tiling';
import { planUniformTiles } from '../src/worker/realesrgan-inference-worker.js';

// Cases mirror real anime frames: 360p low, 540p qHD, 720p HD, 1080p FHD, 1440p, 4K
const SIZES: Array<[number, number, string]> = [
  [640, 360, '640x360'],
  [960, 540, '960x540'],
  [1280, 720, '1280x720'],
  [1920, 1080, '1920x1080'],
  [2560, 1440, '2560x1440'],
  [3840, 2160, '3840x2160'],
];

describe('adaptiveRealEsrganTiling', () => {
  for (const [w, h, label] of SIZES) {
    bench(`adaptive ${label}`, () => {
      adaptiveRealEsrganTiling(w, h);
    });
  }
  bench('adaptive 1920x1080 with overrides 256/16', () => {
    adaptiveRealEsrganTiling(1920, 1080, { maxTileSize: 256, overlap: 16, singleTileMaxHeight: 200 });
  });
});

describe('planRealEsrganTiles (content-script planner)', () => {
  const opts512 = { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 576 };
  const opts384 = { maxTileSize: 384, overlap: 24, singleTileMaxHeight: 384 };

  for (const [w, h, label] of SIZES) {
    const opts = w * h >= 1920 * 1080 ? opts384 : opts512;
    bench(`plan ${label} maxTile=${opts.maxTileSize}`, () => {
      planRealEsrganTiles(w, h, opts);
    });
  }

  bench('plan 640x900 512/24 tall (forces split)', () => {
    planRealEsrganTiles(640, 900, opts512);
  });

  bench('plan 1920x1080 384/24', () => {
    planRealEsrganTiles(1920, 1080, opts384);
  });
});

describe('planUniformTiles (worker, uniform batches)', () => {
  for (const [w, h, label] of SIZES) {
    const maxTile = w * h >= 1920 * 1080 ? 384 : 512;
    bench(`uniform ${label} maxTile=${maxTile}`, () => {
      planUniformTiles(w, h, maxTile, 24, maxTile);
    });
  }

  bench('uniform 640x900 512/24', () => {
    planUniformTiles(640, 900, 512, 24, 576);
  });
});

describe('tiling — plan vs uniform agreement (overhead comparison)', () => {
  bench('plan 1280x720 512 vs uniform same geometry', () => {
    const a = planRealEsrganTiles(1280, 720, { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 576 });
    const b = planUniformTiles(1280, 720, 512, 24, 576);
    if (a.tiles.length !== b.length) throw new Error('mismatch');
  });
});
