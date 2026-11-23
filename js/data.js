(function () {
  "use strict";


  const NPC_PROFILES = [
    {
      id: "huiming",
      name: "慧明师父",
      mark: "师",
      role: "60 岁 · 慈云庵临时管理者",
      desire: "把这窝孩子一个不落地送出这个冬天。",
      conflict: "出家人不打诳语，可他每天都在对上面撒谎：瞒报人数、藏匿糙米、把指标挡在庵门外。",
      secret: "佛龛后的经匣里没有经卷，只有一缕胎发和一只小银锁。",
      routine: "清晨扫地，晌午补锅，深夜把孩子一个个数一遍才睡；数到小苇时，总要多停一息。",
      symbol: "经匣里的银锁",
      truth: "他的慈悲不是念经念出来的，是撒谎撒出来的。",
      memories: [
        { at: 2, text: "你撞见师父在佛龛后收起一只小银锁。他没有解释，只让你把门掩上。" },
        { at: 3, text: "他说，银锁是给女儿的。四岁那年，她没熬过逃荒。他出家，是因为没脸回家。" },
        { at: 5, text: "他把念珠塞进你手里：“替师父……去北边看看。”" }
      ]
    },
    {
      id: "shitou",
      name: "石头",
      mark: "石",
      role: "10 岁 · 庵里的孩子王",
      desire: "想亲眼看一看火车——铁的大虫子，喘白气，跑起来地都震。",
      conflict: "他逢人就说自己扒过火车到过南京，其实连县城都没出过。",
      secret: "他偷听到郎中说，自己的浮肿病“熬不过腊月”。从那天起，他拼了命把生存手札写厚。",
      routine: "雨天必去河滩，夜里给小的们讲火车，讲着讲着自己先睡着。",
      symbol: "炭笔手札",
      truth: "他不是在教你活下去，是在托孤。",
      memories: [
        { at: 2, text: "你发现他说“扒过火车”的时候，会心虚地看你一眼。" },
        { at: 3, text: "他终于承认：“其实我没出过县城。等以后……你替我去看看。”" },
        { at: 5, text: "D18 那晚，他把手札推给你：“替我看看火车。回来讲给我听。”" }
      ]
    },
    {
      id: "xiaonan",
      name: "小囡",
      mark: "囡",
      role: "4 岁 · 话还说不全的小女孩",
      desire: "说不清，大概是“不饿”和“有人抱”。",
      conflict: "她逢人就说“娘去买糖了”，谁纠正她，她就跟谁急。",
      secret: "怀里揣着娘留下的木梳，睡觉都攥着。那是她和这个世界之间最后的凭据。",
      routine: "蹲草垛、数蚂蚁，把粥里的米粒排成队；见人就躲，唯独不怕给她分过粥的人。",
      symbol: "木梳",
      truth: "她不是不懂离别，她只是把“回来”当成了一句必须成立的话。",
      memories: [
        { at: 2, text: "分过她粥以后，她开始远远跟着你，学你走路的样子。" },
        { at: 3, text: "大孩子笑她“你娘不要你了”，你蹲下来说：“嗯，买糖去了，买大包的。”" },
        { at: 5, text: "她把木梳给你看，只给看，不给碰。梳齿缝里缠着一根长头发。" }
      ]
    },
    {
      id: "chen",
      name: "陈婶",
      mark: "婶",
      role: "42 岁 · 食堂分粥人",
      desire: "让每个孩子碗里的粥一样多——包括她自己的儿子栓子。",
      conflict: "夜里她把自己那份倒进栓子碗里，自己喝刷锅水。手心手背都是肉，是她每天的刑罚。",
      secret: "她不识字。男人的名字，她只认得牌位上的写法。",
      routine: "寅时生火，勺不离手；分粥时眼睛从不看人，只看碗。",
      symbol: "粥勺",
      truth: "公平了一辈子的人，也会为一个孩子偏一次心。",
      memories: [
        { at: 2, text: "你帮她刷锅时，看见她把锅底最后一点米渣刮进一只小碗。" },
        { at: 3, text: "她红着脸请你教栓子写名字。她自己的名字，写得像一笔一笔搬石头。" },
        { at: 5, text: "D17 藏粮拷问，她把话头岔开，替你遮掩了过去。" }
      ]
    },
    {
      id: "citou",
      name: "刺头",
      mark: "刺",
      role: "12 岁 · 墙外的流浪儿",
      desire: "活下去；以及，没人知道的——被允许进庵里烤一次火。",
      conflict: "抢食、偷藏、出手狠，却在深夜把半块饼塞给发烧的孩子。",
      secret: "去年冬天，弟弟在他怀里饿死。那天他手里攥着半块饼，没舍得全给出去。",
      routine: "墙根转悠，集市日必在；被轰就走，明天还来。",
      symbol: "墙根下的半块饼",
      truth: "他的恶是生存，他的善是赎罪。",
      memories: [
        { at: 2, text: "你撞见他翻墙进来，把半块饼塞给发烧的孩子，又翻墙出去。" },
        { at: 3, text: "他带你摸到供销社后墙根，说：“你望风。我翻。”" },
        { at: 5, text: "北上清晨，墙根下放着半块还温的饼。他没有来送你。" }
      ]
    }
  ];

  const BOND_LEVELS = [
    { min: 0, name: "生疏", note: "还没有说上几句话。" },
    { min: 1, name: "点头", note: "不再躲你，见面会应一声。" },
    { min: 2, name: "熟络", note: "愿意和你说些无关紧要的闲话。" },
    { min: 3, name: "信任", note: "把一件不愿让别人知道的事交给了你。" },
    { min: 4, name: "托付", note: "开始把你当成可以并肩的人。" },
    { min: 5, name: "家人", note: "有些话不用说，有些人不会走。" }
  ];

  const SKILL_DEFINITIONS = {
    gather: { label: "采集", icon: "枝", description: "剥榆皮、拾柴、辨认可用的材料。" },
    fish: { label: "捕鱼", icon: "鱼", description: "摸鱼、捞虾，冬天破冰。" },
    identify: { label: "辨认", icon: "叶", description: "从野草里挑出能吃的，避开毒草。" },
    weave: { label: "编织", icon: "结", description: "柳条、稻草、碎布，能编出活路。" }
  };

  const MAP_LOCATIONS = [
    { id: "canteen", name: "食堂", icon: "食", danger: "低", intel: "陈婶寅时生火，锅底最知道院里还剩多少粮。", actions: ["queue", "help"] },
    { id: "hall", name: "大殿", icon: "佛", danger: "低", intel: "佛像低垂着眉眼。这里可以存档，也最容易做梦。", actions: ["pray"] },
    { id: "dorm", name: "大通铺", icon: "铺", danger: "低", intel: "挤一挤，体温能多留住一点。", actions: ["rest"] },
    { id: "field", name: "田埂", icon: "埂", danger: "中", intel: "荠菜贴地长，泽漆折断会流白浆。", actions: ["greens"] },
    { id: "river", name: "河埠头", icon: "河", danger: "中", intel: "雨后浅滩会翻银光，化冻日冰面最会骗人。", actions: ["fish"] },
    { id: "elm", name: "村外老榆树", icon: "榆", danger: "中", intel: "雪后树皮冻脆，剥起来省一半力气。", actions: ["bark"] },
    { id: "town", name: "镇街", icon: "街", danger: "中", intel: "大喇叭一响，镇上的风向就变了。", actions: ["help"] },
    { id: "supply", name: "供销社后墙根", icon: "墙", danger: "高", intel: "巡逻经过的时段最危险。刺头熟悉这里。", actions: [], unlockBond: { id: "citou", level: 3 } },
    { id: "market", name: "集市", icon: "市", danger: "中", intel: "货郎的人情账，比货担还沉。", actions: [] },
    { id: "hill", name: "后山", icon: "山", danger: "高", intel: "石头疼得蹲下时，总说自己在练腿。", actions: [] },
    { id: "grassStack", name: "草垛", icon: "草", danger: "低", intel: "小囡总蹲在这里数蚂蚁，也把米粒排成队。", actions: ["care"] },
    { id: "iceRiver", name: "冰河", icon: "冰", danger: "高", intel: "破冰捞鱼是冬季唯一的高产鱼源；冰面破裂，体温会迅速流失。", actions: ["fish"], unlockDay: 16 }
  ];

  const TOOL_RECIPES = [
    { id: "clothBag", name: "破布袋", materials: "碎布 ×4", unlock: "初始", effect: "包袱容量 +2 格" },
    { id: "strawShoes", name: "草鞋", materials: "稻草 ×5", unlock: "D5 石头教授", effect: "免疫冻疮，雪天外出必备" },
    { id: "fishBasket", name: "鱼篓", materials: "柳条 ×3 + 草绳", unlock: "编织 1 级", effect: "摸鱼产量 ×2，可放置河滩过夜" },
    { id: "iceAwl", name: "冰钎", materials: "铁钉 ×2 + 木棒", unlock: "拾荒获得铁钉", effect: "解锁破冰捞鱼" },
    { id: "fireStarter", name: "火折子", materials: "灶膛余炭 + 干草", unlock: "守夜 1 次", effect: "外出时可烤火一次，体温 +30" },
    { id: "herbBag", name: "草药包", materials: "草药 ×3", unlock: "辨认 3 级", effect: "健康 +25，可治高烧" }
  ];

  const RECIPES = [
    { id: "wildBun", name: "野菜团子", materials: { greens: 2, bark: 1 }, result: "wildBun", unlockSkill: 0, note: "野菜掺榆皮粉，捏成能咽下去的团子。" },
    { id: "barkPaste", name: "榆皮糊糊", materials: { bark: 2 }, result: "barkPaste", unlockSkill: 0, note: "难以下咽，但能让胃里有东西。" },
    { id: "fishSoup", name: "鱼汤", materials: { fish: 1 }, result: "fishSoup", unlockSkill: 0, note: "热汤能把冻僵的手脚慢慢叫醒。" },
    { id: "mixedPorridge", name: "混合粥", materials: { porridge: 1, greens: 1 }, result: "mixedPorridge", unlockSkill: 0, note: "把粥变稠，是孩子们最朴素的奢望。" }
  ];

  const DREAM_SEQUENCES = [
    {
      title: "白原",
      text: "你一直往前走。天地几乎没有分界，身后只留下一排脚印。\n远处有一种声音，像风，又像有人在很远的地方哼歌。",
      whisper: "第一次梦见白原。"
    },
    {
      title: "地平线上的黑点",
      text: "地平线上出现一个极小的黑点，一动不动。\n风里的声音近了一点，像一声很远的铃铛。",
      whisper: "第二次梦见白原。"
    },
    {
      title: "蒙古包的剪影",
      text: "黑点近了。那是一座蒙古包的剪影。\n铃铛声变成一段模糊的哼唱，你想不起在哪里听过。",
      whisper: "第三次梦见白原。"
    },
    {
      title: "有人在等",
      text: "剪影前似乎站着一个人，朝这边望。\n醒来时枕边湿了一片。你不知道自己什么时候哭过。",
      whisper: "第四次梦见白原。"
    },
    {
      title: "差一步",
      text: "你看清了：她半蹲着，像在等谁。\n你开始奔跑。白雾漫上来，梦在终点前一步醒了。",
      whisper: "第五次梦见白原。"
    }
  ];

  const FINAL_DREAM = {
    title: "到了，孩子。",
    text: "蒙古包前，她半蹲着，与你的视线平齐。\n风雪第一次停了。她伸出手，掌心有灶膛一样的暖意。\n\n白原的雪，从这一刻开始透出第一丝金色。",
    whisper: "原来这片白，是还没到来的春天。"
  };

  const DAILY_RUMORS = [
    "墙根有半截炭笔印，像一列歪歪扭扭的火车。",
    "石头说，雨后的鱼都躲进浅草里。",
    "陈婶把勺子在锅沿磕了两下。今天的粥更稀。",
    "货郎的人情账上，又添了一笔。",
    "老船工说，化冻时的冰面最会骗人。",
    "有人在草垛后数蚂蚁，数到一半又从头数。",
    "大殿的门缝里漏出一线灯，像有人在等谁。",
    "大喇叭说明天可能征柴。孩子们把这句话传了三遍。",
    "栓子把捡来的煤核分给比他小的孩子，自己把手缩进袖口。",
    "刺头在墙外站了一会儿，没进来，也没走远。",
    "有人用旧衣裳换半斤米。布袋抱在怀里，像抱着孩子。",
    "雪落在庵檐上，声音轻得像有人翻了一页手札。"
  ];


  const PROLOGUE_QUESTIONS = [
    {
      id: "q1",
      question: "闹饥荒的年月，你自己每天只有半碗稀粥。福利院问：愿意无偿收养一个和你毫无血缘的孩子吗？",
      options: [
        { id: "q1a", text: "愿意，多双筷子而已", rational: false },
        { id: "q1b", text: "等日子好点再说", rational: false },
        { id: "q1c", text: "养不活自己，怎么养别人", rational: true }
      ],
      realAnswer: "草原牧民骑马、赶勒勒车、步行几百里，争先恐后领养——有的人家自己也只剩炒米和奶豆腐。",
      fact: "1960—1963 年，约三千名南方孤儿被内蒙古家庭接纳。"
    },
    {
      id: "q2",
      question: "如果收养，你觉得自己一个人最多能同时照顾几个不懂事的孩子？",
      options: [
        { id: "q2a", text: "1 个", rational: true },
        { id: "q2b", text: "2—3 个", rational: false },
        { id: "q2c", text: "5 个以上", rational: false }
      ],
      realAnswer: "都贵玛，19 岁，一个人照顾 28 个孩子。",
      fact: "她把小床摆成圆形，自己睡在中间。"
    },
    {
      id: "q3",
      question: "照顾孩子的代价是：一年以上，每天晚上都不能睡一个完整的觉。你能坚持多久？",
      options: [
        { id: "q3a", text: "一个星期", rational: false },
        { id: "q3b", text: "一个月", rational: false },
        { id: "q3c", text: "应该没人能坚持一年吧", rational: true }
      ],
      realAnswer: "都贵玛一年多没睡过一个整觉。哪个孩子哼一声，她立刻坐起来。",
      fact: "这样的夜晚，她过了四百多个。"
    },
    {
      id: "q4",
      question: "你刚成年，没结过婚，没带过孩子。现在要把几十个孩子的命交到你手上，你敢接吗？",
      options: [
        { id: "q4a", text: "不敢，这是人命", rational: true },
        { id: "q4b", text: "我可以帮忙打下手", rational: false },
        { id: "q4c", text: "总得有人接，我来", rational: false }
      ],
      realAnswer: "都贵玛说：“看到这么多孩子没了父母……我有义务照顾好这些孩子。”",
      fact: "1961 年，19 岁的她成为保育员。"
    },
    {
      id: "q5",
      question: "你千辛万苦把孩子养活了、养亲了，然后要亲手把他们一个个送给别人，经历不知道多少次离别。你还愿意开始吗？",
      options: [
        { id: "q5a", text: "不愿意，我不舍得分离", rational: true },
        { id: "q5b", text: "不知道，我不敢想", rational: false },
        { id: "q5c", text: "只要孩子能活得好", rational: false }
      ],
      realAnswer: "都贵玛经历了 28 次离别，每次都偷偷骑马跟到新家附近张望，确认孩子笑了才离开。",
      fact: "孩子养壮一个，就被领养走一个。"
    }
  ];

  const DAILY_EVENTS = {
    1: {
      title: "入院登记",
      weather: "阴，河面起雾",
      text: "慈云庵的门轴响了一声。慧明师父把一个温热的半个窝头放进你手心。\n“慢慢嚼。嚼出甜味，就不饿了。”",
      note: "你把自己的名字写成了“小苇”。"
    },
    2: {
      title: "布老虎",
      weather: "阴冷",
      text: "你在铺盖下摸到母亲留下的布老虎。棉花已经结成硬块，虎耳朵也磨破了。\n你把它塞回怀里，心口忽然没那么空。",
      note: "布老虎是整幅灰暗画面里唯一保留暖色的物件。"
    },
    3: {
      title: "定量再减",
      weather: "小雨",
      text: "食堂黑板上的数字又被改小。陈婶舀粥时把勺子在锅边刮了三遍。\n今天的粥，能照见人影。",
      note: "有人在墙角写：不怕稀，怕断。"
    },
    4: {
      title: "门槛上的孩子",
      weather: "潮湿",
      text: "邻县的孤儿一批批涌来，大通铺不够睡。最小的孩子被裹在旧棉絮里，放在大殿门槛上。\n夜里风从门缝钻进来。",
      note: "你第一次发现，庵里原来有这么多双眼睛。"
    },
    5: {
      title: "一把荠菜",
      weather: "多云",
      text: "石头教你辨认荠菜，把挖到的唯一一把分出一半，硬塞到你手里。\n“你个子小，得吃。”他说完就转过头。",
      note: "你可以收下，也可以推回去。",
      choices: [
        { id: "accept", label: "收下" },
        { id: "refuse", label: "推回去" },
        { id: "split", label: "各一半" }
      ]
    },
    6: {
      title: "寒潮",
      weather: "北风，霜冻",
      text: "入夜后，风把窗纸吹成一面鼓。你蜷在石头边上，脚趾像被针扎。\n灶膛里只剩一层红灰。",
      note: "今天必须想办法保住体温。"
    },
    7: {
      title: "集市日",
      weather: "阴",
      text: "有人用一件旧衣裳换了半斤米。买米的人把布袋抱在胸前，像抱着孩子。\n你在人群外站了很久，没学会大人脸上的表情。",
      note: "世界很大，粮食却只够装进一个小小的布袋。"
    },
    8: {
      title: "石头的腿",
      weather: "阴雨",
      text: "石头的腿按下去会陷出一个坑，很久才慢慢平复。\n他笑着说只是站久了，却把自己的粥推到你面前。",
      note: "他推说“不饿”的时候，总不敢看你。"
    },
    9: {
      title: "小囡的碗",
      weather: "阴",
      text: "一个半大的孩子抢走了小囡的碗，粥洒在泥地上。小囡没有追，只蹲在原地，眼泪一颗一颗砸下来。\n她抬头看着你。",
      note: "没人看见的时候，你做的事才真正属于你。",
      choices: [
        { id: "share", label: "把自己的粥分她一半" },
        { id: "fight", label: "帮她抢回来" },
        { id: "lie", label: "蹲下来说：娘买糖去了，买大包的" },
        { id: "ignore", label: "装作没看见" }
      ]
    },
    10: {
      title: "浮肿病",
      weather: "阴",
      text: "浮肿病在庵里蔓延。慧明师父遍请郎中，药方写了一张又一张。\n石头脚上的鞋，已经穿不进去了。",
      note: "春天还没有来。"
    },
    11: {
      title: "接勺",
      weather: "阵雨后转晴",
      text: "雨停后，河埠头的浅滩里翻起细碎的银光。\n陈婶却烧得站不稳，把粥勺塞进你手里。栓子排在队尾，低着头。\n“手别抖。每个孩子都一样多。”她说完，靠住了灶台。",
      note: "接过勺，才知道那勺有多沉。",
      choices: [
        { id: "favor", label: "给栓子多一勺" },
        { id: "equal", label: "每个孩子一样多" },
        { id: "ask", label: "请慧明师父来分" }
      ]
    },
    12: {
      title: "断粮",
      weather: "阴",
      text: "食堂断粮一天。全镇支起大锅，清水里飘着几片野菜。\n陈婶不再说“慢点吃”，她只是低着头，一勺一勺地把锅底刮响。",
      note: "锅底的声音比风还冷。"
    },
    13: {
      title: "晕倒的师父",
      weather: "阴冷",
      text: "慧明师父把自己的口粮分给孩子们。傍晚，她在大殿前晃了一下，扶着门框慢慢滑坐下去。\n她醒来后先问：孩子们吃了吗？",
      note: "你第一次觉得，慈悲不是一句话，是把自己的那一口省下来。"
    },
    14: {
      title: "半块红薯",
      weather: "深夜，霜",
      text: "刺头撬开食堂的窗，把半块红薯塞进你怀里。\n“一人一半，别吱声。”他的手指冻得裂开了口子。",
      note: "红薯还带着灶膛的余温。",
      choices: [
        { id: "eat", label: "吃掉" },
        { id: "report", label: "告发" },
        { id: "return", label: "劝他放回去" },
        { id: "give", label: "收下，转送给发烧的孩子" },
        { id: "cover", label: "替他望风，一起分吃" }
      ]
    },
    15: {
      title: "名册",
      weather: "阴",
      text: "县上来人登记孤儿名册。大人们在廊下低声说话，你只听见几个词：\n“北边……草原……”",
      note: "你不知道草原在哪里。"
    },
    16: {
      title: "第一场雪",
      weather: "大雪",
      text: "入冬第一场雪落下来。孩子们挤在大通铺上，脚和脚叠在一起。\n雪压断了院里的枯枝。",
      note: "今夜，谁都不想一个人睡。"
    },
    17: {
      title: "藏粮",
      weather: "雪后",
      text: "陈婶挨屋问：“有没有孩子藏了粮？院里有人要饿死了。”\n她说话时没有看任何人，只看着自己冻红的手。",
      note: "你铺下还留着几份没有分出去的食物。",
      choices: [
        { id: "all", label: "全交" },
        { id: "half", label: "交一半" },
        { id: "silent", label: "沉默" }
      ]
    },
    18: {
      title: "石头再没醒来",
      weather: "阴冷",
      text: "清晨，石头没有像往常一样先坐起来。他的手冰得像河底的石头。\n你们用草席把他抬往后山。你把布老虎塞进他手里，最后又拿了回来。",
      note: "大殿里，佛像低垂着眉眼。"
    },
    19: {
      title: "病倒",
      weather: "大雪封门",
      text: "你醒来时，屋顶在眼前缓慢地打转。有人把湿毛巾放在你额头上。\n这一天，你哪里也去不了。",
      note: "生病时，时间会变得很长。"
    },
    20: {
      title: "名册敲定",
      weather: "雪",
      text: "名册敲定。庵里风言风语，说孩子们要被送去很远很远的地方。\n小囡把自己的小指头勾住你的小指头，不肯松开。",
      note: "远方，第一次不再只是一个词。"
    },
    21: {
      title: "棉鞋",
      weather: "晴冷",
      text: "慧明师父带着病补完所有孩子的棉鞋。针脚歪歪扭扭，鞋底却纳得很厚。\n她把最后一双放在你床头，没有叫醒你。",
      note: "每一针都像是在说：路还长。"
    },
    22: {
      title: "热水",
      weather: "晴",
      text: "防疫大扫除，孩子们第一次被烧热水洗澡。屋里雾气腾腾，谁也看不清谁。\n有人笑了一声，笑声很快被雾气吞掉。",
      note: "你洗掉了头发里的草屑，却洗不掉饿。"
    },
    23: {
      title: "新布褂",
      weather: "阴",
      text: "有人看到大人们在缝统一的新布褂。数量一数再数，总对不上人数。\n你把自己的旧棉袄裹紧了一点。",
      note: "大人们什么也没说。"
    },
    24: {
      title: "大殿里的告别",
      weather: "雪",
      text: "慧明师父把你叫到大殿。她替你理了理衣领，手在发抖。\n“明儿个……不管去哪，好好活。”",
      note: "你点了点头，却不知道她为什么红了眼睛。"
    },
    25: {
      title: "最后一点粥",
      weather: "大雪",
      text: "食堂锅底已经空了。陈婶把最后刮下来的一碗粥底塞给你。\n“快跑，别让人看见。”\n你端着碗往庵里走。路过草垛时，看见小囡蜷在里面。她身边是空了三天的碗，已经没有力气伸出手。",
      note: "风雪把她的呼吸声吹得很轻。",
      final: true
    }
  };

  const ACTION_LIBRARY = {
    queue: {
      id: "queue",
      label: "排队领粥",
      short: "护住碗",
      icon: "粥",
      description: "人堆里护住自己的碗。",
      kind: "timing",
      gain: { porridge: 1 },
      outside: false,
      locationId: "canteen",
      skill: null,
      xp: {},
      community: { smoke: 2, popularity: 0 }
    },
    greens: {
      id: "greens",
      label: "挖野菜",
      short: "辨认野菜",
      icon: "菜",
      description: "从几株野草里挑出能吃的。",
      kind: "plant",
      gain: { greens: 2 },
      outside: true,
      locationId: "field",
      skill: "identify",
      xp: { identify: 10, gather: 5 },
      community: { smoke: 1, popularity: 1 }
    },
    fish: {
      id: "fish",
      label: "下河摸鱼",
      short: "摸鱼虾",
      icon: "鱼",
      description: "趁雨后的浅滩摸一点鱼虾。",
      kind: "timing",
      gain: { fish: 1 },
      outside: true,
      locationId: "river",
      skill: "fish",
      xp: { fish: 10 },
      community: { smoke: 2, popularity: 0 }
    },
    bark: {
      id: "bark",
      label: "剥榆树皮",
      short: "磨榆皮粉",
      icon: "榆",
      description: "剥下树皮，磨成能咽下去的粉。",
      kind: "instant",
      gain: { bark: 2 },
      outside: true,
      locationId: "elm",
      skill: "gather",
      xp: { gather: 10 },
      community: { smoke: 1, popularity: 0 }
    },
    help: {
      id: "help",
      label: "帮陈婶",
      short: "刷锅劈柴",
      icon: "柴",
      description: "按住锅底来回擦洗，换一碗锅底米渣。",
      kind: "scrub",
      gain: { porridge: 1 },
      outside: false,
      locationId: "canteen",
      skill: "weave",
      xp: { weave: 5 },
      community: { smoke: 4, popularity: 1 }
    },
    care: {
      id: "care",
      label: "陪小囡",
      short: "照顾小囡",
      icon: "囡",
      description: "教她认字，听她前言不搭后语地说话。",
      kind: "instant",
      gain: {},
      outside: false,
      locationId: "grassStack",
      skill: null,
      xp: {},
      bond: { xiaonan: 1 },
      community: { smoke: 0, popularity: 4 }
    },
    pray: {
      id: "pray",
      label: "佛前祈祷",
      short: "坐一会儿",
      icon: "佛",
      description: "按住静心，让呼吸慢下来。这里可以存档。",
      kind: "hold",
      gain: {},
      outside: false,
      locationId: "hall",
      skill: null,
      xp: {},
      bond: { huiming: 1 },
      community: { smoke: 0, popularity: 2 }
    },
    rest: {
      id: "rest",
      label: "灶边歇息",
      short: "暖一暖",
      icon: "火",
      description: "靠近灶膛，让冻僵的手脚缓过来。",
      kind: "instant",
      gain: {},
      outside: false,
      locationId: "dorm",
      skill: null,
      xp: {},
      community: { smoke: 1, popularity: 1 }
    }
  };

  const DAILY_ACTIONS = {
    1: ["queue", "help", "care", "pray"],
    2: ["greens", "queue", "rest", "pray"],
    3: ["bark", "queue", "care", "help"],
    4: ["greens", "fish", "queue", "care"],
    5: ["greens", "bark", "care", "pray"],
    6: ["rest", "help", "queue", "pray"],
    7: ["fish", "help", "queue", "pray"],
    8: ["greens", "queue", "care", "rest"],
    9: ["queue", "care", "fish", "pray"],
    10: ["rest", "help", "queue", "pray"],
    11: ["fish", "greens", "queue", "rest"],
    12: ["greens", "bark", "queue", "pray"],
    13: ["help", "care", "queue", "rest"],
    14: ["queue", "greens", "pray", "rest"],
    15: ["help", "queue", "care", "pray"],
    16: ["rest", "help", "queue", "pray"],
    17: ["bark", "greens", "queue", "care"],
    18: ["care", "pray", "rest", "help"],
    19: ["rest", "pray", "queue", "care"],
    20: ["help", "queue", "greens", "pray"],
    21: ["care", "help", "queue", "rest"],
    22: ["rest", "pray", "help", "care"],
    23: ["help", "queue", "greens", "pray"],
    24: ["care", "pray", "queue", "rest"],
    25: []
  };

  const FOODS = {
    porridge: { label: "稀粥", icon: "粥", satiety: 15, warmth: 2, health: 0, spirit: 0 },
    greens: { label: "野菜", icon: "菜", satiety: 10, warmth: 0, health: 0, spirit: 0 },
    bark: { label: "榆皮粉", icon: "榆", satiety: 12, warmth: 0, health: -2, spirit: -1 },
    fish: { label: "鱼虾", icon: "鱼", satiety: 28, warmth: 8, health: 2, spirit: 0 },
    sweetPotato: { label: "半块红薯", icon: "薯", satiety: 45, warmth: 6, health: 2, spirit: 8 },
    wildBun: { label: "野菜团子", icon: "团", satiety: 25, warmth: 1, health: 1, spirit: 0 },
    barkPaste: { label: "榆皮糊糊", icon: "糊", satiety: 18, warmth: 2, health: -1, spirit: -3 },
    fishSoup: { label: "鱼汤", icon: "汤", satiety: 30, warmth: 15, health: 3, spirit: 1 },
    mixedPorridge: { label: "混合粥", icon: "拌", satiety: 26, warmth: 6, health: 1, spirit: 2 }
  };

  const PLANT_QUIZ = [
    {
      prompt: "石头说：认不准的野菜，宁可饿着。哪一株是荠菜？",
      options: [
        { name: "荠菜", safe: true, hint: "叶片贴地生长，有细碎缺刻。" },
        { name: "泽漆", safe: false, hint: "折断茎会流出白色乳汁，有毒。" },
        { name: "曼陀罗", safe: false, hint: "叶片宽大，果实带刺，有毒。" }
      ]
    },
    {
      prompt: "哪一种可以吃？",
      options: [
        { name: "马齿苋", safe: true, hint: "肉质茎叶，贴地匍匐生长。" },
        { name: "夹竹桃", safe: false, hint: "叶片细长，全株有毒。" },
        { name: "苍耳", safe: false, hint: "幼苗易误食，有毒。" }
      ]
    },
    {
      prompt: "河滩边这几株草，哪一株能放进篮子？",
      options: [
        { name: "荠菜", safe: true, hint: "石头教过你：叶脉清楚，根带土腥气。" },
        { name: "毒芹", safe: false, hint: "茎上有紫斑，有恶臭，剧毒。" },
        { name: "蓖麻", safe: false, hint: "叶片掌状，种子有毒。" }
      ]
    }
  ];

  const ARCHIVE_ENTRIES = [
    {
      id: "archive-1",
      title: "“接一个，活一个；养一个，壮一个”",
      unlockDay: 5,
      summary: "1960—1963 年，约三千名南方孤儿分批乘专列北上，由内蒙古牧民家庭抚养。",
      body: "时任内蒙古自治区主席乌兰夫专门指示：“接一个，活一个；养一个，壮一个。”\n草原牧民有的骑马，有的赶着勒勒车，有的步行几百里，争相领养这些孩子。",
      source: "依据 2025-04-28 乌兰察布市人民政府公开报道及中国青年报、中新网相关报道。",
      url: "https://www.wulanchabu.gov.cn/jrwlcb/1812951.html"
    },
    {
      id: "archive-2",
      title: "1960 年移入儿童设备购置费明细表",
      unlockDay: 18,
      summary: "小木床、小毯子、小桌子、便盆、澡盆、枕头、毛巾……一场有组织、有温度的国家行动。",
      body: "内蒙古档案馆留存有“1960 年移入儿童设备购置费明细表”。\n这些普通的物件，是三千个孩子北上途中被认真接住的证据。",
      source: "中国青年报《三千孤儿入内蒙 不分民族写大爱》，2021-03-23。",
      url: "https://zqb.cyol.com/html/2021-03/23/nw.D110000zgqnb_20210323_7-01.htm"
    },
    {
      id: "archive-3",
      title: "28 个孩子，无一夭折",
      unlockDay: 25,
      summary: "19 岁的都贵玛与助手托娅照顾 28 名上海孤儿。她把小床围成圆，自己睡在中间。",
      body: "孩子最大约 6 岁，最小才满月。有的孩子三四岁还不会走路，个个体弱多病。\n此后一年多，都贵玛经历了 28 次离别。孩子被接走后，她还会骑马到新家附近偷偷张望，确认孩子笑了才离开。",
      source: "中新网《东西问·人物丨草原母亲都贵玛抚孤深重情缘》，2023-10-28。",
      url: "https://www.chinanews.com/dxw/2023/10-28/10102422.shtml"
    }
  ];

  const ART_MANIFEST = {
    chapter1Background: "",
    chapter1Winter: "",
    finalSnow: "",
    grasslandBackground: "",
    yurtNight: "",
    xiaowei: "",
    xiaonan: "",
    stone: "",
    naren: "",
    clothTiger: ""
  };

  window.EIDJI_DATA = {
    PROLOGUE_QUESTIONS,
    NPC_PROFILES,
    BOND_LEVELS,
    SKILL_DEFINITIONS,
    MAP_LOCATIONS,
    TOOL_RECIPES,
    RECIPES,
    DREAM_SEQUENCES,
    FINAL_DREAM,
    DAILY_RUMORS,
    DAILY_EVENTS,
    ACTION_LIBRARY,
    DAILY_ACTIONS,
    FOODS,
    PLANT_QUIZ,
    ARCHIVE_ENTRIES,
    ART_MANIFEST
  };
})();
