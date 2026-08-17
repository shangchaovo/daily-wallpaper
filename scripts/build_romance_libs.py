#!/usr/bin/env python3
"""Build the French / Spanish core libraries (data/words_french.json, words_spanish.json).

Sources (open data, fetched to /tmp — see data/ATTRIBUTION.md):
  - /tmp/cfdict.u8   CFDICT 中法词典 (CC BY-SA 3.0, Chine-Informations) — 60k 条「中文→法语」,
                     反查成「法语→中文」。CFDICT 头词含文言/方言字(兹/佥/伲…),直接用会很怪,
                     所以释义只保留「本仓库英语词库释义里出现过的现代汉语词」(白名单过滤)。
  - /tmp/es-zh.json  X2CNDICT/creator_es2cn 的 spanish-chinese.json — 18.8k 条「西语→中文」,
                     meaning 数组按 [词性, 释义, 词性, 释义…] 交替,质量不错,直接采用。
  - /tmp/fr_50k.txt / /tmp/es_50k.txt
                     hermitdave/FrequencyWords (OpenSubtitles 词频),决定收词顺序。

质量原则:
  1. 功能词/常见不规则动词用 OVERRIDES 人工校对的释义(词典反查对 est/pas/no 这类词最差)。
  2. 变位形式(est/sont/vu/voy/fue…)SKIP——词卡背原形,不背变位。
  3. 法语自动释义必须过现代汉语白名单,过不了就跳过该词,宁可缺不可错。

Output schema 与 build_wordlibs.py 一致: [{word, pos?, meaning}, ...] (空字段省略)。
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")

FRENCH_CAP = 1400
SPANISH_CAP = 1400

CFDICT_PATH = "/tmp/cfdict.u8"
ES_ZH_PATH = "/tmp/es-zh.json"
FR_FREQ_PATH = "/tmp/fr_50k.txt"
ES_FREQ_PATH = "/tmp/es_50k.txt"

WORD_RE = re.compile(r"^[^\W\d_][^\W\d_'-]*$", re.UNICODE)
FR_BAD_GLOSS = re.compile(r"(radical|Kangxi|Suzhou|nom propre|variante|abréviation|ancienne forme)", re.I)

# ---------------------------------------------------------------- 法语人工校对 ----
# 高频功能词 + 常见动词原形:CFDICT 反查对这些词给出的往往是同形名词的释义(est→东方),
# 必须人工覆盖。
FR_OVERRIDES = {
    # 代词
    "je": "我", "tu": "你", "il": "他", "elle": "她", "nous": "我们", "vous": "你们;您",
    "ils": "他们", "elles": "她们", "on": "人们;我们(泛称)", "me": "我(宾/自反)", "te": "你(宾/自反)",
    "se": "他/她/他们(自反)", "lui": "他;她(间接宾语)", "moi": "我(重读)", "toi": "你(重读)",
    "celui": "这一个(阳性)", "celle": "这一个(阴性)", "cela": "那;这件事", "ceci": "这;这件事",
    # 冠词/限定词
    "le": "阳性单数定冠词", "la": "阴性单数定冠词", "les": "复数定冠词", "un": "一;一个(阳性)",
    "une": "一;一个(阴性)", "des": "复数不定/部分冠词", "du": "缩合冠词(de+le)",
    "mon": "我的(阳性单数)", "ma": "我的(阴性单数)", "mes": "我的(复数)",
    "ton": "你的(阳性单数)", "ta": "你的(阴性单数)", "tes": "你的(复数)",
    "son": "他/她的(阳性单数)", "sa": "他/她的(阴性单数)", "ses": "他/她的(复数)",
    "notre": "我们的", "nos": "我们的(复数)", "votre": "你们的;您的", "vos": "你们的(复数)",
    "leur": "他们的", "leurs": "他们的(复数)", "ce": "这;这个(阳性)", "cet": "这;这个(元音前阳性)",
    "cette": "这;这个(阴性)", "ces": "这些", "chaque": "每个", "quelque": "某个;几个",
    "quelques": "一些;几个", "tout": "一切;所有(阳性单数)", "tous": "所有;大家", "toute": "整个(阴性)",
    "toutes": "所有(阴性复数)", "autre": "另一个;其他的", "même": "同样的;甚至", "tel": "这样的",
    # 连词/介词/副词
    "et": "和;并且", "ou": "或者", "mais": "但是", "donc": "所以;因此", "car": "因为",
    "si": "如果;(反驳)是的", "que": "那;什么(连/疑)", "qui": "谁;…的(疑/关系)", "quoi": "什么",
    "comme": "像;作为", "de": "的;从", "à": "到;在", "dans": "在…里", "sur": "在…上",
    "avec": "和…一起", "sans": "没有", "sous": "在…下面", "chez": "在…家/店里", "entre": "在…之间",
    "vers": "朝;大约", "pour": "为了", "par": "通过;被", "avant": "在…之前", "après": "在…之后",
    "pendant": "在…期间", "contre": "反对;靠着", "selon": "根据", "malgré": "尽管",
    "ne": "不(否定小品词)", "pas": "不(否定)", "plus": "更;不再", "jamais": "从不", "toujours": "总是",
    "encore": "还;再", "déjà": "已经", "aussi": "也", "très": "很;非常", "bien": "好;很",
    "mal": "差;糟糕", "peu": "少;不大", "beaucoup": "很多", "trop": "太多", "assez": "足够",
    "ici": "这里", "là": "那里", "où": "哪里", "quand": "何时", "comment": "怎样",
    "pourquoi": "为什么", "combien": "多少", "oui": "是;对", "non": "不;不是",
    "maintenant": "现在", "alors": "那么;当时", "ensuite": "然后", "enfin": "最后;终于",
    "déjà": "已经", "vite": "快", "là": "那里", "ailleurs": "在别处", "partout": "到处",
    "merci": "谢谢", "bonjour": "你好", "salut": "嗨;你好", "au revoir": "再见", "pardon": "对不起;请原谅",
    # 常见动词原形
    "être": "是;存在", "avoir": "有", "aller": "去", "faire": "做", "venir": "来",
    "voir": "看见", "dire": "说", "pouvoir": "能够", "vouloir": "想要", "devoir": "必须;欠",
    "savoir": "知道;会", "prendre": "拿;取;乘坐", "donner": "给", "parler": "说话", "mettre": "放;穿上",
    "trouver": "找到;认为", "penser": "想;认为", "croire": "相信;认为", "falloir": "需要(无人称)",
    "aimer": "爱;喜欢", "tenir": "拿着;保持", "porter": "携带;穿", "ouvrir": "打开", "fermer": "关闭",
    "commencer": "开始", "finir": "结束", "choisir": "选择", "attendre": "等待", "entendre": "听见",
    "répondre": "回答", "demander": "问;要求", "écouter": "听", "regarder": "看", "manger": "吃",
    "boire": "喝", "dormir": "睡觉", "partir": "出发;离开", "arriver": "到达;发生", "entrer": "进入",
    "sortir": "出去", "monter": "上去;登上", "descendre": "下去;下来", "rester": "留下", "tomber": "跌倒;落下",
    "vivre": "生活;活着", "mourir": "死", "naître": "出生", "lire": "读", "écrire": "写",
    "apprendre": "学习;得知", "comprendre": "理解", "connaître": "认识;了解", "travailler": "工作",
    "jouer": "玩;演奏", "gagner": "赢;挣得", "perdre": "输;丢失", "payer": "支付", "acheter": "买",
    "vendre": "卖", "coûter": "花费(钱)", "valoir": "值;值得", "sembler": "似乎", "devenir": "变成",
    "revenir": "回来", "repartir": "再出发", "rentrer": "回家", "passer": "经过;度过", "tourner": "转动;转弯",
    "arrêter": "停止", "continuer": "继续", "changer": "改变", "essayer": "尝试", "utiliser": "使用",
    "servir": "服务;用于", "recevoir": "收到", "envoyer": "寄;发送", "montrer": "展示;指给…看",
    "expliquer": "解释", "poser": "放置;提出(问题)", "lever": "举起", "baisser": "放下;降低",
    "tirer": "拉;射击", "pousser": "推", "suivre": "跟随;上(课)", "conduire": "驾驶;带领",
    "produire": "生产", "construire": "建造", "détruire": "摧毁", "offrir": "赠送;提供", "souffrir": "受苦",
    "couvrir": "覆盖", "découvrir": "发现", "permettre": "允许", "promettre": "承诺", "remettre": "放回;推迟",
    "prévenir": "预防;通知", "retenir": "留住;记住", "obtenir": "获得", "appartenir": "属于",
    "contenir": "包含", "maintenir": "维持", "soutenir": "支持", "atteindre": "到达;达到",
    "éteindre": "熄灭", "peindre": "绘画", "craindre": "害怕", "plaindre": "同情", "joindre": "连接;联系",
    "rire": "笑", "sourire": "微笑", "pleurer": "哭", "crier": "喊叫", "mentir": "撒谎",
    "sentir": "感觉;闻到", "partir": "离开", "courir": "跑", "marcher": "走路", "nager": "游泳",
    "voler": "飞;偷", "conduire": "驾驶", "voyager": "旅行", "habiter": "居住", "chercher": "寻找",
    "rappeler": "提醒;回电话", "appeler": "叫;打电话", "nommer": "命名", "compter": "数;打算",
    "noter": "记录;注意到", "raconter": "讲述", "imaginer": "想象", "souhaiter": "祝愿", "espérer": "希望",
    "préférer": "更喜欢", "accepter": "接受", "refuser": "拒绝", "décider": "决定", "préparer": "准备",
    "organiser": "组织", "inviter": "邀请", "présenter": "介绍;呈现", "remercier": "感谢", "féliciter": "祝贺",
    "excuser": "原谅", "oublier": "忘记", "souvenir": "记起(自反)", "rêver": "做梦", "grandir": "长大",
    "vieillir": "变老", "grossir": "变胖", "maigrir": "变瘦", "rougir": "脸红", "bâtir": "建造",
    "obéir": "服从", "punir": "惩罚", "réussir": "成功", "remplir": "装满;填写", "saisir": "抓住;理解",
    "vêtir": "给…穿衣", "coudre": "缝纫", "laver": "洗", "nettoyer": "打扫", "ranger": "整理",
    "cuisiner": "做饭", "goûter": "品尝;下午茶", "petit": "小的", "grand": "大的;高的", "bon": "好的",
    "mauvais": "坏的", "beau": "美丽的(阳性)", "belle": "美丽的(阴性)", "joli": "漂亮的",
    "nouveau": "新的(阳性)", "nouvelle": "新的(阴性)", "vieux": "老的;旧的", "vieille": "老的(阴性)",
    "jeune": "年轻的", "long": "长的", "longue": "长的(阴性)", "court": "短的", "haut": "高的",
    "bas": "低的", "large": "宽的", "étroit": "窄的", "fort": "强的;浓的", "faible": "弱的",
    "dur": "硬的;艰难的", "doux": "柔软的;甜的(阳性)", "douce": "柔软的(阴性)", "chaud": "热的",
    "froid": "冷的", "propre": "干净的;自己的", "sale": "脏的", "plein": "满的", "vide": "空的",
    "riche": "富有的", "pauvre": "贫穷的", "cher": "贵的;亲爱的", "facile": "容易的", "difficile": "困难的",
    "simple": "简单的", "compliqué": "复杂的", "important": "重要的", "nécessaire": "必要的",
    "possible": "可能的", "impossible": "不可能的", "vrai": "真的", "faux": "假的(阳性)", "fausse": "假的(阴性)",
    "sûr": "确定的;安全的", "certain": "某些;确信的", "clair": "清楚的;浅色的", "foncé": "深色的",
    "sombre": "昏暗的", "lumineux": "明亮的", "calme": "平静的", "tranquille": "安静的",
    "content": "高兴的", "heureux": "幸福的", "triste": "难过的", "fatigué": "疲倦的", "malade": "生病的",
    "prêt": "准备好的", "occupé": "忙的", "libre": "自由的;空闲的", "seul": "独自的", "ensemble": "一起",
    "premier": "第一的", "dernier": "最后的", "prochain": "下一个", "autre": "另一个",
    # 常见名词(反查质量差的常用词)
    "jour": "天;白天", "journée": "一天(时段)", "nuit": "夜晚", "matin": "早晨", "matinée": "上午(时段)",
    "soir": "晚上", "soirée": "晚上(时段);晚会", "semaine": "星期;一周", "mois": "月", "an": "年",
    "année": "年(时段)", "heure": "小时;点钟", "minute": "分钟", "seconde": "秒", "moment": "时刻",
    "temps": "时间;天气", "fois": "次;回", "monde": "世界;人们", "pays": "国家;乡村", "ville": "城市",
    "rue": "街道", "maison": "房子;家", "porte": "门", "fenêtre": "窗户", "chambre": "房间;卧室",
    "cuisine": "厨房;烹饪", "table": "桌子", "chaise": "椅子", "lit": "床", "pain": "面包",
    "eau": "水", "lait": "牛奶", "café": "咖啡;咖啡馆", "thé": "茶", "vin": "葡萄酒", "bière": "啤酒",
    "fruit": "水果", "pomme": "苹果", "viande": "肉", "poisson": "鱼", "fromage": "奶酪", "sucre": "糖",
    "sel": "盐", "riz": "米饭;米", "oeuf": "鸡蛋", "légume": "蔬菜", "homme": "男人;人", "femme": "女人;妻子",
    "enfant": "孩子", "fils": "儿子", "fille": "女儿;女孩", "père": "父亲", "mère": "母亲",
    "frère": "兄弟", "soeur": "姐妹", "ami": "朋友(阳性)", "amie": "朋友(阴性)", "monsieur": "先生",
    "madame": "夫人;女士", "mademoiselle": "小姐", "nom": "名字;名词", "prénom": "名", "famille": "家庭",
    "gens": "人们(复数)", "personne": "人;(否定句中)没有人", "chose": "东西;事情", "vie": "生活;生命",
    "mort": "死亡", "travail": "工作", "école": "学校", "livre": "书", "page": "页", "mot": "词;话",
    "lettre": "信;字母", "phrase": "句子", "question": "问题", "réponse": "回答", "idée": "主意;想法",
    "exemple": "例子", "histoire": "故事;历史", "photo": "照片", "image": "图像", "film": "电影",
    "musique": "音乐", "chanson": "歌曲", "journal": "报纸;日记", "téléphone": "电话", "numéro": "号码",
    "adresse": "地址", "ville": "城市", "gare": "火车站", "train": "火车", "avion": "飞机", "voiture": "汽车",
    "vélo": "自行车", "pied": "脚", "main": "手", "tête": "头", "oeil": "眼睛", "yeux": "眼睛(复数)",
    "nez": "鼻子", "bouche": "嘴", "oreille": "耳朵", "cheveux": "头发(复数)", "visage": "脸",
    "corps": "身体", "coeur": "心;心脏", "sang": "血", "bruit": "噪音", "voix": "声音;嗓音",
    "soleil": "太阳", "lune": "月亮", "ciel": "天空", "étoile": "星星", "terre": "土地;地球",
    "mer": "大海", "montagne": "山", "fleur": "花", "arbre": "树", "feuille": "叶子;纸张",
    "animal": "动物", "chien": "狗", "chat": "猫", "oiseau": "鸟", "cheval": "马", "poisson": "鱼",
    "argent": "钱;银", "prix": "价格;奖", "cadeau": "礼物", "clé": "钥匙", "sac": "包;袋",
    "vêtement": "衣服", "chemise": "衬衫", "pantalon": "裤子", "robe": "连衣裙", "jupe": "短裙",
    "manteau": "大衣", "chaussure": "鞋", "chapeau": "帽子", "montre": "手表", "lunettes": "眼镜(复数)",
    # —— 反查单字释义歧义的人工纠正(单字汉语多义,如 jeu→局 应为「游戏」)——
    "bureau": "办公室;书桌", "jeu": "游戏;玩耍", "peine": "痛苦;刑罚", "arme": "武器",
    "service": "服务", "sorte": "种类", "moyen": "方法;手段", "loi": "法律", "forme": "形状;形式",
    "but": "目标;目的", "signe": "标志;符号", "voie": "道路;途径", "base": "基础;基地",
    "héros": "英雄", "entrée": "入口;前菜", "spécial": "特别的", "série": "系列",
    "taille": "尺寸;身材", "excellent": "优秀的;极好的", "joyeux": "快乐的", "action": "行动;动作",
    "reprendre": "重新拿起;恢复", "agir": "行动", "couverture": "毯子;封面;覆盖", "saison": "季节",
    "abandonner": "放弃;抛弃", "univers": "宇宙", "lance": "长矛", "talent": "才能;天赋",
    "particulier": "特别的;个别的", "cependant": "然而", "science": "科学", "département": "部门;(法国)省",
    "abri": "避难所;遮蔽处", "frontière": "边境;国界", "technique": "技术;技巧",
    "matière": "物质;材料;科目", "ouverture": "开放;开口;开幕", "objectif": "目标;镜头",
    "élever": "举起;养育", "commander": "命令;订购", "violent": "暴力的;猛烈的",
    "caractère": "性格;特征", "méthode": "方法", "capacité": "能力;容量", "principe": "原则",
    "franc": "坦率的;法郎(名)", "louer": "租用;赞美", "manche": "袖子;海峡",
    "allumer": "点燃;打开(电器)", "augmenter": "增加", "souffle": "呼吸;气息",
    "marquer": "标记;得分", "rideau": "窗帘;幕", "aspect": "方面;外观", "office": "办公室;职务",
    "vapeur": "蒸汽", "catégorie": "类别;范畴", "verser": "倒;倾注", "appliquer": "应用;涂抹",
    "ouvrier": "工人", "évaluer": "评估", "pratiquer": "实践;从事", "désirer": "渴望;想要",
    "ballade": "民谣;散步", "copier": "复制;抄袭", "calculer": "计算", "cultiver": "种植;培养",
    "distingué": "卓越的;优雅的", "diminuer": "减少", "approuver": "批准;赞同", "exciter": "使兴奋",
    "prélever": "抽取;征收", "aigu": "尖锐的;敏锐的", "simultanément": "同时地", "insérer": "插入",
    "éminent": "杰出的", "contaminer": "污染;传染", "enrôler": "招募;登记", "insolite": "不寻常的",
    "mordant": "尖刻的;腐蚀性的", "individuel": "个人的", "illustrer": "给…插图;阐明",
    "dégrader": "降级;损坏", "tome": "卷;册", "émouvoir": "使感动", "anse": "小海湾;把手",
    "soupirer": "叹气", "ériger": "竖立;建立", "général": "一般的;将军(名)", "ordre": "命令;顺序",
    "situation": "情况;处境", "simplement": "简单地;仅仅", "balle": "球;子弹",
    "mesurer": "测量;衡量", "accélérer": "加速", "élégant": "优雅的", "réellement": "真正地;确实",
    "véritable": "真正的", "communiquer": "交流;传达", "transmettre": "传递;传播",
    "rassembler": "聚集;收集", "réunir": "集合;联合", "nourrir": "喂养;滋养", "trou": "洞;孔",
    "âme": "灵魂", "esprit": "精神;心灵", "tente": "帐篷", "rang": "行列;等级",
    "marge": "边缘;页边空白", "poignée": "一把;少量", "domicile": "住所", "quantité": "数量",
    "épisode": "一集;插曲", "collection": "收藏;系列", "torture": "折磨;酷刑", "boule": "球;球状物",
    "toucher": "触摸;涉及", "vraiment": "真正地;实在", "globe": "球;地球", "khan": "可汗",
    "museau": "(动物的)口鼻部", "fondement": "基础;根基", "hutte": "小屋;棚屋", "couette": "羽绒被",
    "additionner": "加;相加", "prompt": "迅速的;敏捷的",
    "bagages": "行李", "accueillir": "欢迎;接待", "relier": "连接", "acharné": "顽强的;猛烈的",
    "agacer": "惹恼;刺激", "trompeur": "欺骗的;骗子", "décliner": "谢绝;衰退;变位",
}

# 变位形式:不背变位背原形(同形名词冲突也从这里挡掉,如 été→夏天、vu→所见)。
FR_SKIP = {
    "suis", "es", "est", "sommes", "êtes", "sont", "étais", "était", "étions", "étiez", "étaient",
    "serai", "sera", "seront", "serais", "serait", "sois", "soit", "soyons", "soyez", "soient", "été", "étant",
    "ai", "as", "a", "avons", "avez", "ont", "avais", "avait", "avions", "aviez", "avaient",
    "aurai", "aura", "auront", "aurais", "aurait", "aie", "aies", "ait", "ayons", "ayez", "aient", "eu", "ayant",
    "vais", "vas", "va", "allons", "allez", "vont", "allais", "allait", "allaient", "irai", "ira", "iront", "allé",
    "fais", "fait", "faisons", "faites", "font", "faisais", "faisait", "ferai", "fera", "feront",
    "viens", "vient", "venons", "venez", "viennent", "venais", "venait", "viendrai", "viendra", "venu",
    "vois", "voit", "voyons", "voyez", "voient", "voyais", "voyait", "verrai", "verra", "vu", "voyant",
    "dis", "dit", "disons", "dites", "disent", "disais", "disait", "dirai", "dira", "dites-moi",
    "peux", "peut", "pouvons", "pouvez", "peuvent", "pouvais", "pouvait", "pourrai", "pourra", "pu",
    "veux", "veut", "voulons", "voulez", "veulent", "voulais", "voulait", "voudrai", "voudra", "voulu",
    "dois", "doit", "devons", "devez", "doivent", "devais", "devait", "devrai", "devra", "dû",
    "sais", "sait", "savons", "savez", "savent", "savais", "savait", "saurai", "saura",
    "prends", "prend", "prenons", "prenez", "prennent", "prenais", "prenait", "prendrai", "pris",
    "donne", "donnes", "donnent", "donnais", "donnait", "donnerai", "donné",
    "parle", "parles", "parlent", "parlais", "parlait", "parlé",
    "mets", "met", "mettons", "mettez", "mettent", "mettais", "mettait",
    "tiens", "tient", "tenons", "tenez", "tiennent", "tenais", "tenait",
    "porte", "portes", "portent", "portais", "portait", "porté",
    "ouvre", "ouvert", "ferme", "fermes", "ferment", "fermé",
    "commence", "commencent", "commençais", "commençait", "commencé",
    "finit", "finissent", "finissais", "fini", "choisit", "choisi",
    "attends", "attend", "attendent", "attendu", "entends", "entend", "entendent", "entendu",
    "réponds", "répond", "répondent", "répondu", "demande", "demandent", "demandé",
    "écoute", "écoutent", "écouté", "regarde", "regardent", "regardé", "mange", "mangent", "mangé",
    "bois", "boit", "buvent", "bu", "dors", "dort", "dorment", "dormi",
    "pars", "part", "partent", "parti", "arrive", "arrivent", "arrivé", "entre", "entrent", "entré",
    "sors", "sort", "sortent", "sorti", "monte", "montent", "monté", "descends", "descend", "descendu",
    "reste", "restent", "resté", "tombe", "tombent", "tombé", "vis", "vit", "vivent", "vécu",
    "meurs", "meurt", "meurent", "mort", "nais", "naît", "né", "lis", "lit", "lisent", "lu",
    "écris", "écrit", "écrivent", "écrit", "apprends", "apprend", "apprennent", "appris",
    "comprends", "comprend", "comprennent", "compris", "connais", "connaît", "connaissent", "connu",
    "travaille", "travaillent", "travaillé", "joue", "jouent", "joué", "gagne", "gagnent", "gagné",
    "perds", "perd", "perdent", "perdu", "paie", "paye", "payé", "achète", "achètent", "acheté",
    "vends", "vend", "vendent", "vendu", "coûte", "coûtent", "coûté", "vaut", "valent", "valu",
    "semble", "semblent", "semblé", "deviens", "devient", "deviennent", "devenu", "reviens", "revient", "revenu",
    "rentre", "rentrent", "rentré", "passe", "passent", "passé", "tourne", "tournent", "tourné",
    "arrête", "arrêtent", "arrêté", "continue", "continuent", "continué", "change", "changent", "changé",
    "essaie", "essayent", "essayé", "utilise", "utilisent", "utilisé", "sers", "sert", "servent", "servi",
    "reçois", "reçoit", "reçoivent", "reçu", "envoie", "envoient", "envoyé", "montre", "montrent", "montré",
    "explique", "expliquent", "expliqué", "pose", "posent", "posé", "lève", "lèvent", "levé",
    "baisse", "baissent", "baissé", "tire", "tirent", "tiré", "pousse", "poussent", "poussé",
    "suis-je", "suit", "suivent", "suivi", "conduis", "conduit", "conduisent", "conduit",
    "produis", "produit", "produisent", "produit", "construis", "construit", "construit",
    "offre", "offrent", "offert", "souffre", "souffrent", "souffert", "couvre", "couvrent", "couvert",
    "découvre", "découvrent", "découvert", "permets", "permet", "permettent", "permis",
    "promets", "promet", "promettent", "promis", "remets", "remet", "remettent",
    "préviens", "prévient", "préviennent", "prévenu", "retiens", "retient", "retiennent", "retenu",
    "obtiens", "obtient", "obtiennent", "obtenu", "appartiens", "appartient", "appartiennent", "appartenu",
    "contiens", "contient", "contiennent", "contenu", "maintiens", "maintient", "maintenu",
    "soutiens", "soutient", "soutenu", "atteins", "atteint", "atteignent", "atteint",
    "éteins", "éteint", "éteignent", "éteint", "peins", "peint", "peignent", "peint",
    "crains", "craint", "craignent", "craint", "plains", "plaint", "plaignent", "plaint",
    "joins", "joint", "joignent", "joint", "ris", "rit", "rident", "ri", "souris", "sourit", "souri",
    "pleure", "pleurent", "pleuré", "crie", "crient", "crié", "mens", "ment", "mentent", "menti",
    "sens", "sent", "sentent", "senti", "cours", "court", "courent", "couru", "marche", "marchent", "marché",
    "nage", "nagent", "nagé", "vole", "volent", "volé", "conduis", "voyage", "voyagent", "voyagé",
    "habite", "habitent", "habité", "cherche", "cherchent", "cherché", "rappelle", "rappellent", "rappelé",
    "appelle", "appellent", "appelé", "nomme", "nomment", "nommé", "compte", "comptent", "compté",
    "note", "notent", "noté", "raconte", "racontent", "raconté", "imagine", "imaginent", "imaginé",
    "souhaite", "souhaitent", "souhaité", "espère", "espèrent", "espéré", "préfère", "préfèrent", "préféré",
    "accepte", "acceptent", "accepté", "refuse", "refusent", "refusé", "décide", "décident", "décidé",
    "prépare", "préparent", "préparé", "organise", "organisent", "organisé", "invite", "invitent", "invité",
    "présente", "présentent", "présenté", "remercie", "remercient", "remercié", "félicite", "félicitent", "félicité",
    "excuse", "excusent", "excusé", "oublie", "oublient", "oublié", "rêve", "rêvent", "rêvé",
    "grandit", "grandissent", "grandi", "vieillit", "vieilli", "grossit", "grossi", "maigrit", "maigri",
    "rougit", "rougi", "bâtit", "bâti", "obéit", "obéi", "punit", "puni", "réussit", "réussi",
    "remplit", "remplissent", "rempli", "saisit", "saisissent", "saisi", "lave", "lavent", "lavé",
    "nettoie", "nettoient", "nettoyé", "range", "rangent", "rangé", "cuisine", "cuisinent", "cuisiné",
    "goûte", "goûtent", "goûté", "faut", "fallu", "fallait",
}

# ---------------------------------------------------------------- 西语人工校对 ----
ES_OVERRIDES = {
    "bien": "好;很", "diez": "十",
    "segundo": "第二(的);秒", "celda": "单人牢房;小室",
    "no": "不;没有", "sí": "是的", "que": "那;比(连词)", "qué": "什么", "quién": "谁", "quiénes": "谁(复数)",
    "yo": "我", "tú": "你", "él": "他", "ella": "她", "usted": "您", "nosotros": "我们(阳性)",
    "nosotras": "我们(阴性)", "vosotros": "你们(阳性)", "vosotras": "你们(阴性)", "ellos": "他们",
    "ellas": "她们", "ustedes": "您们;你们", "me": "我(宾/与格)", "te": "你(宾/与格)",
    "se": "他/她/您/他们(补语;自复)", "lo": "他;它(宾格)", "la": "她;它(宾格)", "los": "他们(宾格)",
    "las": "她们(宾格)", "le": "他;您(与格)", "les": "他们;您们(与格)", "mí": "我(重读)", "ti": "你(重读)",
    "mi": "我的", "mis": "我的(复数)", "tu": "你的", "tus": "你的(复数)", "su": "他的;您的",
    "sus": "他们的;您的(复数)", "nuestro": "我们的", "vuestra": "你们的(阴性)", "el": "阳性单数定冠词",
    "una": "一个(阴性不定冠词)", "un": "一个(阳性不定冠词)", "unos": "一些(阳性)", "unas": "一些(阴性)",
    "y": "和", "o": "或者", "pero": "但是", "porque": "因为", "como": "像;作为", "si": "如果",
    "sino": "而是", "aunque": "尽管", "cuando": "当…时", "mientras": "当…时;而", "en": "在…里",
    "a": "到;向", "con": "和…一起", "sin": "没有", "sobre": "在…上;关于", "entre": "在…之间",
    "hasta": "直到", "desde": "从…起", "para": "为了", "por": "通过;因为", "de": "的;从",
    "hacia": "朝向", "según": "根据", "durante": "在…期间", "ser": "是(本质)", "estar": "在;是(状态)",
    "haber": "有(助动词)", "hay": "有(无人称)", "tener": "有;拥有", "hacer": "做", "ir": "去",
    "venir": "来", "ver": "看见", "decir": "说", "poder": "能够", "querer": "想要;爱", "deber": "应该;欠",
    "saber": "知道;会", "dar": "给", "tomar": "拿;喝;乘坐", "poner": "放", "hablar": "说话",
    "llevar": "携带;带走", "traer": "带来", "buscar": "寻找", "encontrar": "找到", "pensar": "想;认为",
    "creer": "相信;认为", "escuchar": "听", "oír": "听见", "mirar": "看", "comer": "吃", "beber": "喝",
    "dormir": "睡觉", "despertar": "醒来", "levantar": "举起;(自反)起床", "partir": "出发;分开",
    "llegar": "到达", "salir": "出去", "entrar": "进入", "subir": "上去", "bajar": "下去",
    "quedar": "留下;(自反)留在", "quedarse": "留下来", "caer": "落下", "vivir": "生活;活着",
    "morir": "死", "nacer": "出生", "leer": "读", "escribir": "写", "aprender": "学习",
    "entender": "理解", "comprender": "理解;包含", "conocer": "认识;了解", "trabajar": "工作",
    "estudiar": "学习", "enseñar": "教", "jugar": "玩", "ganar": "赢;挣得", "perder": "输;丢失",
    "pagar": "支付", "comprar": "买", "vender": "卖", "costar": "花费(钱)", "valer": "值;值得",
    "parecer": "似乎", "volver": "回来", "regresar": "返回", "pasar": "经过;度过;发生", "girar": "转动",
    "parar": "停止", "seguir": "跟随;继续", "continuar": "继续", "cambiar": "改变", "intentar": "尝试",
    "usar": "使用", "utilizar": "利用", "servir": "服务;用于", "recibir": "收到", "enviar": "寄;发送",
    "mostrar": "展示", "explicar": "解释", "preguntar": "问", "contestar": "回答", "responder": "回应",
    "abrir": "打开", "cerrar": "关闭", "empezar": "开始", "comenzar": "开始", "terminar": "结束",
    "acabar": "完成;刚(刚做)", "elegir": "选择", "escoger": "挑选", "esperar": "等待;希望",
    "aguardar": "等候", "conducir": "驾驶", "manejar": "驾驶;操作", "viajar": "旅行", "caminar": "走路",
    "correr": "跑", "nadar": "游泳", "volar": "飞", "llamar": "叫;打电话", "gritar": "喊叫",
    "reír": "笑", "sonreír": "微笑", "llorar": "哭", "mentir": "撒谎", "sentir": "感觉;遗憾",
    "oler": "闻", "tocar": "触摸;演奏;轮到", "cortar": "切;剪", "romper": "打破", "lavar": "洗",
    "limpiar": "打扫", "cocinar": "做饭", "probar": "尝;试", "olvidar": "忘记", "recordar": "记得",
    "soñar": "做梦", "imaginar": "想象", "contar": "数;讲述", "notar": "注意到", "aceptar": "接受",
    "rechazar": "拒绝", "decidir": "决定", "preparar": "准备", "organizar": "组织", "invitar": "邀请",
    "presentar": "介绍;呈现", "agradecer": "感谢", "felicitar": "祝贺", "disculpar": "原谅",
    "perdonar": "宽恕", "cumplir": "履行;满(岁)", "permitir": "允许", "prohibir": "禁止",
    "necesitar": "需要", "gustar": "使喜欢", "encantar": "使着迷", "importar": "重要;使在意",
    "interesar": "使感兴趣", "doler": "使疼痛", "faltar": "缺少", "sobrar": "剩余", "quedar": "剩下",
    "más": "更;更多", "menos": "更少", "muy": "很", "mucho": "很多", "poco": "少", "tanto": "那么多",
    "demasiado": "太多", "bastante": "足够;相当", "también": "也", "tampoco": "也不", "siempre": "总是",
    "nunca": "从不", "jamás": "从不(强调)", "ya": "已经", "todavía": "还", "aún": "还;仍然",
    "aquí": "这里", "ahí": "那里", "allí": "那里(较远)", "allá": "那里(最远)", "dónde": "哪里",
    "cuándo": "何时", "cómo": "怎样", "cuánto": "多少", "cuál": "哪个", "ahora": "现在",
    "antes": "以前;之前", "después": "之后", "luego": "然后;稍后", "hoy": "今天", "mañana": "明天;早晨",
    "ayer": "昨天", "hola": "你好", "adiós": "再见", "gracias": "谢谢", "por favor": "请",
    "perdón": "对不起", "buenos": "好的(复数,用于问候)",
    # 常见形容词/名词(直查易撞变位同形词的)
    "bueno": "好的", "buena": "好的(阴性)", "malo": "坏的", "grande": "大的", "gran": "大的;伟大的",
    "pequeño": "小的", "pequeña": "小的(阴性)", "nuevo": "新的", "viejo": "老的;旧的", "joven": "年轻的",
    "largo": "长的", "corto": "短的", "alto": "高的", "bajo": "低的;矮的", "fuerte": "强的",
    "débil": "弱的", "duro": "硬的;艰难的", "blando": "软的", "caliente": "热的", "frío": "冷的",
    "limpio": "干净的", "sucio": "脏的", "lleno": "满的", "vacío": "空的", "rico": "富有的;美味的",
    "pobre": "贫穷的", "caro": "贵的", "barato": "便宜的", "fácil": "容易的", "difícil": "困难的",
    "simple": "简单的", "importante": "重要的", "necesario": "必要的", "posible": "可能的",
    "imposible": "不可能的", "verdadero": "真的", "falso": "假的", "seguro": "确定的;安全的",
    "claro": "清楚的;浅色的", "oscuro": "深色的;昏暗的", "tranquilo": "安静的", "contento": "高兴的",
    "feliz": "幸福的", "triste": "难过的", "cansado": "疲倦的", "enfermo": "生病的", "listo": "准备好的;聪明的",
    "ocupado": "忙的", "libre": "自由的;空闲的", "solo": "独自的", "juntos": "一起(复数)",
    "primero": "第一的", "último": "最后的", "próximo": "下一个", "otro": "另一个", "mismo": "同样的;自己",
    "cada": "每个", "todo": "一切;所有", "toda": "整个(阴性)", "todos": "大家;所有(复数)",
    "algún": "某个(阳性)", "alguno": "某个", "alguna": "某个(阴性)", "ningún": "没有一个(阳性)",
    "ninguno": "没有一个", "ninguna": "没有一个(阴性)", "ambos": "两个都",
    "día": "天;日", "noche": "夜晚", "tarde": "下午", "semana": "星期", "mes": "月", "año": "年",
    "hora": "小时;点钟", "minuto": "分钟", "segundo": "秒", "momento": "时刻", "tiempo": "时间;天气",
    "vez": "次;回", "mundo": "世界", "país": "国家", "ciudad": "城市", "pueblo": "村镇;人民",
    "calle": "街道", "casa": "房子;家", "puerta": "门", "ventana": "窗户", "cuarto": "房间",
    "habitación": "房间;卧室", "cocina": "厨房", "mesa": "桌子", "silla": "椅子", "cama": "床",
    "pan": "面包", "agua": "水", "leche": "牛奶", "café": "咖啡;咖啡馆", "té": "茶", "vino": "葡萄酒",
    "cerveza": "啤酒", "fruta": "水果", "manzana": "苹果", "carne": "肉", "pescado": "鱼(食物)",
    "queso": "奶酪", "azúcar": "糖", "sal": "盐", "arroz": "米饭", "huevo": "鸡蛋", "verdura": "蔬菜",
    "hombre": "男人;人", "mujer": "女人;妻子", "niño": "男孩;孩子", "niña": "女孩;孩子(阴性)",
    "hijo": "儿子", "hija": "女儿", "padre": "父亲;神父", "madre": "母亲", "hermano": "兄弟",
    "hermana": "姐妹", "amigo": "朋友(阳性)", "amiga": "朋友(阴性)", "señor": "先生", "señora": "夫人;女士",
    "señorita": "小姐", "nombre": "名字", "familia": "家庭", "gente": "人们(总称)", "persona": "人",
    "cosa": "东西;事情", "vida": "生活;生命", "muerte": "死亡", "trabajo": "工作", "escuela": "学校",
    "libro": "书", "página": "页", "palabra": "词;话", "carta": "信;卡片", "frase": "句子",
    "pregunta": "问题", "respuesta": "回答", "idea": "主意", "ejemplo": "例子", "historia": "故事;历史",
    "foto": "照片", "imagen": "图像", "película": "电影", "música": "音乐", "canción": "歌曲",
    "periódico": "报纸", "teléfono": "电话", "número": "号码", "dirección": "地址;方向", "tren": "火车",
    "avión": "飞机", "coche": "汽车", "carro": "汽车(拉美)", "autobús": "公交车", "bicicleta": "自行车",
    "pie": "脚", "mano": "手", "cabeza": "头", "ojo": "眼睛", "nariz": "鼻子", "boca": "嘴",
    "oreja": "耳朵", "pelo": "头发", "cara": "脸", "cuerpo": "身体", "corazón": "心;心脏",
    "sangre": "血", "ruido": "噪音", "voz": "声音;嗓音", "sol": "太阳", "luna": "月亮",
    "cielo": "天空", "estrella": "星星", "tierra": "土地;地球", "mar": "大海", "montaña": "山",
    "flor": "花", "árbol": "树", "hoja": "叶子;纸张", "animal": "动物", "perro": "狗", "gato": "猫",
    "pájaro": "鸟", "caballo": "马", "pez": "鱼(活的)", "dinero": "钱", "precio": "价格",
    "regalo": "礼物", "llave": "钥匙", "bolsa": "包;袋", "ropa": "衣服(总称)", "camisa": "衬衫",
    "pantalón": "裤子", "vestido": "连衣裙", "falda": "短裙", "abrigo": "大衣", "zapato": "鞋",
    "sombrero": "帽子", "reloj": "钟表", "gafas": "眼镜(复数)",
}

# 变位形式(西语频率表头部大量出现;背原形不背变位,也避开 no→先生 这类同形名词误配)。
ES_SKIP = {
    "basta", "baila", "mira-", "soy", "eres", "es", "somos", "sois", "son", "era", "eras", "éramos", "eran", "fui", "fuiste",
    "fue", "fuimos", "fueron", "seré", "será", "serán", "sea", "seas", "sean", "sido", "siendo",
    "estoy", "estás", "está", "estamos", "estáis", "están", "estaba", "estaban", "estuve", "estuvo",
    "estuvieron", "estaré", "estará", "estarán", "esté", "estén", "estado", "he", "has", "ha", "hemos",
    "habéis", "han", "había", "habías", "habían", "hubo", "hubieron", "habrá", "habrán", "haya", "hayan", "habido",
    "tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen", "tenía", "tenían", "tuve", "tuvo", "tuvieron",
    "tendré", "tendrá", "tendrán", "tenga", "tengan", "tenido", "hago", "haces", "hace", "hacemos", "hacéis",
    "hacen", "hacía", "hacían", "hice", "hizo", "hicieron", "haré", "hará", "harán", "haga", "hagan", "hecho",
    "voy", "vas", "va", "vamos", "van", "iba", "ibas", "iban", "iré", "irá", "irán", "vaya", "vayan", "ido", "yendo",
    "vengo", "vienes", "viene", "venimos", "vienen", "venía", "venían", "vine", "vino", "vinieron", "vendré", "vendrá",
    "venga", "vengan", "venido", "veo", "ves", "ve", "vemos", "ven", "veía", "veían", "vi", "vio", "vieron",
    "veré", "verá", "verán", "vea", "vean", "visto", "digo", "dices", "dice", "decimos", "decís", "dicen",
    "decía", "decían", "dije", "dijo", "dijeron", "diré", "dirá", "dirán", "diga", "digan", "dicho",
    "puedo", "puedes", "puede", "podemos", "pueden", "podía", "podían", "pude", "pudo", "pudieron",
    "podré", "podrá", "podrán", "pueda", "puedan", "podido", "quiero", "quieres", "quiere", "queremos",
    "quieren", "quería", "querían", "quise", "quiso", "quisieron", "querré", "querrá", "querrán", "quiera", "quieran",
    "debo", "debes", "debe", "debemos", "deben", "debía", "debían", "debí", "debió", "debieron", "deberé",
    "deba", "deban", "debido", "sé", "sabes", "sabe", "sabemos", "sabéis", "saben", "sabía", "sabían",
    "supe", "supo", "supieron", "sabré", "sabrá", "sabrán", "sepa", "sepan", "sabido", "doy", "das", "da",
    "damos", "dais", "dan", "daba", "daban", "di", "dio", "dieron", "daré", "dará", "darán", "dé", "den", "dado",
    "tomo", "tomas", "toma", "toman", "tomaba", "tomé", "tomó", "tomado", "pongo", "pones", "pone", "ponemos",
    "ponen", "ponía", "puse", "puso", "pusieron", "pondré", "pondrá", "ponga", "pongan", "puesto",
    "hablo", "hablas", "habla", "hablan", "hablé", "habló", "hablado", "llevo", "llevas", "lleva", "llevan",
    "llevé", "llevó", "llevado", "traigo", "traes", "trae", "traen", "traía", "traje", "trajo", "trajeron",
    "traeré", "traiga", "traigan", "traído", "busco", "buscas", "busca", "buscan", "busqué", "buscado",
    "encuentro", "encuentras", "encuentra", "encuentran", "encontré", "encontró", "encontrado",
    "pienso", "piensas", "piensa", "piensan", "pensé", "pensó", "pensado", "creo", "crees", "cree", "creen",
    "creía", "creían", "creí", "creyó", "creyeron", "creído", "escucho", "escucha", "escuchan", "escuché", "escuchado",
    "oigo", "oyes", "oye", "oyen", "oía", "oían", "oí", "oyó", "oyeron", "oiré", "oiga", "oigan", "oído",
    "miro", "miras", "mira", "miran", "miré", "miró", "mirado", "comes", "come", "comen", "comí",
    "comió", "comido", "bebo", "bebes", "bebe", "beben", "bebí", "bebió", "bebido", "duermo", "duermes",
    "duerme", "duermen", "dormí", "durmió", "durmieron", "dormido", "despierto", "despierta", "despiertan",
    "levanto", "levanta", "levantan", "levanté", "levantado", "parto", "partes", "parte", "parten", "partí",
    "partió", "partido", "llego", "llegas", "llega", "llegan", "llegué", "llegó", "llegado",
    "salgo", "sales", "sale", "salen", "salía", "salí", "salió", "salieron", "saldré", "saldrá", "salga", "salgan", "salido",
    "entro", "entras", "entra", "entran", "entré", "entró", "entrado", "subo", "subes", "sube", "suben",
    "subí", "subió", "subido", "bajo", "bajas", "baja", "bajan", "bajé", "bajó", "bajado",
    "quedo", "quedas", "queda", "quedan", "quedé", "quedó", "quedado", "caigo", "cae", "caen", "caí", "cayó", "cayeron",
    "vivo", "vives", "vive", "viven", "vivía", "viví", "vivió", "vivido", "muero", "mueres", "muere", "mueren",
    "moría", "morí", "murió", "murieron", "muerto", "nazco", "nace", "nacen", "nací", "nació", "nacido",
    "leo", "lees", "lee", "leen", "leía", "leí", "leyó", "leyeron", "leído", "escribo", "escribes", "escribe",
    "escriben", "escribí", "escribió", "escrito", "aprendo", "aprendes", "aprende", "aprenden", "aprendí", "aprendió", "aprendido",
    "entiendo", "entiendes", "entiende", "entienden", "entendí", "entendió", "entendido", "comprendo", "comprende", "comprendido",
    "conozco", "conoces", "conoce", "conocen", "conocía", "conocí", "conoció", "conocido", "trabajas",
    "trabaja", "trabajan", "trabajé", "trabajó", "trabajado", "estudio", "estudias", "estudia", "estudian", "estudié", "estudiado",
    "enseño", "enseña", "enseñan", "enseñé", "enseñado", "juego", "juegas", "juega", "juegan", "jugué", "jugó", "jugado",
    "gano", "ganas", "gana", "ganan", "gané", "ganó", "ganado", "pierdo", "pierdes", "pierde", "pierden", "perdí", "perdió", "perdido",
    "pago", "pagas", "paga", "pagan", "pagué", "pagó", "pagado", "compro", "compras", "compra", "compran", "compré", "comprado",
    "vendo", "vendes", "vende", "venden", "vendí", "vendió", "vendido", "cuesta", "cuestan", "costado",
    "vale", "valen", "valía", "valió", "valga", "valgan", "parezco", "parece", "parecen", "parecí", "pareció", "parecido",
    "vuelvo", "vuelves", "vuelve", "vuelven", "volví", "volvió", "vuelto", "regreso", "regresa", "regresan", "regresé", "regresado",
    "paso", "pasas", "pasa", "pasan", "pasé", "pasó", "pasado", "giro", "gira", "giran", "giré", "girado",
    "paro", "para", "paran", "paré", "paró", "parado", "sigo", "sigues", "sigue", "siguen", "seguía", "seguí", "siguió", "siguieron",
    "continúo", "continúa", "continúan", "continué", "continuado", "cambio", "cambias", "cambia", "cambian", "cambié", "cambió", "cambiado",
    "intento", "intenta", "intentan", "intenté", "intentado", "uso", "usas", "usa", "usan", "usé", "usó", "usado",
    "utilizo", "utiliza", "utilizan", "utilicé", "utilizado", "sirvo", "sirves", "sirve", "sirven", "serví", "sirvió", "servido",
    "recibo", "recibes", "recibe", "reciben", "recibí", "recibió", "recibido", "envío", "envía", "envían", "envié", "enviado",
    "muestro", "muestra", "muestran", "mostré", "mostró", "mostrado", "explico", "explica", "explican", "expliqué", "explicado",
    "pregunto", "pregunta", "preguntan", "pregunté", "preguntado", "contesto", "contesta", "contestan", "contesté", "contestado",
    "respondo", "responde", "responden", "respondí", "respondió", "respondido", "abro", "abres", "abre", "abren", "abrí", "abrió", "abierto",
    "cierro", "cierras", "cierra", "cierran", "cerré", "cerró", "cerrado", "empiezo", "empiezas", "empieza", "empiezan", "empecé", "empezó", "empezado",
    "comienzo", "comienza", "comienzan", "comencé", "comenzó", "comenzado", "termino", "termina", "terminan", "terminé", "terminado",
    "acabo", "acaba", "acaban", "acabé", "acabó", "acabado", "elijo", "eliges", "elige", "eligen", "elegí", "eligió", "elegido",
    "escojo", "escoges", "escoge", "escogen", "escogí", "escogió", "escogido", "espero", "esperas", "espera", "esperan", "esperé", "esperó", "esperado",
    "conduzco", "conduces", "conduce", "conducen", "conducía", "conduje", "condujo", "conducido", "manejo", "maneja", "manejan", "manejé", "manejado",
    "viajo", "viaja", "viajan", "viajé", "viajó", "viajado", "camino", "caminas", "camina", "caminan", "caminé", "caminó", "caminado",
    "corro", "corres", "corre", "corren", "corrí", "corrió", "corrido", "nado", "nadas", "nada", "nadan", "nadé", "nadó", "nadado",
    "vuelo", "vuelas", "vuela", "vuelan", "volé", "voló", "volado", "llamo", "llamas", "llama", "llaman", "llamé", "llamó", "llamado",
    "grito", "grita", "gritan", "grité", "gritado", "río", "ríes", "ríe", "ríen", "reí", "rio", "rieron", "reído",
    "sonrío", "sonríe", "sonríen", "sonreí", "sonrió", "sonreído", "lloro", "llora", "lloran", "lloré", "lloró", "llorado",
    "miento", "mientes", "miente", "mienten", "mentí", "mintió", "mentido", "siento", "sientes", "siente", "sienten", "sentí", "sintió", "sentido",
    "huelo", "huele", "huelen", "olí", "olió", "olido", "toco", "tocas", "toca", "tocan", "toqué", "tocó", "tocado",
    "corto", "cortas", "corta", "cortan", "corté", "cortó", "cortado", "rompo", "rompes", "rompe", "rompen", "rompí", "rompió", "roto",
    "lavo", "lavas", "lava", "lavan", "lavé", "lavó", "lavado", "limpio", "limpias", "limpia", "limpian", "limpié", "limpiado",
    "cocino", "cocina", "cocinan", "cociné", "cocinado", "pruebo", "pruebas", "prueba", "prueban", "probé", "probó", "probado",
    "olvido", "olvidas", "olvida", "olvidan", "olvidé", "olvidó", "olvidado", "recuerdo", "recuerdas", "recuerda", "recuerdan", "recordé", "recordó", "recordado",
    "sueño", "sueñas", "sueña", "sueñan", "soñé", "soñó", "soñado", "imagino", "imagina", "imaginan", "imaginé", "imaginado",
    "cuento", "cuentas", "cuenta", "cuentan", "conté", "contó", "contado", "noto", "notas", "nota", "notan", "noté", "notado",
    "acepto", "acepta", "aceptan", "acepté", "aceptado", "rechazo", "rechaza", "rechazan", "rechacé", "rechazado",
    "decido", "decides", "decide", "deciden", "decidí", "decidió", "decidido", "preparo", "prepara", "preparan", "preparé", "preparado",
    "organizo", "organiza", "organizan", "organicé", "organizado", "invito", "invita", "invitan", "invité", "invitado",
    "presento", "presenta", "presentan", "presenté", "presentado", "agradezco", "agradece", "agradecen", "agradecí", "agradeció", "agradecido",
    "felicito", "felicita", "felicitan", "felicité", "felicitado", "disculpo", "disculpa", "disculpan", "disculpé", "disculpado",
    "perdono", "perdona", "perdonan", "perdoné", "perdonado", "cumplo", "cumple", "cumplen", "cumplí", "cumplió", "cumplido",
    "permito", "permite", "permiten", "permití", "permitió", "permitido", "prohíbo", "prohíbe", "prohíben", "prohibí", "prohibió", "prohibido",
    "necesito", "necesitas", "necesita", "necesitan", "necesité", "necesitó", "necesitado", "gusto", "gusta", "gustan", "gustó",
    "encanta", "encantan", "encantó", "importa", "importan", "importó", "interesa", "interesan", "interesó",
    "duele", "duelen", "dolió", "falta", "faltan", "faltó", "sobra", "sobran", "sobró",
}


def load_freq(path):
    words = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if parts:
                words.append(parts[0].lower())
    return words


def load_zh_whitelist():
    """现代汉语白名单:从现有英语词库释义里抽中文词,用来过滤 CFDICT 的文言/方言头词。"""
    words = set()
    for path in glob.glob(os.path.join(DATA, "words_*.json")):
        if os.path.basename(path) in ("words_french.json", "words_spanish.json"):
            continue
        try:
            entries = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        for e in entries:
            meaning = e.get("meaning") or ""
            for token in re.split(r"[;,;、,()()\[\]【】\s…·/]+", meaning):
                token = token.strip()
                if token and re.fullmatch(r"[一-鿿]+", token):
                    words.add(token)
    return words


def build_french(whitelist):
    fr2zh = {}
    line_re = re.compile(r"^\S+ (\S+) \[[^\]]*\] /(.+)/$")
    with open(CFDICT_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            m = line_re.match(line.strip())
            if not m:
                continue
            zh, gloss_blob = m.group(1), m.group(2)
            if zh not in whitelist:
                continue  # 文言/方言/生僻头词不做释义
            for gloss in gloss_blob.split("/"):
                g = gloss.strip().lower()
                if not g or " " in g or g.startswith("(") or FR_BAD_GLOSS.search(g):
                    continue
                if not WORD_RE.match(g) or len(g) < 2:
                    continue
                bucket = fr2zh.setdefault(g, [])
                if zh not in bucket:
                    bucket.append(zh)
    out, seen = [], set()
    for raw in load_freq(FR_FREQ_PATH):
        if len(out) >= FRENCH_CAP:
            break
        # 词频表里的省音/切分残留先归一:"l'un"→un、"'je"→je(前/后带撇号都剥掉),
        # 然后对归一形式做去重/skip/override,避免 'je 与 je 重复入库。
        w = raw.strip("'")
        if "'" in w:
            w = w.split("'", 1)[1]
        if not w or w in seen:
            continue
        if w in FR_SKIP:
            seen.add(w)
            continue
        if w in FR_OVERRIDES:
            out.append({"word": w, "meaning": FR_OVERRIDES[w]})
            seen.add(w)
            continue
        if not WORD_RE.match(w) or len(w) < 2:
            continue
        zh = fr2zh.get(w)
        if not zh:
            continue
        seen.add(w)
        out.append({"word": w, "meaning": "、".join(zh[:3])})
    return out


def build_spanish():
    with open(ES_ZH_PATH, encoding="utf-8") as f:
        entries = json.load(f)
    es2entry = {}
    for e in entries:
        w = (e.get("word") or "").strip().lower()
        if w and w not in es2entry:
            es2entry[w] = e
    out, seen = [], set()
    for raw in load_freq(ES_FREQ_PATH):
        if len(out) >= SPANISH_CAP:
            break
        w = raw.strip("'")
        if not w or w in seen:
            continue
        if w in ES_SKIP:
            seen.add(w)
            continue
        if w in ES_OVERRIDES:
            out.append({"word": w, "meaning": ES_OVERRIDES[w]})
            seen.add(w)
            continue
        if not WORD_RE.match(w) or len(w) < 2:
            continue
        e = es2entry.get(w)
        if not e:
            continue
        meaning = e.get("meaning") or []
        pos_parts, gloss_parts = [], []
        for i in range(0, min(len(meaning), 4), 2):
            pos, gloss = meaning[i], meaning[i + 1] if i + 1 < len(meaning) else ""
            if pos and pos not in pos_parts:
                pos_parts.append(pos)
            if gloss and gloss not in gloss_parts:
                gloss_parts.append(re.sub(r"(?<=[一-鿿]),(?=[一-鿿])", "、", gloss))
        if not gloss_parts:
            continue
        seen.add(w)
        row = {"word": w, "meaning": "; ".join(gloss_parts[:2])}
        if pos_parts:
            row["pos"] = " ".join(pos_parts[:2])
        out.append(row)
    return out


def main():
    whitelist = load_zh_whitelist()
    print(f"现代汉语白名单: {len(whitelist)} 词")
    fr = build_french(whitelist)
    es = build_spanish()
    for name, rows in (("french", fr), ("spanish", es)):
        path = os.path.join(DATA, f"words_{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
        print(f"wrote {path}  ({len(rows)} words)")


if __name__ == "__main__":
    main()
