// Neon Bay — Rico's Garage, the shop.
// Walk up to the garage and the shutter opens: ammo, a medkit,
// a repair and a clean record, bought with keys 1 to 4.

import { SHOP_ITEMS, SHOP_POS, PLAYER } from './config.js';
import { showBanner } from './police.js';

export function shopNearby(state) {
  const p = state.player;
  return Math.hypot(p.x - SHOP_POS.x, p.y - SHOP_POS.y) < SHOP_POS.radius;
}

export function stepShop(state) {
  const near = shopNearby(state);
  if (near && state.player.onFoot && !state.shopOpen) {
    state.shopOpen = true;
    showBanner(state, "RICO'S GARAGE", 'Press 1-4 to buy. Walk away to close.');
  }
  if ((!near || !state.player.onFoot) && state.shopOpen) {
    state.shopOpen = false;
  }
}

export function buyItem(state, slot) {
  if (!state.shopOpen) return false;
  const item = SHOP_ITEMS[slot];
  if (!item) return false;
  if (state.money < item.price) {
    showBanner(state, 'NOT ENOUGH CASH', 'You need $' + item.price + ' for ' + item.label + '.');
    return false;
  }
  state.money -= item.price;
  if (slot === 0) {
    state.ammo += 24;
    state.stats.ammoBought += 24;
  } else if (slot === 1) {
    state.health = Math.min(PLAYER.health, state.health + 60);
  } else if (slot === 2) {
    if (state.player.car) {
      state.player.car.health = 100;
      state.player.car.wrecked = false;
    }
  } else if (slot === 3) {
    state.heat = Math.max(0, state.heat - 1);
    state.wanted = Math.ceil(state.heat);
  }
  showBanner(state, 'BOUGHT — ' + item.label, 'Rico nods. Pleasure doing business.');
  state.stats.spent += item.price;
  return true;
}

export function shopList() {
  return SHOP_ITEMS;
}
