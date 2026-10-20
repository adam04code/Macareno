'use strict';

const { ITEMS, itemPrice, WEAPON_SPECIALS, ARMOR_SPECIALS } = require('../data/equipment');
const { newId } = require('./effects');
const { toCopper, formatMoney } = require('./tables');

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const WONDROUS_SLOTS = ['head', 'headband', 'eyes', 'neck', 'shoulders', 'chest', 'body', 'belt', 'wrists', 'hands', 'ring1', 'ring2', 'feet'];

/** Create an item instance. opts: { qty, enhancement, special[], masterwork, material, charges, name }. */
function createItem(itemId, opts = {}) {
  const def = ITEMS[itemId];
  if (!def) throw err(`Unknown item: ${itemId}`);
  const special = opts.special || [];
  for (const s of special) {
    if (def.kind === 'weapon' && !WEAPON_SPECIALS[s]) throw err(`Unknown weapon special ability ${s}`);
    if ((def.kind === 'armor' || def.kind === 'shield') && !ARMOR_SPECIALS[s]) throw err(`Unknown armor special ability ${s}`);
  }
  if (special.length && !(opts.enhancement > 0)) throw err('Special abilities require at least a +1 enhancement bonus');
  if ((opts.enhancement || 0) > 5) throw err('Enhancement bonus cannot exceed +5');
  const totalBonus = (opts.enhancement || 0) + special.reduce((s, k) => s + ((WEAPON_SPECIALS[k] || ARMOR_SPECIALS[k] || {}).bonus || 0), 0);
  if (totalBonus > 10) throw err('Total effective bonus cannot exceed +10');
  const inst = { uid: newId(), itemId, qty: opts.qty || (def.qtyPer || 1), equipped: null };
  if (opts.enhancement) inst.enhancement = opts.enhancement;
  if (special.length) inst.special = special;
  if (opts.masterwork) inst.masterwork = true;
  if (opts.material) inst.material = opts.material;
  if (def.charges) inst.charges = opts.charges ?? def.charges;
  if (opts.name) inst.name = opts.name;
  return inst;
}

function displayName(inst) {
  const def = ITEMS[inst.itemId];
  if (inst.name) return inst.name;
  let n = def.name;
  if (inst.special && inst.special.length) n = `${inst.special.map((s) => (WEAPON_SPECIALS[s] || ARMOR_SPECIALS[s]).name.toLowerCase()).join(' ')} ${n}`;
  if (inst.enhancement) n = `+${inst.enhancement} ${n}`;
  else if (inst.masterwork) n = `masterwork ${n}`;
  return n;
}

function unitValue(inst) {
  const def = ITEMS[inst.itemId];
  const base = itemPrice(def, inst);
  return def.qtyPer ? base / def.qtyPer : base;
}

function addItem(char, inst) {
  const def = ITEMS[inst.itemId];
  // Stack plain consumables and ammunition.
  const stackable = ['ammo', 'potion', 'scroll', 'splash', 'gear', 'alchemical', 'component'].includes(def.kind) && !inst.enhancement && !inst.special;
  if (stackable) {
    const existing = char.inventory.find((i) => i.itemId === inst.itemId && !i.enhancement && !i.special && !i.equipped);
    if (existing) {
      existing.qty += inst.qty || 1;
      char.touch();
      return existing;
    }
  }
  char.inventory.push(inst);
  char.touch();
  return inst;
}

function removeItem(char, uid, qty) {
  const inst = char.inventory.find((i) => i.uid === uid);
  if (!inst) throw err('Item not found', 404);
  if (qty && qty < (inst.qty || 1)) {
    inst.qty -= qty;
    char.touch();
    return { ...inst, uid: newId(), qty, equipped: null };
  }
  char.inventory = char.inventory.filter((i) => i.uid !== uid);
  char.touch();
  return { ...inst, equipped: null };
}

function findItem(char, uidOrId) {
  return char.inventory.find((i) => i.uid === uidOrId) || char.inventory.find((i) => i.itemId === uidOrId && !i.equipped) || char.inventory.find((i) => i.itemId === uidOrId);
}

function unequipSlot(char, slot) {
  const cur = char.inventory.find((i) => i.equipped === slot);
  if (cur) cur.equipped = null;
  return cur;
}

/** Equip an item. slot is optional; inferred from the item. opts.twoHanded wields a one-handed weapon in two hands. */
function equip(char, uidOrId, slot, opts = {}) {
  const inst = findItem(char, uidOrId);
  if (!inst) throw err('Item not found', 404);
  const def = ITEMS[inst.itemId];
  if (inst.equipped) unequipSlot(char, inst.equipped);
  let target = slot;
  switch (def.kind) {
    case 'weapon': {
      target = target || 'mainHand';
      if (!['mainHand', 'offHand'].includes(target)) throw err('Weapons go in mainHand or offHand');
      const twoHanded = def.use === 'two-handed' || (opts.twoHanded && def.use === 'one-handed');
      if (twoHanded) {
        if (target === 'offHand') throw err('Two-handed weapons must be wielded in mainHand');
        unequipSlot(char, 'offHand');
        const sh = char.inventory.find((i) => i.equipped === 'shield');
        if (sh && ITEMS[sh.itemId].shieldType !== 'buckler') unequipSlot(char, 'shield');
      }
      if (target === 'offHand') {
        const main = char.inventory.find((i) => i.equipped === 'mainHand');
        if (main && (ITEMS[main.itemId].use === 'two-handed' || main.twoHanded)) throw err('Your main hand weapon needs both hands');
        const sh = char.inventory.find((i) => i.equipped === 'shield');
        if (sh && ITEMS[sh.itemId].shieldType !== 'buckler') throw err('Your off hand is holding a shield');
      }
      inst.twoHanded = !!twoHanded;
      break;
    }
    case 'armor':
      target = 'armor';
      break;
    case 'shield': {
      target = 'shield';
      if (def.shieldType !== 'buckler') {
        unequipSlot(char, 'offHand');
        const main = char.inventory.find((i) => i.equipped === 'mainHand');
        if (main && main.twoHanded) main.equipped = null;
      }
      break;
    }
    case 'wondrous': {
      if (def.slot === 'none') {
        target = 'slotless';
        break;
      }
      if (def.slot === 'ring') {
        target = target && ['ring1', 'ring2'].includes(target) ? target : !char.inventory.some((i) => i.equipped === 'ring1') ? 'ring1' : 'ring2';
      } else target = def.slot;
      if (!WONDROUS_SLOTS.includes(target)) throw err(`Invalid slot ${target}`);
      break;
    }
    default:
      throw err(`${def.name} cannot be equipped`);
  }
  if (target !== 'slotless') unequipSlot(char, target);
  inst.equipped = target;
  char.touch();
  return { item: inst.uid, slot: target, name: displayName(inst) };
}

function unequip(char, uidOrSlot) {
  const inst = char.inventory.find((i) => i.uid === uidOrSlot) || char.inventory.find((i) => i.equipped === uidOrSlot);
  if (!inst || !inst.equipped) throw err('Item is not equipped');
  inst.equipped = null;
  inst.twoHanded = false;
  char.touch();
  return { item: inst.uid };
}

function pay(char, copper) {
  if (char.money < copper) throw err(`Not enough money (need ${formatMoney(copper)}, have ${formatMoney(char.money)})`, 402);
  char.money -= copper;
  char.touch();
}

function earn(char, copper) {
  char.money += Math.floor(copper);
  char.touch();
}

/** Buy from a shop at list price. */
function buy(char, itemId, opts = {}) {
  const inst = createItem(itemId, opts);
  const def = ITEMS[itemId];
  const priceGp = itemPrice(def, inst) * (opts.qty && def.qtyPer ? opts.qty / def.qtyPer : opts.qty && !def.qtyPer ? opts.qty : 1);
  if (opts.qty && !def.qtyPer) inst.qty = opts.qty;
  pay(char, toCopper(priceGp));
  return { item: addItem(char, inst), cost: toCopper(priceGp) };
}

/** Sell for half price (trade goods would be full price). */
function sell(char, uid, qty) {
  const inst = char.inventory.find((i) => i.uid === uid);
  if (!inst) throw err('Item not found', 404);
  if (inst.equipped) throw err('Unequip the item first');
  const removed = removeItem(char, uid, qty);
  const value = Math.floor(toCopper(unitValue(removed) * (removed.qty || 1)) / 2);
  earn(char, value);
  return { sold: displayName(removed), value };
}

function describeInventory(char) {
  return {
    money: char.money, moneyText: formatMoney(char.money), weight: Math.round(char.carriedWeight() * 10) / 10, load: char.load(), capacity: char.capacity(),
    items: char.inventory.map((i) => ({ uid: i.uid, itemId: i.itemId, name: displayName(i), qty: i.qty, equipped: i.equipped, kind: ITEMS[i.itemId].kind, charges: i.charges, valueGp: unitValue(i) })),
  };
}

module.exports = { createItem, addItem, removeItem, equip, unequip, buy, sell, pay, earn, describeInventory, displayName, unitValue, findItem, WONDROUS_SLOTS };
