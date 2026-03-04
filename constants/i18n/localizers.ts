// noinspection SpellCheckingInspection
import { BOSS_NARRATIVE_TRANSLATIONS, type BossNarrativeMap } from '@/constants/i18nBossNarratives';
import type { Language } from './types';

type NameLocalizationMap = Partial<Record<Language, string>>;

function normalizeLocalizationKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-');
}

const CATEGORY_NAME_TRANSLATIONS: Record<string, NameLocalizationMap> = {
  'arm-band': { zh: '臂章' },
  'armor-plate': { zh: '护甲插板' },
  'auxiliary-mod': { zh: '辅助配件' },
  'barter-item': { zh: '交易物品' },
  completable: { zh: '任务物品' },
  compass: { zh: '指南针' },
  'compound-item': { zh: '组合物品' },
  'cultist-amulet': { zh: '邪教徒护符' },
  'cylinder-magazine': { zh: '弹鼓' },
  'dialog-item': { zh: '对话物品' },
  'face-cover': { zh: '面罩' },
  flyer: { zh: '海报' },
  poster: { zh: '海报' },
  rinaki: { zh: 'Killa小迷妹海报[Rinaki]' },
  'food-and-drink': { zh: '食物与饮料' },
  fuel: { zh: '燃料' },
  headwear: { zh: '头部装备' },
  info: { zh: '情报' },
  item: { zh: '全部类型' },
  key: { zh: '钥匙' },
  keycard: { zh: '门禁卡' },
  knife: { zh: '近战武器' },
  map: { zh: '地图' },
  'mark-of-the-unheard': { zh: '未闻者印记' },
  'mechanical-key': { zh: '机械钥匙' },
  meds: { zh: '医疗物品' },
  multitools: { zh: '多功能工具' },
  'night-vision': { zh: '夜视设备' },
  notes: { zh: '笔记' },
  other: { zh: '其他' },
  'planting-kits': { zh: '布设工具包' },
  'portable-range-finder': { zh: '便携测距仪' },
  'radio-transmitter': { zh: '无线电发射器' },
  'random-loot-container': { zh: '随机战利品容器' },
  recorder: { zh: '录音机' },
  'repair-kits': { zh: '维修工具包' },
  revolver: { zh: '左轮手枪' },
  rocket: { zh: '火箭弹' },
  'rocket-launcher': { zh: '火箭发射器' },
  'special-item': { zh: '特殊物品' },
  'spring-driven-cylinder': { zh: '发条弹鼓' },
  'stackable-item': { zh: '可堆叠物品' },
  tapes: { zh: '磁带' },
  'thermal-vision': { zh: '热成像设备' },
  'throwable-weapon': { zh: '投掷武器' },
  'ammo-container': { zh: '子弹包' },
  'ammo-box': { zh: '子弹包' },
};

const TRADER_NAME_TRANSLATIONS: Record<string, NameLocalizationMap> = {
  fence: { zh: '黑商' },
  prapor: { zh: '俄商' },
  therapist: { zh: '大妈' },
  skier: { zh: '小蓝帽' },
  peacekeeper: { zh: '美商' },
  mechanic: { zh: '机械师' },
  ragman: { zh: '服装商' },
  jaeger: { zh: '杰哥' },
  lightkeeper: { zh: '灯塔商人' },
  'radio-station': { zh: '电台' },
  'btr-driver': { zh: 'BTR司机' },
  taran: { zh: '塔兰' },
  ref: { zh: '竞技场裁判' },
  'mr-kerman': { zh: 'Kerman 先生' },
  voevoda: { zh: 'Voevoda' },
  voecoda: { zh: 'Voevoda' },
};

const BOSS_NAME_TRANSLATIONS: Record<string, NameLocalizationMap> = {
  af: { zh: '美军' },
  basmach: { zh: '巴斯马奇' },
  'big-pipe': { zh: '大胡子' },
  birdeye: { zh: '鸟眼' },
  'black-div': { zh: '黑狐军团' },
  'cultist-priest': { zh: '邪教徒牧师' },
  'cultist-warrior': { zh: '邪教徒战士' },
  glukhar: { zh: '格鲁哈' },
  'glukhar-guard-assault': { zh: '格鲁哈突击小弟' },
  'glukhar-guard-scout': { zh: '格鲁哈侦察小弟' },
  'glukhar-guard-security': { zh: '格鲁哈安保小弟' },
  gus: { zh: '古斯' },
  kaban: { zh: '卡班' },
  'kaban-guard': { zh: '卡班小弟' },
  'kaban-guard-sniper': { zh: '卡班狙击小弟' },
  killa: { zh: 'killa' },
  knight: { zh: '骑士' },
  kollontay: { zh: '葛朗台' },
  'kollontay-guard-assault': { zh: '葛朗台突击小弟' },
  'kollontay-guard-security': { zh: '葛朗台安保小弟' },
  partisan: { zh: '游击队' },
  raider: { zh: '掠夺者' },
  reshala: { zh: '瑞沙拉' },
  'reshala-guard': { zh: '瑞沙拉小弟' },
  rogue: { zh: '叛军' },
  sanitar: { zh: '萨尼塔' },
  'sanitar-guard': { zh: '萨尼塔小弟' },
  'shadow-of-tagilla': { zh: '暗影大锤' },
  shturman: { zh: '谢特曼' },
  'shturman-guard': { zh: '谢特曼小弟' },
  tagilla: { zh: '大锤' },
  'vengeful-killa': { zh: '复仇的killa' },
  zryachiy: { zh: '小鹿' },
  'zryachiy-guard': { zh: '小鹿小弟' },
};

const BOSS_BEHAVIOR_TRANSLATIONS: Record<string, NameLocalizationMap> = {
  rogue: { zh: '巡逻' },
  raider: { zh: '快速逼近' },
  kaban: { zh: '高耐久坦克型' },
  'cultist-priest': { zh: '潜伏跟踪' },
  knight: { zh: '快速逼近' },
  glukhar: { zh: '进攻性强且射击精准' },
  killa: { zh: '重装巡逻' },
  reshala: { zh: '团队巡逻' },
  sanitar: { zh: '频繁治疗与注射刺激剂' },
  shturman: { zh: '狙击作战' },
  tagilla: { zh: '近战狂暴' },
  zryachiy: { zh: '狙击作战' },
};

const OBJECTIVE_TYPE_TRANSLATIONS: Record<string, Record<Language, string>> = {
  buildweapon: { en: 'Build weapon', zh: '组装武器', ru: 'Build weapon' },
  experience: { en: 'Gain experience', zh: '获取经验', ru: 'Gain experience' },
  extract: { en: 'Extract', zh: '成功撤离', ru: 'Extract' },
  finditem: { en: 'Find item', zh: '寻找物品', ru: 'Find item' },
  findquestitem: { en: 'Find quest item', zh: '寻找任务物品', ru: 'Find quest item' },
  giveitem: { en: 'Hand over item', zh: '上交物品', ru: 'Hand over item' },
  givequestitem: { en: 'Hand over quest item', zh: '上交任务物品', ru: 'Hand over quest item' },
  mark: { en: 'Mark target', zh: '标记目标', ru: 'Mark target' },
  plantitem: { en: 'Plant item', zh: '放置物品', ru: 'Plant item' },
  plantquestitem: { en: 'Plant quest item', zh: '放置任务物品', ru: 'Plant quest item' },
  sellitem: { en: 'Sell item', zh: '出售物品', ru: 'Sell item' },
  shoot: { en: 'Eliminate target', zh: '击杀目标', ru: 'Eliminate target' },
  skill: { en: 'Skill requirement', zh: '技能达标', ru: 'Skill requirement' },
  taskstatus: { en: 'Task status', zh: '任务状态', ru: 'Task status' },
  traderlevel: { en: 'Trader level', zh: '商人等级', ru: 'Trader level' },
  traderstanding: { en: 'Trader standing', zh: '商人好感', ru: 'Trader standing' },
  useitem: { en: 'Use item', zh: '使用物品', ru: 'Use item' },
  visit: { en: 'Visit location', zh: '前往地点', ru: 'Visit location' },
};

const TASK_REQUIREMENT_STATUS_TRANSLATIONS: Record<string, Record<Language, string>> = {
  active: { en: 'Active', zh: '进行中', ru: 'Активно' },
  complete: { en: 'Completed', zh: '已完成', ru: 'Выполнено' },
  failed: { en: 'Failed', zh: '失败', ru: 'Провалено' },
};

export function localizeCategoryName(name: string, language: Language): string {
  const text = String(name || '').trim();
  if (!text || language === 'en') return text;
  const mapped = CATEGORY_NAME_TRANSLATIONS[normalizeLocalizationKey(text)];
  return mapped?.[language] || text;
}

export function localizeTraderName(
  name: string,
  normalizedName: string | null | undefined,
  language: Language,
): string {
  const text = String(name || '').trim();
  if (!text || language === 'en') return text;
  const lookupKey = normalizeLocalizationKey(normalizedName || text);
  const mapped = TRADER_NAME_TRANSLATIONS[lookupKey];
  return mapped?.[language] || text;
}

export function localizeBossName(
  name: string,
  normalizedName: string | null | undefined,
  language: Language,
): string {
  const text = String(name || '').trim();
  if (!text || language === 'en') return text;
  const lookupKey = normalizeLocalizationKey(normalizedName || text);
  const mapped = BOSS_NAME_TRANSLATIONS[lookupKey];
  return mapped?.[language] || text;
}

export function localizeBossBehavior(
  normalizedName: string | null | undefined,
  behavior: string | null | undefined,
  language: Language,
): string {
  const text = String(behavior || '').trim();
  if (!text || language === 'en') return text;
  const lookupKey = normalizeLocalizationKey(normalizedName || '');
  const mapped = BOSS_BEHAVIOR_TRANSLATIONS[lookupKey];
  return mapped?.[language] || text;
}

function normalizeNarrativeText(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

export function localizeBossNarrative(
  normalizedName: string | null | undefined,
  language: Language,
): { bio: string; description: string } {
  const key = normalizeLocalizationKey(normalizedName || '');
  if (!key) {
    return { bio: '', description: '' };
  }

  const allNarratives = BOSS_NARRATIVE_TRANSLATIONS as Record<Language, BossNarrativeMap>;
  const languageEntry = allNarratives[language]?.[key];
  const fallbackEntry = allNarratives.en?.[key];
  const selected = languageEntry || fallbackEntry;

  return {
    bio: normalizeNarrativeText(selected?.bio),
    description: normalizeNarrativeText(selected?.description),
  };
}

export function localizeObjectiveType(type: string | null | undefined, language: Language): string {
  const rawType = String(type || '').trim();
  if (!rawType) return '';
  const normalized = rawType.replace(/[^a-z]/gi, '').toLowerCase();
  const mapped = OBJECTIVE_TYPE_TRANSLATIONS[normalized];
  if (!mapped) return rawType;
  return mapped[language] || mapped.en || rawType;
}

export function localizeTaskRequirementStatus(status: string | null | undefined, language: Language): string {
  const rawStatus = String(status || '').trim();
  if (!rawStatus) return '';
  const normalized = normalizeLocalizationKey(rawStatus);
  const mapped = TASK_REQUIREMENT_STATUS_TRANSLATIONS[normalized];
  if (!mapped) return rawStatus;
  return mapped[language] || mapped.en || rawStatus;
}
