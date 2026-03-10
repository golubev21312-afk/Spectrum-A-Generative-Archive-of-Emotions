export type Lang = "ru" | "en";

const texts = {
  create: { ru: "Создать", en: "Create" },
  view: { ru: "Смотреть", en: "View" },
  params: { ru: "Параметры", en: "Parameters" },
  save: { ru: "Сохранить эмоцию", en: "Save Emotion" },
  saving: { ru: "Сохраняю...", en: "Saving..." },
  saved: { ru: "Сохранено", en: "Saved" },
  errorRetry: { ru: "Ошибка — повторить", en: "Error — retry" },
  next: { ru: "Следующая эмоция", en: "Next Emotion" },
  loading: { ru: "Загрузка...", en: "Loading..." },
  noEmotions: { ru: "Эмоций пока нет — создайте первую!", en: "No emotions yet — create one first!" },
  hue: { ru: "Оттенок", en: "Hue" },
  transparency: { ru: "Прозрачность", en: "Transparency" },
  rotation: { ru: "Вращение", en: "Rotation" },
  noise: { ru: "Шум", en: "Noise" },
  particles: { ru: "Частицы", en: "Particles" },
  hintHue: { ru: "Цвет куба — от красного до фиолетового", en: "Cube color — red to violet" },
  hintTransparency: { ru: "Насколько куб прозрачный", en: "How transparent the cube is" },
  hintRotation: { ru: "Скорость вращения куба", en: "Cube rotation speed" },
  hintNoise: { ru: "Искажение формы куба", en: "Cube shape distortion" },
  hintParticles: { ru: "Количество частиц вокруг", en: "Particle count around cube" },
  hintCreate: { ru: "Настройте параметры и сохраните вашу эмоцию", en: "Adjust parameters and save your emotion" },
  hintView: { ru: "Просматривайте случайные эмоции других людей", en: "Browse random emotions from others" },
  emotionLabel: { ru: "Эмоция", en: "Emotion" },
  auth: { ru: "Вход", en: "Auth" },
  login: { ru: "Войти", en: "Log in" },
  register: { ru: "Регистрация", en: "Register" },
  username: { ru: "Никнейм", en: "Username" },
  password: { ru: "Пароль", en: "Password" },
  logout: { ru: "Выйти", en: "Log out" },
  authError: { ru: "Ошибка авторизации", en: "Auth error" },
  usernameTaken: { ru: "Никнейм уже занят", en: "Username already taken" },
  invalidCredentials: { ru: "Неверный логин или пароль", en: "Invalid username or password" },
  registerSuccess: { ru: "Регистрация успешна! Войдите.", en: "Registered! Please log in." },
  loginRequired: { ru: "Войдите, чтобы сохранять эмоции", en: "Log in to save emotions" },
  author: { ru: "Автор", en: "Author" },
  anonymous: { ru: "Аноним", en: "Anonymous" },
  screenshot: { ru: "Скачать", en: "Screenshot" },
  feed: { ru: "Лента", en: "Feed" },
  feedHint: { ru: "Эмоции сообщества", en: "Community emotions" },
  sortNew: { ru: "Новые", en: "New" },
  sortPopular: { ru: "Популярные", en: "Popular" },
  allEmotions: { ru: "Все эмоции", en: "All emotions" },
  searchAuthor: { ru: "Автор...", en: "Author..." },
  likes: { ru: "лайков", en: "likes" },
  like: { ru: "Нравится", en: "Like" },
  liked: { ru: "Понравилось", en: "Liked" },
  share: { ru: "Поделиться", en: "Share" },
  copied: { ru: "Ссылка скопирована", en: "Link copied" },
  profile: { ru: "Профиль", en: "Profile" },
  emotions: { ru: "эмоций", en: "emotions" },
  joined: { ru: "Зарегистрирован", en: "Joined" },
  loadMore: { ru: "Показать ещё", en: "Load more" },
  notFound: { ru: "Не найдено", en: "Not found" },
  loginToLike: { ru: "Войдите чтобы ставить лайки", en: "Log in to like" },
  backToFeed: { ru: "← Лента", en: "← Feed" },
  onboardTitle: { ru: "Добро пожаловать в Spectrum", en: "Welcome to Spectrum" },
  onboardText: { ru: "Двигайте слайдеры — куб меняет форму и цвет.\nКогда почувствуете нужное — сохраните эмоцию.", en: "Move the sliders — the cube changes shape and color.\nWhen it feels right — save your emotion." },
  onboardOk: { ru: "Понятно", en: "Got it" },
  feedEmptyTitle: { ru: "Пока тихо", en: "Still quiet here" },
  feedEmptyText: { ru: "Станьте первым — создайте свою эмоцию", en: "Be the first — create your emotion" },
  feedEmptyAction: { ru: "Создать эмоцию →", en: "Create emotion →" },
  notifications: { ru: "Уведомления", en: "Notifications" },
  noNotifications: { ru: "Пока ничего нет", en: "Nothing yet" },
  markRead: { ru: "Отметить все прочитанными", en: "Mark all as read" },
  notifLiked: { ru: "оценил вашу эмоцию", en: "liked your emotion" },
  notifCommented: { ru: "прокомментировал вашу эмоцию", en: "commented on your emotion" },
  comments: { ru: "Комментарии", en: "Comments" },
  noComments: { ru: "Комментариев пока нет", en: "No comments yet" },
  commentPlaceholder: { ru: "Напишите комментарий...", en: "Write a comment..." },
  loginToComment: { ru: "Войдите чтобы комментировать", en: "Log in to comment" },
  send: { ru: "Отправить", en: "Send" },
  follow: { ru: "Подписаться", en: "Follow" },
  unfollow: { ru: "Отписаться", en: "Unfollow" },
  followers: { ru: "подписчиков", en: "followers" },
  following: { ru: "подписок", en: "following" },
  followingFeed: { ru: "Подписки", en: "Following" },
  likedTab: { ru: "Лайки", en: "Liked" },
  myEmotions: { ru: "Эмоции", en: "Emotions" },
  clone: { ru: "Клонировать", en: "Clone" },
  views: { ru: "просмотров", en: "views" },
  deleteEmotion: { ru: "Удалить", en: "Delete" },
  confirmDelete: { ru: "Удалить эту эмоцию?", en: "Delete this emotion?" },
  search: { ru: "Поиск...", en: "Search..." },
  sortTrending: { ru: "Трендовые", en: "Trending" },
  todayTop: { ru: "Сегодня в топе", en: "Today's top" },
  bio: { ru: "О себе", en: "Bio" },
  bioPlaceholder: { ru: "Расскажите о себе (до 160 символов)", en: "Tell about yourself (up to 160 chars)" },
  saveBio: { ru: "Сохранить", en: "Save" },
  exportJson: { ru: "Экспорт JSON", en: "Export JSON" },
  editType: { ru: "Изменить тип", en: "Edit type" },
  autoPlay: { ru: "Авто", en: "Auto" },
  autoStop: { ru: "Стоп", en: "Stop" },
  nextIn: { ru: "Следующая через", en: "Next in" },
  followersTab: { ru: "Подписчики", en: "Followers" },
  followingTab: { ru: "Подписки", en: "Following" },
  mute: { ru: "Звук выкл", en: "Mute" },
  unmute: { ru: "Звук вкл", en: "Unmute" },
} as const;

interface EmotionRule {
  ru: string;
  en: string;
  test: (p: Record<string, number>) => boolean;
}

const EMOTION_RULES: EmotionRule[] = [
  { ru: "Ярость", en: "Rage", test: p => p.hue < 30 && p.noiseAmplitude > 1 && p.rotationSpeed > 3 },
  { ru: "Страсть", en: "Passion", test: p => p.hue < 30 && p.rotationSpeed > 1.5 },
  { ru: "Тревога", en: "Anxiety", test: p => p.noiseAmplitude > 1.2 && p.rotationSpeed > 2.5 },
  { ru: "Энергия", en: "Energy", test: p => p.hue >= 30 && p.hue < 70 && p.rotationSpeed > 2 },
  { ru: "Радость", en: "Joy", test: p => p.hue >= 40 && p.hue < 80 && p.particleDensity > 250 },
  { ru: "Надежда", en: "Hope", test: p => p.hue >= 80 && p.hue < 160 && p.transparency < 0.3 },
  { ru: "Спокойствие", en: "Calm", test: p => p.hue >= 140 && p.hue < 220 && p.rotationSpeed < 1 && p.noiseAmplitude < 0.5 },
  { ru: "Меланхолия", en: "Melancholy", test: p => p.hue >= 200 && p.hue < 270 && p.transparency > 0.5 },
  { ru: "Грусть", en: "Sadness", test: p => p.hue >= 200 && p.hue < 270 && p.particleDensity < 100 },
  { ru: "Мистика", en: "Mystery", test: p => p.hue >= 270 && p.hue < 320 && p.noiseAmplitude > 0.8 },
  { ru: "Нежность", en: "Tenderness", test: p => p.hue >= 300 && p.transparency > 0.4 && p.rotationSpeed < 1.5 },
  { ru: "Пустота", en: "Emptiness", test: p => p.transparency > 0.7 && p.particleDensity < 50 },
  { ru: "Хаос", en: "Chaos", test: p => p.noiseAmplitude > 1.5 && p.particleDensity > 350 },
  { ru: "Гармония", en: "Harmony", test: p => p.rotationSpeed > 0.5 && p.rotationSpeed < 2 && p.noiseAmplitude < 0.6 && p.transparency < 0.4 },
  { ru: "Созерцание", en: "Contemplation", test: p => p.rotationSpeed < 0.5 },
];

const DEFAULT_EMOTION = { ru: "Безмятежность", en: "Serenity" };

export function detectEmotion(params: Record<string, number>): string {
  for (const rule of EMOTION_RULES) {
    if (rule.test(params)) return rule[current];
  }
  return DEFAULT_EMOTION[current];
}

type Key = keyof typeof texts;

let current: Lang = (localStorage.getItem("lang") as Lang) || "ru";

export function t(key: Key): string {
  return texts[key][current];
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  localStorage.setItem("lang", lang);
}
