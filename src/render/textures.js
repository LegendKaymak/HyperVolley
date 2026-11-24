// =============================================================================
//  textures.js — Parçacık dokuları. Hepsi Pixi Graphics ile çizilip bir kez
//  texture'a dönüştürülür (dış görsel dosyası yok). Beyaz çizilir, tint ile renklenir.
// =============================================================================
import { Graphics } from 'pixi.js';

function soft(g, r, steps, maxAlpha) {
  // Yumuşak kenarlı daire: iç içe yarı saydam daireler → radyal gradyan hissi
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    g.circle(0, 0, r * (1 - t)).fill({ color: 0xffffff, alpha: maxAlpha });
  }
  return g;
}

export function makeTextures(renderer) {
  const gen = (g) => {
    const tex = renderer.generateTexture({ target: g, resolution: 2, antialias: true });
    g.destroy();
    return tex;
  };

  return {
    glow: gen(soft(new Graphics(), 64, 18, 0.09)),
    smoke: gen(soft(new Graphics(), 32, 10, 0.12)),
    dot: gen(new Graphics().circle(0, 0, 6).fill(0xffffff)),
    spark: gen(new Graphics().roundRect(-10, -2.5, 20, 5, 2.5).fill(0xffffff)),
    square: gen(new Graphics().rect(-5, -3.5, 10, 7).fill(0xffffff)),
    tri: gen(new Graphics().poly([0, -7, 7, 6, -7, 5]).fill(0xffffff)),
    star: gen(
      new Graphics()
        .poly(Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 3.5 : 9;
          return [Math.cos(a) * r, Math.sin(a) * r];
        }).flat())
        .fill(0xffffff),
    ),
  };
}
