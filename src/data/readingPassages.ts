import type { ReadingPassage } from '../types'

export const READING_PASSAGES: ReadingPassage[] = [
  {
    id: 'rp001',
    title: 'A Library on the Move',
    level: 1,
    body: `In a small mountain town in southwestern China, students once had to walk for hours to reach the nearest library. Three years ago, a retired teacher named Mr. Lin decided to change that. He bought an old van, painted it sky blue, and filled it with more than two thousand books. Every weekend, his "library on wheels" drives along narrow village roads, stopping in seven different villages.
At each stop, Mr. Lin stays for two hours. Children sit on small wooden chairs and read whatever interests them — adventure stories, science magazines, picture books about the ocean. Before they leave, they can borrow up to three books and return them on Mr. Lin's next visit.
Mr. Lin keeps no records and charges no money. "Trust is part of reading," he often says. "If a child loses a book, that means they were carrying it everywhere — and that is exactly what books are for."
The project now has six volunteer drivers and serves more than four hundred students. Local universities have begun donating books, and a publisher recently delivered a thousand new titles. Mr. Lin smiles when people call him a hero. "I just open the door," he says. "The books do the rest."`,
    questions: [
      {
        id: 'rp001-q1',
        prompt: 'Why did Mr. Lin start the moving library?',
        choices: [
          'He wanted to make money from book rentals.',
          'Children in the area had no easy access to books.',
          'The local government asked him to do so.',
          'He was looking for a hobby after retirement.',
        ],
        answerIndex: 1,
        explanation: '文章开头说学生需要走数小时才能到最近的图书馆，林老师正是为了改变这一点。',
      },
      {
        id: 'rp001-q2',
        prompt: 'Why does Mr. Lin keep no borrowing records?',
        choices: [
          'He believes trust is part of reading.',
          'The system is too expensive to maintain.',
          'Children rarely return the books.',
          'He does not have enough time.',
        ],
        answerIndex: 0,
        explanation: '原文："Trust is part of reading."',
      },
      {
        id: 'rp001-q3',
        prompt: 'Which statement best describes the project today?',
        choices: [
          'It is run only by Mr. Lin alone.',
          'It has stopped because of the lack of books.',
          'It involves more drivers and gets new donations.',
          'It now charges a small fee for membership.',
        ],
        answerIndex: 2,
        explanation: '原文最后一段提到现在有六位志愿者司机，大学和出版社也在捐书。',
      },
    ],
  },
  {
    id: 'rp002',
    title: 'Why Sleep Matters for Teenagers',
    level: 2,
    body: `Most teenagers know that sleep is good for them, yet many sleep less than seven hours on a school night. Researchers in Shanghai recently studied 1,200 high-school students and found that those who slept eight to nine hours scored, on average, 12% higher on language tests than classmates who slept under seven hours.
The reason is biological. During deep sleep, the brain replays the events of the day, strengthens new memories, and clears out chemicals that build up during waking hours. Without enough sleep, this nightly "cleaning" is incomplete. Students may still be able to remember individual facts, but their ability to combine ideas — exactly the skill required for reading comprehension and essay writing — drops sharply.
Teachers often blame phones for the lost hours, but researchers point to a quieter cause: lighting. Many students study under cool, blue-tinted desk lamps until late at night. This kind of light tells the brain that it is still daytime, making it harder to fall asleep even after the lamp is switched off.
The advice is simple. About an hour before bed, switch to a warm-colored lamp, finish the most demanding homework first, and keep weekend wake-up times within an hour of weekday wake-up times. Small changes, the researchers say, can return the missing hours of sleep — and a great deal of learning along with them.`,
    questions: [
      {
        id: 'rp002-q1',
        prompt: 'According to the study, students who slept 8–9 hours…',
        choices: [
          'studied harder than other classmates',
          'preferred reading over essay writing',
          'scored about 12% higher on language tests',
          'were more likely to fall asleep in class',
        ],
        answerIndex: 2,
        explanation: '第一段明确给出 12% 的数据。',
      },
      {
        id: 'rp002-q2',
        prompt: 'What does deep sleep mainly help the brain to do?',
        choices: [
          'Forget unpleasant events',
          'Strengthen memories and clear chemicals',
          'Move blood from the head to the body',
          'Cool down after physical exercise',
        ],
        answerIndex: 1,
        explanation: '第二段直接说明深睡阶段会强化记忆并清除化学物质。',
      },
      {
        id: 'rp002-q3',
        prompt: 'According to the writer, the "quieter cause" of poor sleep is…',
        choices: [
          'noisy neighbours',
          'cool blue desk lighting',
          'too much sport before bed',
          'late dinners',
        ],
        answerIndex: 1,
        explanation: '第三段提到冷色台灯会让大脑误以为还是白天。',
      },
      {
        id: 'rp002-q4',
        prompt: 'What is the main idea of the article?',
        choices: [
          'Phones are the biggest enemy of sleep.',
          'Studying late at night is always harmful.',
          'Small changes in habits can recover lost sleep and learning.',
          'Teenagers in Shanghai sleep more than other cities.',
        ],
        answerIndex: 2,
        explanation: '末段总结：小小的改变就能找回丢失的睡眠与学习成果。',
      },
    ],
  },
  {
    id: 'rp003',
    title: 'The Quiet Revolution of City Trees',
    level: 3,
    body: `When we picture a great city, we usually think of skylines, bridges, or crowded subways. We rarely think about trees. Yet in the past decade, urban planners around the world have come to view trees not as decoration but as essential infrastructure — as crucial as roads or power lines. The argument is simple: a city without trees is a city that overheats, floods, and quietly damages the health of its residents.
A single mature street tree can lower the air temperature around it by up to two degrees Celsius. Multiplied across a neighbourhood, this cooling effect reduces the use of air conditioning, which in turn reduces electricity demand and the carbon emissions that come with it. During heavy rain, the same tree can absorb hundreds of litres of water through its roots, easing pressure on drainage systems that would otherwise flood. And on a calm afternoon, its canopy quietly removes invisible particles from the air, particles that, when breathed in over years, are linked to asthma, heart disease, and reduced cognitive performance in children.
Sceptics ask whether the cost is worth it. Trees demand water, regular pruning, and decades to reach their full size. They drop leaves, occasionally branches, and sometimes block useful sunlight in winter. Cities planting at scale must also choose species carefully: an aggressive root system can damage pavements, and a tree poorly suited to the local climate will simply die.
The most thoughtful programmes treat each planting as a small experiment. They diversify species so that one disease cannot wipe out an entire street. They install sensors that measure soil moisture and update watering schedules automatically. They engage neighbourhoods so that residents — not the city alone — feel ownership of the trees outside their windows.
The result, slowly, is a different kind of skyline. It is greener, quieter, and a little cooler. It is also, by every measurable standard, healthier. The lesson, the planners say, is that the most powerful technology a city can install may not arrive in a delivery truck. It may already be growing, slowly, on the corner.`,
    questions: [
      {
        id: 'rp003-q1',
        prompt: 'According to the article, urban planners now see trees primarily as…',
        choices: [
          'symbols of a city\'s wealth',
          'decoration to attract tourists',
          'essential infrastructure',
          'obstacles to modern construction',
        ],
        answerIndex: 2,
        explanation: '第一段强调 "essential infrastructure"。',
      },
      {
        id: 'rp003-q2',
        prompt: 'Which is NOT mentioned as a benefit of city trees?',
        choices: [
          'Lower local temperatures',
          'Reduced flooding from heavy rain',
          'Improved internet connection speed',
          'Removal of harmful particles from the air',
        ],
        answerIndex: 2,
        explanation: '互联网速度未在文中出现。',
      },
      {
        id: 'rp003-q3',
        prompt: 'What concern do sceptics raise?',
        choices: [
          'Trees give too much shade in summer.',
          'Maintenance is demanding and species choice is tricky.',
          'Trees attract tourists who damage neighbourhoods.',
          'Trees do not survive long in any city.',
        ],
        answerIndex: 1,
        explanation: '第三段直接列出维护与物种选择的难处。',
      },
      {
        id: 'rp003-q4',
        prompt: 'What do thoughtful programmes do differently?',
        choices: [
          'Plant only fast-growing species',
          'Treat each planting as an experiment with sensors and community involvement',
          'Hire foreign experts for every project',
          'Replace trees every five years to save costs',
        ],
        answerIndex: 1,
        explanation: '第四段：多样化树种、传感器、居民参与。',
      },
      {
        id: 'rp003-q5',
        prompt: 'What is the writer\'s overall tone?',
        choices: [
          'Pessimistic about urban life',
          'Neutral and statistical',
          'Optimistic and persuasive',
          'Critical of urban planners',
        ],
        answerIndex: 2,
        explanation: '末段以充满希望的语气总结，明显是劝说性的乐观语气。',
      },
    ],
  },
]
