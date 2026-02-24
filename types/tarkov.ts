export interface PlayerProfile {
  aid: number;
  info: PlayerInfo;
  customization: PlayerCustomization;
  skills?: PlayerSkills;
  equipment?: EquipmentContainer;
  pmcStats?: GameStats;
  scavStats?: GameStats;
  achievements?: Record<string, number>;
  updated?: number;
}

export interface PlayerInfo {
  nickname: string;
  side: string;
  experience: number;
  memberCategory?: number;
  selectedMemberCategory?: number;
  prestigeLevel?: number;
}

export interface PlayerCustomization {
  head?: string;
  body?: string;
  feet?: string;
  hands?: string;
}

export interface EquipmentContainer {
  Id: string;
  Items: EquipmentItem[];
}

export interface EquipmentItem {
  _id: string;
  _tpl: string;
  parentId?: string;
  slotId?: string;
  upd?: ItemUpdate;
}

export interface ItemUpdate {
  StackObjectsCount?: number;
  Repairable?: RepairableState;
}

export interface RepairableState {
  Durability?: number;
  MaxDurability?: number;
}

export interface PlayerSkills {
  Common?: SkillEntry[];
  Mastering?: MasteringEntry[];
  Points?: number;
}

export interface SkillEntry {
  Id: string;
  Progress: number;
  PointsEarnedDuringSession?: number;
  LastAccess?: number;
}

export interface MasteringEntry {
  Id: string;
  Progress?: number;
}

export interface GameStats {
  eft?: EFTStats;
}

export interface EFTStats {
  totalInGameTime?: number;
  overAllCounters?: OverAllCounters;
}

export interface OverAllCounters {
  Items?: CounterItem[];
}

export interface CounterItem {
  Key: string[];
  Value: number;
}

export interface PlayerStats {
  sessions: number;
  survived: number;
  kills: number;
  deaths: number;
  totalInGameTime: number;
  kd: number;
  survivalRate: number;
}

export interface SearchResult {
  id: string;
  name: string;
}

export const MAIN_SLOTS = [
  'Headwear', 'Earpiece', 'FaceCover', 'Eyewear',
  'ArmorVest', 'TacticalVest', 'ArmBand',
  'FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster',
  'Backpack', 'SecuredContainer', 'Scabbard',
] as const;

export function getSlotDisplayName(slot: string): string {
  const map: Record<string, string> = {
    FirstPrimaryWeapon: 'Primary',
    SecondPrimaryWeapon: 'Secondary',
    Holster: 'Sidearm',
    ArmorVest: 'Armor',
    TacticalVest: 'Rig',
    FaceCover: 'Face Cover',
    SecuredContainer: 'Secure',
    ArmBand: 'Armband',
  };
  return map[slot] ?? slot;
}

export function getItemImageURL(tpl: string): string {
  return `https://assets.tarkov.dev/${tpl}-icon.webp`;
}

export function getCharacterImageURL(profile: PlayerProfile): string {
  const dataObj = {
    aid: profile.aid,
    customization: {
      head: profile.customization.head ?? '',
      body: profile.customization.body ?? '',
      feet: profile.customization.feet ?? '',
      hands: profile.customization.hands ?? '',
    },
    equipment: {
      Id: profile.equipment?.Id ?? '',
      Items: (profile.equipment?.Items ?? []).map((item) => {
        const dict: Record<string, string> = {
          _id: item._id,
          _tpl: item._tpl,
        };
        if (item.parentId) dict.parentId = item.parentId;
        if (item.slotId) dict.slotId = item.slotId;
        return dict;
      }),
    },
  };
  const jsonString = JSON.stringify(dataObj);
  return `https://imagemagic.tarkov.dev/player/${profile.aid}.webp?data=${encodeURIComponent(jsonString)}`;
}

export function calculatePlayerStats(gameStats?: GameStats): PlayerStats {
  const counters = gameStats?.eft?.overAllCounters?.Items ?? [];
  const totalTime = gameStats?.eft?.totalInGameTime ?? 0;

  let sessions = 0;
  let survived = 0;
  let kills = 0;
  let deaths = 0;

  for (const item of counters) {
    const key = item.Key;
    if (key[0] === 'Sessions') {
      sessions += item.Value;
    } else if (key[0] === 'ExitStatus' && key.includes('Survived')) {
      survived += item.Value;
    } else if (key.length === 1 && key[0] === 'Kills') {
      kills = item.Value;
    } else if (key.length === 1 && key[0] === 'Deaths') {
      deaths = item.Value;
    }
  }

  const kd = deaths === 0 ? kills : kills / deaths;
  const survivalRate = sessions === 0 ? 0 : (survived / sessions) * 100;

  return { sessions, survived, kills, deaths, totalInGameTime: totalTime, kd, survivalRate };
}

const XP_THRESHOLDS = [
  0, 1000, 4017, 8432, 14256, 21477, 30023, 39936, 51204, 63723,
  77563, 92713, 110144, 128384, 149867, 172144, 197203, 225938, 259311, 295287,
  336008, 382308, 432768, 490936, 557528, 631688, 714168, 804808, 905408, 1018908,
  1141108, 1272508, 1413908, 1570708, 1742908, 1930508, 2133508, 2351908, 2585708, 2834908,
  3099508, 3379508, 3674908, 3985708, 4311908, 4653508, 5010508, 5382908, 5770708, 6173908,
  6592508, 7026508, 7475908, 7940708, 8420908, 8916508, 9427508, 9953908, 10495708, 11052908,
  11625508, 12213508, 12816908, 13435708, 14069908, 14719508, 15384508, 16064908, 16760708, 17471908,
];

export function getLevel(experience: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (experience >= XP_THRESHOLDS[i]) {
      lvl = i + 1;
    } else {
      break;
    }
  }
  return lvl;
}
