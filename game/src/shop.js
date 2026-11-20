import { CITY, FONT, PALETTE, VIEW } from './config.js';

export const SHOP_ITEMS = [
  {
    id: 'ammo', name: 'Pistol ammo +24', price: 50,
    apply(state) { state.ammo += 24; return true; },
  },
  {
    id: 'medkit', name: 'Medkit — full health', price: 60,
    apply(state) { state.health = 100; return true; },
  },
  {
    id: 'repair', name: 'Repair your car', price: 80,
    apply(state) {
      const mine = state.player.car;
      let car = mine;
      if (!car) {
        let best = 200;
        for (const c of state.cars) {
          const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
          if (d < best) { best = d; car = c; }
        }
      }
      if (!car) return false;
      car.health = 100; car.flat = false; car.wrecked = false; car.smokeTimer = 0;
      return true;
    },
  },
  {
    id: 'clean', name: 'Clean record — lose a star', price: 200,
    apply(state) {
      if (state.wanted <= 0) return false;
      state.wantedPoints = Math.max(0, state.wantedPoints - 1);
      state.wanted = state.wantedPoints;
      if (state.wanted === 0) state.banner = { text: 'CLEAN', sub: 'You lost them — for now', timer: 2 };
      return true;
    },
  },
];

function shopState(state) {
  if (!state.shop) state.shop = { open: false, msg: '', msgT: 0 };
  return state.shop;
}

export function updateShop(state, dt) {
  const shop = shopState(state);
  if (shop.msgT > 0) shop.msgT -= dt;
  const p = state.player;
  const d = Math.hypot(p.x - CITY.garage.x, p.y - CITY.garage.y);
  if (!shop.open && p.onFoot && d < 140) { shop.open = true; shop.msg = ''; }
  else if (shop.open && (!p.onFoot || d > 200)) { shop.open = false; shop.msg = ''; }
}

export function shopOpen(state) {
  return !!(state.shop && state.shop.open);
}

export function buyShop(state, index) {
  const shop = shopState(state);
  if (!shop.open) return false;
  const item = SHOP_ITEMS[index];
  if (!item) return false;
  if (state.money < item.price) { shop.msg = 'Not enough cash.'; shop.msgT = 2; return false; }
  if (!item.apply(state)) { shop.msg = 'Nothing to fix right now.'; shop.msgT = 2; return false; }
  state.money -= item.price;
  shop.msg = `Bought: ${item.name}`;
  shop.msgT = 2;
  return true;
}

export function handleShopKey(state, code) {
  if (!shopOpen(state)) return false;
  const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
  if (idx < 0) return false;
  buyShop(state, idx);
  return true;
}

export function drawShop(ctx, state) {
  const shop = state.shop;
  if (!shop || !shop.open) return;
  const x = VIEW.width - 320, y = 300, w = 296;
  const h = 44 + SHOP_ITEMS.length * 30 + 34;
  ctx.fillStyle = 'rgba(8,10,18,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.neonYellow; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = PALETTE.neonYellow; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText('RICO’S GARAGE — SHOP', x + 14, y + 26);
  SHOP_ITEMS.forEach((item, i) => {
    const yy = y + 52 + i * 30;
    const afford = state.money >= item.price;
    ctx.fillStyle = afford ? PALETTE.text : 'rgba(170,178,197,0.55)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`${i + 1}. ${item.name}`, x + 14, yy);
    ctx.fillStyle = afford ? PALETTE.money : '#ff5a5a';
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.price}`, x + w - 14, yy);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Press 1-4 to buy • walk away to leave', x + 14, y + h - 14);
  if (shop.msg && shop.msgT > 0) {
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(shop.msg, x + 14, y + h - 34);
  }
}
