import type {
  ActionDef,
  ConditionDef,
  DamageKind,
  EffectDef,
  Hex,
  Scale,
  Side,
  StatKey,
  StatusKind,
  TargetSel,
  TriggerDef,
} from '@/core/types';
import { Rng } from '@/core/rng';
import { Unit, type UnitInit, type UnitTracker } from './unit';
import type { BattleEvent, UnitSnapshot } from './events';
import {
  findPath,
  hexDistance,
  hexKey,
  hexLine,
  hexNeighbors,
  hexToPixel,
  hexesInRange,
  isFrontForSide,
} from './hex';

export const TICK = 1 / 20;

export interface BattleConfig {
  seed: number;
  allies: UnitInit[];
  bench?: UnitInit[];
  enemies: UnitInit[];
  tribulationAt?: number;
  enemyDamagePct?: number;
  startCombatHpLossPct?: number;
  maxTime?: number;
  spawnEnemy?: (enemyId: string, id: number) => UnitInit | null;
}

export interface QuestCounters {
  crits: number;
  kills: number;
  casts: number;
  frost: number;
  burn: number;
  poison: number;
  shield: number;
  heal: number;
  surge: number;
  enlightenment: number;
  damage: number;
  wins: number;
  stones: number;
}

export interface PermanentBuff {
  heroUid: string;
  stat: StatKey;
  flat: number;
  pct: number;
}

export interface BattleUnitResult {
  id: number;
  defId: string;
  heroUid?: string;
  name: string;
  side: Side;
  alive: boolean;
  onBoard: boolean;
  boss: boolean;
  tracker: UnitTracker;
  portrait?: string;
}

export interface BattleResult {
  winner: Side;
  duration: number;
  survivors: number;
  units: BattleUnitResult[];
  quest: QuestCounters;
  stonesBonus: number;
  permanentBuffs: PermanentBuff[];
  killedBoss: boolean;
}

interface RuntimeEffect {
  def: EffectDef;
  owner: Unit;
  key: string;
  nextAt: number;
  fired: boolean;
  lastFired: number;
}

interface TriggerCtx {
  target?: Unit;
  amount?: number;
  crit?: boolean;
  ability?: boolean;
  status?: StatusKind;
  effectKey?: string;
  untilSurgeEnd?: string;
}

interface Scheduled {
  at: number;
  seq: number;
  fn: () => void;
}

type CustomAction = (b: Battle, owner: Unit, ctx: TriggerCtx, params: Record<string, number | string>) => void;

const CUSTOM_ACTIONS: Record<string, CustomAction> = {
  execute(b, owner, ctx) {
    const t = ctx.target;
    if (!t || !t.alive) return;
    b.dealDamage(owner, t, t.hp + t.shield + 1, 'true', { canCrit: false, ability: true });
  },
  spreadBurn(b, owner, ctx) {
    const victim = ctx.target;
    if (!victim || !victim.pos || victim.burns.length === 0) return;
    for (const n of hexNeighbors(victim.pos)) {
      const u = b.unitAt(n);
      if (!u || u.side !== victim.side || !u.alive) continue;
      for (const burn of victim.burns) {
        u.burns.push({ dps: burn.dps, until: b.time + 3, sourceId: owner.id });
      }
      b.emit({ t: b.time, type: 'status', id: u.id, status: 'burn', stacks: 1, duration: 3 });
    }
  },
  shieldToAttack(b, owner, _ctx, params) {
    const ratio = Number(params.ratio ?? 0.1);
    const amt = owner.shield * ratio;
    if (amt <= 0) return;
    owner.addMod({ stat: 'attack', flat: amt, pct: 0, unique: 'shieldToAttack', source: 'custom' });
  },
  bossEnrage(b, owner) {
    owner.addMod({ stat: 'attack', flat: 0, pct: 40, source: 'enrage', unique: 'enrage' });
    owner.addMod({ stat: 'attackSpeed', flat: 40, pct: 0, source: 'enrage', unique: 'enrage-as' });
    b.emit({ t: b.time, type: 'vfx', key: 'enrage', id: owner.id });
    b.emit({ t: b.time, type: 'buff', id: owner.id, stat: 'attack', flat: 0, pct: 40, label: 'ENRAGED' });
  },
};

export class Battle {
  readonly rng: Rng;
  readonly units: Unit[] = [];
  private byId = new Map<number, Unit>();
  private effects = new Map<number, RuntimeEffect[]>();
  private scheduled: Scheduled[] = [];
  private seq = 0;
  private nextId = 1;
  private events: BattleEvent[] = [];
  private started = false;
  private activeEffects = new Set<string>();
  private depth = 0;
  private tribulationStarted = false;
  private lastTribulationTick = 0;

  time = 0;
  over = false;
  winner: Side | null = null;
  stonesBonus = 0;
  permanentBuffs: PermanentBuff[] = [];
  quest: QuestCounters = {
    crits: 0,
    kills: 0,
    casts: 0,
    frost: 0,
    burn: 0,
    poison: 0,
    shield: 0,
    heal: 0,
    surge: 0,
    enlightenment: 0,
    damage: 0,
    wins: 0,
    stones: 0,
  };
  killedBoss = false;

  readonly tribulationAt: number;
  readonly enemyDamagePct: number;
  readonly startCombatHpLossPct: number;
  readonly maxTime: number;
  private spawnEnemyFactory?: (enemyId: string, id: number) => UnitInit | null;

  constructor(cfg: BattleConfig) {
    this.rng = new Rng(cfg.seed);
    this.tribulationAt = cfg.tribulationAt ?? 50;
    this.enemyDamagePct = cfg.enemyDamagePct ?? 0;
    this.startCombatHpLossPct = cfg.startCombatHpLossPct ?? 0;
    this.maxTime = cfg.maxTime ?? 150;
    this.spawnEnemyFactory = cfg.spawnEnemy;
    for (const init of cfg.allies) this.addUnit(init, true);
    for (const init of cfg.bench ?? []) this.addUnit({ ...init, onBoard: false, pos: null }, true);
    for (const init of cfg.enemies) this.addUnit(init, true);
  }

  // ───────────────────────── setup ─────────────────────────

  private addUnit(init: UnitInit, silent = false): Unit {
    const id = init.id ?? this.nextId;
    if (id >= this.nextId) this.nextId = id + 1;
    const u = new Unit({ ...init, id });
    this.units.push(u);
    this.byId.set(u.id, u);
    const list: RuntimeEffect[] = [];
    for (const def of u.effectDefs) {
      if (!u.onBoard && !def.meditation) continue;
      list.push(this.makeRuntime(def, u));
    }
    this.effects.set(u.id, list);
    if (!silent || this.started) this.emit({ t: this.time, type: 'spawn', unit: this.snapshot(u) });
    return u;
  }

  private makeRuntime(def: EffectDef, owner: Unit): RuntimeEffect {
    const trig = def.trigger;
    const nextAt = trig.on === 'interval' ? (trig.after ?? trig.every) : 0;
    return { def, owner, key: `${owner.id}:${def.id}:${this.seq++}`, nextAt, fired: false, lastFired: -Infinity };
  }

  /** Adds an effect to a unit mid-battle (e.g. from Dao Companion pairing). */
  addEffect(u: Unit, def: EffectDef): void {
    const list = this.effects.get(u.id) ?? [];
    const rt = this.makeRuntime(def, u);
    list.push(rt);
    this.effects.set(u.id, list);
    if (this.started) this.armTimedEffect(rt);
  }

  snapshot(u: Unit): UnitSnapshot {
    return {
      id: u.id,
      side: u.side,
      defId: u.defId,
      name: u.name,
      hanzi: u.hanzi,
      hp: u.hp,
      maxHp: u.maxHp,
      qi: u.qi,
      maxQi: u.maxQi,
      shield: u.shield,
      pos: u.pos,
      sprite: u.sprite,
      scale: u.visualScale,
      accent: u.accent,
      boss: u.boss,
      elite: u.elite,
      portrait: u.portrait,
      heroUid: u.heroUid,
      rank: u.rank,
      isRanged: u.isRanged,
    };
  }

  private start(): void {
    this.started = true;
    for (const u of this.units) this.emit({ t: 0, type: 'spawn', unit: this.snapshot(u) });

    // difficulty: start-of-combat HP loss
    if (this.startCombatHpLossPct > 0) {
      for (const u of this.units) {
        if (u.side !== 'ally' || !u.onBoard) continue;
        const dmg = Math.round(u.maxHp * (this.startCombatHpLossPct / 100));
        u.hp = Math.max(1, u.hp - dmg);
      }
    }

    // passives first (they may set counters that tune later systems)
    for (const u of this.units) this.fire(u, 'passive', {});
    for (const u of this.units) {
      u.surgeBonus += u.counter('surgeBonus');
      u.enlightenmentBonus += u.counter('enlightenmentBonus');
      u.shatterPct += u.counter('shatterPct');
      u.burnHealPct += u.counter('burnHealPct');
      u.companionMult += u.counter('companionMult');
      if (u.counter('permafrost') > 0) u.permafrost = true;
      u.healPct += u.counter('healPct');
      if (u.counter('firstHitCrit') > 0) u.firstHitCrit = true;
    }

    // Dao Companions
    const allies = this.units.filter((u) => u.side === 'ally' && u.onBoard);
    const paired = new Set<number>();
    for (const u of allies) {
      if (!u.companion || paired.has(u.id)) continue;
      const partner = allies.find((o) => o.defId === u.companion && o.id !== u.id);
      if (!partner) continue;
      paired.add(u.id);
      paired.add(partner.id);
      for (const member of [u, partner]) {
        const mult = member.companionMult;
        this.addEffect(member, {
          id: 'dao_companion',
          name: 'Dao Companions',
          desc: 'Each second gain +2% Attack and +2% Spirit.',
          trigger: { on: 'interval', every: 1 },
          actions: [
            { do: 'buff', stat: 'attack', pct: 2 * mult },
            { do: 'buff', stat: 'spirit', pct: 2 * mult },
          ],
        });
      }
      this.emit({ t: 0, type: 'companion', ids: [u.id, partner.id] });
    }

    // combat start (in unit order for determinism)
    for (const u of this.units) this.fire(u, 'combatStart', {});

    // surge / enlightenment windows
    for (const u of this.units) {
      for (const rt of this.effects.get(u.id) ?? []) this.armTimedEffect(rt);
    }
  }

  private armTimedEffect(rt: RuntimeEffect): void {
    const { def, owner } = rt;
    const trig = def.trigger;
    if (trig.on === 'surge') {
      if (!owner.alive) return;
      const dur = Math.max(1, trig.duration + owner.surgeBonus);
      this.emit({ t: this.time, type: 'surge', id: owner.id, start: true, name: def.name ?? 'Surge' });
      this.quest.surge += owner.side === 'ally' ? 1 : 0;
      this.executeActions(def.actions, owner, { untilSurgeEnd: rt.key, effectKey: rt.key });
      this.schedule(this.time + dur, () => {
        for (const u of this.units) u.removeModsWhere((m) => m.untilSurgeEnd === rt.key);
        this.emit({ t: this.time, type: 'surge', id: owner.id, start: false, name: def.name ?? 'Surge' });
        this.fire(owner, 'surgeEnd', {});
      });
    } else if (trig.on === 'enlightenment') {
      const at = Math.max(0.5, trig.at - owner.enlightenmentBonus);
      this.schedule(this.time + at, () => {
        if (!owner.alive) return;
        if (!this.checkConditions(def.conditions, owner, {})) return;
        this.emit({ t: this.time, type: 'enlightenment', id: owner.id, name: def.name ?? 'Enlightenment' });
        if (owner.side === 'ally') this.quest.enlightenment++;
        this.executeActions(def.actions, owner, { effectKey: rt.key });
      });
    }
  }

  // ───────────────────────── scheduling / events ─────────────────────────

  schedule(at: number, fn: () => void): void {
    const item = { at, seq: this.seq++, fn };
    // insert sorted
    let i = this.scheduled.length;
    while (i > 0 && (this.scheduled[i - 1].at > at || (this.scheduled[i - 1].at === at && this.scheduled[i - 1].seq > item.seq))) i--;
    this.scheduled.splice(i, 0, item);
  }

  emit(e: BattleEvent): void {
    this.events.push(e);
  }

  drainEvents(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  unit(id: number): Unit | undefined {
    return this.byId.get(id);
  }

  unitAt(h: Hex): Unit | undefined {
    for (const u of this.units) {
      if (u.alive && u.onBoard && u.pos && u.pos.q === h.q && u.pos.r === h.r) return u;
    }
    return undefined;
  }

  aliveOnBoard(side?: Side): Unit[] {
    return this.units.filter((u) => u.alive && u.onBoard && (!side || u.side === side));
  }

  // ───────────────────────── main loop ─────────────────────────

  tick(dt = TICK): void {
    if (this.over) return;
    if (!this.started) this.start();
    this.time += dt;
    const now = this.time;

    // scheduled callbacks
    while (this.scheduled.length && this.scheduled[0].at <= now) {
      const s = this.scheduled.shift()!;
      s.fn();
      if (this.over) return;
    }

    for (const u of this.units) {
      if (!u.alive) continue;
      u.expire(now);
      // qi regen
      const regen = u.stat('qiRegen');
      if (regen > 0 && u.maxQi > 0 && u.onBoard) u.qi = Math.min(u.maxQi, u.qi + regen * dt);
      // DoTs
      if (u.onBoard) {
        u.dotAccumulator += dt;
        if (u.dotAccumulator >= 0.5) {
          u.dotAccumulator -= 0.5;
          this.applyDots(u);
          if (this.over) return;
        }
      }
      // interval effects
      for (const rt of this.effects.get(u.id) ?? []) {
        const trig = rt.def.trigger;
        if (trig.on !== 'interval') continue;
        if (now >= rt.nextAt) {
          rt.nextAt += trig.every;
          if (!rt.owner.alive) continue;
          if (!this.checkConditions(rt.def.conditions, rt.owner, {})) continue;
          this.executeActions(rt.def.actions, rt.owner, { effectKey: rt.key });
        }
      }
    }

    // Heavenly Tribulation
    if (now >= this.tribulationAt) {
      if (!this.tribulationStarted) {
        this.tribulationStarted = true;
        this.lastTribulationTick = now;
        this.emit({ t: now, type: 'tribulation', start: true });
      } else if (now - this.lastTribulationTick >= 1) {
        this.lastTribulationTick = now;
        const pct = 4 + (now - this.tribulationAt);
        for (const u of this.aliveOnBoard()) {
          const dmg = Math.round((u.maxHp * pct) / 100);
          this.dealDamage(u, u, dmg, 'true', { canCrit: false, dot: 'tribulation' });
        }
        if (this.over) return;
      }
    }

    // unit actions
    for (const u of this.units) {
      if (!u.alive || !u.onBoard || !u.pos) continue;
      this.actUnit(u, dt);
      if (this.over) return;
    }

    this.checkEnd();
    if (!this.over && now >= this.maxTime) this.finish('enemy');
  }

  private actUnit(u: Unit, dt: number): void {
    const now = this.time;
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    if (u.moving) {
      if (now >= u.moving.end) u.moving = null;
      else return;
    }
    if (u.isDisabled(now) || now < u.castUntil) return;

    const target = this.acquireTarget(u);
    if (!target) return;

    // face target
    const tp = hexToPixel(target.pos!);
    const up = hexToPixel(u.pos!);
    if (Math.abs(tp.x - up.x) > 1) u.facing = tp.x > up.x ? 1 : -1;

    // cast
    if (u.ability && u.maxQi > 0 && u.qi >= u.maxQi) {
      this.cast(u, target);
      return;
    }

    const dist = hexDistance(u.pos!, target.pos!);
    if (dist <= u.range) {
      if (u.attackCooldown <= 0) {
        this.beginAttack(u, target);
        u.attackCooldown = 1 / u.attacksPerSecond;
      }
      return;
    }

    // move
    const blocked = new Set<string>();
    for (const o of this.units) {
      if (o.alive && o.onBoard && o.pos && o.id !== u.id) blocked.add(hexKey(o.pos));
    }
    const path = findPath(u.pos!, target.pos!, u.range, blocked);
    if (path.length === 0) return;
    const step = path[0];
    const duration = 1 / u.moveSpeed;
    u.moving = { from: u.pos!, to: step, start: now, end: now + duration };
    const from = u.pos!;
    u.pos = step;
    const sp = hexToPixel(step);
    if (Math.abs(sp.x - up.x) > 1) u.facing = sp.x > up.x ? 1 : -1;
    this.emit({ t: now, type: 'move', id: u.id, from, to: step, duration });
  }

  private acquireTarget(u: Unit): Unit | null {
    const now = this.time;
    if (u.tauntTargetId !== null && now < u.tauntUntil) {
      const t = this.byId.get(u.tauntTargetId);
      if (t && t.alive && t.onBoard && t.pos) {
        u.targetId = t.id;
        return t;
      }
      u.tauntTargetId = null;
    }
    const enemies = this.aliveOnBoard(u.side === 'ally' ? 'enemy' : 'ally').filter((e) => e.pos);
    if (enemies.length === 0) return null;
    const cur = u.targetId !== null ? this.byId.get(u.targetId) : undefined;
    if (cur && cur.alive && cur.onBoard && cur.pos) {
      const sticky = u.targeting === 'lowestHp' || hexDistance(u.pos!, cur.pos) <= u.range;
      if (sticky) return cur;
    }
    let best: Unit | null = null;
    switch (u.targeting) {
      case 'lowestHp': {
        let bestHp = Infinity;
        for (const e of enemies) if (e.hp < bestHp) ((bestHp = e.hp), (best = e));
        break;
      }
      case 'farthest': {
        let bestD = -1;
        for (const e of enemies) {
          const d = hexDistance(u.pos!, e.pos!);
          if (d > bestD) ((bestD = d), (best = e));
        }
        break;
      }
      case 'random':
        best = this.rng.pick(enemies);
        break;
      default: {
        let bestD = Infinity;
        let bestHp = Infinity;
        for (const e of enemies) {
          const d = hexDistance(u.pos!, e.pos!);
          if (d < bestD || (d === bestD && e.hpPct < bestHp)) {
            bestD = d;
            bestHp = e.hpPct;
            best = e;
          }
        }
      }
    }
    u.targetId = best ? best.id : null;
    return best;
  }

  // ───────────────────────── attacks & casts ─────────────────────────

  private beginAttack(u: Unit, target: Unit): void {
    const now = this.time;
    const ranged = u.isRanged;
    const dist = hexDistance(u.pos!, target.pos!);
    const hitDelay = ranged ? 0.2 + dist * 0.05 : 0.22;
    this.emit({
      t: now,
      type: 'attack',
      id: u.id,
      targetId: target.id,
      projectile: ranged ? (u.projectile ?? 'spirit_bolt') : undefined,
      hitDelay,
      ranged,
    });
    this.schedule(now + hitDelay, () => {
      if (!u.alive || !target.alive || !target.onBoard) return;
      const raw = this.evalScale(u.attackScale, u, target, {});
      const dealt = this.dealDamage(u, target, raw, 'physical', { canCrit: true, attack: true, forceCrit: u.firstHitCrit });
      u.firstHitCrit = false;
      if (dealt > 0 || true) {
        this.gainQi(u, 5);
        this.gainQi(target, 3);
      }
    });
  }

  private cast(u: Unit, target: Unit): void {
    const ab = u.ability!;
    const now = this.time;
    const castTime = ab.castTime ?? 0.6;
    u.qi = 0;
    u.castUntil = now + castTime;
    u.tracker.casts++;
    if (u.side === 'ally') this.quest.casts++;
    this.emit({ t: now, type: 'qi', id: u.id, qi: 0, maxQi: u.maxQi });
    this.emit({
      t: now,
      type: 'cast',
      id: u.id,
      name: ab.name,
      castTime,
      vfx: ab.vfx,
      animation: ab.animation ?? 'cast',
    });
    this.schedule(now + castTime * 0.55, () => {
      if (!u.alive) return;
      const tgt = target.alive && target.onBoard ? target : this.acquireTarget(u) ?? undefined;
      this.executeActions(ab.actions, u, { target: tgt, ability: true });
      this.fire(u, 'cast', { target: tgt, ability: true });
    });
  }

  gainQi(u: Unit, amount: number): void {
    if (u.maxQi <= 0 || !u.alive) return;
    const before = u.qi;
    u.qi = Math.min(u.maxQi, u.qi + amount);
    if (u.qi !== before) this.emit({ t: this.time, type: 'qi', id: u.id, qi: u.qi, maxQi: u.maxQi });
  }

  // ───────────────────────── damage pipeline ─────────────────────────

  dealDamage(
    src: Unit,
    tgt: Unit,
    raw: number,
    kind: DamageKind,
    o: { canCrit?: boolean; attack?: boolean; ability?: boolean; dot?: StatusKind | 'tribulation'; forceCrit?: boolean } = {},
  ): number {
    if (!tgt.alive || raw <= 0) return 0;
    const now = this.time;
    let amount = raw;
    let crit = false;
    if (kind !== 'true' && (o.canCrit ?? true) && !o.dot) {
      const c = src.stat('crit');
      if (o.forceCrit || this.rng.chance(c)) {
        crit = true;
        amount *= 2 + Math.max(0, c - 100) / 100;
      }
    }
    if (kind !== 'true') {
      const def = tgt.stat('defense');
      amount *= 100 / (100 + def);
    }
    if (src.side === 'enemy' && this.enemyDamagePct && src.id !== tgt.id) amount *= 1 + this.enemyDamagePct / 100;
    if (now < tgt.frozenUntil && src.shatterPct > 0) amount *= 1 + src.shatterPct / 100;
    amount = Math.max(1, Math.round(amount));

    const absorbed = tgt.absorb(amount);
    const hpDmg = amount - absorbed;
    tgt.hp -= hpDmg;

    if (src.id !== tgt.id) {
      src.tracker.damageDealt += amount;
      if (amount > src.tracker.bestHit) src.tracker.bestHit = amount;
      if (src.side === 'ally') this.quest.damage += amount;
    }
    tgt.tracker.damageTaken += amount;

    this.emit({
      t: now,
      type: 'damage',
      id: tgt.id,
      sourceId: src.id,
      amount,
      absorbed,
      crit,
      kind,
      dot: o.dot,
      hp: Math.max(0, tgt.hp),
      shield: tgt.shield,
    });

    if (!o.dot && src.id !== tgt.id) {
      const vamp = src.stat('omnivamp');
      if (vamp > 0) this.heal(src, src, (amount * vamp) / 100, { silentTrigger: true });
      if (crit) {
        src.tracker.crits++;
        if (src.side === 'ally') this.quest.crits++;
        this.fire(src, 'crit', { target: tgt, amount, crit, ability: o.ability });
      }
      this.fire(src, 'hit', { target: tgt, amount, crit, ability: o.ability });
      if (o.attack) this.fire(src, 'autoAttack', { target: tgt, amount, crit });
      if (tgt.alive) this.fire(tgt, 'damaged', { target: src, amount, crit, ability: o.ability });
    }

    if (tgt.alive) this.checkHpBelow(tgt);
    if (tgt.hp <= 0 && tgt.alive) this.kill(tgt, src);
    return amount;
  }

  private checkHpBelow(u: Unit): void {
    for (const rt of this.effects.get(u.id) ?? []) {
      const trig = rt.def.trigger;
      if (trig.on !== 'hpBelow' || rt.fired) continue;
      if (u.hpPct * 100 < trig.pct) {
        rt.fired = true;
        if (!this.checkConditions(rt.def.conditions, u, {})) continue;
        this.executeActions(rt.def.actions, u, { effectKey: rt.key });
      }
    }
  }

  private kill(victim: Unit, killer: Unit): void {
    // death triggers may revive
    this.fire(victim, 'death', { target: killer });
    if (victim.hp > 0) return;
    victim.hp = 0;
    victim.alive = false;
    victim.deathTime = this.time;
    victim.moving = null;
    victim.burns = [];
    victim.bleeds = [];
    victim.shields = [];
    this.emit({ t: this.time, type: 'death', id: victim.id });
    if (victim.boss && victim.side === 'enemy') this.killedBoss = true;
    if (killer.id !== victim.id && killer.side !== victim.side) {
      killer.tracker.kills++;
      if (killer.side === 'ally') this.quest.kills++;
      this.fire(killer, 'kill', { target: victim });
    }
    for (const u of this.units) {
      if (u.id === victim.id) continue;
      if (u.targetId === victim.id) u.targetId = null;
      if (u.tauntTargetId === victim.id) u.tauntTargetId = null;
      if (u.alive && u.side === victim.side && u.onBoard) this.fire(u, 'allyDied', { target: victim });
    }
    this.checkEnd();
  }

  heal(src: Unit, tgt: Unit, amount: number, o: { cleanse?: boolean; silentTrigger?: boolean } = {}): number {
    if (!tgt.alive || amount <= 0) return 0;
    // Hundred Herbs Valley: stronger healing (not lifesteal or burn-heals, which are silent)
    if (!o.silentTrigger && src.healPct) amount *= 1 + src.healPct / 100;
    amount = Math.round(amount);
    const before = tgt.hp;
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
    const healed = tgt.hp - before;
    src.tracker.healing += healed;
    if (src.side === 'ally') this.quest.heal += healed;
    if (o.cleanse) this.cleanse(tgt);
    this.emit({ t: this.time, type: 'heal', id: tgt.id, sourceId: src.id, amount: healed, hp: tgt.hp });
    if (!o.silentTrigger) this.fire(src, 'healed', { target: tgt, amount: healed });
    return healed;
  }

  addShield(src: Unit, tgt: Unit, amount: number, lasting: boolean, duration = 6): void {
    if (!tgt.alive || amount <= 0) return;
    amount = Math.round(amount);
    tgt.shields.push({ amount, until: lasting ? Infinity : this.time + duration });
    src.tracker.shielding += amount;
    if (src.side === 'ally') this.quest.shield += amount;
    this.emit({ t: this.time, type: 'shield', id: tgt.id, amount, shield: tgt.shield, lasting });
    this.fire(tgt, 'shieldGained', { target: src, amount });
  }

  applyStatus(src: Unit, tgt: Unit, status: StatusKind, stacks: number, duration: number | undefined, dps: number): void {
    if (!tgt.alive) return;
    const now = this.time;
    let dur = duration ?? 4;
    switch (status) {
      case 'burn':
        tgt.burns.push({ dps: Math.max(1, dps), until: now + dur, sourceId: src.id });
        if (src.side === 'ally') this.quest.burn += stacks;
        break;
      case 'bleed':
        tgt.bleeds.push({ dps: Math.max(1, dps), until: now + dur, sourceId: src.id });
        break;
      case 'poison':
        tgt.poison += stacks;
        tgt.poisonSourceId = src.id;
        if (src.side === 'ally') this.quest.poison += stacks;
        dur = 0;
        break;
      case 'frost':
        tgt.frost += stacks;
        tgt.frostUntil = now + (duration ?? 5);
        if (src.side === 'ally') this.quest.frost += stacks;
        if (tgt.frost >= 60) {
          tgt.frost = 0;
          tgt.frozenUntil = now + 1.5;
          this.emit({ t: now, type: 'status', id: tgt.id, status: 'stun', stacks: 0, duration: 1.5 });
          this.emit({ t: now, type: 'vfx', key: 'freeze', id: tgt.id });
        }
        break;
      case 'stun':
        tgt.stunUntil = Math.max(tgt.stunUntil, now + (duration ?? 1));
        dur = duration ?? 1;
        break;
      case 'taunt':
        tgt.tauntTargetId = src.id;
        tgt.tauntUntil = now + (duration ?? 3);
        tgt.targetId = src.id;
        dur = duration ?? 3;
        break;
      case 'weaken':
        tgt.addMod({ stat: 'attack', flat: 0, pct: -stacks, expiresAt: now + dur, source: 'weaken', unique: `weaken:${src.id}` });
        break;
      case 'sunder':
        tgt.addMod({ stat: 'defense', flat: -stacks, pct: 0, expiresAt: duration ? now + dur : undefined, source: 'sunder' });
        break;
    }
    this.emit({ t: now, type: 'status', id: tgt.id, status, stacks, duration: dur });
    this.fire(src, 'statusApplied', { target: tgt, status, amount: stacks });
  }

  cleanse(u: Unit): void {
    u.burns = [];
    u.bleeds = [];
    u.poison = 0;
    u.frost = 0;
    u.stunUntil = 0;
    u.frozenUntil = 0;
    u.removeModsWhere((m) => m.flat < 0 || m.pct < 0);
    this.emit({ t: this.time, type: 'cleanse', id: u.id });
  }

  private applyDots(u: Unit): void {
    if (!u.alive) return;
    if (u.burns.length) {
      let total = 0;
      let srcId = u.burns[0].sourceId;
      for (const b of u.burns) ((total += b.dps * 0.5), (srcId = b.sourceId));
      const src = this.byId.get(srcId) ?? u;
      const dealt = this.dealDamage(src, u, total, 'true', { canCrit: false, dot: 'burn' });
      if (src.burnHealPct > 0 && dealt > 0) {
        const allies = this.aliveOnBoard(src.side);
        const low = allies.sort((a, b) => a.hpPct - b.hpPct)[0];
        if (low) this.heal(src, low, (dealt * src.burnHealPct) / 100, { silentTrigger: true });
      }
      if (!u.alive) return;
    }
    if (u.bleeds.length) {
      let total = 0;
      let srcId = u.bleeds[0].sourceId;
      for (const b of u.bleeds) ((total += b.dps * 0.5), (srcId = b.sourceId));
      const src = this.byId.get(srcId) ?? u;
      this.dealDamage(src, u, total, 'true', { canCrit: false, dot: 'bleed' });
      if (!u.alive) return;
    }
    if (u.poison > 0) {
      const src = this.byId.get(u.poisonSourceId) ?? u;
      const dmg = u.poison * 2 * 0.5;
      this.dealDamage(src, u, dmg, 'true', { canCrit: false, dot: 'poison' });
      u.poison = Math.max(0, u.poison - 0.5);
      if (u.poison < 0.5) u.poison = 0;
    }
  }

  // ───────────────────────── effect interpreter ─────────────────────────

  fire(u: Unit, on: TriggerDef['on'], ctx: TriggerCtx): void {
    const list = this.effects.get(u.id);
    if (!list) return;
    for (const rt of list) {
      const def = rt.def;
      if (def.trigger.on !== on) continue;
      if (!u.alive && on !== 'death') continue;
      if (def.trigger.on === 'statusApplied' && def.trigger.status !== ctx.status) continue;
      if (def.once && rt.fired) continue;
      if (def.cooldown && this.time - rt.lastFired < def.cooldown) continue;
      if (this.activeEffects.has(rt.key) || this.depth > 8) continue; // re-entrancy guard
      if (!this.checkConditions(def.conditions, u, ctx)) continue;
      rt.fired = true;
      rt.lastFired = this.time;
      this.activeEffects.add(rt.key);
      this.depth++;
      try {
        this.executeActions(def.actions, u, { ...ctx, effectKey: rt.key });
      } finally {
        this.activeEffects.delete(rt.key);
        this.depth--;
      }
    }
  }

  checkConditions(conds: ConditionDef[] | undefined, u: Unit, ctx: TriggerCtx): boolean {
    if (!conds) return true;
    for (const c of conds) {
      switch (c.if) {
        case 'shielded':
          if (u.shield <= 0) return false;
          break;
        case 'notShielded':
          if (u.shield > 0) return false;
          break;
        case 'chance':
          if (!this.rng.chance(c.pct)) return false;
          break;
        case 'targetHpBelow':
          if (!ctx.target || ctx.target.hpPct * 100 >= c.pct) return false;
          break;
        case 'targetHpAbove':
          if (!ctx.target || ctx.target.hpPct * 100 <= c.pct) return false;
          break;
        case 'selfHpBelow':
          if (u.hpPct * 100 >= c.pct) return false;
          break;
        case 'hasClass':
          if (!u.hasClass(c.class)) return false;
          break;
        case 'targetHasStatus':
          if (!ctx.target || !this.hasStatus(ctx.target, c.status)) return false;
          break;
        case 'frontRow':
          if (!u.pos || !isFrontForSide(u.pos, u.side)) return false;
          break;
        case 'backRow':
          if (!u.pos || isFrontForSide(u.pos, u.side)) return false;
          break;
        case 'companionPresent':
          if (!u.companion || !this.aliveOnBoard(u.side).some((o) => o.defId === u.companion)) return false;
          break;
        case 'isMelee':
          if (u.isRanged) return false;
          break;
        case 'isRanged':
          if (!u.isRanged) return false;
          break;
        case 'triggerWasCrit':
          if (!ctx.crit) return false;
          break;
        case 'triggerWasAbility':
          if (!ctx.ability) return false;
          break;
        case 'counterAtLeast':
          if (u.counter(c.key) < c.value) return false;
          break;
      }
    }
    return true;
  }

  hasStatus(u: Unit, s: StatusKind): boolean {
    const now = this.time;
    switch (s) {
      case 'burn':
        return u.burns.length > 0;
      case 'bleed':
        return u.bleeds.length > 0;
      case 'poison':
        return u.poison > 0;
      case 'frost':
        return u.frost > 0 || now < u.frozenUntil;
      case 'stun':
        return now < u.stunUntil || now < u.frozenUntil;
      case 'taunt':
        return u.tauntTargetId !== null;
      default:
        return false;
    }
  }

  evalScale(s: Scale, src: Unit, tgt: Unit | undefined, ctx: TriggerCtx): number {
    let v = s.base ?? 0;
    if (s.attack) v += src.stat('attack') * s.attack;
    if (s.spirit) v += src.stat('spirit') * s.spirit;
    if (s.maxHp) v += src.maxHp * s.maxHp;
    if (s.currentHp) v += src.hp * s.currentHp;
    if (s.missingHp) v += (src.maxHp - src.hp) * s.missingHp;
    if (s.shield) v += src.shield * s.shield;
    if (s.defense) v += src.stat('defense') * s.defense;
    if (s.crit) v += src.stat('crit') * s.crit;
    if (s.attackSpeed) v += src.stat('attackSpeed') * s.attackSpeed;
    if (s.maxQi) v += src.maxQi * s.maxQi;
    if (s.perRank) v += src.rank * s.perRank;
    if (s.counter) v += src.counter(s.counter.key) * s.counter.mult;
    if (s.targetMaxHp && tgt) v += tgt.maxHp * s.targetMaxHp;
    if (s.triggerAmount && ctx.amount) v += ctx.amount * s.triggerAmount;
    return v;
  }

  resolveTargets(sel: TargetSel | undefined, u: Unit, ctx: TriggerCtx): Unit[] {
    const kind = typeof sel === 'string' ? sel : (sel?.kind ?? 'self');
    const count = typeof sel === 'object' ? sel.count : undefined;
    const radius = typeof sel === 'object' ? (sel.radius ?? 1) : 1;
    const includeSelf = typeof sel === 'object' ? !!sel.includeSelf : false;
    const foes = this.aliveOnBoard(u.side === 'ally' ? 'enemy' : 'ally').filter((e) => e.pos);
    const friends = this.aliveOnBoard(u.side).filter((e) => e.pos);
    const ref = ctx.target && ctx.target.alive ? ctx.target : undefined;
    const curTarget = ref ?? (u.targetId !== null ? this.byId.get(u.targetId) : undefined);
    const anchor = u.pos ?? curTarget?.pos ?? null;
    const byDist = (list: Unit[], from: Hex | null) =>
      from ? list.slice().sort((a, b) => hexDistance(from, a.pos!) - hexDistance(from, b.pos!)) : list.slice();

    switch (kind) {
      case 'self':
        return [u];
      case 'target':
        return curTarget && curTarget.alive && curTarget.onBoard ? [curTarget] : foes.length ? [byDist(foes, anchor)[0]] : [];
      case 'triggerTarget':
        return ref ? [ref] : [];
      case 'nearestEnemy':
        return foes.length ? [byDist(foes, anchor)[0]] : [];
      case 'nearestEnemies':
        return byDist(foes, anchor).slice(0, count ?? 3);
      case 'lowestHpEnemy': {
        if (!foes.length) return [];
        return [foes.slice().sort((a, b) => a.hp - b.hp)[0]];
      }
      case 'highestHpEnemy': {
        if (!foes.length) return [];
        return [foes.slice().sort((a, b) => b.hp - a.hp)[0]];
      }
      case 'randomEnemy':
        return foes.length ? this.rng.pickN(foes, count ?? 1) : [];
      case 'farthestEnemy':
        return foes.length ? [byDist(foes, anchor).reverse()[0]] : [];
      case 'allEnemies':
        return foes;
      case 'enemiesAroundTarget': {
        const center = curTarget?.pos ?? (foes.length ? byDist(foes, anchor)[0].pos : null);
        if (!center) return [];
        const set = new Set(hexesInRange(center, radius).map(hexKey));
        const list = foes.filter((f) => set.has(hexKey(f.pos!)));
        return count ? list.slice(0, count) : list;
      }
      case 'enemiesAdjacent': {
        if (!u.pos) return [];
        const set = new Set(hexesInRange(u.pos, radius, true).map(hexKey));
        return foes.filter((f) => set.has(hexKey(f.pos!)));
      }
      case 'lineThroughTarget': {
        const tgt = curTarget && curTarget.pos ? curTarget : foes.length ? byDist(foes, anchor)[0] : null;
        if (!tgt || !u.pos) return [];
        const line = hexLine(u.pos, tgt.pos!, 3);
        const set = new Set(line.map(hexKey));
        return foes.filter((f) => set.has(hexKey(f.pos!)));
      }
      case 'lowestHpAlly': {
        const pool = includeSelf || !u.onBoard ? friends : friends.filter((f) => f.id !== u.id).concat(u.onBoard ? [u] : []);
        if (!pool.length) return [];
        return [pool.slice().sort((a, b) => a.hpPct - b.hpPct)[0]];
      }
      case 'randomAlly':
        return friends.length ? this.rng.pickN(friends, count ?? 1) : [];
      case 'allAllies':
        return friends;
      case 'otherAllies':
        return friends.filter((f) => f.id !== u.id);
      case 'alliesAdjacent': {
        if (!u.pos) return [];
        const set = new Set(hexesInRange(u.pos, radius, !includeSelf).map(hexKey));
        return friends.filter((f) => set.has(hexKey(f.pos!)));
      }
      case 'frontAllies':
        return friends.filter((f) => isFrontForSide(f.pos!, f.side));
      case 'backAllies':
        return friends.filter((f) => !isFrontForSide(f.pos!, f.side));
      case 'allUnits':
        return this.aliveOnBoard();
    }
    return [];
  }

  executeActions(actions: ActionDef[], u: Unit, ctx: TriggerCtx): void {
    for (const a of actions) {
      if (this.over) return;
      this.executeAction(a, u, ctx);
    }
  }

  private executeAction(a: ActionDef, u: Unit, ctx: TriggerCtx): void {
    const now = this.time;
    switch (a.do) {
      case 'buff': {
        const targets = this.resolveTargets(a.target ?? 'self', u, ctx);
        for (const t of targets) {
          const flat = (a.flat ?? 0) + (a.scale ? this.evalScale(a.scale, u, t, ctx) : 0);
          const pct = a.pct ?? 0;
          const source = ctx.effectKey ?? 'buff';
          if (a.maxStacks && t.countMods(source) >= a.maxStacks) continue;
          const added = t.addMod({
            stat: a.stat,
            flat,
            pct,
            expiresAt: a.duration ? now + a.duration : undefined,
            untilSurgeEnd: a.untilSurgeEnd || (ctx.untilSurgeEnd && !a.duration) ? ctx.untilSurgeEnd : undefined,
            unique: a.unique ? `${source}:${a.unique}` : undefined,
            source,
          });
          if (added && (Math.abs(flat) >= 1 || Math.abs(pct) >= 1))
            this.emit({ t: now, type: 'buff', id: t.id, stat: a.stat, flat: Math.round(flat), pct });
        }
        break;
      }
      case 'damage': {
        const targets = this.resolveTargets(a.target, u, ctx);
        const kind = a.kind ?? 'magic';
        for (const t of targets) {
          const raw = this.evalScale(a.scale, u, t, ctx);
          const apply = () => {
            if (!u.alive || !t.alive) return;
            this.dealDamage(u, t, raw, kind, { canCrit: a.canCrit ?? true, attack: a.asAttack, ability: ctx.ability || !a.asAttack });
            if (a.asAttack) this.gainQi(u, 5);
          };
          if (a.vfx) this.emit({ t: now, type: 'vfx', key: a.vfx, id: u.id, targetId: t.id, pos: t.pos ?? undefined });
          if (a.projectile && u.pos && t.pos) {
            const d = hexDistance(u.pos, t.pos);
            const delay = 0.15 + d * 0.05;
            this.emit({ t: now, type: 'attack', id: u.id, targetId: t.id, projectile: a.projectile, hitDelay: delay, ranged: true });
            this.schedule(now + delay, apply);
          } else apply();
        }
        break;
      }
      case 'heal': {
        const targets = this.resolveTargets(a.target, u, ctx);
        for (const t of targets) {
          const amt = this.evalScale(a.scale, u, t, ctx);
          if (a.vfx) this.emit({ t: now, type: 'vfx', key: a.vfx, id: u.id, targetId: t.id });
          this.heal(u, t, amt, { cleanse: a.cleanse });
        }
        break;
      }
      case 'shield': {
        const targets = this.resolveTargets(a.target, u, ctx);
        for (const t of targets) {
          const amt = this.evalScale(a.scale, u, t, ctx);
          if (a.vfx) this.emit({ t: now, type: 'vfx', key: a.vfx, id: u.id, targetId: t.id });
          this.addShield(u, t, amt, !!a.lasting, a.duration ?? 6);
        }
        break;
      }
      case 'status': {
        const targets = this.resolveTargets(a.target, u, ctx);
        for (const t of targets) {
          const dps = a.scale ? this.evalScale(a.scale, u, t, ctx) : 10;
          this.applyStatus(u, t, a.status, a.stacks ?? 1, a.duration, dps);
        }
        break;
      }
      case 'cleanse': {
        for (const t of this.resolveTargets(a.target, u, ctx)) this.cleanse(t);
        break;
      }
      case 'qi': {
        for (const t of this.resolveTargets(a.target, u, ctx)) {
          const amt = a.amount + (a.pctMax ? (t.maxQi * a.pctMax) / 100 : 0);
          this.gainQi(t, amt);
        }
        break;
      }
      case 'revive': {
        if (u.hp <= 0 && !u.revived) {
          u.revived = true;
          u.hp = Math.max(1, Math.round((u.maxHp * a.pct) / 100));
          this.cleanse(u);
          this.emit({ t: now, type: 'revive', id: u.id, hp: u.hp });
        }
        break;
      }
      case 'blink': {
        const targets = this.resolveTargets(a.target, u, ctx);
        const t = targets[0];
        if (!t || !t.pos) break;
        const free = hexNeighbors(t.pos).filter((h) => !this.unitAt(h));
        if (free.length === 0) break;
        // prefer the hex behind the target (farther from our start)
        const from = u.pos;
        free.sort((x, y) => (from ? hexDistance(y, from) - hexDistance(x, from) : 0));
        const dest = free[0];
        u.moving = null;
        u.pos = dest;
        u.targetId = t.id;
        const tp = hexToPixel(t.pos);
        const dp = hexToPixel(dest);
        u.facing = tp.x >= dp.x ? 1 : -1;
        this.emit({ t: now, type: 'blink', id: u.id, from, to: dest });
        break;
      }
      case 'repeat': {
        for (let i = 0; i < a.times; i++) {
          const at = now + i * a.interval;
          if (i === 0) this.executeActions(a.actions, u, ctx);
          else
            this.schedule(at, () => {
              if (u.alive) this.executeActions(a.actions, u, ctx);
            });
        }
        break;
      }
      case 'convertStat': {
        const amt = u.stat(a.from) * a.ratio;
        u.addMod({ stat: a.to, flat: amt, pct: 0, unique: `convert:${a.from}:${a.to}`, source: ctx.effectKey ?? 'convert' });
        this.emit({ t: now, type: 'buff', id: u.id, stat: a.to, flat: Math.round(amt), pct: 0 });
        break;
      }
      case 'counter': {
        for (const t of this.resolveTargets(a.target ?? 'self', u, ctx)) {
          if (a.set !== undefined) t.addCounter(a.key, a.set - t.counter(a.key));
          else t.addCounter(a.key, (a.add ?? 0) + (a.scale ? this.evalScale(a.scale, u, t, ctx) : 0));
        }
        break;
      }
      case 'stones': {
        this.stonesBonus += a.amount;
        this.quest.stones += a.amount;
        this.emit({ t: now, type: 'stones', amount: a.amount, sourceId: u.id });
        this.fire(u, 'stonesEarned', { amount: a.amount });
        break;
      }
      case 'permanentBuff': {
        for (const t of this.resolveTargets(a.target ?? 'self', u, ctx)) {
          if (t.heroUid) this.permanentBuffs.push({ heroUid: t.heroUid, stat: a.stat, flat: a.flat ?? 0, pct: a.pct ?? 0 });
          t.addMod({ stat: a.stat, flat: a.flat ?? 0, pct: a.pct ?? 0, source: 'permanent' });
          this.emit({ t: now, type: 'buff', id: t.id, stat: a.stat, flat: a.flat ?? 0, pct: a.pct ?? 0, label: 'PERMANENT' });
        }
        break;
      }
      case 'summon': {
        if (!this.spawnEnemyFactory || !u.pos) break;
        for (let i = 0; i < a.count; i++) {
          const init = this.spawnEnemyFactory(a.enemyId, this.nextId);
          if (!init) break;
          const free = hexesInRange(u.pos, 2, true).filter((h) => !this.unitAt(h));
          if (free.length === 0) break;
          const pos = this.rng.pick(free);
          const nu = this.addUnit({ ...init, side: u.side, pos, onBoard: true, isSummon: true });
          this.emit({ t: now, type: 'vfx', key: 'summon', id: nu.id });
        }
        break;
      }
      case 'vfx': {
        const targets = a.target ? this.resolveTargets(a.target, u, ctx) : [u];
        for (const t of targets) this.emit({ t: now, type: 'vfx', key: a.key, id: u.id, targetId: t.id, pos: t.pos ?? undefined });
        break;
      }
      case 'custom': {
        const fn = CUSTOM_ACTIONS[a.id];
        if (fn) fn(this, u, ctx, a.params ?? {});
        break;
      }
    }
  }

  // ───────────────────────── end ─────────────────────────

  private checkEnd(): void {
    if (this.over) return;
    const allies = this.aliveOnBoard('ally').length;
    const enemies = this.aliveOnBoard('enemy').length;
    if (enemies === 0) this.finish('ally');
    else if (allies === 0) this.finish('enemy');
  }

  private finish(winner: Side): void {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    if (winner === 'ally') this.quest.wins = 1;
    this.emit({ t: this.time, type: 'end', winner });
  }

  /** Runs headless until the fight ends. */
  run(): BattleResult {
    while (!this.over) this.tick(TICK);
    return this.result();
  }

  result(): BattleResult {
    const winner = this.winner ?? 'enemy';
    return {
      winner,
      duration: this.time,
      survivors: this.aliveOnBoard('ally').filter((u) => !u.isSummon).length,
      units: this.units.map((u) => ({
        id: u.id,
        defId: u.defId,
        heroUid: u.heroUid,
        name: u.name,
        side: u.side,
        alive: u.alive,
        onBoard: u.onBoard,
        boss: u.boss,
        tracker: { ...u.tracker },
        portrait: u.portrait,
      })),
      quest: { ...this.quest },
      stonesBonus: this.stonesBonus,
      permanentBuffs: this.permanentBuffs.slice(),
      killedBoss: this.killedBoss,
    };
  }
}
