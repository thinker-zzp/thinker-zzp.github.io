// samples.js — Preset training corpora for markov-text

const CORPUS_PRESETS = {
  shakespeare: {
    name: "Shakespeare (Sonnets & Soliloquy)",
    lang: "en",
    text: `To be, or not to be, that is the question:
Whether 'tis nobler in the mind to suffer
The slings and arrows of outrageous fortune,
Or to take arms against a sea of troubles
And by opposing end them. To die—to sleep,
No more; and by a sleep to say we end
The heart-ache and the thousand natural shocks
That flesh is heir to: 'tis a consummation
Devoutly to be wish'd. To die, to sleep;
To sleep, perchance to dream—ay, there's the rub:
For in that sleep of death what dreams may come,
When we have shuffled off this mortal coil,
Must give us pause—there's the respect
That makes calamity of so long life.
Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date.`
  },

  alice: {
    name: "Alice in Wonderland",
    lang: "en",
    text: `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"
So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!"`
  },

  search_poem: {
    name: "算法与搜索随想 (Algorithms & Search)",
    lang: "zh",
    text: `在学习与搜索之间，探索更好的算法。
高维空间是一座起伏不定的丘陵，山峰隐匿于未知的浓雾，低谷回荡着收敛的轻响。
粒子向着全局最优振翅，留下一串串微弱的动能痕迹。
染色体在交叉与突变中重组，每一次选择都是对自然规律的致敬。
没有绝对的捷径，没有免费的午餐定理。
我们设计智能体在迷宫中摸索，每一次撞墙获得惩罚，每一次触碰目标获得救赎。
价值函数如潮水般漫过每一个状态，贪心策略从混沌中凝结出清晰的方向。
从随机探索到确定性利用，在探索与利用的博弈中，寻找那条通往最优解的红线。
每一步，都有新的可能；每一个状态，都孕育着未来的演化。`
  },

  scifi: {
    name: "深空演化史 (Sci-Fi Prose)",
    lang: "zh",
    text: `宇宙是一座冰冷而繁密的巨型自动机。星系如旋转的离散种群，在引力势能的等高线间缓慢坍缩。
探测飞船在黑暗的虚空中航行，向未知频段发送微弱的信标。
每一个跃迁坐标都是多维搜索空间中的一个采样点。
有时飞船落入引力陷阱，能量指数衰减；有时偶然掠过超新星的余晖，重获新生。
智能体在星际航线中学习最优策略，利用极少的信息熵推测母星的坐标。
文明在迭代中演化，算法在试错中进化，时间的单向箭头永远指向那片更高维度的未知。`
  },

  code: {
    name: "Python Code Snippet",
    lang: "code",
    text: `def optimize(objective_function, bounds, max_iters=100, pop_size=50):
    population = initialize_population(pop_size, bounds)
    best_solution = None
    best_fitness = float("-inf")
    history = []

    for iteration in range(max_iters):
        scores = [objective_function(ind) for ind in population]
        for ind, score in zip(population, scores):
            if score > best_fitness:
                best_fitness = score
                best_solution = ind
        history.append(best_fitness)
        population = evolve_step(population, scores, mutation_rate=0.1)

    return best_solution, best_fitness, history`
  }
};
