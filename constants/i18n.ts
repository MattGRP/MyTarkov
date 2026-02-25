export type Language = 'en' | 'zh';

export interface Translations {
  // Common
  back: string;
  retry: string;
  cancel: string;
  save: string;
  clear: string;

  // Tabs
  tabMyProfile: string;
  tabSearch: string;
  tabSettings: string;

  // Settings
  settingsTitle: string;
  language: string;
  languageValueEn: string;
  languageValueZh: string;
  defaultPlayerName: string;
  defaultPlayerNamePlaceholder: string;
  defaultPlayerNameHint: string;
  turnstileToken: string;
  turnstileTokenPlaceholder: string;
  turnstileTokenHint: string;
  turnstileTokenHelp: string;
  turnstileOpenPlayers: string;

  // Profile
  loadingProfile: string;
  failedToLoad: string;
  signOut: string;
  signOutConfirm: string;
  signOutConfirmMessage: string;
  level: string;
  xp: string;
  accountId: string;
  prestige: string;
  kd: string;
  survival: string;
  kills: string;
  raids: string;
  pmcStats: string;
  scavStats: string;
  totalRaids: string;
  survived: string;
  deaths: string;
  kdRatio: string;
  survivalRate: string;
  timeInRaids: string;
  accountTime: string;
  lastActive: string;

  // Search
  searchHeaderSubtitle: string;
  searchHeaderTitle: string;
  searchPlaceholder: string;
  searchNoPlayers: string;
  searchNoPlayersSub: string;
  searchForPlayer: string;
  searchDbLoaded: string;
  searchDbDefault: string;
  searchDownloading: string;
  searchDownloadingSub: string;
  searchFirstTime: string;
  searchResults: string;

  // Hints
  hintKD: string;
  hintSurvival: string;
  hintSkills: string;
  skillsTitle: string;

  // Player Name Validation
  playerNameInvalidChars: string;
  playerNameInvalidLength: string;

  // Setup
  setupTitle: string;
  setupSubtitle: string;
  setupOpenPlayers: string;
  setupAccountIdLabel: string;
  setupAccountIdPlaceholder: string;
  setupAccountIdHint: string;
  setupLinkButton: string;
  setupInvalidAccountId: string;
  setupFetchingProfile: string;

  // Loadout
  loadout: string;
  noLoadout: string;
  slotPrimary: string;
  slotSecondary: string;
  slotSidearm: string;
  slotArmor: string;
  slotRig: string;
  slotBackpack: string;
  slotSecure: string;
  slotScabbard: string;
  slotArmband: string;
  slotHeadwear: string;
  slotEarpiece: string;
  slotFaceCover: string;
  slotEyewear: string;
}

const en: Translations = {
  back: 'Back',
  retry: 'Retry',
  cancel: 'Cancel',
  save: 'Save',
  clear: 'Clear',

  tabMyProfile: 'My Profile',
  tabSearch: 'Search',
  tabSettings: 'Settings',

  settingsTitle: 'Settings',
  language: 'Language',
  languageValueEn: 'English',
  languageValueZh: 'Chinese',
  defaultPlayerName: 'Default player name',
  defaultPlayerNamePlaceholder: 'Enter player name',
  defaultPlayerNameHint: 'Used to prefill the search box.',
  turnstileToken: 'Turnstile token',
  turnstileTokenPlaceholder: 'Paste token from tarkov.dev',
  turnstileTokenHint: 'Optional. Required if search is blocked by Turnstile.',
  turnstileTokenHelp: 'Open the players page, complete Turnstile, then copy the token from the request URL (token=...).',
  turnstileOpenPlayers: 'Open tarkov.dev players',

  loadingProfile: 'Loading your profile...',
  failedToLoad: 'Failed to load profile',
  signOut: 'Sign Out',
  signOutConfirm: 'Sign Out',
  signOutConfirmMessage: 'Are you sure you want to sign out?',
  level: 'LVL',
  xp: 'XP',
  accountId: 'Account ID',
  prestige: 'Prestige',
  kd: 'K/D',
  survival: 'Survival',
  kills: 'Kills',
  raids: 'Raids',
  pmcStats: 'PMC Statistics',
  scavStats: 'Scav Statistics',
  totalRaids: 'Total Raids',
  survived: 'Survived',
  deaths: 'Deaths',
  kdRatio: 'K/D Ratio',
  survivalRate: 'Survival Rate',
  timeInRaids: 'Time in Raids',
  accountTime: 'Account Time:',
  lastActive: 'Last active:',

  searchHeaderSubtitle: 'ESCAPE FROM TARKOV',
  searchHeaderTitle: 'Player Lookup',
  searchPlaceholder: 'Player name or Account ID',
  searchNoPlayers: 'No players found',
  searchNoPlayersSub: 'Try a different name or enter an Account ID directly',
  searchForPlayer: 'Search for a player',
  searchDbLoaded: 'Database loaded! Enter a player name to search.',
  searchDbDefault: 'Enter a player name to search the database,\nor enter an Account ID to view directly.',
  searchDownloading: 'Downloading player database...',
  searchDownloadingSub: 'First search may take 10-30s due to database size (~66MB).\nSubsequent searches will be instant.',
  searchFirstTime: 'Downloading ~66MB database in background.\nYou can search once it finishes.',
  searchResults: 'results',

  hintKD: 'K/D Ratio',
  hintSurvival: 'Survival Rate',
  hintSkills: 'Skills',
  skillsTitle: 'Skills',

  playerNameInvalidChars: 'Names can only contain letters, numbers, dashes (-), and underscores (_)',
  playerNameInvalidLength: 'Name must be 3-15 characters, or TarkovCitizen followed by numbers',

  setupTitle: 'Link Your Player',
  setupSubtitle: 'Open the players page, go to your profile, and paste the URL or Account ID here.',
  setupOpenPlayers: 'Open tarkov.dev players',
  setupAccountIdLabel: 'Account ID',
  setupAccountIdPlaceholder: 'Paste player URL or Account ID',
  setupAccountIdHint: 'Example: https://tarkov.dev/players/regular/11302632',
  setupLinkButton: 'Link account',
  setupInvalidAccountId: 'Paste a player URL or numbers-only Account ID',
  setupFetchingProfile: 'Fetching profile...',

  loadout: 'Loadout',
  noLoadout: 'No loadout data available',
  slotPrimary: 'Primary',
  slotSecondary: 'Secondary',
  slotSidearm: 'Sidearm',
  slotArmor: 'Armor',
  slotRig: 'Rig',
  slotBackpack: 'Backpack',
  slotSecure: 'Secure',
  slotScabbard: 'Melee',
  slotArmband: 'Armband',
  slotHeadwear: 'Headwear',
  slotEarpiece: 'Earpiece',
  slotFaceCover: 'Face Cover',
  slotEyewear: 'Eyewear',
};

const zh: Translations = {
  back: '返回',
  retry: '重试',
  cancel: '取消',
  save: '保存',
  clear: '清除',

  tabMyProfile: '我的资料',
  tabSearch: '搜索',
  tabSettings: '设置',

  settingsTitle: '设置',
  language: '语言',
  languageValueEn: 'English',
  languageValueZh: '中文',
  defaultPlayerName: '默认玩家名称',
  defaultPlayerNamePlaceholder: '输入玩家名称',
  defaultPlayerNameHint: '用于预填搜索框。',
  turnstileToken: 'Turnstile 令牌',
  turnstileTokenPlaceholder: '粘贴来自 tarkov.dev 的 token',
  turnstileTokenHint: '可选。若被 Turnstile 拦截，需要填写。',
  turnstileTokenHelp: '打开玩家页面完成 Turnstile，然后从请求地址中复制 token=...。',
  turnstileOpenPlayers: '打开 tarkov.dev 玩家页',

  loadingProfile: '正在加载你的资料...',
  failedToLoad: '加载资料失败',
  signOut: '退出登录',
  signOutConfirm: '退出登录',
  signOutConfirmMessage: '确定要退出登录吗？',
  level: '等级',
  xp: '经验值',
  accountId: '账户ID',
  prestige: '声望',
  kd: '击杀比',
  survival: '存活率',
  kills: '击杀',
  raids: '战局',
  pmcStats: 'PMC 数据',
  scavStats: 'Scav 数据',
  totalRaids: '总战局数',
  survived: '存活',
  deaths: '死亡',
  kdRatio: '击杀比',
  survivalRate: '存活率',
  timeInRaids: '战局总时长',
  accountTime: '账号时长:',
  lastActive: '最近活跃:',

  searchHeaderSubtitle: '逃离塔科夫',
  searchHeaderTitle: '玩家查询',
  searchPlaceholder: '玩家名称或账户ID',
  searchNoPlayers: '未找到玩家',
  searchNoPlayersSub: '尝试其他名称或直接输入账户ID',
  searchForPlayer: '搜索玩家',
  searchDbLoaded: '数据库已加载！输入玩家名称即可搜索。',
  searchDbDefault: '输入玩家名称搜索数据库，\n或直接输入账户ID查看。',
  searchDownloading: '正在下载玩家数据库...',
  searchDownloadingSub: '首次搜索可能需要10-30秒（数据库约66MB）。\n后续搜索将即时完成。',
  searchFirstTime: '正在后台下载约66MB数据库。\n下载完成后即可搜索。',
  searchResults: '个结果',

  hintKD: '击杀比',
  hintSurvival: '存活率',
  hintSkills: '技能',
  skillsTitle: '技能',

  playerNameInvalidChars: '名称只能包含字母、数字、短横线 (-) 和下划线 (_)',
  playerNameInvalidLength: '名称需为 3-15 个字符，或 TarkovCitizen 加数字',

  setupTitle: '绑定你的角色',
  setupSubtitle: '打开玩家页面进入你的资料，然后粘贴 URL 或账户 ID。',
  setupOpenPlayers: '打开 tarkov.dev 玩家页',
  setupAccountIdLabel: '账户ID',
  setupAccountIdPlaceholder: '粘贴玩家 URL 或账户ID',
  setupAccountIdHint: '示例：https://tarkov.dev/players/regular/11302632',
  setupLinkButton: '绑定账户',
  setupInvalidAccountId: '请粘贴玩家 URL 或仅数字账户ID',
  setupFetchingProfile: '正在获取资料...',

  loadout: '装备',
  noLoadout: '暂无装备数据',
  slotPrimary: '主武器',
  slotSecondary: '副武器',
  slotSidearm: '手枪',
  slotArmor: '护甲',
  slotRig: '战术背心',
  slotBackpack: '背包',
  slotSecure: '安全箱',
  slotScabbard: '近战武器',
  slotArmband: '臂章',
  slotHeadwear: '头盔',
  slotEarpiece: '耳机',
  slotFaceCover: '面罩',
  slotEyewear: '眼镜',
};

export const translations: Record<Language, Translations> = { en, zh };

