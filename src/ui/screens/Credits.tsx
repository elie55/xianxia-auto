import { screen } from '@/app/store';
import { Icon } from '@/ui/components/Icon';
import { audio } from '@/audio/AudioManager';

export function Credits() {
  return (
    <div class="screen settings-screen">
      <div class="newrun-bg" />
      <div class="newrun-header">
        <button
          class="btn small ghost"
          data-hotkey="back"
          onClick={() => {
            audio.sfx('ui_back');
            screen.value = 'menu';
          }}
        >
          <Icon name="ui_back" size={20} /> Back
        </button>
        <div class="display newrun-title">Credits</div>
        <div style={{ width: 120 }} />
      </div>
      <div class="settings-body anim-rise">
        <div class="panel settings-panel credits-panel">
          <h3 class="display">Nine Heavens</h3>
          <p class="muted">A xianxia roguelike auto-battler inspired by Guildrun (Leyline).</p>
          <h4 class="display">Music</h4>
          <p>
            “Shenxian”, “Wuxia”, “Wuxia2” — PeriTune (CC BY 4.0, peritune.com)
            <br />
            “Shenyang”, “Ishikari Lore” — Kevin MacLeod (incompetech.com), CC BY 4.0
            <br />
            “10 Fanfares” — Spring Spring (OpenGameArt, CC0)
          </p>
          <h4 class="display">Sound effects</h4>
          <p>
            Kenney.nl audio packs (CC0) · RPG Sound Pack & Swishes — artisticdude (CC0) · Sword sounds — StarNinjas (CC0) · 80 CC0 RPG SFX — rubberduck · Magic Spell SFX — JaggedStone (CC0) · Electricity pack — faxcorp (CC0) · Spark — BMacZero (CC0) · Freeze — artisticdude (CC0) · Teleport — Ogrebane (CC0) · Fire — Spring Spring (CC0)
          </p>
          <h4 class="display">Icons & fonts</h4>
          <p>
            Icons by Lorc, Delapouite and contributors — game-icons.net (CC BY 3.0)
            <br />
            Cinzel, Noto Sans, Ma Shan Zheng, ZCOOL XiaoWei — Google Fonts (OFL)
          </p>
        </div>
      </div>
    </div>
  );
}
