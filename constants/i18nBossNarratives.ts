export type BossNarrativeMap = Record<string, { bio: string; description: string }>;

export const BOSS_NARRATIVE_TRANSLATIONS: Record<'en' | 'zh' | 'ru', BossNarrativeMap> = {
  "en": {
    "cultist": {
      "bio": "",
      "description": ""
    },
    "cultist-priest": {
      "bio": "",
      "description": "Sneaky bois. Cultists lurk in the shadows in groups of 3-5 waiting for a player to approach. They silently approach their enemies and stab them using either normal knives or in case of the priests the poisoned Cultist knife. If fired upon the Cultists will return fire using firearms and grenades. After they attack a player with their knife they may choose to run off into the woods again and return to the shadows."
    },
    "knight": {
      "bio": "",
      "description": "The leader of 'The Goons'. Can spawn on many different maps."
    },
    "glukhar": {
      "bio": "There is no reliable information about his past activities because all documents were either lost or classified, but according to unverified information, he had the rank of petty officer. He participated in combat operations. Knew the fundamentals of tactics and actively used this knowledge in claiming or defending various territories.<br/>All of his crew, too, appear to be former servicemen. Although now his gang is just a de facto bandit group fighting for resources and influence in Tarkov. He has connections to traders capable of exporting goods from the Norvinsk region, which regularly send him the last working trains for cargo transportation.",
      "description": "Glukhar and his many guards are extremely hostile. It's very unlikely to find success while fighting in any open areas. Small hallways and closed rooms are preferable. Glukhar and his guards are very accurate. Glukhar and his guards will stay near each other at all times and his guards will follow him to wherever he goes."
    },
    "kaban": {
      "bio": "He once had a small legal business in Tarkov, but was not afraid to use criminal methods of money acquisition. After the general evacuation he remained in the city, and his gang has grown. ",
      "description": "His size allows him to fire various heavy machine guns without resting the gun, but at the same time Kaban cannot afford to be mobile and therefore either stays in position or moves slowly from point to point during combat. He has a large number of well-armed guards, some of whom are former military men who have organized a strong defense for him. The boss dwells in the area of the car repair shop on \"Streets of Tarkov\". The area is heavily defended, entrances are fortified with stationary machine guns and AGS, the paths are mined, and there are snipers on the roof of the car service center. Kaban uses a custom rig to store machine gun boxes, wears body armor under his clothes, and has unquestionable authority among his guards. Scavs nearby help the boss with defense and will engage in combat for Kaban."
    },
    "killa": {
      "bio": "",
      "description": "The true Giga Chad of Tarkov. Killa uses a light machine gun or other automatic weapon to suppress the enemy while lurking from cover to cover getting closer to his target for the final push. During the assault he moves in a zig-zag pattern uses smoke and fragmentation grenades and relentlessly suppresses enemies with automatic fire. He will follow his target large distances out of his patrol route so be sure to run very far to get away from him if he has locked onto you."
    },
    "kollontay": {
      "bio": "He is a former officer of the MVD (Ministry of Internal Affairs), during his service in law enforcement he had a reputation as a vile man, whose behavior was sometimes feared by his coworkers. During his work, he often resorted to his favorite method of interrogation - a rubber baton, as well as other non-statutory pressure on someone who was not to his liking. Thanks to his physical strength and bold temperament, after the events of the TerraGroup scandal, he formed a gang and began to do what he himself was recently supposed to combat - looting and banditry. However, even before the conflict, he often provided protection to local \"businessmen\". For example, his good relations with Kaban are well-known.",
      "description": "Kollontay has a small number of guards, prefers to stay in one position and occasionally patrols his territory. If he feels he has the upper hand, he may switch to his police baton. He lives in the area around Klimov Shopping Mall and the Tarkov Academy of the Ministry of Internal Affairs."
    },
    "partisan": {
      "bio": "There are few reliable details about his past, but it's known that he once served in Afghanistan, where his radical methods of warfare took root. Referred to by some as 'Partizan', he became notorious for his expertise in setting traps and mines. His reputation for eliminating enemies often came down to catching them off guard, using their overconfidence against them. Partizan's knowledge of guerrilla tactics made him a dangerous adversary, able to turn any location—whether forest or building—into a deadly trap.<br/>Those who survive long enough to learn his ways may just find themselves in his good graces, but only if they're careful enough to see the traps before it's too late.",
      "description": ""
    },
    "raider": {
      "bio": "",
      "description": "Scav raiders (also known as just 'raiders') are advanced Scavs that are considerably stronger and more tactical than your typical Scavs. They carry significantly more dangerous weapons and use higher tier ammunition. Additionally they have much better aim and can frequently drop well geared players with only a few bullets (or you just get head-eyes'd). Scav raiders also patrol in multiple groups and can usually be distinguished by their gear unique voicelines and general aggression. Scav Raiders start out friendly to all other Scavs (including player scavs) but they will become hostile if you get to close and ignore their verbal warnings. They will also become hostile to all Scavs if any Scav angers them."
    },
    "reshala": {
      "bio": "",
      "description": "He will normally try to stay at the back of the fight and hidden from the player's view. Additionally he never wears armor. Be careful as a player scav as if you are at lower scav karma levels Reshala or his guards may shoot you without provocation or will shoot you if you come to close to Reshala. His guards are sometimes known to give warnings to player scavs with low karma before becoming hostile."
    },
    "rogue": {
      "bio": "",
      "description": "Rogues defend the water treatment plant and surrounding areas on Lighthouse. Their primary behavior is patrolling but they will often take defensive positions on rooftops and use emplaced weapons. They will target all players who enter their area but are slightly more lenient towards USEC PMCs and Scavs. Rogues are extremely dangerous due to their high health, laserbeam accuracy and high targeting distance. Rogues will also run behind cover and use meds if they are wounded."
    },
    "sanitar": {
      "bio": "A former doctor and scientist. Worked for TerraGroup. He led several projects in the laboratory, including the development of new psychoactive substances. The area of research extended from the influence of various conditions on the body to developing neurostimulants. Besides the TerraGroup laboratory, he had his own office at the Azure Coast Sanatorium, where he also conducted research, especially during the last weeks before the full evacuation.<br/>Often went on detached duty to hot zones along with the medical corps, and after starting work for the corporation, he regularly visited African and other offices, supervising developments. He has earned unquestioned authority and respect among colleagues.",
      "description": "When engaged in combat he will fight alongside his fellow scavs and guards but may often break away to heal or inject himself. He has plenty of meds so a prolonged engagement is possible."
    },
    "shturman": {
      "bio": "",
      "description": "Shturman and his followers will engage the player at a long range protecting the sawmill area of the woods. They prefer to keep their distance as they are not suited for close quarters combat."
    },
    "tagilla": {
      "bio": "",
      "description": "He is batshit insane and will attempt to hammer you down. However if you are in a position that he cannot path-find to such as the rafters he will use his secondary weapon (usually a shotgun) to kill you from a distance. He's active immediately at the start of raid. The boss can set ambushes open suppressive fire and breach if needed."
    },
    "zryachiy": {
      "bio": "One of Tarkov's most mysterious figures. Virtually nothing is known about his past, except that he has sniper training and is remotely rumored to have been in hot zones in the Middle East and Africa many times.<br/>Long before the conflict, he became Lightkeeper's loyal lapdog and took an active part in \"establishing\" connections between Lightkeeper and all those with whom he interacted. He is known to be friendly with the Rogue group, as well as with the hooded men who draw mysterious symbols on the locations.<br/>Zryachiy is very taciturn, though those who work with him usually understand him without words. There are many rumors about his eyes, some say that it is an inborn peculiarity, some point to certain eye drops that allow him to enhance his vision in the dark, giving his eyes this whiteness side effect. Despite the appearance, it seems that he earned his name precisely for his excellent eyesight, which is not surprising for a former military sniper.",
      "description": "Lightkeeper's cultist guard."
    }
  },
  "zh": {
    "cultist": {
      "bio": "",
      "description": ""
    },
    "cultist-priest": {
      "bio": "",
      "description": "潜行的家伙。邪教徒以 3-5 人一组潜伏在阴影中，等待玩家靠近。他们会悄无声息地接近敌人，用普通刀具或祭司专用的淬毒邪教匕首进行刺杀。若遭到射击，邪教徒会使用枪支和手榴弹还击。用刀攻击玩家后，他们可能会再次跑进树林，重新隐入阴影。"
    },
    "knight": {
      "bio": "",
      "description": "“The Goons”的首领。可在多张地图中刷新。"
    },
    "glukhar": {
      "bio": "关于他过往活动的可靠信息无从考证，因为所有文件要么遗失要么被列为机密，但据未经证实的消息，他曾拥有士官军衔。他参与过战斗行动，精通战术基础，并在争夺或保卫各类领土时积极运用这些知识。他的所有队员似乎也都曾是军人。尽管如今他的帮派实质上只是一个为塔科夫资源与影响力而战的土匪团体。他与有能力从诺文斯克地区运出货品的商人有联系，这些商人会定期为他派出最后仍在运营的货运列车。",
      "description": "Glukhar 及其众多守卫极具敌意。在开阔地带与他们交战极难成功。狭窄走廊和封闭房间是更理想的选择。Glukhar 及其守卫枪法极准。他们会始终聚集行动，守卫们会跟随 Glukhar 前往任何地点。"
    },
    "kaban": {
      "bio": "他曾在塔科夫经营合法小生意，但也不惮使用犯罪手段敛财。全面撤离后他留在城内，其帮派规模日益壮大。",
      "description": "魁梧体型使他能无需架枪就持续射击各种重机枪，但同时，Kaban 无法灵活移动，因此在战斗中，他要么固守阵地，要么在点位间缓慢移动。其人拥有大量武装护卫，其中不乏前军人，为他组织起了严密防御。该 Boss 驻扎在“塔科夫街区”的汽车修理厂区域。该区域防御森严，入口处配备固定机枪和 AGS 榴弹发射器，通道布有地雷，汽车服务中心屋顶部署有狙击手。Kaban 使用定制装具携带机枪弹药箱，外衣下穿着防弹装甲，在护卫中拥有绝对权威。附近的 Scav 会协助首领防御并为 Kaban 而战。"
    },
    "killa": {
      "bio": "",
      "description": "塔科夫的终极猛男。Killa 使用轻机枪或其他自动武器压制敌人，同时在掩体间潜行接近目标发动最终突击。进攻时他以之字形移动，运用烟雾弹和破片手榴弹，用自动火力无情压制敌人。他会超出巡逻范围长距离追击目标，若被他锁定只有远遁才能摆脱。"
    },
    "kollontay": {
      "bio": "他曾是内务部军官，在执法部门服役时就以品行恶劣著称，同事有时都畏惧其行径。任职期间他常使用最爱的审讯方式——橡胶警棍，以及其他非常规手段打压不合其意者。凭借强健体魄和大胆性情，在 TerraGroup 丑闻爆发后组建帮派，开始从事自己昔日本该打击的勾当——抢劫与匪帮活动。其实在冲突前他就常为当地“商人”提供保护，例如与 Kaban 的良好关系便广为人知。",
      "description": "Kollontay 护卫数量较少，偏好固守某处，偶尔巡逻领地。若自觉占据上风，可能会切换使用警棍。他活跃在 Klimov 购物中心，以及内务部塔科夫学院周边区域。"
    },
    "partisan": {
      "bio": "其过往可靠细节寥寥，但可知曾在阿富汗服役，其激进的作战方式于此扎根。人称“游击队员”，以布设陷阱与地雷的专长恶名昭彰。他歼灭敌人的声誉常源于利用对方大意攻其不备。游击战术知识使他成为危险对手，能将任何地点——无论森林或建筑——化为致命陷阱。幸存足够久并洞悉其手法者或能赢得他的青睐，但前提是能在为时已晚前识破陷阱。",
      "description": ""
    },
    "raider": {
      "bio": "",
      "description": "Scav 掠夺者（简称“掠夺者”）是进阶版 Scav，比普通 Scav 更具战术性与战斗力。他们配备更危险的武器与高级弹药，同时拥有更精准的枪法，常仅用数发子弹就击倒重装玩家（或直接爆头秒杀）。Scav 掠夺者以小组形式巡逻，通常可通过独特装备、语音与攻击性进行辨识。初始对所有其他 Scav（包括玩家 Scav）友善，但若无视口头警告靠近则会转为敌对。若有 Scav 激怒他们，会对全体 Scav 敌对。"
    },
    "reshala": {
      "bio": "",
      "description": "他通常试图待在战斗后方避开玩家视线，且从不穿戴护甲。玩家 Scav 需注意：若 Scav 声望等级较低，Reshala 或其守卫会无端攻击你，或因你过于接近 Reshala 而开火。其守卫有时会对低声望玩家 Scav 发出警告后再转为敌对。"
    },
    "rogue": {
      "bio": "",
      "description": "游荡者守卫着灯塔地图的污水处理厂及周边区域。主要行为是巡逻，但常会在屋顶占据防御位置并使用固定武器。他们会攻击所有进入区域的玩家，但对 Scav 和 USEC 阵营的 PMC 稍显宽容。游荡者因高生命值、激光般精准的枪法及超远射程而极度危险。受伤时，他们会跑向掩体并使用医疗物品。"
    },
    "sanitar": {
      "bio": "前医生与科学家，曾为 TerraGroup 工作。他在实验室领导多个项目，包括开发新型精神活性物质。研究领域涵盖各种条件对人体影响至神经刺激素研发。除 TerraGroup 实验室外，他在蔚蓝海岸疗养院设有私人办公室，亦在此进行研究——尤其是在全面撤离前的最后数周。他常随医疗队前往热点地区出差，为企业工作后定期巡视非洲及其他办事处督导研发。在同事中享有毋庸置疑的权威与尊敬。",
      "description": "交战时他会与 Scav 同伴及护卫协同作战，但又常常会脱离战线治疗或注射药物。携带大量医疗物资，可能会导向持久战。"
    },
    "shturman": {
      "bio": "",
      "description": "Shturman 及其追随者会在伐木场远距离与玩家交战，偏好保持距离而不擅近距离战斗。"
    },
    "tagilla": {
      "bio": "",
      "description": "完全是个疯子，会试图用锤子砸碎你。但若你处于他无法路径找到的位置（如横梁），他会使用副武器（通常为霰弹枪）远程攻击。他在战局开始时便被会激活。此 Boss 会设置伏击、展开压制火力并在需要时实施突破。"
    },
    "zryachiy": {
      "bio": "塔科夫最神秘人物之一。其过往几乎无人知晓，仅知受过狙击训练，遥传曾多次出入中东与非洲热点地区。早在冲突爆发前，他就成为 Lightkeeper 的忠犬，积极参与建立 Lightkeeper 与所有合作者之间的联系。已知与游荡者团体及在各地绘制神秘符号的兜帽人交好。Zryachiy 沉默寡言，但共事者常能心领神会。关于其眼睛的传闻众多，有人说是先天特征，有人指认是某种增强暗视能力的眼药水导致眼球泛白的副作用。尽管外观如此，他似乎正是因卓越视力得名——这对前军用狙击手而言并不意外。",
      "description": "Lightkeeper 的邪教护卫。"
    }
  },
  "ru": {
    "cultist": {
      "bio": "",
      "description": ""
    },
    "cultist-priest": {
      "bio": "",
      "description": "Ловкие мальчишки. Культисты скрываются в тени группами по 3-5 человек, ожидая приближения игрока. Они бесшумно приближаются к врагам и наносят им удары либо обычными ножами, либо отравленным культистским ножом, если речь идет о жреце. Если по ним открывают огонь, культисты открывают ответный огонь, используя огнестрельное оружие и гранаты. После нападения на игрока с ножом они могут убежать в лес и вернуться в тень."
    },
    "knight": {
      "bio": "",
      "description": "Лидер \"головорезов\". Может появляться на разных картах."
    },
    "glukhar": {
      "bio": "Достоверных сведений о его деятельности ранее нет, так как все документы были утеряны или засекречены, но по непроверенной информации имел звание старшины. Участвовал в боевых действиях. Знает основы тактики и активно использует эти знания при штурме или обороне территорий.<br/>Вся его команда, судя по всему, тоже бывшие военные. Хотя сейчас его банда де факто является просто бандитской группировкой, воюющей за ресурсы и влияние в Таркове. Имеет выходы на торговцев, способных вывозить товар с Норвинской области, которые регулярно присылают ему последние работающие составы для погрузки.",
      "description": "Глухарь и его многочисленные охранники крайне враждебны. Очень маловероятно, что вы добьетесь успеха, сражаясь на открытых пространствах. Предпочтительнее небольшие коридоры и закрытые комнаты. Глухарь и его охранники очень меткие и они будут постоянно находиться рядом друг с другом. Охранники Глухаря будут следовать за ним, куда бы он ни пошел."
    },
    "kaban": {
      "bio": "Некогда имел небольшой легальный бизнес в Таркове, однако не гнушался применять криминальные методы добычи денег. После всеобщей эвакуации остался в городе, а его банда обросла еще большим количеством криминальных элементов.",
      "description": "Его габариты позволяют стрелять из различных тяжелых пулеметов с руки, но одновременно Кабан не может позволить себе быть мобильным и соответственно либо сидит на позиции, либо переходит медленно с точки на точку во время боя. Имеет большое количество хорошо вооруженной свиты, часть из которых – бывшие военные, организовавшие ему мощную оборону. Босс обитает в районе автосервиса на локации \"Улицы Таркова\". Территория охраняется свитой, входы укреплены стационарными пулеметами и АГС, подходы заминированы, а на крышах стоят дозорные снайпера. Кабан использует кастомную разгрузку, чтобы хранить коробы для пулемета, носит бронежилет под одеждой, обладает непререкаемым авторитетом для своей свиты. Дикие боты, находящиеся неподалеку, помогают боссу с обороной и будут вступать в бой за Кабана."
    },
    "killa": {
      "bio": "",
      "description": "Настоящий гига-чад из Таркова. Килла использует легкий пулемет или другое автоматическое оружие для подавления противника, скрываясь от укрытия к укрытию, приближаясь к цели для последнего рывка. Во время штурма он движется зигзагообразно, использует дымовые и осколочные гранаты и неустанно подавляет врагов автоматическим огнем. Он будет преследовать свою цель на большом расстоянии от маршрута патрулирования, поэтому убегайте от него очень далеко, если он вас засек."
    },
    "kollontay": {
      "bio": "Он — бывший сотрудник МВД, во время службы в органах имел репутацию грязного на руку сотрудника, выходок которого порой боялись его сослуживцы. Во время работы он часто прибегал к своему излюбленному методу допроса с помощью резиновой дубинки, а также иного неуставного давления на того, кто был ему не по нраву. Имея крупные габариты и дерзкий нрав, после событий со скандалом в TerraGroup, он сколотил банду и занялся тем, с чем сам недавно должен был бороться — мародерством и бандитизмом. Впрочем, и до этого он часто крышевал местных «бизнесменов», например, известно  об его хороших отношениях с Кабаном.",
      "description": "Коллонтай имеет небольшое количество свиты, предпочитает находиться на позиции и изредка патрулирует свою территорию. Если он чувствует свое преимущество, то может перейти на добивание дубинкой. Обитает в районе Торгового Дома Климова и Тарковской академии МВД."
    },
    "partisan": {
      "bio": "О его прошлом мало достоверной информации, но известно, что он служил в Афганистане, где и выработал свои радикальные методы ведения войны. Известный некоторым как \"Партизан\", он прославился своим мастерством в установке ловушек и мин. Его репутация устраняющего врагов часто сводилась к тому, что он заставлял их терять бдительность, обращая их излишнюю уверенность против них самих. Знания Партизана в области партизанской тактики делают его опасным противником, способным превратить любое место — будь то лес или здание — в смертельную ловушку.<br/>Те, кто выживет достаточно долго, чтобы изучить его методы, могут заслужить его благосклонность, но только если будут достаточно осторожны, чтобы замечать ловушки, прежде чем станет слишком поздно.",
      "description": ""
    },
    "raider": {
      "bio": "",
      "description": "Дикие-рейдеры (также известные как просто \"рейдеры\") - это усовершенствованные дикие, которые значительно сильнее и тактичнее ваших обычных диких. Они носят гораздо более опасное оружие и используют боеприпасы более высокого уровня. Кроме того, они гораздо лучше целятся и часто могут завалить хорошо подготовленных игроков, получив всего несколько пуль (или просто попав вам в голову). Дикие-рейдеры также патрулируют несколькими группами, и их обычно можно отличить по уникальной экипировке и общей агрессивности. Поначалу дикие-рейдеры дружелюбно относятся ко всем другим диким (включая диких-игроков), но они станут враждебными, если вы подойдете слишком близко и проигнорируете их устные предупреждения. Они также станут враждебными ко всем диким, если какой-нибудь дикий разозлит их."
    },
    "reshala": {
      "bio": "",
      "description": "Обычно он старается держаться в тылу и быть скрытым от глаз игрока. Кроме того, он никогда не носит броню. Будьте осторожны как игрок, так как при низком уровне кармы Решала или его охранники могут выстрелить в вас без провокации или застрелить вас, если вы подойдете к Решале слишком близко. Известно, что его охранники иногда предупреждают игроков-скавенов с низкой кармой, прежде чем начать враждебные действия."
    },
    "rogue": {
      "bio": "",
      "description": "Отступники защищают водоочистную станцию и прилегающие территории на Маяке. Их основное поведение - патрулирование, но они часто занимают оборонительные позиции на крышах и используют установленное оружие. Они нападают на всех игроков, которые заходят на их территорию, но немного снисходительнее относятся к ЧВК USEC и Диким. Отступники также могут появляться на южном маяке (остров). Роуги чрезвычайно опасны из-за высокой точности лазерного луча и большого расстояния прицеливания. Кроме того, при ранении они будут бежать за укрытие и использовать медикаменты."
    },
    "sanitar": {
      "bio": "Некогда бывший врач и ученый. Работал на TerraGroup. Вел несколько проектов в лаборатории, в том числе по разработке новых психоактивных веществ. Область интересов распространялась от влияния на организм различных условий до нейростимуляторов. Помимо лаборатории TerraGroup имел свой кабинет в Санатории «Лазурный Берег», где также занимался исследованиями, особенно в последние недели перед всеобщей эвакуацией.<br/>Часто бывал в командировках в горячих точках вместе с медицинской службой, а после начала работы на корпорацию регулярно посещал африканский и другие офисы, курируя разработки. В команде заслужил непререкаемый авторитет и уважение среди коллег.",
      "description": "В бою он будет сражаться вместе со своими товарищами и охранниками, но может часто отрываться, чтобы подлечиться или сделать себе инъекцию. У него много медикаментов, поэтому возможен длительный бой."
    },
    "shturman": {
      "bio": "",
      "description": "Штурман и его последователи будут сражаться с игроком на дальнем расстоянии, защищая лесопилку в лесу. Они предпочитают держаться на расстоянии, так как не приспособлены для ближнего боя."
    },
    "tagilla": {
      "bio": "",
      "description": "Он безумен и будет пытаться забить вас. Однако если вы находитесь в таком месте, куда он не может добраться, например, на стропилах, он использует свое вторичное оружие (обычно дробовик), чтобы убить вас с расстояния. Он активен сразу в начале рейда. При необходимости босс может устраивать засады, открывать огонь на подавление и прорываться."
    },
    "zryachiy": {
      "bio": "Одна из самых таинственных личностей Таркова. О прошлом практически ничего неизвестно, кроме того, что он имеет снайперскую подготовку и по отдаленным слухам не раз бывал в горячих точках на Ближнем Востоке и в Африке.<br/>Задолго до событий стал верным цепным псом Смотрителя Маяка и активно налаживал связи Смотрителя со всеми, с кем он взаимодействовал. Известно его лояльное отношение к группе отступников, а также к людям в капюшонах, которые рисуют различные символы на локациях.<br/>Зрячий очень немногословен, хотя все, кто с ним работает, обычно понимают его без слов. Ходит много слухов относительно его зрачков, кто-то говорит, что это врожденная особенность, кто-то указывает на какие-то капли для глаз, позволяющие расширить возможности зрения в темное время суток и с таким эффектом белизны. Тем не менее прозвище, судя по всему, он получил как раз за отличное зрение, что не удивительно для бывшего военного снайпера.",
      "description": "Культист-охранник смотрителя маяка."
    }
  }
};
