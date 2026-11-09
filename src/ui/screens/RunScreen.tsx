import { run, screen } from '@/app/store';
import { ChooseHero } from './ChooseHero';
import { BoardScreen } from './BoardScreen';
import { BattleResult } from './BattleResult';
import { ShopScreen } from './ShopScreen';
import { EventScreen } from './EventScreen';
import { RankUpScreen } from './RankUpScreen';
import { RewardScreen } from './RewardScreen';
import { ChallengeScreen } from './ChallengeScreen';
import { RealmCleared } from './RealmCleared';
import { RunEnd } from './RunEnd';

export function RunScreen() {
  const s = run.value!;
  switch (s.phase) {
    case 'chooseHero':
      return <ChooseHero />;
    case 'board':
    case 'battle':
      return <BoardScreen />;
    case 'result':
    case 'defeat':
      return <BattleResult />;
    case 'shop':
      return <ShopScreen />;
    case 'event':
      return <EventScreen />;
    case 'rankUp':
      return <RankUpScreen />;
    case 'reward':
      return <RewardScreen />;
    case 'challenge':
      return <ChallengeScreen />;
    case 'realmCleared':
      return <RealmCleared />;
    case 'runEnd':
      return <RunEnd />;
    default:
      return (
        <div class="screen center" style={{ gap: 20, flexDirection: 'column' }}>
          <div class="display" style={{ fontSize: 32 }}>
            Unknown phase “{s.phase}”
          </div>
          <button class="btn" onClick={() => (screen.value = 'menu')}>
            Back to menu
          </button>
        </div>
      );
  }
}
