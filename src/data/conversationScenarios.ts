import type { ConversationScenario } from '../types'

// 8 progressive conversation scenarios. Each scenario is a short dialogue split into turns.
// The user reads the Chinese prompt for each turn and tries to say it in English.
// The hintEn is the model answer; notes provide a focused tip.
export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: 'cs-week1-cafe',
    week: 1,
    title: 'Ordering at a Café',
    zhContext: '你在一家咖啡馆点单，询问菜单并点一杯饮料。',
    turns: [
      {
        zhPrompt: '请问，你们今天的特调是什么？',
        hintEn: 'Excuse me, what is today\'s special drink?',
        notes: '"特调"用 special drink / signature drink 都可以。',
      },
      {
        zhPrompt: '我可以加一份燕麦奶吗？',
        hintEn: 'Could I have it with oat milk?',
        notes: '"加燕麦奶"用 with oat milk 比 add 更自然。',
      },
      {
        zhPrompt: '我想要一份小杯，少糖。',
        hintEn: 'I\'d like a small one, with less sugar.',
        notes: '"少糖"用 less sugar 而不是 little sugar。',
      },
      {
        zhPrompt: '我可以坐在窗边的位置吗？',
        hintEn: 'Can I sit by the window?',
        notes: 'by the window 是固定搭配。',
      },
    ],
  },
  {
    id: 'cs-week2-directions',
    week: 2,
    title: 'Asking for Directions',
    zhContext: '你在外滩附近迷路了，向路人问路。',
    turns: [
      {
        zhPrompt: '不好意思，能告诉我去地铁站怎么走吗？',
        hintEn: 'Excuse me, could you tell me the way to the metro station?',
        notes: 'the way to + 地点。',
      },
      {
        zhPrompt: '走路过去大概要多久？',
        hintEn: 'About how long does it take on foot?',
        notes: 'on foot = 步行。',
      },
      {
        zhPrompt: '我应该在第二个红绿灯左转吗？',
        hintEn: 'Should I turn left at the second traffic light?',
        notes: 'turn left at + 地点。',
      },
      {
        zhPrompt: '太感谢了，您帮了大忙。',
        hintEn: 'Thank you so much — you\'ve been a great help.',
        notes: '比 thank you very much 更地道。',
      },
    ],
  },
  {
    id: 'cs-week3-school',
    week: 3,
    title: 'Talking About School Life',
    zhContext: '你在向一位外国朋友介绍你的高中生活。',
    turns: [
      {
        zhPrompt: '我们学校七点半开始上课。',
        hintEn: 'My school starts at half past seven.',
        notes: '"半点"也可以说 7:30。',
      },
      {
        zhPrompt: '我最喜欢的科目是物理，因为它能解释身边的现象。',
        hintEn: 'My favourite subject is physics, because it explains things around us.',
        notes: '原因从句 because + clause。',
      },
      {
        zhPrompt: '放学后我会和同学一起打篮球。',
        hintEn: 'After school I usually play basketball with my classmates.',
        notes: 'After school 不要加 the。',
      },
      {
        zhPrompt: '考试压力很大，但老师总是鼓励我们。',
        hintEn: 'Exam pressure is heavy, but our teachers always encourage us.',
        notes: '"压力大"= heavy / a lot of pressure。',
      },
    ],
  },
  {
    id: 'cs-week4-shopping',
    week: 4,
    title: 'Shopping for a Gift',
    zhContext: '你在为妈妈挑选生日礼物。',
    turns: [
      {
        zhPrompt: '我想给我妈妈买一份生日礼物，您有什么推荐？',
        hintEn: 'I\'d like to buy a birthday gift for my mum — do you have any recommendations?',
        notes: '"推荐"= recommendations。',
      },
      {
        zhPrompt: '我的预算大概是 500 元。',
        hintEn: 'My budget is about 500 yuan.',
        notes: 'budget 是预算。',
      },
      {
        zhPrompt: '这条围巾的材质是什么？',
        hintEn: 'What is this scarf made of?',
        notes: 'be made of + 材质。',
      },
      {
        zhPrompt: '可以帮我礼品包装一下吗？',
        hintEn: 'Could you gift-wrap it for me, please?',
        notes: 'gift-wrap 作动词。',
      },
    ],
  },
  {
    id: 'cs-week5-doctor',
    week: 5,
    title: 'A Visit to the Doctor',
    zhContext: '你最近感冒了，在医院描述自己的症状。',
    turns: [
      {
        zhPrompt: '我已经咳嗽三天了，晚上咳得更厉害。',
        hintEn: 'I\'ve had a cough for three days, and it gets worse at night.',
        notes: '现在完成时表示持续。',
      },
      {
        zhPrompt: '我没有发烧，但是感觉很疲倦。',
        hintEn: 'I don\'t have a fever, but I feel really tired.',
        notes: 'have a fever 是固定搭配。',
      },
      {
        zhPrompt: '这个药一天吃几次？',
        hintEn: 'How many times a day should I take this medicine?',
        notes: 'take medicine 用 take。',
      },
      {
        zhPrompt: '需要忌口吗？',
        hintEn: 'Is there anything I should avoid eating?',
        notes: '"忌口"= avoid eating。',
      },
    ],
  },
  {
    id: 'cs-week6-interview',
    week: 6,
    title: 'A Mini Interview',
    zhContext: '你在参加学生会面试。',
    turns: [
      {
        zhPrompt: '请用一句话介绍自己。',
        hintEn: 'Could you introduce yourself in one sentence?',
        notes: '面试常用句式。',
      },
      {
        zhPrompt: '我相信团队合作比个人表现更重要。',
        hintEn: 'I believe teamwork matters more than individual performance.',
        notes: 'matter more than 是地道比较法。',
      },
      {
        zhPrompt: '过去半年我组织了一次班级义卖活动。',
        hintEn: 'In the past six months, I organised a class charity sale.',
        notes: 'organise + 名词。',
      },
      {
        zhPrompt: '如果被录用，我希望发起一个英语角项目。',
        hintEn: 'If I\'m chosen, I hope to launch an English Corner project.',
        notes: 'If I am chosen 是条件状语从句。',
      },
    ],
  },
  {
    id: 'cs-week7-debate',
    week: 7,
    title: 'A Friendly Debate',
    zhContext: '你和朋友在讨论：高中生是否应该自带午餐。',
    turns: [
      {
        zhPrompt: '我认为带饭更健康，因为能控制油盐用量。',
        hintEn: 'I think bringing your own lunch is healthier because you control how much oil and salt you use.',
        notes: 'how much + 不可数名词。',
      },
      {
        zhPrompt: '虽然食堂菜更方便，但选择有限。',
        hintEn: 'Although the canteen is more convenient, the choices are limited.',
        notes: 'although ... 让步状语。',
      },
      {
        zhPrompt: '你说的有道理，但我担心早晨没时间。',
        hintEn: 'You have a point, but I worry there isn\'t enough time in the morning.',
        notes: 'have a point = 你说得有道理。',
      },
      {
        zhPrompt: '我们也许可以前一晚提前准备。',
        hintEn: 'Maybe we could prepare it the night before.',
        notes: 'the night before = 前一晚。',
      },
    ],
  },
  {
    id: 'cs-week8-future',
    week: 8,
    title: 'Talking About the Future',
    zhContext: '你在和老师讨论未来想做的事情。',
    turns: [
      {
        zhPrompt: '我打算大学学习计算机科学。',
        hintEn: 'I plan to study computer science at university.',
        notes: 'plan to do sth.',
      },
      {
        zhPrompt: '长远来看，我希望成为一名 AI 研究员。',
        hintEn: 'In the long run, I hope to become an AI researcher.',
        notes: 'in the long run = 从长远来看。',
      },
      {
        zhPrompt: '我也希望能在大学期间出国交流一年。',
        hintEn: 'I also hope to spend a year abroad during university.',
        notes: 'spend + 时间 + abroad。',
      },
      {
        zhPrompt: '当然，最重要的是先把这一年的功课做好。',
        hintEn: 'Of course, what matters most is doing well this year first.',
        notes: 'what matters most 是主语从句。',
      },
    ],
  },
]
