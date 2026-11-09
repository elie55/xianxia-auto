import { Howl, Howler } from 'howler';
import { computed, effect } from '@preact/signals';
import { meta } from '@/app/store';

type MusicKey = 'menu' | 'battle' | 'boss' | 'shop' | 'event' | 'realm2shop' | 'victory';

const MUSIC: Record<MusicKey, { src: string; loop: boolean; volume: number }> = {
  menu: { src: './assets/audio/music/menu_shenxian.mp3', loop: true, volume: 0.7 },
  battle: { src: './assets/audio/music/battle_wuxia.mp3', loop: true, volume: 0.6 },
  boss: { src: './assets/audio/music/boss_wuxia2.mp3', loop: true, volume: 0.65 },
  shop: { src: './assets/audio/music/shop_shenyang.mp3', loop: true, volume: 0.55 },
  event: { src: './assets/audio/music/event_ishikari_lore.mp3', loop: true, volume: 0.55 },
  realm2shop: { src: './assets/audio/music/realm2_shop_wuxia2_guzheng.mp3', loop: true, volume: 0.55 },
  victory: { src: './assets/audio/music/fanfares_10.ogg', loop: false, volume: 0.7 },
};

/** SFX keys → files under /assets/audio/sfx (multiple variants allowed). */
const SFX: Record<string, string[]> = {
  ui_click: ['ui_click.ogg'],
  ui_hover: ['ui_hover.wav'],
  ui_flip: ['ui_flip.wav'],
  ui_confirm: ['ui_confirm.ogg'],
  ui_back: ['ui_back.ogg'],
  ui_card: ['ui_card.ogg'],
  ui_reroll: ['ui_reroll.ogg'],
  ui_buy: ['ui_buy.ogg'],
  ui_sell: ['ui_sell.ogg'],
  ui_error: ['ui_error.ogg'],
  ui_equip: ['ui_equip.ogg'],
  ui_drop: ['ui_drop.ogg'],
  stones: ['stones_1.ogg', 'stones_2.ogg'],
  hit_melee: ['hit_1.ogg', 'hit_2.ogg', 'hit_3.ogg'],
  hit_crit: ['crit_1.ogg', 'crit_2.ogg'],
  swing: ['swing_1.ogg', 'swing_2.ogg', 'swing_3.ogg'],
  sword: ['sword_1.ogg', 'sword_2.ogg', 'sword_3.ogg'],
  cast: ['cast_1.ogg', 'cast_2.ogg', 'cast_3.ogg'],
  fire: ['fire.ogg'],
  frost: ['frost.ogg'],
  lightning: ['lightning_1.ogg', 'lightning_2.ogg'],
  heal: ['heal.ogg'],
  shield: ['shield.ogg'],
  poison: ['poison.ogg'],
  death: ['death_1.ogg', 'death_2.ogg'],
  blink: ['blink.ogg'],
  victory: ['victory.ogg'],
  defeat: ['defeat.ogg'],
  rankup: ['rankup.ogg'],
  fight_start: ['fight_start.ogg'],
  tribulation: ['tribulation.ogg'],
  boss_roar: ['boss_roar.ogg'],
};

class AudioManager {
  private music: Howl | null = null;
  private musicKey: MusicKey | null = null;
  private sfxCache = new Map<string, Howl>();
  private unlocked = false;
  private pendingMusic: MusicKey | null = null;
  private lastSfx = new Map<string, number>();

  constructor() {
    const unlock = () => {
      this.unlocked = true;
      if (this.pendingMusic) {
        const k = this.pendingMusic;
        this.pendingMusic = null;
        this.playMusic(k);
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // The Music slider (Settings screen and pause menu) applies at once to the track that is playing. Before, only
    // the next track read the setting, so music went on at the old volume, even at 0%.
    const musicSetting = computed(() => meta.value.settings.music);
    effect(() => {
      const setting = musicSetting.value;
      if (this.music && this.musicKey) this.music.volume(MUSIC[this.musicKey].volume * setting);
    });
  }

  get musicVolume(): number {
    return meta.value.settings.music;
  }
  get sfxVolume(): number {
    return meta.value.settings.sfx;
  }

  playMusic(key: MusicKey): void {
    if (!this.unlocked) {
      this.pendingMusic = key;
      return;
    }
    if (this.musicKey === key && this.music?.playing()) return;
    const def = MUSIC[key];
    const old = this.music;
    if (old) {
      old.fade(old.volume(), 0, 700);
      setTimeout(() => old.unload(), 800);
    }
    const h = new Howl({ src: [def.src], loop: def.loop, volume: 0, html5: true });
    h.play();
    // fade in; at 0% there is nothing to fade, and Howler never ends a 0 → 0 fade, which would hold back any
    // volume change queued behind it while the track loads
    const target = def.volume * this.musicVolume;
    if (target > 0) h.fade(0, target, 900);
    this.music = h;
    this.musicKey = key;
  }

  stopMusic(): void {
    if (this.music) {
      const old = this.music;
      old.fade(old.volume(), 0, 600);
      setTimeout(() => old.unload(), 700);
      this.music = null;
      this.musicKey = null;
    }
  }

  applyVolumes(): void {
    if (this.music && this.musicKey) this.music.volume(MUSIC[this.musicKey].volume * this.musicVolume);
  }

  sfx(key: string, opts: { volume?: number; rate?: number; throttleMs?: number } = {}): void {
    const files = SFX[key];
    if (!files || !this.unlocked) return;
    const now = performance.now();
    const throttle = opts.throttleMs ?? 40;
    if (now - (this.lastSfx.get(key) ?? -Infinity) < throttle) return;
    this.lastSfx.set(key, now);
    const file = files[Math.floor(Math.random() * files.length)];
    let h = this.sfxCache.get(file);
    if (!h) {
      h = new Howl({ src: [`./assets/audio/sfx/${file}`], volume: 1, preload: true });
      this.sfxCache.set(file, h);
    }
    const id = h.play();
    h.volume((opts.volume ?? 1) * this.sfxVolume, id);
    h.rate(opts.rate ?? 0.95 + Math.random() * 0.1, id);
  }

  mute(m: boolean): void {
    Howler.mute(m);
  }
}

export const audio = new AudioManager();
