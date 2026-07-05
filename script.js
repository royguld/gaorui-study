/* ========== 数据 ========== */

const subjects = {
  math: {
    label: "数学",
    tasks: [
      ["二次根式复盘", "完成 8 道计算题，错题写出化简步骤。"],
      ["IXL 技能点", "完成 20 分钟未完成任务，记录得分。"],
      ["IG 数学词汇", "背 significant figure、factorise、gradient 等 12 个词。"],
    ],
    lessons: [
      {
        title: "一次函数",
        status: "今天重点",
        oneLine: "一次函数就是用一条直线描述两个量之间的变化关系。",
        example: "打车费用 = 起步价 + 每公里费用 × 公里数。公里数越多，总费用按固定速度增加。",
        steps: ["找到自变量 x", "写出 y = kx + b", "用图像判断增减"],
        review: ["说清 k 和 b 分别控制什么。", "重新做 2 道求解析式题。", "画一条 y 随 x 增大的直线。"],
        quiz: [
          ["y = 2x + 3 中，k 的值是？", ["2", "3", "5"], 0],
          ["当 k > 0 时，y 随 x 怎么变化？", ["增大", "减小", "不变"], 0],
          ["一次函数图像通常是什么？", ["直线", "抛物线", "圆"], 0],
        ],
      },
      {
        title: "二次根式",
        status: "需巩固",
        oneLine: "二次根式的关键是先看被开方数，再做化简和同类合并。",
        example: "把根号 12 看成根号 4×3，所以可以化成 2 根号 3。",
        steps: ["判断有意义条件", "拆平方因数", "合并同类根式"],
        review: ["写出根号有意义的条件。", "重做 5 道化简题。", "标出哪些根式是同类。"],
        quiz: [
          ["根号 x 有意义，x 应满足？", ["x ≥ 0", "x < 0", "x = 1"], 0],
          ["根号 12 可化为？", ["2√3", "3√2", "6√2"], 0],
          ["√2 和 3√2 能否合并？", ["能", "不能", "看情况"], 0],
        ],
      },
      {
        title: "统计与平均数",
        status: "已入门",
        oneLine: "统计题先分清平均数、众数、中位数，再看题目是否有权重。",
        example: "考试总评如果平时 40%、期末 60%，就不能直接算普通平均。",
        steps: ["读清数据", "判断统计量", "代入权重"],
        review: ["复述众数和中位数区别。", "做一道加权平均题。", "检查单位和百分比。"],
        quiz: [
          ["出现次数最多的数叫？", ["众数", "平均数", "极差"], 0],
          ["加权平均要注意什么？", ["权重", "颜色", "顺序"], 0],
          ["中位数需要先做什么？", ["排序", "相加", "画图"], 0],
        ],
      },
    ],
  },
  english: {
    label: "英语",
    tasks: [
      ["短语辨析", "完成 a number of / the number of 到 spend / take。"],
      ["MyOn 阅读", "读 20 分钟，摘 5 个新词。"],
      ["写作句型", "用 compare、prefer、used to 各造 2 句。"],
    ],
    lessons: [
      {
        title: "used to 与 be used to",
        status: "易错点",
        oneLine: "used to do 表示过去常常；be used to doing 表示习惯于做。",
        example: "I used to get up late. Now I am used to getting up early.",
        steps: ["看后面是动词原形还是 ing", "判断过去习惯还是现在适应", "自己造句"],
        review: ["默写两个结构。", "各造 2 个句子。", "把错句改成正确句。"],
        quiz: [
          ["used to 后面接？", ["动词原形", "动词 ing", "名词复数"], 0],
          ["be used to 后面常接？", ["doing", "do", "did"], 0],
          ["I ___ play basketball. 应填？", ["used to", "am used to", "use to doing"], 0],
        ],
      },
    ],
  },
  chinese: {
    label: "语文",
    tasks: [
      ["九上古诗", "抄写并背诵《行路难》前半部分。"],
      ["IG 阅读", "完成一篇现代文阅读，答案必须写依据。"],
      ["《简爱》", "阅读 30 分钟，记录人物心理变化。"],
    ],
    lessons: [
      {
        title: "阅读题答题依据",
        status: "核心方法",
        oneLine: "阅读题不是凭感觉写，要先定位原文，再概括作用。",
        example: "问环境描写作用时，先找景物，再答氛围、人物、情节、主题。",
        steps: ["圈关键词", "定位原文句", "按题型模板作答"],
        review: ["把今天错题重新定位原文。", "背一个环境描写答题模板。", "补充遗漏的作用点。"],
        quiz: [
          ["阅读题第一步通常是？", ["定位原文", "直接发挥", "先写很长"], 0],
          ["环境描写常见作用不包括？", ["计算面积", "渲染氛围", "烘托人物"], 0],
          ["答案要尽量来自哪里？", ["文本", "想象", "网上"], 0],
        ],
      },
    ],
  },
  physics: {
    label: "物理",
    tasks: [
      ["Physics Vocabulary", "背 movement、velocity、force 等 15 个词。"],
      ["纪录片观后感", "列《电的故事》400 字提纲。"],
      ["实验设计", "画自动供水装置草图，标注大气压原理。"],
    ],
    lessons: [
      {
        title: "力 Force",
        status: "IG 词汇",
        oneLine: "Force 是改变物体运动状态或形状的作用。",
        example: "推门、拉弹簧、摩擦刹车，都是力在改变运动或形状。",
        steps: ["识别施力物体", "判断效果", "写出单位 N"],
        review: ["默写 force、friction、weight。", "举 3 个力的例子。", "说清重力和质量区别。"],
        quiz: [
          ["Force 的单位常用？", ["N", "kg", "m"], 0],
          ["摩擦力英文是？", ["friction", "velocity", "mass"], 0],
          ["力可能改变物体的？", ["运动状态", "颜色名称", "日期"], 0],
        ],
      },
    ],
  },
  chemistry: {
    label: "化学",
    tasks: [
      ["入门预习", "阅读九年级 IG 化学第一章，记录 10 个英文关键词。"],
      ["概念卡", "整理 solid、liquid、gas 的区别。"],
      ["小测", "用中文解释 particle model。"],
    ],
    lessons: [
      {
        title: "物质三态",
        status: "预习",
        oneLine: "固体、液体、气体的差别，本质上是粒子排列和运动不同。",
        example: "冰、水、水蒸气是同一种物质在不同状态下的表现。",
        steps: ["看粒子距离", "看能否流动", "看是否固定体积"],
        review: ["画三态粒子图。", "背 solid、liquid、gas。", "解释熔化和蒸发。"],
        quiz: [
          ["solid 是？", ["固体", "液体", "气体"], 0],
          ["气体粒子通常排列？", ["很疏远", "完全固定", "紧密整齐"], 0],
          ["melting 表示？", ["熔化", "凝固", "过滤"], 0],
        ],
      },
    ],
  },
  economics: {
    label: "经济",
    tasks: [
      ["经济词汇", "背 scarcity、choice、opportunity cost、resource。"],
      ["Chapter 1", "读 Economic problem，画一张选择关系图。"],
      ["生活解释", "用 3 句话解释为什么暑假时间也是稀缺资源。"],
    ],
    lessons: [
      {
        title: "机会成本 Opportunity Cost",
        status: "Chapter 1",
        oneLine: "选择 A 时，放弃的最好选择 B，就是机会成本。",
        example: "晚上 1 小时如果用来打游戏，就放弃了做 IXL 或读 MyOn 的最好机会。",
        steps: ["资源有限", "必须选择", "放弃的最好选项"],
        review: ["用英文解释 opportunity cost。", "举一个暑假学习例子。", "说清 need 和 want 的区别。"],
        quiz: [
          ["Opportunity cost 指什么？", ["放弃的最好选择", "总花费", "收入"], 0],
          ["资源有限会导致？", ["选择", "无限消费", "没有成本"], 0],
          ["choice 的中文是？", ["选择", "曲线", "生产"], 0],
        ],
      },
      {
        title: "需求曲线 Demand",
        status: "Chapter 2",
        oneLine: "通常价格越高，愿意购买的数量越少，需求曲线向右下方倾斜。",
        example: "奶茶涨价后，同学们可能买得更少。",
        steps: ["看价格", "看购买数量", "画向下曲线"],
        review: ["画一条需求曲线。", "背 demand、quantity、price。", "解释价格上升的影响。"],
        quiz: [
          ["需求曲线通常向？", ["右下", "右上", "水平"], 0],
          ["Demand 是？", ["需求", "供给", "利润"], 0],
          ["价格上涨，需求量通常？", ["减少", "增加", "不变"], 0],
        ],
      },
    ],
  },
  history: {
    label: "历史",
    tasks: [["读书笔记", "从三本书中选一本，完成第 1 次读书笔记。"], ["人物卡", "整理一个历史人物：背景、行动、影响。"]],
    lessons: [
      {
        title: "历史读书笔记",
        status: "长期任务",
        oneLine: "读书笔记要写章节内容、关键人物、自己的判断，不只是摘抄。",
        example: "读到一个历史事件时，记录它为什么发生、谁推动、造成什么影响。",
        steps: ["概括章节", "提取人物事件", "写个人判断"],
        review: ["补充一个问题。", "用 3 句话复述读过内容。", "标出不懂的概念。"],
        quiz: [
          ["读书笔记至少要有？", ["概括和思考", "只写日期", "只画线"], 0],
          ["读书笔记应该多久做一次？", ["每周 1-2 次", "最后一周集中补", "想起来再做"], 0],
          ["读完一章第一步是？", ["概括发生了什么", "抄目录", "直接合上书"], 0],
        ],
      },
    ],
  },
  morality: {
    label: "道法",
    tasks: [["学生读本", "阅读第一讲，圈出 5 个核心概念。"], ["练习", "完成 10 道选择题，错题写原因。"]],
    lessons: [
      {
        title: "中国梦",
        status: "核心概念",
        oneLine: "中国梦的本质是国家富强、民族振兴、人民幸福。",
        example: "个人成长和国家发展不是分开的，青少年的学习也是未来建设能力的一部分。",
        steps: ["记本质", "看材料", "联系青少年责任"],
        review: ["默写中国梦本质。", "改正选择题错因。", "用一句话联系自己。"],
        quiz: [
          ["中国梦的本质不包括？", ["个人懒散", "国家富强", "人民幸福"], 0],
          ["做错选择题后应该？", ["写出错误原因", "擦掉不管", "只抄正确答案"], 0],
          ["青少年与中国梦的关系是？", ["学习成长就是参与", "毫无关系", "只是口号"], 0],
        ],
      },
    ],
  },
  life: {
    label: "德育",
    tasks: [["运动", "完成 1 小时运动并记录。"], ["做饭", "选择一道菜，拍照留证。"], ["家庭陪伴", "安排一次无手机聊天或散步。"]],
    lessons: [
      {
        title: "每周实践打卡",
        status: "生活任务",
        oneLine: "德育不是额外负担，是把暑假过得有节奏、有身体、有家庭连接。",
        example: "一周 3 次运动、一道菜、一次家庭陪伴，就是最小可执行方案。",
        steps: ["定时间", "拍照记录", "家长评价"],
        review: ["本周运动够 3 次吗？", "菜品是否独立完成？", "家庭陪伴是否真实发生？"],
        quiz: [
          ["每周运动建议至少？", ["3 次", "0 次", "1 次"], 0],
          ["打卡记录最好什么时候做？", ["当天完成当天记", "开学前统一补", "随便什么时候"], 0],
          ["家庭陪伴的要求是？", ["无手机专注相处", "边玩手机边聊", "发消息就算"], 0],
        ],
      },
    ],
  },
};

Object.assign(subjects.math.lessons[0], {
  terms: [
    ["linear function", "一次函数"],
    ["gradient / slope", "斜率"],
    ["intercept", "截距"],
    ["increase", "增大"],
  ],
  mistake: "最容易把 k 和 b 混在一起：k 决定倾斜和增减，b 决定与 y 轴交点。",
  narration: [
    "第一步先找自变量 x。题目里谁在主动变化，谁就更可能是 x，比如公里数、时间、件数。",
    "第二步写出 y = kx + b。k 是每增加 1 个 x，y 增加多少；b 是一开始就有的固定量。",
    "第三步看图像。k 大于 0，线往右上；k 小于 0，线往右下。先判断方向，再计算。",
  ],
});

Object.assign(subjects.math.lessons[1], {
  terms: [
    ["square root", "平方根"],
    ["simplify", "化简"],
    ["like surds", "同类二次根式"],
    ["condition", "有意义条件"],
  ],
  mistake: "不要看到根号就直接相加，只有同类二次根式才能合并。",
  narration: [
    "第一步看被开方数能不能成立。初中阶段根号里面通常要大于等于 0。",
    "第二步拆出平方因数，比如 12 拆成 4 乘 3，根号 4 可以拿出来变成 2。",
    "第三步只合并同类根式。根号 2 和根号 3 不是同类，不能硬加。",
  ],
});

subjects.math.lessons.push({
  title: "勾股定理与距离",
  status: "复习巩固",
  oneLine: "直角三角形里，两条直角边平方和等于斜边平方。",
  example: "坐标系里求两点距离，可以把横向差和纵向差看成直角边。",
  steps: ["确认直角", "列 a² + b² = c²", "开方得到长度"],
  terms: [
    ["Pythagoras theorem", "勾股定理"],
    ["hypotenuse", "斜边"],
    ["coordinate", "坐标"],
  ],
  mistake: "斜边一定是直角对面的最长边，不能随便把任意一条边当 c。",
  narration: [
    "第一步先确认是不是直角三角形。没有直角，就不能直接套勾股定理。",
    "第二步找到两条直角边，把它们平方后相加，等于斜边平方。",
    "第三步如果题目要求边长，最后还要开方，并检查结果是不是正数。",
  ],
  review: ["默写 a² + b² = c²。", "做一道坐标系两点距离题。", "说明为什么斜边最长。"],
  quiz: [
    ["直角边为 3 和 4，斜边是？", ["5", "6", "7"], 0],
    ["hypotenuse 是？", ["斜边", "底边", "高"], 0],
    ["勾股定理适用于？", ["直角三角形", "任意四边形", "圆"], 0],
  ],
});

Object.assign(subjects.english.lessons[0], {
  terms: [
    ["used to do", "过去常常做"],
    ["be used to doing", "习惯于做"],
    ["compare with", "比较"],
    ["prefer", "更喜欢"],
  ],
  mistake: "be used to 里的 to 是介词，所以后面接名词或 doing，不接动词原形。",
  narration: [
    "第一步看句子是在讲过去习惯，还是现在已经适应。过去习惯用 used to do。",
    "第二步看 to 后面的形式。如果是 be used to，后面通常接 doing。",
    "第三步自己造句最重要。语法点只有放进真实句子里，才不容易忘。",
  ],
});

subjects.english.lessons.push({
  title: "APTIS 写作开头",
  status: "写作训练",
  oneLine: "英文写作开头要先回应题目，再给出清楚立场或背景。",
  example: "如果题目问假期计划，不要先背模板，要先说明 who、when、what。",
  steps: ["抓题目关键词", "写第一句回应", "补充一个具体细节"],
  terms: [
    ["topic sentence", "主题句"],
    ["detail", "细节"],
    ["because", "原因连接"],
  ],
  mistake: "不要写很空的万能句，比如 I think it is very important，却没有说清 it 是什么。",
  narration: [
    "第一步圈出题目关键词，确认问题到底问的是计划、观点还是经历。",
    "第二步第一句直接回答题目，不绕圈。",
    "第三步马上补一个具体细节，让老师看到你不是背模板。",
  ],
  review: ["用 today plan 写 3 句话。", "检查有没有具体时间和动作。", "删掉一句空话。"],
  quiz: [
    ["topic sentence 是？", ["主题句", "结尾日期", "标点"], 0],
    ["写作开头应先？", ["回应题目", "背无关名言", "空两行"], 0],
    ["because 常用于表达？", ["原因", "颜色", "数量"], 0],
  ],
});

Object.assign(subjects.chinese.lessons[0], {
  terms: [
    ["环境描写", "写景物和氛围"],
    ["人物形象", "性格与心理"],
    ["答题依据", "来自原文的证据"],
  ],
  mistake: "不要只写“生动形象”，必须说明生动在哪里、对人物或主题有什么作用。",
  narration: [
    "第一步圈出题目关键词，看它问的是内容、作用还是理解。",
    "第二步回到原文定位，不要凭印象答。",
    "第三步按题型组织答案，比如环境描写可以从氛围、人物、情节、主题四个角度想。",
  ],
});

subjects.chinese.lessons.push({
  title: "九上古诗背默",
  status: "开学必备",
  oneLine: "古诗背默不是只会读，要能写对字、理解典故、说出情感。",
  example: "《行路难》里的“长风破浪会有时”表达的是困境中的信心。",
  steps: ["先读准", "再默写", "最后说情感"],
  terms: [
    ["意象", "诗中承载情感的景物"],
    ["典故", "借历史故事表达意思"],
    ["情感", "诗人的态度"],
  ],
  mistake: "最容易错在同音字和漏字，背过不等于默写过。",
  narration: [
    "第一步先读准字音和节奏，读顺以后再背。",
    "第二步遮住原文默写，错字要单独圈出来。",
    "第三步用一句话说清这首诗的情感，否则阅读题会失分。",
  ],
  review: ["默写《行路难》前 4 句。", "圈出 2 个易错字。", "说出诗人情感变化。"],
  quiz: [
    ["古诗背默最需要检查？", ["错字漏字", "字体颜色", "纸张大小"], 0],
    ["意象通常承载？", ["情感", "价格", "公式"], 0],
    ["“长风破浪”表达？", ["信心", "放弃", "恐惧"], 0],
  ],
});

Object.assign(subjects.physics.lessons[0], {
  terms: [
    ["force", "力"],
    ["friction", "摩擦力"],
    ["weight", "重力"],
    ["Newton", "牛顿"],
  ],
  mistake: "质量 mass 和重力 weight 不是一回事：质量单位 kg，重力单位 N。",
  narration: [
    "第一步先找谁对谁施加了力。力不是孤立存在的，总有施力物体和受力物体。",
    "第二步看力的效果，是改变速度、方向，还是让物体发生形变。",
    "第三步写单位。IG 物理里 force 常用 Newton，符号是 N。",
  ],
});

subjects.physics.lessons.push({
  title: "电路与电流",
  status: "九年级预习",
  oneLine: "电流可以理解为电荷在电路中的定向移动。",
  example: "手电筒亮起来，是因为电池、导线、开关、灯泡形成了闭合回路。",
  steps: ["找电源", "确认闭合回路", "判断电流方向与元件"],
  terms: [
    ["current", "电流"],
    ["circuit", "电路"],
    ["switch", "开关"],
    ["potential difference", "电势差"],
  ],
  mistake: "电路断开时没有持续电流；不要只看有没有电池，还要看回路是否闭合。",
  narration: [
    "第一步找电源。电源提供让电荷移动的条件。",
    "第二步看回路是否闭合。只要断开一个地方，灯泡就不会正常亮。",
    "第三步识别元件，知道开关、电阻、灯泡分别在电路中起什么作用。",
  ],
  review: ["画一个简单串联电路。", "背 current、circuit、switch。", "解释为什么断路灯不亮。"],
  quiz: [
    ["current 是？", ["电流", "压力", "质量"], 0],
    ["闭合回路断开后，灯泡通常？", ["不亮", "更亮", "变重"], 0],
    ["switch 是？", ["开关", "电池", "导线"], 0],
  ],
});

Object.assign(subjects.chemistry.lessons[0], {
  terms: [
    ["solid", "固体"],
    ["liquid", "液体"],
    ["gas", "气体"],
    ["particle", "粒子"],
  ],
  mistake: "不要只背三态名称，要能用粒子距离和运动方式解释三态差别。",
  narration: [
    "第一步看粒子距离。固体粒子排列紧密，气体粒子距离很远。",
    "第二步看能不能流动。液体和气体能流动，固体通常保持形状。",
    "第三步看体积和形状是否固定，这能帮助你区分液体和气体。",
  ],
});

subjects.chemistry.lessons.push({
  title: "原子与元素",
  status: "九年级预习",
  oneLine: "元素由同一种原子组成，原子是理解化学反应的基础单位。",
  example: "氧气中的 oxygen、铁钉里的 iron，都是元素概念的生活入口。",
  steps: ["认识 atom", "认识 element", "用符号表示元素"],
  terms: [
    ["atom", "原子"],
    ["element", "元素"],
    ["symbol", "元素符号"],
  ],
  mistake: "元素符号大小写很关键，CO 和 Co 不是同一个意思。",
  narration: [
    "第一步认识 atom。原子是化学里讨论物质组成的重要单位。",
    "第二步认识 element。同一种原子构成的物质，可以从元素角度理解。",
    "第三步学习元素符号，大小写不能随便改。",
  ],
  review: ["背 atom、element、symbol。", "写出 H、O、C、Fe。", "解释 CO 和 Co 的区别。"],
  quiz: [
    ["atom 是？", ["原子", "曲线", "价格"], 0],
    ["元素符号大小写？", ["重要", "不重要", "随便"], 0],
    ["O 通常表示？", ["氧元素", "铁元素", "钠元素"], 0],
  ],
});

Object.assign(subjects.economics.lessons[0], {
  terms: [
    ["scarcity", "稀缺"],
    ["choice", "选择"],
    ["opportunity cost", "机会成本"],
    ["resource", "资源"],
  ],
  mistake: "机会成本不是所有放弃选项的总和，而是被放弃的最好那个选择。",
  narration: [
    "第一步理解资源有限。时间、金钱、精力都不是无限的。",
    "第二步因为资源有限，所以必须选择。选择一个方向，就不能同时拥有所有结果。",
    "第三步找出被放弃的最好选项，它就是 opportunity cost。",
  ],
});

Object.assign(subjects.economics.lessons[1], {
  terms: [
    ["demand", "需求"],
    ["quantity", "数量"],
    ["price", "价格"],
    ["curve", "曲线"],
  ],
  mistake: "注意区分 demand 的变化和 quantity demanded 的变化，一个是整条曲线移动，一个是沿曲线移动。",
  narration: [
    "第一步看价格变化。价格是需求曲线图上最重要的纵轴信息。",
    "第二步看购买数量如何变化。通常价格越高，购买数量越低。",
    "第三步画向右下方倾斜的曲线，再用生活例子解释。",
  ],
});

subjects.economics.lessons.push({
  title: "供给曲线 Supply",
  status: "Chapter 4",
  oneLine: "通常价格越高，生产者越愿意提供更多商品，供给曲线向右上方倾斜。",
  example: "如果某种饮料卖得更贵，商家可能更愿意增加生产和销售。",
  steps: ["看价格", "看生产意愿", "画向上曲线"],
  terms: [
    ["supply", "供给"],
    ["seller", "卖家"],
    ["cost", "成本"],
    ["revenue", "收入"],
  ],
  mistake: "供给是从生产者角度看，不是消费者想买多少。",
  narration: [
    "第一步看价格。价格影响生产者是否愿意卖出更多。",
    "第二步看生产意愿和成本。如果成本上升，供给可能减少。",
    "第三步画供给曲线，一般是向右上方倾斜。",
  ],
  review: ["画一条供给曲线。", "背 supply、seller、cost。", "解释供给和需求的视角差别。"],
  quiz: [
    ["Supply 是？", ["供给", "需求", "机会成本"], 0],
    ["供给通常从谁的角度看？", ["生产者", "消费者", "旁观者"], 0],
    ["供给曲线通常向？", ["右上", "右下", "竖直向下"], 0],
  ],
});

Object.assign(subjects.history.lessons[0], {
  terms: [
    ["背景", "事情发生的原因"],
    ["过程", "事情如何展开"],
    ["影响", "带来的结果"],
  ],
  mistake: "读书笔记不要只摘抄名句，必须留下自己的问题和判断。",
  narration: [
    "第一步概括本次阅读章节，不用太长，但要说清发生了什么。",
    "第二步提取人物和事件，关注谁推动了变化。",
    "第三步写自己的判断，比如这个人物的选择为什么重要。",
  ],
});

subjects.history.lessons.push({
  title: "历史人物卡",
  status: "方法工具",
  oneLine: "人物卡就是用背景、行动、影响三栏，把一个人放回他所处的时代。",
  example: "整理一位历史人物时，先写他所处时代的问题，再写他做了什么，最后写带来了什么变化。",
  steps: ["写时代背景", "列关键行动", "评历史影响"],
  terms: [
    ["背景", "他面对什么时代问题"],
    ["行动", "他具体做了什么"],
    ["影响", "改变了什么"],
  ],
  mistake: "不要把人物卡写成生平流水账，重点是行动和影响之间的因果关系。",
  narration: [
    "第一步写背景。不了解时代问题，就无法理解人物为什么这样选择。",
    "第二步列出 2-3 个关键行动，不求全，求关键。",
    "第三步写影响，并加一句自己的判断：这个影响是长期的还是短期的？",
  ],
  review: ["完成一张人物卡。", "用一句话说清行动与影响的关系。", "提出一个自己的疑问。"],
  quiz: [
    ["人物卡的三栏是？", ["背景、行动、影响", "姓名、生日、爱好", "开头、中间、结尾"], 0],
    ["人物卡最忌讳？", ["写成流水账", "写因果关系", "写自己的判断"], 0],
    ["写影响时最好加上？", ["自己的判断", "更多日期", "无关名言"], 0],
  ],
});

Object.assign(subjects.morality.lessons[0], {
  terms: [
    ["中国梦", "民族复兴"],
    ["国家富强", "国家层面目标"],
    ["人民幸福", "最终落脚点"],
  ],
  mistake: "选择题常把相近概念混在一起，要回到教材关键词判断。",
  narration: [
    "第一步记住中国梦的核心表达：实现中华民族伟大复兴。",
    "第二步记住本质：国家富强、民族振兴、人民幸福。",
    "第三步联系青少年责任，把知识点落到自己的学习和行动上。",
  ],
});

subjects.morality.lessons.push({
  title: "《学生读本》阅读法",
  status: "方法",
  oneLine: "读《学生读本》先圈核心概念，再用自己的话复述，最后连到生活实例。",
  example: "读到一个新概念时，合上书用一句话讲给自己听，讲不出来就是没读懂。",
  steps: ["圈核心概念", "自己复述", "联系生活"],
  terms: [
    ["核心概念", "每讲最重要的关键词"],
    ["复述", "用自己的话讲出来"],
    ["联系实际", "找一个身边例子"],
  ],
  mistake: "不要只划线不复述，划过线不等于记住，更不等于会做题。",
  narration: [
    "第一步通读一讲，把反复出现的关键词圈出来，通常不超过 5 个。",
    "第二步合上书，用自己的话把每个概念说一遍，说不出的重读。",
    "第三步给每个概念找一个生活例子，选择题里最爱考概念和例子的对应。",
  ],
  review: ["圈出本讲 5 个核心概念。", "每个概念口头复述一遍。", "写一个生活对应例子。"],
  quiz: [
    ["读《学生读本》第一步是？", ["圈核心概念", "抄整段原文", "直接做题"], 0],
    ["判断自己读懂的标准是？", ["能用自己的话复述", "划了很多线", "读得很快"], 0],
    ["选择题常考什么对应？", ["概念和例子", "页码和字数", "颜色和图片"], 0],
  ],
});

Object.assign(subjects.life.lessons[0], {
  terms: [
    ["运动", "每周 3 次"],
    ["做饭", "至少 3 道菜"],
    ["陪伴", "每周 1 次"],
  ],
  mistake: "德育打卡不要最后补照片，最好当天完成当天记录。",
  narration: [
    "第一步先定时间，把运动、做饭、家庭陪伴放进每周日程。",
    "第二步完成后马上拍照或记录，证据越及时越真实。",
    "第三步请家长写一句评价，开学整理时就不会混乱。",
  ],
});

subjects.life.lessons.push({
  title: "暑假作息管理",
  status: "习惯",
  oneLine: "固定起床时间和学习开始时间，比每天学多久更重要。",
  example: "每天 8:00 起床、9:00 开始学习，坚持一周后就不需要靠意志力硬撑。",
  steps: ["定固定起床时间", "上午先完成最难任务", "睡前 5 分钟记录"],
  terms: [
    ["固定起点", "每天同一时间开始"],
    ["先难后易", "上午做最难的科目"],
    ["当日复盘", "睡前记录完成情况"],
  ],
  mistake: "不要熬夜补任务，晚睡会让第二天整个节奏塌掉，损失比收获大。",
  narration: [
    "第一步固定起床时间。节奏稳了，学习才不用每天重新启动。",
    "第二步把最难的科目放在上午，那是头脑最清楚的时间。",
    "第三步睡前花 5 分钟记录今天完成了什么，明天先做什么。",
  ],
  review: ["今天是否按时起床？", "最难任务放在上午了吗？", "睡前写了明日清单吗？"],
  quiz: [
    ["暑假作息最重要的是？", ["固定起床和开始时间", "每天熬夜补任务", "想睡到几点都行"], 0],
    ["最难的任务适合放在？", ["上午", "深夜", "永远不做"], 0],
    ["睡前 5 分钟建议？", ["记录与计划", "刷视频", "开始新一章"], 0],
  ],
});

/* ========== 8 周计划（与暑假计划 PDF 一致） ========== */

const WEEKS = [
  ["7.6-7.12", "建立清单，完成摸底；进入每日闭环", "数学试卷 1；英语前 8-10 页；语文古诗前 3 首；物理纪录片提纲"],
  ["7.13-7.19", "学校作业稳定推进；开始物理实验任务", "数学试卷 2；英语继续 10 页；语文古诗 4-6 首；历史读书笔记 1-2 次"],
  ["7.20-7.26", "完成数学暑假卷主体；补 IG 数学词汇", "数学试卷 3；英语语法一半；物理练习题；IG 数学词汇 Unit 1-5"],
  ["7.27-8.2", "学校作业完成 50%-60%；启动《简爱》深读", "物理观后感初稿；物理实验记录；《简爱》心灵地图初稿；道法笔记 1-2 次"],
  ["8.3-8.9", "从完成作业转向九年级预习", "IG 化学前 2-3 章笔记；经济 Chapter 1-2；英语写作 2 篇；历史笔记到第 6 次"],
  ["8.10-8.16", "IG 经济与物理词汇二刷；集中处理错题", "经济 Chapter 3-6；物理词汇二刷；数学错题一刷；语文阅读题集中训练"],
  ["8.17-8.23", "所有学校作业完成初稿", "补空、改错、装订顺序检查；历史 10 次读书笔记完成；道法练习完成"],
  ["8.24-8.30", "开学前整理与综合测", "全部作业定稿；每天半套综合测；整理错题本、词汇本、读书笔记"],
];

/* ========== 日期与进度 ========== */

const SUMMER_START = new Date(2026, 6, 6); // 2026-07-06
const TOTAL_DAYS = 56;
const _now = new Date();
const today = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
const rawDay = Math.floor((today - SUMMER_START) / 86400000) + 1;
const currentWeekNum = rawDay < 1 ? 1 : Math.min(Math.ceil(rawDay / 7), WEEKS.length);

function fmtDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
const todayKey = fmtDate(today);

/* ========== 本地存储 ========== */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 隐私模式下忽略 */
  }
}

const completedLessons = new Set(loadJSON("completedLessons", []));
const tasksState = loadJSON("grx:tasks", {}); // { dateKey: { subjectKey: [checkedIndex,...] } }
const wrongBook = loadJSON("grx:wrongBook", []); // [{date, subjectLabel, question, correct, chosen}]
const scores = loadJSON("grx:scores", []); // [{date, subject, lesson, score, total}]
const activeDays = loadJSON("grx:activeDays", []); // ["2026-07-06", ...]

function markActiveToday() {
  if (!activeDays.includes(todayKey)) {
    activeDays.push(todayKey);
    saveJSON("grx:activeDays", activeDays);
  }
  renderHeader();
}

function computeStreak() {
  const set = new Set(activeDays);
  const d = new Date(today);
  if (!set.has(fmtDate(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(fmtDate(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ========== 状态 ========== */

let currentSubjectKey = "math";
let currentLessonIndex = 0;
let currentAnimationStep = 0;
let animationTimer = null;
let selectedWeek = currentWeekNum;
let quizView = []; // 当前小测（选项已乱序）
let quizGraded = false;

/* ========== DOM ========== */

const subjectButtons = document.querySelectorAll(".subject-button");
const dateLine = document.getElementById("dateLine");
const topGreeting = document.getElementById("topGreeting");
const progressDays = document.getElementById("progressDays");
const progressFill = document.getElementById("progressFill");
const streakLine = document.getElementById("streakLine");
const weekStrip = document.getElementById("weekStrip");
const weekDetail = document.getElementById("weekDetail");
const taskList = document.getElementById("taskList");
const questMap = document.getElementById("questMap");
const subjectSummary = document.getElementById("subjectSummary");
const lessonSubject = document.getElementById("lessonSubject");
const lessonTitle = document.getElementById("lessonTitle");
const lessonOneLine = document.getElementById("lessonOneLine");
const conceptBox = document.getElementById("conceptBox");
const termStrip = document.getElementById("termStrip");
const lessonExample = document.getElementById("lessonExample");
const mistakeText = document.getElementById("mistakeText");
const reviewPoints = document.getElementById("reviewPoints");
const narrationText = document.getElementById("narrationText");
const animationLabel = document.getElementById("animationLabel");
const animationProgress = document.getElementById("animationProgress");
const quizBox = document.getElementById("quizBox");
const quizResult = document.getElementById("quizResult");
const reviewQueue = document.getElementById("reviewQueue");
const markDone = document.getElementById("markDone");
const playLesson = document.getElementById("playLesson");
const speakLesson = document.getElementById("speakLesson");
const submitQuiz = document.getElementById("submitQuiz");

/* ========== 工具 ========== */

function enrichLesson(lesson) {
  const terms = lesson.terms || lesson.steps.map((step) => [step, "关键步骤"]);
  const narration =
    lesson.narration ||
    lesson.steps.map((step, index) => `第 ${index + 1} 步：${step}。先把这一步说清楚，再进入下一步。`);
  const mistake = lesson.mistake || "不要只记结论，要能说出为什么这样做，并且能在题目中找到依据。";
  return { ...lesson, terms, narration, mistake };
}

function lessonKey(subjectKey, index) {
  return `${subjectKey}:${index}`;
}

function shuffleIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ========== 顶部：日期 / 进度 / 连续学习 ========== */

function renderHeader() {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  let phase;
  if (rawDay < 1) {
    phase = `距暑假开始还有 ${1 - rawDay} 天`;
    topGreeting.textContent = "暑假还没开始，先熟悉一下学习舱";
  } else if (rawDay > TOTAL_DAYS) {
    phase = "暑假已结束";
    topGreeting.textContent = "整理暑假成果，切换到开学节奏";
  } else {
    phase = `暑假第 ${rawDay} 天 · 第 ${currentWeekNum} 周`;
    if (currentWeekNum <= 4) topGreeting.textContent = "把学校作业稳步往前推";
    else if (currentWeekNum <= 6) topGreeting.textContent = "重心转向九年级预习";
    else topGreeting.textContent = "收尾、错题复盘、综合测";
  }
  dateLine.textContent = `${today.getFullYear()} 年 ${m} 月 ${d} 日 · ${phase}`;

  const doneDays = Math.min(Math.max(rawDay, 0), TOTAL_DAYS);
  progressDays.textContent = `${doneDays} / ${TOTAL_DAYS} 天`;
  progressFill.style.width = `${(doneDays / TOTAL_DAYS) * 100}%`;

  const streak = computeStreak();
  streakLine.textContent = streak > 0 ? `已连续学习 ${streak} 天，别断档` : "今天完成一项任务，开始积累连续天数";
}

/* ========== 8 周计划 ========== */

function renderWeekPanel() {
  weekStrip.innerHTML = WEEKS.map((_, i) => {
    const n = i + 1;
    const cls = ["week-chip", n === selectedWeek ? "active" : "", n === currentWeekNum && rawDay >= 1 && rawDay <= TOTAL_DAYS ? "current" : ""]
      .filter(Boolean)
      .join(" ");
    return `<button class="${cls}" data-week="${n}">第 ${n} 周</button>`;
  }).join("");

  const [range, goal, deliver] = WEEKS[selectedWeek - 1];
  const isCurrent = selectedWeek === currentWeekNum && rawDay >= 1 && rawDay <= TOTAL_DAYS;
  weekDetail.innerHTML = `
    <strong>${range} · ${goal}${isCurrent ? "（本周）" : ""}</strong>
    <p>本周交付：${deliver}</p>
  `;

  weekStrip.querySelectorAll(".week-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedWeek = Number(chip.dataset.week);
      renderWeekPanel();
    });
  });
}

/* ========== 今日任务（按日期保存勾选） ========== */

function getTodayTaskState(subjectKey) {
  const day = tasksState[todayKey] || {};
  return day[subjectKey] || [];
}

function setTodayTaskState(subjectKey, checkedIndices) {
  if (!tasksState[todayKey]) tasksState[todayKey] = {};
  tasksState[todayKey][subjectKey] = checkedIndices;
  saveJSON("grx:tasks", tasksState);
}

function renderTasks(subject) {
  const checked = getTodayTaskState(currentSubjectKey);
  taskList.innerHTML = subject.tasks
    .map(
      ([title, detail], index) => `
      <label class="task ${checked.includes(index) ? "done" : ""}">
        <input type="checkbox" data-task="${index}" ${checked.includes(index) ? "checked" : ""} />
        <span>
          <strong>${title}</strong>
          <p>${detail}</p>
        </span>
      </label>
    `,
    )
    .join("");

  taskList.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.addEventListener("change", () => {
      const idx = Number(box.dataset.task);
      const now = new Set(getTodayTaskState(currentSubjectKey));
      if (box.checked) now.add(idx);
      else now.delete(idx);
      setTodayTaskState(currentSubjectKey, [...now]);
      box.closest(".task").classList.toggle("done", box.checked);
      if (box.checked) markActiveToday();
    });
  });
}

/* ========== 科目导航（含完成度） ========== */

function renderNav() {
  subjectButtons.forEach((button) => {
    const key = button.dataset.subject;
    const subject = subjects[key];
    const done = subject.lessons.filter((_, i) => completedLessons.has(lessonKey(key, i))).length;
    button.innerHTML = `${subject.label}<span class="nav-count">${done}/${subject.lessons.length}</span>`;
    button.classList.toggle("active", key === currentSubjectKey);
  });
}

/* ========== 闯关地图 ========== */

function renderMap(subjectKey, subject) {
  subjectSummary.textContent = `${subject.label} · ${subject.lessons.length} 个知识点`;
  questMap.innerHTML = subject.lessons
    .map((lesson, index) => {
      const done = completedLessons.has(lessonKey(subjectKey, index));
      return `
        <button class="quest-node ${index === currentLessonIndex ? "active" : ""} ${done ? "done" : ""}" data-index="${index}">
          <span class="node-status">${done ? "已学 ✓" : lesson.status}</span>
          <h4>${lesson.title}</h4>
          <p>${lesson.oneLine}</p>
        </button>
      `;
    })
    .join("");

  questMap.querySelectorAll(".quest-node").forEach((node) => {
    node.addEventListener("click", () => {
      currentLessonIndex = Number(node.dataset.index);
      currentAnimationStep = 0;
      stopAnimation();
      stopSpeech();
      fullRender();
    });
  });
}

/* ========== 讲解面板 ========== */

function renderLesson(subjectKey, subject) {
  const lesson = enrichLesson(subject.lessons[currentLessonIndex]);
  lessonSubject.textContent = subject.label;
  lessonTitle.textContent = lesson.title;
  lessonOneLine.textContent = lesson.oneLine;
  lessonExample.textContent = lesson.example;
  mistakeText.textContent = lesson.mistake;

  const done = completedLessons.has(lessonKey(subjectKey, currentLessonIndex));
  markDone.textContent = done ? "已学 · 点击取消" : "标记已学";
  markDone.classList.toggle("active", done);

  playLesson.textContent = animationTimer ? "暂停" : "播放讲解";
  playLesson.classList.toggle("active", Boolean(animationTimer));
  animationLabel.textContent = `分步讲解 · Step ${currentAnimationStep + 1}/${lesson.steps.length}`;
  animationProgress.style.width = `${((currentAnimationStep + 1) / lesson.steps.length) * 100}%`;
  narrationText.textContent = lesson.narration[currentAnimationStep] || lesson.oneLine;

  conceptBox.innerHTML = lesson.steps
    .map(
      (step, index) => `
      <div class="concept-step ${index === currentAnimationStep ? "current" : ""}" data-step="${index}">
        <span>STEP ${index + 1}</span>
        <strong>${step}</strong>
      </div>
    `,
    )
    .join("");

  conceptBox.querySelectorAll(".concept-step").forEach((step) => {
    step.addEventListener("click", () => {
      currentAnimationStep = Number(step.dataset.step);
      stopAnimation();
      render();
    });
  });

  termStrip.innerHTML = lesson.terms
    .map(([term, meaning]) => `<span class="term-chip"><strong>${term}</strong>&nbsp;${meaning}</span>`)
    .join("");

  reviewPoints.innerHTML = lesson.review.map((item) => `<li>${item}</li>`).join("");
}

/* ========== 小测（选项乱序 + 判错 + 错题入队） ========== */

function renderQuiz(subject) {
  const lesson = subject.lessons[currentLessonIndex];
  quizGraded = false;
  quizView = lesson.quiz.map(([question, options, answer]) => {
    const order = shuffleIndices(options.length);
    return {
      question,
      options: order.map((i) => options[i]),
      answer: order.indexOf(answer),
    };
  });

  quizBox.innerHTML = quizView
    .map(
      (item, qIndex) => `
      <div class="quiz-question" data-q="${qIndex}">
        <strong>${qIndex + 1}. ${item.question}</strong>
        ${item.options
          .map(
            (option, oIndex) => `
          <label data-o="${oIndex}">
            <input type="radio" name="q${qIndex}" value="${oIndex}" />
            ${option}
          </label>
        `,
          )
          .join("")}
      </div>
    `,
    )
    .join("");

  submitQuiz.textContent = "提交小测";

  const last = scores.filter((s) => s.subject === currentSubjectKey && s.lesson === currentLessonIndex).slice(-1)[0];
  quizResult.classList.remove("bad");
  quizResult.textContent = last ? `上次成绩：${last.score}/${last.total}（${last.date.slice(5)}）` : "";
}

function gradeQuiz() {
  const subject = subjects[currentSubjectKey];
  const lesson = subject.lessons[currentLessonIndex];

  const answers = quizView.map((_, qIndex) => {
    const checked = quizBox.querySelector(`input[name="q${qIndex}"]:checked`);
    return checked ? Number(checked.value) : null;
  });
  const firstEmpty = answers.indexOf(null);
  if (firstEmpty !== -1) {
    quizResult.classList.add("bad");
    quizResult.textContent = `第 ${firstEmpty + 1} 题还没有选，答完再提交。`;
    return;
  }

  let score = 0;
  quizView.forEach((item, qIndex) => {
    const div = quizBox.querySelector(`.quiz-question[data-q="${qIndex}"]`);
    const labels = div.querySelectorAll("label");
    labels.forEach((label) => label.querySelector("input").setAttribute("disabled", "disabled"));
    labels[item.answer].classList.add("opt-correct");

    if (answers[qIndex] === item.answer) {
      score += 1;
      div.classList.add("right");
    } else {
      labels[answers[qIndex]].classList.add("opt-wrong");
      div.classList.add("wrong");
      wrongBook.push({
        date: todayKey,
        subjectLabel: subject.label,
        lessonTitle: lesson.title,
        question: item.question,
        correct: item.options[item.answer],
        chosen: item.options[answers[qIndex]],
      });
    }
  });

  while (wrongBook.length > 60) wrongBook.shift();
  saveJSON("grx:wrongBook", wrongBook);

  scores.push({ date: todayKey, subject: currentSubjectKey, lesson: currentLessonIndex, score, total: quizView.length });
  while (scores.length > 300) scores.shift();
  saveJSON("grx:scores", scores);

  markActiveToday();
  quizGraded = true;
  submitQuiz.textContent = "换一组顺序，再测一遍";

  if (score === quizView.length) {
    quizResult.classList.remove("bad");
    quizResult.textContent = `满分 ${score}/${quizView.length}！这个知识点过关了。`;
  } else {
    quizResult.classList.add("bad");
    quizResult.textContent = `得分 ${score}/${quizView.length}，错题已进入复核队列。`;
  }
  renderReviewQueue();
}

/* ========== 复核队列（真实错题本） ========== */

function renderReviewQueue() {
  if (!wrongBook.length) {
    reviewQueue.innerHTML = `<li class="rq-empty">暂时没有错题。小测里做错的题会自动收集到这里，明早重做一遍再移除。</li>`;
    return;
  }
  const items = [...wrongBook].map((item, realIndex) => ({ item, realIndex })).reverse().slice(0, 10);
  reviewQueue.innerHTML = items
    .map(
      ({ item, realIndex }) => `
      <li class="rq-item">
        <div class="rq-head"><span class="rq-tag">${item.subjectLabel}</span>${item.question}</div>
        <p class="rq-detail">正确答案：${item.correct}（当时选了：${item.chosen}）· ${item.date.slice(5)}</p>
        <button class="rq-done" data-rq="${realIndex}">复核完成，移除</button>
      </li>
    `,
    )
    .join("");

  reviewQueue.querySelectorAll(".rq-done").forEach((btn) => {
    btn.addEventListener("click", () => {
      wrongBook.splice(Number(btn.dataset.rq), 1);
      saveJSON("grx:wrongBook", wrongBook);
      renderReviewQueue();
    });
  });
}

/* ========== 渲染入口 ========== */

function render() {
  const subject = subjects[currentSubjectKey];
  if (currentAnimationStep >= subject.lessons[currentLessonIndex].steps.length) {
    currentAnimationStep = 0;
  }
  renderNav();
  renderTasks(subject);
  renderMap(currentSubjectKey, subject);
  renderLesson(currentSubjectKey, subject);
}

function fullRender() {
  render();
  renderQuiz(subjects[currentSubjectKey]);
  renderReviewQueue();
}

/* ========== 事件 ========== */

subjectButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSubjectKey = button.dataset.subject;
    currentLessonIndex = 0;
    currentAnimationStep = 0;
    stopAnimation();
    stopSpeech();
    fullRender();
  });
});

function stopAnimation() {
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
}

function advanceAnimation() {
  const lesson = subjects[currentSubjectKey].lessons[currentLessonIndex];
  if (currentAnimationStep >= lesson.steps.length - 1) {
    stopAnimation();
    render();
    return;
  }
  currentAnimationStep += 1;
  render();
}

playLesson.addEventListener("click", () => {
  if (animationTimer) {
    stopAnimation();
    render();
    return;
  }
  const lesson = subjects[currentSubjectKey].lessons[currentLessonIndex];
  if (currentAnimationStep >= lesson.steps.length - 1) currentAnimationStep = -1;
  advanceAnimation();
  if (currentAnimationStep < lesson.steps.length - 1) {
    animationTimer = setInterval(advanceAnimation, 2400);
  }
  render();
});

/* 朗读：可开可停，切换课程自动停 */
let speaking = false;

function stopSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  speaking = false;
  speakLesson.textContent = "朗读讲解";
  speakLesson.classList.remove("active");
}

speakLesson.addEventListener("click", () => {
  if (speaking) {
    stopSpeech();
    return;
  }
  if (!("speechSynthesis" in window)) {
    narrationText.textContent = "当前浏览器不支持语音朗读，可以直接阅读这一段讲解。";
    return;
  }
  const subject = subjects[currentSubjectKey];
  const lesson = enrichLesson(subject.lessons[currentLessonIndex]);
  const text = `${lesson.title}。${lesson.oneLine}。${lesson.narration[currentAnimationStep]}。生活例子：${lesson.example}。易错提醒：${lesson.mistake}`;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  utterance.onend = () => stopSpeech();
  utterance.onerror = () => stopSpeech();
  window.speechSynthesis.speak(utterance);
  speaking = true;
  speakLesson.textContent = "停止朗读";
  speakLesson.classList.add("active");
});

/* 标记已学：可切换 */
markDone.addEventListener("click", () => {
  const key = lessonKey(currentSubjectKey, currentLessonIndex);
  if (completedLessons.has(key)) {
    completedLessons.delete(key);
  } else {
    completedLessons.add(key);
    markActiveToday();
  }
  saveJSON("completedLessons", [...completedLessons]);
  render();
});

submitQuiz.addEventListener("click", () => {
  if (quizGraded) {
    renderQuiz(subjects[currentSubjectKey]);
    return;
  }
  gradeQuiz();
});

/* ========== 启动 ========== */

renderHeader();
renderWeekPanel();
fullRender();
