/* ==========================================================================
 * Динамика прогноза погоды — Frontend-only MVP
 *
 * Один запрос к Open-Meteo Previous Model Runs API приносит сразу всё:
 * 10 суток × 24 часа × 4 показателя × 8 обновлений прогноза (~40 КБ).
 * Дальше переключение дат, часов, языка и единиц идёт мгновенно, из памяти.
 *
 * Термин: «обновление прогноза» — это один расчёт модели на заданный час.
 * Модель пересчитывает прогноз каждые сутки, поэтому на один и тот же час
 * есть 8 разных ответов: сегодняшний и семь предыдущих.
 * ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
 * 1. Источники данных
 * ----------------------------------------------------------------------- */

/** Название продукта не переводится — это бренд; переводится только подзаголовок. */
const APP_NAME = 'Meteo Dynamics';

const API_FORECAST = 'https://previous-runs-api.open-meteo.com/v1/forecast';
const API_GEOCODE  = 'https://geocoding-api.open-meteo.com/v1/search';
const API_REVERSE  = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const RUNS = [0, 1, 2, 3, 4, 5, 6, 7];
const PAST_DAYS = 2;
const FCST_DAYS = 8;

/* --------------------------------------------------------------------------
 * 2. Языки
 * ----------------------------------------------------------------------- */

const LANG_NAMES = {
  en: 'English',  ru: 'Русский',   uk: 'Українська', de: 'Deutsch',
  fr: 'Français', es: 'Español',   pt: 'Português',  it: 'Italiano',
  pl: 'Polski',   lv: 'Latviešu',  lt: 'Lietuvių',   et: 'Eesti',
  tr: 'Türkçe',   zh: '中文',       ja: '日本語',      ar: 'العربية',
};

const RTL = new Set(['ar']);

/**
 * Языки, где подзаголовок после тире принято начинать со строчной.
 * В английском и немецком так делать нельзя: «Track how…» и слова
 * с заглавной там уместны, а в немецком существительные обязаны быть
 * с большой буквы. Поэтому список явный, а не «понижать везде».
 */
const LOWER_AFTER_DASH = new Set(['ru', 'uk']);

/** Язык по стране, определённой геолокацией. */
const COUNTRY_LANG = {
  RU:'ru', BY:'ru', KZ:'ru', KG:'ru', TJ:'ru', UZ:'ru', MD:'ru',
  UA:'uk', LV:'lv', LT:'lt', EE:'et',
  DE:'de', AT:'de', CH:'de', LI:'de',
  FR:'fr', BE:'fr', LU:'fr', MC:'fr',
  ES:'es', MX:'es', AR:'es', CL:'es', CO:'es', PE:'es', VE:'es', UY:'es', CU:'es',
  PT:'pt', BR:'pt', AO:'pt', MZ:'pt',
  IT:'it', SM:'it', VA:'it',
  PL:'pl', TR:'tr',
  CN:'zh', TW:'zh', HK:'zh', MO:'zh', SG:'zh',
  JP:'ja',
  SA:'ar', AE:'ar', EG:'ar', MA:'ar', DZ:'ar', TN:'ar', IQ:'ar', JO:'ar',
  KW:'ar', QA:'ar', OM:'ar', BH:'ar', LY:'ar', SY:'ar', YE:'ar', LB:'ar',
};

const T = {
  ru: {
    skipLink:'Перейти к прогнозу', detectBtn:'Определить моё местоположение', detecting:'Определяем…',
    findCity:'Найти город', searchPh:'Начните вводить название…', nothingFound:'Ничего не найдено',
    searchOff:'Поиск недоступен', quickPick:'Быстрый выбор', language:'Язык', units:'Единицы',
    loading:'Загружаем прогноз…', loadErr:'Не удалось загрузить данные', retry:'Повторить',
    noData:'Нет данных', theme:'Тема оформления',
    tempName:'Температура', cloudName:'Облачность', precName:'Осадки', windName:'Ветер',
    tempShort:'Темп.', cloudShort:'Облачность', precShort:'Осадки', windShort:'Ветер',
    legendTitle:'Как читать',
    legendRange:'верхнее число — минимум, нижнее — максимум среди всех обновлений прогноза на этот час. Стрелка — куда сместился прогноз от самого раннего обновления к свежему.',
    legendTap:'Нажмите на час — раскроются графики: как менялся прогноз день за днём.',
    spreadMost:'{m}: наибольший разброс — {v} {u} по {n} обновлениям.',
    spreadSame:'Все обновления вернули одинаковые значения. Для дальних дат это значит, что независимых прогнозов ещё нет — сравнивать пока не с чем.',
    fcFrom:'Прогноз от {d}', fcNow:'Актуальный прогноз',
    atLeastOne:'Хотя бы один показатель должен остаться',
    geoDenied:'Доступ к геолокации отклонён — выберите город вручную',
    geoFail:'Не удалось определить местоположение',
    geoInsecure:'Автоопределение требует https или localhost',
    geoNone:'Браузер не поддерживает геолокацию',
    byDefault:'по умолчанию', autoDetected:'определено автоматически',
    unitTemp:'Температура', unitWind:'Ветер', unitPrec:'Осадки',
    uKmh:'км/ч', uMs:'м/с', uMph:'миль/ч', uKn:'узлы', uMm:'мм', uIn:'дюймы',
    settings:'Настройки',
    themeAuto:'Как в системе',
    themeLight:'Светлая',
    themeDark:'Тёмная',
    share:'Поделиться',
    shareCopied:'Ссылка скопирована',
    installTitle:'Добавить на главный экран',
    installBtn:'Добавить',
    installHowIOS:'Нажмите «Поделиться» в панели браузера, затем «На экран „Домой“».',
    installHowOther:'Откройте меню браузера и выберите «Установить приложение».',
    installLeft:'Напоминание {n} из 5 — потом исчезнет',
    tagline:'Как меняется прогноз погоды',
    metaDescr:'Как менялся прогноз на каждый час за последние восемь обновлений модели: разброс, тренд и графики. Данные Open-Meteo, работает целиком в браузере.',
    shareText:'Показывает разброс между обновлениями модели на каждый час — видно динамику прогноза.',
    src:'Данные: Open-Meteo, CC BY 4.0. Работает полностью в браузере, без сервера.',
  },
  en: {
    skipLink:'Skip to forecast', detectBtn:'Detect my location', detecting:'Detecting…',
    findCity:'Find a city', searchPh:'Start typing a name…', nothingFound:'Nothing found',
    searchOff:'Search unavailable', quickPick:'Quick pick', language:'Language', units:'Units',
    loading:'Loading forecast…', loadErr:'Could not load data', retry:'Retry',
    noData:'No data', theme:'Colour theme',
    tempName:'Temperature', cloudName:'Cloud cover', precName:'Precipitation', windName:'Wind',
    tempShort:'Temp.', cloudShort:'Cloud', precShort:'Precip.', windShort:'Wind',
    legendTitle:'How to read this',
    legendRange:'the upper number is the lowest value, the lower one the highest, across every forecast update for that hour. The arrow shows which way the forecast moved from the earliest update to the latest.',
    legendTap:'Tap an hour to open the charts: how the prediction changed day by day.',
    spreadMost:'{m}: widest spread — {v} {u} across {n} updates.',
    spreadSame:'Every update returned identical values. For distant dates that means there are no independent forecasts yet — nothing to compare.',
    fcFrom:'Forecast from {d}', fcNow:'Latest forecast',
    atLeastOne:'At least one metric must stay on',
    geoDenied:'Location access denied — pick a city manually',
    geoFail:'Could not determine your location',
    geoInsecure:'Auto-detect needs https or localhost',
    geoNone:'This browser has no geolocation',
    byDefault:'default', autoDetected:'detected automatically',
    unitTemp:'Temperature', unitWind:'Wind', unitPrec:'Precipitation',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'kn', uMm:'mm', uIn:'in',
    settings:'Settings',
    themeAuto:'System',
    themeLight:'Light',
    themeDark:'Dark',
    share:'Share',
    shareCopied:'Link copied',
    installTitle:'Add to home screen',
    installBtn:'Add',
    installHowIOS:'Tap Share in the browser bar, then “Add to Home Screen”.',
    installHowOther:'Open your browser menu and choose “Install app”.',
    installLeft:'Reminder {n} of 5 — then it stops',
    tagline:'Track how weather forecasts change',
    metaDescr:'See how the forecast for each hour changed across the last eight model updates: spread, trend and charts. Open-Meteo data, runs entirely in your browser.',
    shareText:'Shows the spread between model updates for every hour — you can see the forecast dynamics.',
    src:'Data: Open-Meteo, CC BY 4.0. Runs entirely in the browser, no server.',
  },
  uk: {
    skipLink:'Перейти до прогнозу', detectBtn:'Визначити моє місцезнаходження', detecting:'Визначаємо…',
    findCity:'Знайти місто', searchPh:'Почніть вводити назву…', nothingFound:'Нічого не знайдено',
    searchOff:'Пошук недоступний', quickPick:'Швидкий вибір', language:'Мова', units:'Одиниці',
    loading:'Завантажуємо прогноз…', loadErr:'Не вдалося завантажити дані', retry:'Повторити',
    noData:'Немає даних', theme:'Тема оформлення',
    tempName:'Температура', cloudName:'Хмарність', precName:'Опади', windName:'Вітер',
    tempShort:'Темп.', cloudShort:'Хмарність', precShort:'Опади', windShort:'Вітер',
    legendTitle:'Як читати',
    legendRange:'верхнє число — мінімум, нижнє — максимум серед усіх оновлень прогнозу на цю годину. Стрілка — куди змістився прогноз від найранішого оновлення до свіжого.',
    legendTap:'Натисніть на годину — розкриються графіки: як змінювався прогноз день за днем.',
    spreadMost:'{m}: найбільший розкид — {v} {u} за {n} оновленнями.',
    spreadSame:'Усі оновлення повернули однакові значення. Для віддалених дат це означає, що незалежних прогнозів ще немає — порівнювати нема з чим.',
    fcFrom:'Прогноз від {d}', fcNow:'Актуальний прогноз',
    atLeastOne:'Хоча б один показник має залишитися',
    geoDenied:'Доступ до геолокації відхилено — оберіть місто вручну',
    geoFail:'Не вдалося визначити місцезнаходження',
    geoInsecure:'Автовизначення потребує https або localhost',
    geoNone:'Браузер не підтримує геолокацію',
    byDefault:'за замовчуванням', autoDetected:'визначено автоматично',
    unitTemp:'Температура', unitWind:'Вітер', unitPrec:'Опади',
    uKmh:'км/год', uMs:'м/с', uMph:'миль/год', uKn:'вузли', uMm:'мм', uIn:'дюйми',
    settings:'Налаштування',
    themeAuto:'Як у системі',
    themeLight:'Світла',
    themeDark:'Темна',
    share:'Поділитися',
    shareCopied:'Посилання скопійовано',
    installTitle:'Додати на головний екран',
    installBtn:'Додати',
    installHowIOS:'Натисніть «Поділитися» на панелі браузера, потім «На екран „Домівка“».',
    installHowOther:'Відкрийте меню браузера та виберіть «Встановити застосунок».',
    installLeft:'Нагадування {n} з 5 — потім зникне',
    tagline:'Як змінюється прогноз погоди',
    metaDescr:'Як змінювався прогноз на кожну годину за останні вісім оновлень моделі: розкид, тренд і графіки. Дані Open-Meteo, працює повністю у браузері.',
    shareText:'Показує розкид між оновленнями моделі на кожну годину — видно динаміку прогнозу.',
    src:'Дані: Open-Meteo, CC BY 4.0. Працює повністю у браузері, без сервера.',
  },
  de: {
    skipLink:'Zur Vorhersage springen', detectBtn:'Meinen Standort ermitteln', detecting:'Wird ermittelt…',
    findCity:'Stadt suchen', searchPh:'Namen eingeben…', nothingFound:'Nichts gefunden',
    searchOff:'Suche nicht verfügbar', quickPick:'Schnellauswahl', language:'Sprache', units:'Einheiten',
    loading:'Vorhersage wird geladen…', loadErr:'Daten konnten nicht geladen werden', retry:'Erneut versuchen',
    noData:'Keine Daten', theme:'Farbschema',
    tempName:'Temperatur', cloudName:'Bewölkung', precName:'Niederschlag', windName:'Wind',
    tempShort:'Temp.', cloudShort:'Wolken', precShort:'Nieder.', windShort:'Wind',
    legendTitle:'So liest man das',
    legendRange:'die obere Zahl ist der niedrigste, die untere der höchste Wert über alle Vorhersage-Aktualisierungen für diese Stunde. Der Pfeil zeigt, wohin sich die Vorhersage von der ältesten zur neuesten Aktualisierung bewegt hat.',
    legendTap:'Auf eine Stunde tippen — dann öffnen sich die Diagramme: wie sich die Vorhersage Tag für Tag verändert hat.',
    spreadMost:'{m}: größte Spannweite — {v} {u} über {n} Aktualisierungen.',
    spreadSame:'Alle Aktualisierungen lieferten identische Werte. Bei weit entfernten Terminen heißt das: Es gibt noch keine unabhängigen Vorhersagen — nichts zu vergleichen.',
    fcFrom:'Vorhersage vom {d}', fcNow:'Aktuelle Vorhersage',
    atLeastOne:'Mindestens ein Wert muss aktiv bleiben',
    geoDenied:'Standortzugriff verweigert — Stadt manuell wählen',
    geoFail:'Standort konnte nicht ermittelt werden',
    geoInsecure:'Automatische Ortung benötigt https oder localhost',
    geoNone:'Browser unterstützt keine Geolokalisierung',
    byDefault:'Standard', autoDetected:'automatisch ermittelt',
    unitTemp:'Temperatur', unitWind:'Wind', unitPrec:'Niederschlag',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'kn', uMm:'mm', uIn:'in',
    settings:'Einstellungen',
    themeAuto:'System',
    themeLight:'Hell',
    themeDark:'Dunkel',
    share:'Teilen',
    shareCopied:'Link kopiert',
    installTitle:'Zum Startbildschirm hinzufügen',
    installBtn:'Hinzufügen',
    installHowIOS:'Tippen Sie in der Browserleiste auf „Teilen“ und dann auf „Zum Home-Bildschirm“.',
    installHowOther:'Öffnen Sie das Browsermenü und wählen Sie „App installieren“.',
    installLeft:'Hinweis {n} von 5 — danach nicht mehr',
    tagline:'Wie sich Wettervorhersagen ändern',
    metaDescr:'Wie sich die Vorhersage für jede Stunde über die letzten acht Modell-Aktualisierungen verändert hat: Spannweite, Trend und Diagramme. Open-Meteo-Daten, läuft komplett im Browser.',
    shareText:'Zeigt die Spannweite zwischen Modell-Aktualisierungen für jede Stunde und damit die Dynamik der Vorhersage.',
    src:'Daten: Open-Meteo, CC BY 4.0. Läuft vollständig im Browser, ohne Server.',
  },
  fr: {
    skipLink:'Aller aux prévisions', detectBtn:'Détecter ma position', detecting:'Détection…',
    findCity:'Chercher une ville', searchPh:'Commencez à saisir…', nothingFound:'Aucun résultat',
    searchOff:'Recherche indisponible', quickPick:'Choix rapide', language:'Langue', units:'Unités',
    loading:'Chargement des prévisions…', loadErr:'Impossible de charger les données', retry:'Réessayer',
    noData:'Aucune donnée', theme:'Thème',
    tempName:'Température', cloudName:'Nébulosité', precName:'Précipitations', windName:'Vent',
    tempShort:'Temp.', cloudShort:'Nuages', precShort:'Précip.', windShort:'Vent',
    legendTitle:'Comment lire',
    legendRange:'le chiffre du haut est la valeur la plus basse, celui du bas la plus haute, parmi toutes les mises à jour de prévision pour cette heure. La flèche indique le sens du déplacement de la prévision, de la plus ancienne mise à jour à la plus récente.',
    legendTap:'Touchez une heure pour ouvrir les graphiques : comment la prévision a évolué jour après jour.',
    spreadMost:'{m} : plus grand écart — {v} {u} sur {n} mises à jour.',
    spreadSame:'Toutes les mises à jour ont renvoyé des valeurs identiques. Pour les dates lointaines, cela signifie qu’il n’existe pas encore de prévisions indépendantes — rien à comparer.',
    fcFrom:'Prévision du {d}', fcNow:'Prévision actuelle',
    atLeastOne:'Au moins un paramètre doit rester actif',
    geoDenied:'Accès à la position refusé — choisissez une ville',
    geoFail:'Impossible de déterminer la position',
    geoInsecure:'La détection nécessite https ou localhost',
    geoNone:'Ce navigateur ne gère pas la géolocalisation',
    byDefault:'par défaut', autoDetected:'détecté automatiquement',
    unitTemp:'Température', unitWind:'Vent', unitPrec:'Précipitations',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'nœuds', uMm:'mm', uIn:'po',
    settings:'Réglages',
    themeAuto:'Système',
    themeLight:'Clair',
    themeDark:'Sombre',
    share:'Partager',
    shareCopied:'Lien copié',
    installTitle:'Ajouter à l’écran d’accueil',
    installBtn:'Ajouter',
    installHowIOS:'Touchez « Partager » dans la barre du navigateur, puis « Sur l’écran d’accueil ».',
    installHowOther:'Ouvrez le menu du navigateur et choisissez « Installer l’application ».',
    installLeft:'Rappel {n} sur 5 — puis il disparaît',
    tagline:'Comment les prévisions météo évoluent',
    metaDescr:'Comment la prévision de chaque heure a évolué sur les huit dernières mises à jour du modèle : écart, tendance et graphiques. Données Open-Meteo, tout se passe dans le navigateur.',
    shareText:'Montre l’écart entre les mises à jour du modèle pour chaque heure — la dynamique de la prévision devient visible.',
    src:'Données : Open-Meteo, CC BY 4.0. Fonctionne entièrement dans le navigateur.',
  },
  es: {
    skipLink:'Ir al pronóstico', detectBtn:'Detectar mi ubicación', detecting:'Detectando…',
    findCity:'Buscar ciudad', searchPh:'Empiece a escribir…', nothingFound:'Sin resultados',
    searchOff:'Búsqueda no disponible', quickPick:'Selección rápida', language:'Idioma', units:'Unidades',
    loading:'Cargando pronóstico…', loadErr:'No se pudieron cargar los datos', retry:'Reintentar',
    noData:'Sin datos', theme:'Tema',
    tempName:'Temperatura', cloudName:'Nubosidad', precName:'Precipitación', windName:'Viento',
    tempShort:'Temp.', cloudShort:'Nubes', precShort:'Precip.', windShort:'Viento',
    legendTitle:'Cómo leerlo',
    legendRange:'el número de arriba es el valor mínimo y el de abajo el máximo entre todas las actualizaciones del pronóstico para esa hora. La flecha indica hacia dónde se movió el pronóstico desde la actualización más antigua hasta la más reciente.',
    legendTap:'Toque una hora para abrir los gráficos: cómo cambió la predicción día a día.',
    spreadMost:'{m}: mayor dispersión — {v} {u} en {n} actualizaciones.',
    spreadSame:'Todas las actualizaciones devolvieron valores idénticos. En fechas lejanas eso significa que aún no hay pronósticos independientes — nada que comparar.',
    fcFrom:'Pronóstico del {d}', fcNow:'Pronóstico actual',
    atLeastOne:'Debe quedar al menos un indicador',
    geoDenied:'Acceso a la ubicación denegado — elija una ciudad',
    geoFail:'No se pudo determinar la ubicación',
    geoInsecure:'La detección requiere https o localhost',
    geoNone:'El navegador no admite geolocalización',
    byDefault:'por defecto', autoDetected:'detectado automáticamente',
    unitTemp:'Temperatura', unitWind:'Viento', unitPrec:'Precipitación',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'nudos', uMm:'mm', uIn:'pulg',
    settings:'Ajustes',
    themeAuto:'Sistema',
    themeLight:'Claro',
    themeDark:'Oscuro',
    share:'Compartir',
    shareCopied:'Enlace copiado',
    installTitle:'Añadir a la pantalla de inicio',
    installBtn:'Añadir',
    installHowIOS:'Toque «Compartir» en la barra del navegador y luego «Añadir a pantalla de inicio».',
    installHowOther:'Abra el menú del navegador y elija «Instalar aplicación».',
    installLeft:'Aviso {n} de 5 — después desaparece',
    tagline:'Cómo cambian las previsiones del tiempo',
    metaDescr:'Cómo cambió la previsión de cada hora en las últimas ocho actualizaciones del modelo: dispersión, tendencia y gráficos. Datos de Open-Meteo, funciona íntegramente en el navegador.',
    shareText:'Muestra la dispersión entre actualizaciones del modelo para cada hora — se ve la dinámica de la previsión.',
    src:'Datos: Open-Meteo, CC BY 4.0. Funciona íntegramente en el navegador.',
  },
  pt: {
    skipLink:'Ir para a previsão', detectBtn:'Detectar a minha localização', detecting:'A detectar…',
    findCity:'Procurar cidade', searchPh:'Comece a escrever…', nothingFound:'Nada encontrado',
    searchOff:'Pesquisa indisponível', quickPick:'Escolha rápida', language:'Idioma', units:'Unidades',
    loading:'A carregar a previsão…', loadErr:'Não foi possível carregar os dados', retry:'Tentar de novo',
    noData:'Sem dados', theme:'Tema',
    tempName:'Temperatura', cloudName:'Nebulosidade', precName:'Precipitação', windName:'Vento',
    tempShort:'Temp.', cloudShort:'Nuvens', precShort:'Precip.', windShort:'Vento',
    legendTitle:'Como ler',
    legendRange:'o número de cima é o valor mínimo e o de baixo o máximo entre todas as atualizações da previsão para aquela hora. A seta mostra para onde a previsão se moveu, da atualização mais antiga para a mais recente.',
    legendTap:'Toque numa hora para abrir os gráficos: como a previsão mudou dia após dia.',
    spreadMost:'{m}: maior dispersão — {v} {u} em {n} atualizações.',
    spreadSame:'Todas as atualizações devolveram valores idênticos. Em datas distantes isso significa que ainda não há previsões independentes — nada a comparar.',
    fcFrom:'Previsão de {d}', fcNow:'Previsão atual',
    atLeastOne:'Pelo menos um indicador deve permanecer',
    geoDenied:'Acesso à localização negado — escolha uma cidade',
    geoFail:'Não foi possível determinar a localização',
    geoInsecure:'A deteção requer https ou localhost',
    geoNone:'O navegador não suporta geolocalização',
    byDefault:'predefinido', autoDetected:'detetado automaticamente',
    unitTemp:'Temperatura', unitWind:'Vento', unitPrec:'Precipitação',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'nós', uMm:'mm', uIn:'pol',
    settings:'Definições',
    themeAuto:'Sistema',
    themeLight:'Claro',
    themeDark:'Escuro',
    share:'Partilhar',
    shareCopied:'Ligação copiada',
    installTitle:'Adicionar ao ecrã principal',
    installBtn:'Adicionar',
    installHowIOS:'Toque em «Partilhar» na barra do navegador e depois em «Adicionar ao ecrã principal».',
    installHowOther:'Abra o menu do navegador e escolha «Instalar aplicação».',
    installLeft:'Aviso {n} de 5 — depois desaparece',
    tagline:'Como mudam as previsões do tempo',
    metaDescr:'Como a previsão de cada hora mudou nas últimas oito atualizações do modelo: dispersão, tendência e gráficos. Dados Open-Meteo, funciona inteiramente no navegador.',
    shareText:'Mostra a dispersão entre atualizações do modelo para cada hora — vê-se a dinâmica da previsão.',
    src:'Dados: Open-Meteo, CC BY 4.0. Funciona inteiramente no navegador.',
  },
  it: {
    skipLink:'Vai alle previsioni', detectBtn:'Rileva la mia posizione', detecting:'Rilevamento…',
    findCity:'Cerca città', searchPh:'Inizia a digitare…', nothingFound:'Nessun risultato',
    searchOff:'Ricerca non disponibile', quickPick:'Scelta rapida', language:'Lingua', units:'Unità',
    loading:'Caricamento previsioni…', loadErr:'Impossibile caricare i dati', retry:'Riprova',
    noData:'Nessun dato', theme:'Tema',
    tempName:'Temperatura', cloudName:'Nuvolosità', precName:'Precipitazioni', windName:'Vento',
    tempShort:'Temp.', cloudShort:'Nuvole', precShort:'Precip.', windShort:'Vento',
    legendTitle:'Come leggere',
    legendRange:'il numero in alto è il valore minimo, quello in basso il massimo fra tutti gli aggiornamenti della previsione per quell’ora. La freccia indica in che direzione si è spostata la previsione dall’aggiornamento più vecchio a quello più recente.',
    legendTap:'Tocca un’ora per aprire i grafici: come è cambiata la previsione giorno dopo giorno.',
    spreadMost:'{m}: massima escursione — {v} {u} su {n} aggiornamenti.',
    spreadSame:'Tutti gli aggiornamenti hanno restituito valori identici. Per date lontane significa che non ci sono ancora previsioni indipendenti — nulla da confrontare.',
    fcFrom:'Previsione del {d}', fcNow:'Previsione attuale',
    atLeastOne:'Almeno un indicatore deve restare attivo',
    geoDenied:'Accesso alla posizione negato — scegli una città',
    geoFail:'Impossibile determinare la posizione',
    geoInsecure:'Il rilevamento richiede https o localhost',
    geoNone:'Il browser non supporta la geolocalizzazione',
    byDefault:'predefinito', autoDetected:'rilevato automaticamente',
    unitTemp:'Temperatura', unitWind:'Vento', unitPrec:'Precipitazioni',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'nodi', uMm:'mm', uIn:'poll',
    settings:'Impostazioni',
    themeAuto:'Sistema',
    themeLight:'Chiaro',
    themeDark:'Scuro',
    share:'Condividi',
    shareCopied:'Link copiato',
    installTitle:'Aggiungi alla schermata Home',
    installBtn:'Aggiungi',
    installHowIOS:'Tocca «Condividi» nella barra del browser, poi «Aggiungi a Home».',
    installHowOther:'Apri il menu del browser e scegli «Installa app».',
    installLeft:'Promemoria {n} di 5 — poi sparisce',
    tagline:'Come cambiano le previsioni meteo',
    metaDescr:'Come è cambiata la previsione di ogni ora negli ultimi otto aggiornamenti del modello: escursione, tendenza e grafici. Dati Open-Meteo, funziona interamente nel browser.',
    shareText:'Mostra l’escursione tra gli aggiornamenti del modello per ogni ora — si vede la dinamica della previsione.',
    src:'Dati: Open-Meteo, CC BY 4.0. Funziona interamente nel browser.',
  },
  pl: {
    skipLink:'Przejdź do prognozy', detectBtn:'Wykryj moją lokalizację', detecting:'Wykrywanie…',
    findCity:'Znajdź miasto', searchPh:'Zacznij wpisywać nazwę…', nothingFound:'Nic nie znaleziono',
    searchOff:'Wyszukiwanie niedostępne', quickPick:'Szybki wybór', language:'Język', units:'Jednostki',
    loading:'Ładowanie prognozy…', loadErr:'Nie udało się wczytać danych', retry:'Ponów',
    noData:'Brak danych', theme:'Motyw',
    tempName:'Temperatura', cloudName:'Zachmurzenie', precName:'Opady', windName:'Wiatr',
    tempShort:'Temp.', cloudShort:'Chmury', precShort:'Opady', windShort:'Wiatr',
    legendTitle:'Jak to czytać',
    legendRange:'górna liczba to wartość najniższa, dolna najwyższa spośród wszystkich aktualizacji prognozy na tę godzinę. Strzałka pokazuje, w którą stronę przesunęła się prognoza od najstarszej aktualizacji do najnowszej.',
    legendTap:'Dotknij godziny, aby otworzyć wykresy: jak prognoza zmieniała się dzień po dniu.',
    spreadMost:'{m}: największy rozrzut — {v} {u} w {n} aktualizacjach.',
    spreadSame:'Wszystkie aktualizacje zwróciły identyczne wartości. Dla odległych dat oznacza to, że nie ma jeszcze niezależnych prognoz — nie ma czego porównywać.',
    fcFrom:'Prognoza z {d}', fcNow:'Aktualna prognoza',
    atLeastOne:'Przynajmniej jeden wskaźnik musi zostać',
    geoDenied:'Odmowa dostępu do lokalizacji — wybierz miasto',
    geoFail:'Nie udało się ustalić lokalizacji',
    geoInsecure:'Wykrywanie wymaga https lub localhost',
    geoNone:'Przeglądarka nie obsługuje geolokalizacji',
    byDefault:'domyślnie', autoDetected:'wykryto automatycznie',
    unitTemp:'Temperatura', unitWind:'Wiatr', unitPrec:'Opady',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'węzły', uMm:'mm', uIn:'cale',
    settings:'Ustawienia',
    themeAuto:'Systemowy',
    themeLight:'Jasny',
    themeDark:'Ciemny',
    share:'Udostępnij',
    shareCopied:'Skopiowano link',
    installTitle:'Dodaj do ekranu głównego',
    installBtn:'Dodaj',
    installHowIOS:'Naciśnij „Udostępnij” na pasku przeglądarki, a potem „Do ekranu początkowego”.',
    installHowOther:'Otwórz menu przeglądarki i wybierz „Zainstaluj aplikację”.',
    installLeft:'Przypomnienie {n} z 5 — potem zniknie',
    tagline:'Jak zmieniają się prognozy pogody',
    metaDescr:'Jak zmieniała się prognoza na każdą godzinę w ostatnich ośmiu aktualizacjach modelu: rozrzut, trend i wykresy. Dane Open-Meteo, działa w całości w przeglądarce.',
    shareText:'Pokazuje rozrzut między aktualizacjami modelu dla każdej godziny — widać dynamikę prognozy.',
    src:'Dane: Open-Meteo, CC BY 4.0. Działa w całości w przeglądarce.',
  },
  lv: {
    skipLink:'Pāriet uz prognozi', detectBtn:'Noteikt manu atrašanās vietu', detecting:'Nosaka…',
    findCity:'Atrast pilsētu', searchPh:'Sāciet rakstīt nosaukumu…', nothingFound:'Nekas nav atrasts',
    searchOff:'Meklēšana nav pieejama', quickPick:'Ātrā izvēle', language:'Valoda', units:'Mērvienības',
    loading:'Ielādē prognozi…', loadErr:'Neizdevās ielādēt datus', retry:'Mēģināt vēlreiz',
    noData:'Nav datu', theme:'Noformējums',
    tempName:'Temperatūra', cloudName:'Mākoņainība', precName:'Nokrišņi', windName:'Vējš',
    tempShort:'Temp.', cloudShort:'Mākoņi', precShort:'Nokrišņi', windShort:'Vējš',
    legendTitle:'Kā to lasīt',
    legendRange:'augšējais skaitlis ir zemākā vērtība, apakšējais — augstākā starp visiem prognozes atjauninājumiem šai stundai. Bultiņa rāda, uz kuru pusi prognoze nobīdījusies no senākā atjauninājuma līdz jaunākajam.',
    legendTap:'Pieskarieties stundai, lai atvērtu grafikus: kā prognoze mainījās dienu no dienas.',
    spreadMost:'{m}: lielākā izkliede — {v} {u} {n} atjauninājumos.',
    spreadSame:'Visi atjauninājumi atgriezuši vienādas vērtības. Tālākiem datumiem tas nozīmē, ka neatkarīgu prognožu vēl nav — nav ar ko salīdzināt.',
    fcFrom:'Prognoze no {d}', fcNow:'Jaunākā prognoze',
    atLeastOne:'Vismaz vienam rādītājam jāpaliek',
    geoDenied:'Piekļuve atrašanās vietai liegta — izvēlieties pilsētu',
    geoFail:'Neizdevās noteikt atrašanās vietu',
    geoInsecure:'Automātiskai noteikšanai vajadzīgs https vai localhost',
    geoNone:'Pārlūks neatbalsta ģeolokāciju',
    byDefault:'pēc noklusējuma', autoDetected:'noteikts automātiski',
    unitTemp:'Temperatūra', unitWind:'Vējš', unitPrec:'Nokrišņi',
    uKmh:'km/h', uMs:'m/s', uMph:'jūdzes/h', uKn:'mezgli', uMm:'mm', uIn:'collas',
    settings:'Iestatījumi',
    themeAuto:'Kā sistēmā',
    themeLight:'Gaišs',
    themeDark:'Tumšs',
    share:'Kopīgot',
    shareCopied:'Saite nokopēta',
    installTitle:'Pievienot sākuma ekrānam',
    installBtn:'Pievienot',
    installHowIOS:'Pieskarieties «Kopīgot» pārlūka joslā, pēc tam «Pievienot sākuma ekrānam».',
    installHowOther:'Atveriet pārlūka izvēlni un izvēlieties «Instalēt lietotni».',
    installLeft:'Atgādinājums {n} no 5 — pēc tam pazudīs',
    tagline:'Kā mainās laika prognozes',
    metaDescr:'Kā mainījās prognoze katrai stundai pēdējos astoņos modeļa atjauninājumos: izkliede, tendence un grafiki. Open-Meteo dati, darbojas pilnībā pārlūkā.',
    shareText:'Rāda izkliedi starp modeļa atjauninājumiem katrai stundai — redzama prognozes dinamika.',
    src:'Dati: Open-Meteo, CC BY 4.0. Darbojas pilnībā pārlūkā, bez servera.',
  },
  lt: {
    skipLink:'Pereiti prie prognozės', detectBtn:'Nustatyti mano vietą', detecting:'Nustatoma…',
    findCity:'Rasti miestą', searchPh:'Pradėkite rašyti pavadinimą…', nothingFound:'Nieko nerasta',
    searchOff:'Paieška neprieinama', quickPick:'Greitas pasirinkimas', language:'Kalba', units:'Vienetai',
    loading:'Kraunama prognozė…', loadErr:'Nepavyko įkelti duomenų', retry:'Bandyti dar kartą',
    noData:'Nėra duomenų', theme:'Tema',
    tempName:'Temperatūra', cloudName:'Debesuotumas', precName:'Krituliai', windName:'Vėjas',
    tempShort:'Temp.', cloudShort:'Debesys', precShort:'Krituliai', windShort:'Vėjas',
    legendTitle:'Kaip skaityti',
    legendRange:'viršutinis skaičius — mažiausia reikšmė, apatinis — didžiausia tarp visų tos valandos prognozės atnaujinimų. Rodyklė rodo, kur prognozė pasislinko nuo seniausio atnaujinimo iki naujausio.',
    legendTap:'Palieskite valandą, kad atsivertų grafikai: kaip prognozė keitėsi diena po dienos.',
    spreadMost:'{m}: didžiausia sklaida — {v} {u} per {n} atnaujinimų.',
    spreadSame:'Visi atnaujinimai grąžino vienodas reikšmes. Tolimoms datoms tai reiškia, kad nepriklausomų prognozių dar nėra — nėra su kuo lyginti.',
    fcFrom:'Prognozė nuo {d}', fcNow:'Naujausia prognozė',
    atLeastOne:'Bent vienas rodiklis turi likti',
    geoDenied:'Prieiga prie vietos atmesta — pasirinkite miestą',
    geoFail:'Nepavyko nustatyti vietos',
    geoInsecure:'Automatiniam nustatymui reikia https arba localhost',
    geoNone:'Naršyklė nepalaiko geolokacijos',
    byDefault:'numatytoji', autoDetected:'nustatyta automatiškai',
    unitTemp:'Temperatūra', unitWind:'Vėjas', unitPrec:'Krituliai',
    uKmh:'km/h', uMs:'m/s', uMph:'mylios/h', uKn:'mazgai', uMm:'mm', uIn:'coliai',
    settings:'Nustatymai',
    themeAuto:'Kaip sistemoje',
    themeLight:'Šviesi',
    themeDark:'Tamsi',
    share:'Bendrinti',
    shareCopied:'Nuoroda nukopijuota',
    installTitle:'Įtraukti į pradžios ekraną',
    installBtn:'Įtraukti',
    installHowIOS:'Palieskite „Bendrinti“ naršyklės juostoje, tada „Į pradžios ekraną“.',
    installHowOther:'Atverkite naršyklės meniu ir pasirinkite „Įdiegti programą“.',
    installLeft:'Priminimas {n} iš 5 — paskui dings',
    tagline:'Kaip kinta oro prognozės',
    metaDescr:'Kaip kito kiekvienos valandos prognozė per aštuonis paskutinius modelio atnaujinimus: sklaida, tendencija ir grafikai. Open-Meteo duomenys, veikia visiškai naršyklėje.',
    shareText:'Rodo sklaidą tarp modelio atnaujinimų kiekvienai valandai — matosi prognozės dinamika.',
    src:'Duomenys: Open-Meteo, CC BY 4.0. Veikia visiškai naršyklėje, be serverio.',
  },
  et: {
    skipLink:'Mine prognoosi juurde', detectBtn:'Tuvasta minu asukoht', detecting:'Tuvastamine…',
    findCity:'Otsi linna', searchPh:'Hakka nime kirjutama…', nothingFound:'Midagi ei leitud',
    searchOff:'Otsing pole saadaval', quickPick:'Kiirvalik', language:'Keel', units:'Ühikud',
    loading:'Laadin prognoosi…', loadErr:'Andmete laadimine ebaõnnestus', retry:'Proovi uuesti',
    noData:'Andmeid pole', theme:'Kujundus',
    tempName:'Temperatuur', cloudName:'Pilvisus', precName:'Sademed', windName:'Tuul',
    tempShort:'Temp.', cloudShort:'Pilved', precShort:'Sademed', windShort:'Tuul',
    legendTitle:'Kuidas lugeda',
    legendRange:'ülemine arv on väikseim ja alumine suurim väärtus kõigi selle tunni prognoosiuuenduste seas. Nool näitab, kummale poole prognoos nihkus vanimast uuendusest värskeimani.',
    legendTap:'Puuduta tundi, et avada graafikud: kuidas ennustus päev-päevalt muutus.',
    spreadMost:'{m}: suurim hajuvus — {v} {u} {n} uuenduse lõikes.',
    spreadSame:'Kõik uuendused andsid identsed väärtused. Kaugete kuupäevade puhul tähendab see, et sõltumatuid prognoose veel pole — pole millegagi võrrelda.',
    fcFrom:'Prognoos {d}', fcNow:'Värskeim prognoos',
    atLeastOne:'Vähemalt üks näitaja peab alles jääma',
    geoDenied:'Asukohale juurdepääs keelatud — vali linn käsitsi',
    geoFail:'Asukohta ei õnnestunud tuvastada',
    geoInsecure:'Automaattuvastus vajab https-i või localhosti',
    geoNone:'Brauser ei toeta geolokatsiooni',
    byDefault:'vaikimisi', autoDetected:'tuvastatud automaatselt',
    unitTemp:'Temperatuur', unitWind:'Tuul', unitPrec:'Sademed',
    uKmh:'km/h', uMs:'m/s', uMph:'miili/h', uKn:'sõlme', uMm:'mm', uIn:'tolli',
    settings:'Seaded',
    themeAuto:'Nagu süsteemis',
    themeLight:'Hele',
    themeDark:'Tume',
    share:'Jaga',
    shareCopied:'Link kopeeritud',
    installTitle:'Lisa avakuvale',
    installBtn:'Lisa',
    installHowIOS:'Puuduta brauseriribal „Jaga“ ja seejärel „Lisa avakuvale“.',
    installHowOther:'Ava brauseri menüü ja vali „Installi rakendus“.',
    installLeft:'Meeldetuletus {n} / 5 — seejärel kaob',
    tagline:'Kuidas ilmaprognoosid muutuvad',
    metaDescr:'Kuidas iga tunni prognoos muutus viimase kaheksa mudeliuuenduse jooksul: hajuvus, trend ja graafikud. Open-Meteo andmed, töötab täielikult brauseris.',
    shareText:'Näitab hajuvust mudeliuuenduste vahel iga tunni kohta — prognoosi dünaamika on näha.',
    src:'Andmed: Open-Meteo, CC BY 4.0. Töötab täielikult brauseris, ilma serverita.',
  },
  tr: {
    skipLink:'Tahmine geç', detectBtn:'Konumumu belirle', detecting:'Belirleniyor…',
    findCity:'Şehir ara', searchPh:'Ad yazmaya başlayın…', nothingFound:'Sonuç yok',
    searchOff:'Arama kullanılamıyor', quickPick:'Hızlı seçim', language:'Dil', units:'Birimler',
    loading:'Tahmin yükleniyor…', loadErr:'Veriler yüklenemedi', retry:'Yeniden dene',
    noData:'Veri yok', theme:'Tema',
    tempName:'Sıcaklık', cloudName:'Bulutluluk', precName:'Yağış', windName:'Rüzgâr',
    tempShort:'Sıc.', cloudShort:'Bulut', precShort:'Yağış', windShort:'Rüzgâr',
    legendTitle:'Nasıl okunur',
    legendRange:'üstteki sayı o saate ait tüm tahmin güncellemeleri arasındaki en düşük, alttaki en yüksek değerdir. Ok, tahminin en eski güncellemeden en yenisine hangi yöne kaydığını gösterir.',
    legendTap:'Grafikleri açmak için bir saate dokunun: tahmin gün gün nasıl değişti.',
    spreadMost:'{m}: en geniş aralık — {n} güncellemede {v} {u}.',
    spreadSame:'Tüm güncellemeler aynı değerleri döndürdü. Uzak tarihler için bu, henüz bağımsız tahmin bulunmadığı anlamına gelir — karşılaştıracak bir şey yok.',
    fcFrom:'{d} tarihli tahmin', fcNow:'Güncel tahmin',
    atLeastOne:'En az bir gösterge açık kalmalı',
    geoDenied:'Konum erişimi reddedildi — şehri elle seçin',
    geoFail:'Konum belirlenemedi',
    geoInsecure:'Otomatik belirleme https veya localhost gerektirir',
    geoNone:'Tarayıcı konum servisini desteklemiyor',
    byDefault:'varsayılan', autoDetected:'otomatik belirlendi',
    unitTemp:'Sıcaklık', unitWind:'Rüzgâr', unitPrec:'Yağış',
    uKmh:'km/sa', uMs:'m/s', uMph:'mil/sa', uKn:'knot', uMm:'mm', uIn:'inç',
    settings:'Ayarlar',
    themeAuto:'Sistem',
    themeLight:'Açık',
    themeDark:'Koyu',
    share:'Paylaş',
    shareCopied:'Bağlantı kopyalandı',
    installTitle:'Ana ekrana ekle',
    installBtn:'Ekle',
    installHowIOS:'Tarayıcı çubuğunda «Paylaş»a, ardından «Ana Ekrana Ekle»ye dokunun.',
    installHowOther:'Tarayıcı menüsünü açın ve «Uygulamayı yükle»yi seçin.',
    installLeft:'{n}/5 hatırlatma — sonra kaybolur',
    tagline:'Hava tahminleri nasıl değişiyor',
    metaDescr:'Her saatin tahmini son sekiz model güncellemesinde nasıl değişti: aralık, eğilim ve grafikler. Open-Meteo verileri, tamamen tarayıcıda çalışır.',
    shareText:'Her saat için model güncellemeleri arasındaki aralığı gösterir — tahminin dinamiği görünür hale gelir.',
    src:'Veri: Open-Meteo, CC BY 4.0. Tamamen tarayıcıda çalışır, sunucusuz.',
  },
  zh: {
    skipLink:'跳至预报', detectBtn:'定位我的位置', detecting:'定位中…',
    findCity:'查找城市', searchPh:'开始输入名称…', nothingFound:'未找到结果',
    searchOff:'搜索不可用', quickPick:'快速选择', language:'语言', units:'单位',
    loading:'正在加载预报…', loadErr:'无法加载数据', retry:'重试',
    noData:'无数据', theme:'主题',
    tempName:'气温', cloudName:'云量', precName:'降水', windName:'风速',
    tempShort:'气温', cloudShort:'云量', precShort:'降水', windShort:'风速',
    legendTitle:'如何阅读',
    legendRange:'上方数字是该小时所有预报更新中的最小值，下方是最大值。箭头表示预报从最早一次更新到最新一次的变化方向。',
    legendTap:'点击某个小时即可展开图表：预报如何逐日变化。',
    spreadMost:'{m}：分歧最大 — {n} 次更新中相差 {v} {u}。',
    spreadSame:'所有更新返回了完全相同的数值。对于较远的日期，这意味着尚无独立预报——无从比较。',
    fcFrom:'{d} 的预报', fcNow:'最新预报',
    atLeastOne:'至少需保留一个指标',
    geoDenied:'定位权限被拒绝——请手动选择城市',
    geoFail:'无法确定位置',
    geoInsecure:'自动定位需要 https 或 localhost',
    geoNone:'浏览器不支持地理定位',
    byDefault:'默认', autoDetected:'自动定位',
    unitTemp:'气温', unitWind:'风速', unitPrec:'降水',
    uKmh:'公里/小时', uMs:'米/秒', uMph:'英里/小时', uKn:'节', uMm:'毫米', uIn:'英寸',
    settings:'设置',
    themeAuto:'跟随系统',
    themeLight:'浅色',
    themeDark:'深色',
    share:'分享',
    shareCopied:'链接已复制',
    installTitle:'添加到主屏幕',
    installBtn:'添加',
    installHowIOS:'点击浏览器栏中的「分享」，然后选择「添加到主屏幕」。',
    installHowOther:'打开浏览器菜单，选择「安装应用」。',
    installLeft:'第 {n}/5 次提醒，之后不再显示',
    tagline:'天气预报如何变化',
    metaDescr:'查看每个小时的预报在最近八次模型更新中如何变化：分歧范围、趋势和图表。数据来自 Open-Meteo，完全在浏览器中运行。',
    shareText:'显示每个小时在各次模型更新之间的分歧范围，一眼看出预报的变化动态。',
    src:'数据：Open-Meteo，CC BY 4.0。完全在浏览器中运行，无需服务器。',
  },
  ja: {
    skipLink:'予報へ移動', detectBtn:'現在地を取得', detecting:'取得中…',
    findCity:'都市を検索', searchPh:'名前を入力…', nothingFound:'見つかりません',
    searchOff:'検索を利用できません', quickPick:'クイック選択', language:'言語', units:'単位',
    loading:'予報を読み込み中…', loadErr:'データを読み込めませんでした', retry:'再試行',
    noData:'データなし', theme:'テーマ',
    tempName:'気温', cloudName:'雲量', precName:'降水量', windName:'風速',
    tempShort:'気温', cloudShort:'雲量', precShort:'降水', windShort:'風速',
    legendTitle:'見かた',
    legendRange:'上の数字はその時刻に対するすべての予報更新のうち最小値、下の数字は最大値です。矢印は最も古い更新から最新の更新へ予報がどちらに動いたかを示します。',
    legendTap:'時刻をタップするとグラフが開きます。予報が日ごとにどう変わったかがわかります。',
    spreadMost:'{m}：最大の幅 — {n} 回の更新で {v} {u}。',
    spreadSame:'すべての更新が同じ値を返しました。遠い日付では独立した予報がまだ存在しないことを意味します — 比較する対象がありません。',
    fcFrom:'{d} の予報', fcNow:'最新の予報',
    atLeastOne:'少なくとも 1 つの項目は残してください',
    geoDenied:'位置情報が拒否されました — 都市を手動で選択してください',
    geoFail:'位置を特定できませんでした',
    geoInsecure:'自動取得には https または localhost が必要です',
    geoNone:'このブラウザは位置情報に対応していません',
    byDefault:'既定', autoDetected:'自動取得',
    unitTemp:'気温', unitWind:'風速', unitPrec:'降水量',
    uKmh:'km/h', uMs:'m/s', uMph:'mph', uKn:'ノット', uMm:'mm', uIn:'インチ',
    settings:'設定',
    themeAuto:'システムに合わせる',
    themeLight:'ライト',
    themeDark:'ダーク',
    share:'共有',
    shareCopied:'リンクをコピーしました',
    installTitle:'ホーム画面に追加',
    installBtn:'追加',
    installHowIOS:'ブラウザの「共有」をタップし、「ホーム画面に追加」を選びます。',
    installHowOther:'ブラウザのメニューから「アプリをインストール」を選びます。',
    installLeft:'{n}/5 回目の案内 — 以降は表示しません',
    tagline:'天気予報はどう変わるか',
    metaDescr:'各時刻の予報が直近8回のモデル更新でどう変わったかを表示します。幅、傾向、グラフ。Open-Meteo のデータ、ブラウザだけで動作します。',
    shareText:'各時刻についてモデル更新間の幅を表示し、予報の推移が一目でわかります。',
    src:'データ: Open-Meteo, CC BY 4.0。サーバーなしでブラウザ内だけで動作します。',
  },
  ar: {
    skipLink:'الانتقال إلى التوقعات', detectBtn:'تحديد موقعي', detecting:'جارٍ التحديد…',
    findCity:'البحث عن مدينة', searchPh:'ابدأ بكتابة الاسم…', nothingFound:'لا توجد نتائج',
    searchOff:'البحث غير متاح', quickPick:'اختيار سريع', language:'اللغة', units:'الوحدات',
    loading:'جارٍ تحميل التوقعات…', loadErr:'تعذّر تحميل البيانات', retry:'إعادة المحاولة',
    noData:'لا توجد بيانات', theme:'المظهر',
    tempName:'درجة الحرارة', cloudName:'الغيوم', precName:'الهطول', windName:'الرياح',
    tempShort:'الحرارة', cloudShort:'الغيوم', precShort:'الهطول', windShort:'الرياح',
    legendTitle:'كيف تقرأ هذا',
    legendRange:'الرقم العلوي هو أدنى قيمة والسفلي أعلى قيمة بين جميع تحديثات التوقعات لتلك الساعة. يشير السهم إلى اتجاه تغيّر التوقع من أقدم تحديث إلى أحدثه.',
    legendTap:'اضغط على ساعة لفتح الرسوم البيانية: كيف تغيّر التوقع يوماً بعد يوم.',
    spreadMost:'{m}: أوسع تباين — {v} {u} عبر {n} تحديثات.',
    spreadSame:'أعادت كل التحديثات القيم نفسها. بالنسبة للتواريخ البعيدة يعني ذلك عدم وجود توقعات مستقلة بعد — لا شيء للمقارنة.',
    fcFrom:'توقع بتاريخ {d}', fcNow:'أحدث توقع',
    atLeastOne:'يجب إبقاء مؤشر واحد على الأقل',
    geoDenied:'تم رفض الوصول إلى الموقع — اختر مدينة يدوياً',
    geoFail:'تعذّر تحديد الموقع',
    geoInsecure:'يتطلب التحديد التلقائي https أو localhost',
    geoNone:'المتصفح لا يدعم تحديد الموقع',
    byDefault:'افتراضي', autoDetected:'تم التحديد تلقائياً',
    unitTemp:'درجة الحرارة', unitWind:'الرياح', unitPrec:'الهطول',
    uKmh:'كم/س', uMs:'م/ث', uMph:'ميل/س', uKn:'عقدة', uMm:'مم', uIn:'بوصة',
    settings:'الإعدادات',
    themeAuto:'حسب النظام',
    themeLight:'فاتح',
    themeDark:'داكن',
    share:'مشاركة',
    shareCopied:'تم نسخ الرابط',
    installTitle:'إضافة إلى الشاشة الرئيسية',
    installBtn:'إضافة',
    installHowIOS:'اضغط «مشاركة» في شريط المتصفح ثم «إضافة إلى الشاشة الرئيسية».',
    installHowOther:'افتح قائمة المتصفح واختر «تثبيت التطبيق».',
    installLeft:'التذكير {n} من 5 — ثم يختفي',
    tagline:'كيف تتغير توقعات الطقس',
    metaDescr:'كيف تغيّر التوقع لكل ساعة خلال آخر ثمانية تحديثات للنموذج: المدى والاتجاه والرسوم البيانية. بيانات Open-Meteo، يعمل بالكامل في المتصفح.',
    shareText:'يعرض التباين بين تحديثات النموذج لكل ساعة — فتظهر ديناميكية التوقع.',
    src:'البيانات: Open-Meteo، CC BY 4.0. يعمل بالكامل داخل المتصفح دون خادم.',
  },
};

/* --------------------------------------------------------------------------
 * 3. Единицы измерения
 * ----------------------------------------------------------------------- */

/** API отдаёт °C, км/ч и мм — остальное пересчитывается на лету, без нового запроса. */
const UNITS = {
  temp: {
    c: { key:'uC',   sym:'°C', suffix:'°', dec:1, conv: (v) => v },
    f: { key:'uF',   sym:'°F', suffix:'°', dec:1, conv: (v) => v * 9 / 5 + 32 },
  },
  wind: {
    kmh: { key:'uKmh', dec:1, conv: (v) => v },
    ms:  { key:'uMs',  dec:1, conv: (v) => v / 3.6 },
    mph: { key:'uMph', dec:1, conv: (v) => v / 1.609344 },
    kn:  { key:'uKn',  dec:1, conv: (v) => v / 1.852 },
  },
  prec: {
    mm: { key:'uMm', dec:1, conv: (v) => v },
    in: { key:'uIn', dec:2, conv: (v) => v / 25.4 },
  },
};

/** Привычные единицы по стране. Всё, что не перечислено, получает метрические. */
const COUNTRY_UNITS = {
  US:{temp:'f',wind:'mph',prec:'in'}, LR:{temp:'f',wind:'mph',prec:'in'},
  MM:{temp:'f',wind:'mph',prec:'in'}, PR:{temp:'f',wind:'mph',prec:'in'},
  GB:{temp:'c',wind:'mph',prec:'mm'}, IE:{temp:'c',wind:'kmh',prec:'mm'},
  RU:{temp:'c',wind:'ms',prec:'mm'},  BY:{temp:'c',wind:'ms',prec:'mm'},
  UA:{temp:'c',wind:'ms',prec:'mm'},  KZ:{temp:'c',wind:'ms',prec:'mm'},
  LV:{temp:'c',wind:'ms',prec:'mm'},  LT:{temp:'c',wind:'ms',prec:'mm'},
  EE:{temp:'c',wind:'ms',prec:'mm'},  FI:{temp:'c',wind:'ms',prec:'mm'},
  SE:{temp:'c',wind:'ms',prec:'mm'},  NO:{temp:'c',wind:'ms',prec:'mm'},
  DK:{temp:'c',wind:'ms',prec:'mm'},  DE:{temp:'c',wind:'kmh',prec:'mm'},
  PL:{temp:'c',wind:'kmh',prec:'mm'}, CN:{temp:'c',wind:'ms',prec:'mm'},
  JP:{temp:'c',wind:'ms',prec:'mm'},
};

const DEFAULT_UNITS = { temp:'c', wind:'kmh', prec:'mm' };

/* --------------------------------------------------------------------------
 * 4. Показатели и пресеты
 * ----------------------------------------------------------------------- */

const METRICS = [
  { key:'temperature_2m', nameKey:'tempName',  shortKey:'tempShort',  fam:'temp',
    icon:'i-temp',  color:'--series-temp',  floor:null, on:true },
  { key:'cloud_cover',    nameKey:'cloudName', shortKey:'cloudShort', fam:null,
    icon:'i-cloud', color:'--series-cloud', floor:0,    on:true, ceil:100, dec:0, sym:'%', suffix:'%' },
  { key:'precipitation',  nameKey:'precName',  shortKey:'precShort',  fam:'prec',
    icon:'i-prec',  color:'--series-prec',  floor:0,    on:true },
  { key:'wind_speed_10m', nameKey:'windName',  shortKey:'windShort',  fam:'wind',
    icon:'i-wind',  color:'--series-wind',  floor:0,    on:true },
];

const PRESETS = [
  { name:'Rīga',      cc:'LV', lat:56.9460, lon:24.1059 },
  { name:'Paris',     cc:'FR', lat:48.8566, lon:2.3522  },
  { name:'Berlin',    cc:'DE', lat:52.5200, lon:13.4050 },
  { name:'London',    cc:'GB', lat:51.5074, lon:-0.1278 },
  { name:'New York',  cc:'US', lat:40.7128, lon:-74.0060 },
  { name:'Almaty',    cc:'KZ', lat:43.2380, lon:76.8829 },
];

/* --------------------------------------------------------------------------
 * 5. Состояние
 * ----------------------------------------------------------------------- */

const state = {
  lang: 'en',
  langPinned: false,          // пользователь выбрал язык сам — не перебивать автоопределением
  units: { ...DEFAULT_UNITS },
  unitsPinned: false,
  place: null,
  hourly: null,
  index: null,
  days: [],
  date: null,
  openHour: null,
  metrics: new Set(METRICS.filter((m) => m.on).map((m) => m.key)),
  tz: null,
  theme: 'auto',
  installShows: 0,
  loading: false,
  reqId: 0,
};

const $ = (s) => document.querySelector(s);
const el = {};

/* --------------------------------------------------------------------------
 * 6. Перевод и форматирование чисел
 * ----------------------------------------------------------------------- */

function t(key, vars) {
  const dict = T[state.lang] || T.en;
  let s = dict[key] !== undefined ? dict[key] : (T.en[key] !== undefined ? T.en[key] : key);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

const nfCache = new Map();
function nf(v, dec) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const ck = state.lang + '|' + dec;
  let f = nfCache.get(ck);
  if (!f) {
    f = new Intl.NumberFormat(state.lang, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    nfCache.set(ck, f);
  }
  return f.format(v);
}

const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* --- единицы конкретного показателя --- */

function unitOf(metric) {
  if (!metric.fam) return null;
  return UNITS[metric.fam][state.units[metric.fam]];
}
function conv(metric, v)   { const u = unitOf(metric); return u ? u.conv(v) : v; }
function decOf(metric)     { const u = unitOf(metric); return u ? u.dec : metric.dec; }
function symOf(metric)     { const u = unitOf(metric); return u ? (u.sym || t(u.key)) : metric.sym; }
function suffixOf(metric)  { const u = unitOf(metric); return u ? (u.suffix || '') : (metric.suffix || ''); }

/* --- даты --- */

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const wd = new Intl.DateTimeFormat(state.lang, { weekday: 'short' }).format(d);
  return { wd, num: `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}` };
}

/** Дата, когда было выпущено обновление прогноза, отстоящее на n дней назад. */
function updateLabel(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

function toast(msg, ms = 3600) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.toast.hidden = true; }, ms);
}

/* --------------------------------------------------------------------------
 * 7. Загрузка погоды
 * ----------------------------------------------------------------------- */

function buildHourlyParam() {
  const out = [];
  for (const m of METRICS) {
    for (const n of RUNS) out.push(n === 0 ? m.key : `${m.key}_previous_day${n}`);
  }
  return out.join(',');
}

async function loadWeather() {
  const my = ++state.reqId;
  state.loading = true;
  renderHours();

  const params = new URLSearchParams({
    latitude: state.place.lat.toFixed(4),
    longitude: state.place.lon.toFixed(4),
    hourly: buildHourlyParam(),
    timezone: 'auto',
    wind_speed_unit: 'kmh',          // канонические единицы; пересчёт — на клиенте
    past_days: String(PAST_DAYS),
    forecast_days: String(FCST_DAYS),
  });

  try {
    const res = await fetch(`${API_FORECAST}?${params}`);
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j && j.reason) reason = j.reason; } catch (_) {}
      throw new Error(reason);
    }
    const data = await res.json();
    if (my !== state.reqId) return;

    indexHours(data);
    state.tz = data.timezone;
    state.loading = false;

    if (!state.days.includes(state.date)) state.date = pickDefaultDate();
    renderDates();
    renderHours();
    scrollToCurrentHour();
  } catch (err) {
    if (my !== state.reqId) return;
    state.loading = false;
    state.hourly = null;
    renderError(err.message);
  }
}

function indexHours(data) {
  const h = data.hourly;
  state.hourly = h;
  state.index = new Map();
  state.days = [];
  for (let i = 0; i < h.time.length; i++) {
    const date = h.time[i].slice(0, 10);
    if (!state.index.has(date)) { state.index.set(date, []); state.days.push(date); }
    state.index.get(date).push(i);
  }
}

function pickDefaultDate() {
  const today = localNowISO().slice(0, 10);
  return state.days.includes(today) ? today : state.days[Math.min(PAST_DAYS, state.days.length - 1)];
}

function localNowISO() {
  if (!state.tz) {
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}T${pad2(n.getHours())}:00`;
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: state.tz, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false,
  }).format(new Date()).replace(' ', 'T');
}

/* --------------------------------------------------------------------------
 * 8. Выборка значений
 * ----------------------------------------------------------------------- */

/** Значения показателя на конкретный час по всем обновлениям прогноза. */
function updatesAt(rowIdx, metricKey) {
  const h = state.hourly;
  return RUNS.map((n) => {
    const field = n === 0 ? metricKey : `${metricKey}_previous_day${n}`;
    const arr = h[field];
    const v = Array.isArray(arr) ? arr[rowIdx] : null;
    return { age: n, value: (typeof v === 'number' && Number.isFinite(v)) ? v : null };
  });
}

/**
 * Сводка по часу в канонических единицах: минимум, максимум и сдвиг
 * от самого раннего обновления к свежему.
 */
function summarize(rowIdx, metricKey) {
  const ups = updatesAt(rowIdx, metricKey);
  const real = ups.filter((r) => r.value !== null);
  if (!real.length) return null;

  const values = real.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const newest = real.reduce((a, b) => (b.age < a.age ? b : a));
  const oldest = real.reduce((a, b) => (b.age > a.age ? b : a));

  return {
    ups, min, max,
    delta: newest.value - oldest.value,
    now: newest.value,
    count: real.length,
    identical: max - min < 1e-9 && real.length > 1,
  };
}

/* --------------------------------------------------------------------------
 * 9. Локация
 * ----------------------------------------------------------------------- */

function setPlace(place, { save = true, reload = true } = {}) {
  state.place = place;

  // Язык и единицы подстраиваются под страну, пока пользователь не выбрал своё
  if (place.cc) {
    if (!state.langPinned) {
      const auto = COUNTRY_LANG[place.cc];
      if (auto && LANG_NAMES[auto] && auto !== state.lang) applyLang(auto, false);
    }
    if (!state.unitsPinned) {
      state.units = { ...DEFAULT_UNITS, ...(COUNTRY_UNITS[place.cc] || {}) };
      renderUnitList();
    }
  }

  renderPlaceLine();
  if (save) { try { localStorage.setItem('wf-place', JSON.stringify(place)); } catch (_) {} }
  closePanels();
  if (reload) loadWeather(); else renderAll();
}

/** Пример в легенде следует выбранному языку и единицам, а не зашит в разметку. */
function renderLegendDemo() {
  const m = METRICS[0];                       // температура
  const d = decOf(m), sfx = suffixOf(m);
  el.legendDemo.innerHTML =
    `<b>${nf(conv(m, 16.8), d)}${sfx}</b><i>↘</i><b>${nf(conv(m, 22.8), d)}${sfx}</b>`;
}

/** Подпись локации рисуется после того, как язык устоялся, иначе
    «определено автоматически» останется на прежнем языке. */
function renderPlaceLine() {
  const p = state.place;
  if (!p) return;
  el.placeName.textContent = p.name;
  el.placeSub.textContent = [p.sub, p.srcKey ? t(p.srcKey) : ''].filter(Boolean).join(' · ');
}

function detectPlace(userInitiated) {
  if (!navigator.geolocation) { if (userInitiated) toast(t('geoNone')); return; }
  if (!window.isSecureContext) { if (userInitiated) toast(t('geoInsecure')); return; }

  el.detectBtn.disabled = true;
  el.detectLabel.textContent = t('detecting');
  const done = () => { el.detectBtn.disabled = false; el.detectLabel.textContent = t('detectBtn'); };

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      let name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`, sub = '', cc = null;
      try {
        const r = await fetch(`${API_REVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=${state.lang}`);
        if (r.ok) {
          const g = await r.json();
          const city = g.city || g.locality || g.principalSubdivision;
          if (city) { name = city; sub = g.countryName || ''; }
          cc = g.countryCode || null;
        }
      } catch (_) {}
      done();
      setPlace({ name, sub, lat, lon, cc, srcKey: 'autoDetected' });
    },
    (err) => {
      done();
      if (!userInitiated) return;
      toast(err.code === err.PERMISSION_DENIED ? t('geoDenied') : t('geoFail'));
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 }
  );
}

let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  const q = el.search.value.trim();
  if (q.length < 2) { el.results.innerHTML = ''; return; }
  searchTimer = setTimeout(() => runSearch(q), 280);
}

async function runSearch(q) {
  try {
    const url = `${API_GEOCODE}?name=${encodeURIComponent(q)}&count=6&language=${state.lang}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('geocode');
    const list = (await res.json()).results || [];
    if (!list.length) {
      el.results.innerHTML = `<p class="res res__sub">${esc(t('nothingFound'))}</p>`;
      return;
    }
    el.results.innerHTML = list.map((r, i) => `
      <button type="button" class="res" data-i="${i}">
        <span class="res__name">${esc(r.name)}</span>
        <span class="res__sub">${esc([r.admin1, r.country].filter(Boolean).join(', '))}</span>
      </button>`).join('');

    el.results.querySelectorAll('.res').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = list[Number(btn.dataset.i)];
        el.search.value = ''; el.results.innerHTML = '';
        setPlace({
          name: r.name,
          sub: [r.admin1, r.country].filter(Boolean).join(', '),
          lat: r.latitude, lon: r.longitude,
          cc: r.country_code || null, srcKey: null,
        });
      });
    });
  } catch (_) {
    el.results.innerHTML = `<p class="res res__sub">${esc(t('searchOff'))}</p>`;
  }
}

/* --------------------------------------------------------------------------
 * 10. Панели
 * ----------------------------------------------------------------------- */

function closePanels() {
  el.panel.hidden = true;  el.placeBtn.setAttribute('aria-expanded', 'false');
  el.prefs.hidden = true;  el.prefsBtn.setAttribute('aria-expanded', 'false');
  syncHeadOffset();
}

function togglePanel(which) {
  const openPlace = which === 'place' && el.panel.hidden;
  const openPrefs = which === 'prefs' && el.prefs.hidden;
  closePanels();
  if (openPlace) { el.panel.hidden = false; el.placeBtn.setAttribute('aria-expanded', 'true'); }
  if (openPrefs) { el.prefs.hidden = false; el.prefsBtn.setAttribute('aria-expanded', 'true'); }
  syncHeadOffset();
}

function renderLangList() {
  const codes = Object.keys(LANG_NAMES).sort((a, b) =>
    LANG_NAMES[a].localeCompare(LANG_NAMES[b]));
  el.langList.innerHTML = codes.map((c) => `
    <button type="button" class="lang" role="option" data-lang="${c}"
            aria-selected="${c === state.lang}" lang="${c}">
      <span>${esc(LANG_NAMES[c])}</span><span class="lang__code">${c}</span>
    </button>`).join('');
  el.langList.querySelectorAll('.lang').forEach((b) => {
    b.addEventListener('click', () => applyLang(b.dataset.lang, true));
  });
}

function renderUnitList() {
  const rows = [
    { fam:'temp', label:'unitTemp', opts:['c','f'] },
    { fam:'wind', label:'unitWind', opts:['kmh','ms','mph','kn'] },
    { fam:'prec', label:'unitPrec', opts:['mm','in'] },
  ];
  el.unitList.innerHTML = rows.map((r) => `
    <div class="unit-row">
      <span class="unit-row__name">${esc(t(r.label))}</span>
      <div class="seg" role="group">
        ${r.opts.map((o) => {
          const u = UNITS[r.fam][o];
          return `<button type="button" class="seg__btn" data-fam="${r.fam}" data-opt="${o}"
                  aria-pressed="${state.units[r.fam] === o}">${esc(u.sym || t(u.key))}</button>`;
        }).join('')}
      </div>
    </div>`).join('');

  el.unitList.querySelectorAll('.seg__btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.units[b.dataset.fam] = b.dataset.opt;
      state.unitsPinned = true;
      try { localStorage.setItem('wf-units', JSON.stringify(state.units)); } catch (_) {}
      renderUnitList();
      renderHours();   // пересчёт мгновенный, без обращения к сети
    });
  });
}

function applyLang(code, pinned) {
  if (!LANG_NAMES[code]) code = 'en';
  state.lang = code;
  nfCache.clear();
  if (pinned) {
    state.langPinned = true;
    try { localStorage.setItem('wf-lang', code); } catch (_) {}
  }

  document.documentElement.lang = code;
  document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
  // Текущий язык виден в самом списке языков; в шапке остаётся только «EN»
  el.enBtn.hidden = (code === 'en');

  applyStaticStrings();
  renderAll();
}

/** Строки, живущие прямо в разметке. */
function applyStaticStrings() {
  document.querySelectorAll('[data-i18n]').forEach((n) => {
    n.textContent = t(n.dataset.i18n);
  });
  el.search.placeholder = t('searchPh');
  el.detectLabel.textContent = t('detectBtn');
  el.shareBtn.setAttribute('aria-label', t('share'));
  el.shareBtn.setAttribute('title', t('share'));
  el.prefsBtn.setAttribute('aria-label', t('settings'));
  el.prefsBtn.setAttribute('title', t('settings'));
  el.placeBtn.setAttribute('aria-label', t('findCity'));
  el.footerSrc.textContent = t('src');

  // Заголовок вкладки и описание для поиска/превью ссылки
  document.title = `${APP_NAME} — ${taglineAfterDash()}`;
  const set = (sel, attr, val) => {
    const n = document.querySelector(sel);
    if (n) n.setAttribute(attr, val);
  };
  set('meta[name="description"]', 'content', t('metaDescr'));
  set('meta[property="og:title"]', 'content', APP_NAME);
  set('meta[property="og:description"]', 'content', t('tagline'));
}

/* --------------------------------------------------------------------------
 * 11. Рендер
 * ----------------------------------------------------------------------- */

function renderAll() {
  renderPlaceLine();
  renderLegendDemo();
  renderLangList();
  renderUnitList();
  renderThemeList();
  renderInstallBar();
  renderMetricBar();
  renderPresets();
  if (state.hourly) { renderDates(); renderHours(); }
}

function renderPresets() {
  el.presets.innerHTML = PRESETS.map((p, i) =>
    `<button type="button" class="preset" data-i="${i}">${esc(p.name)}</button>`).join('');
  el.presets.querySelectorAll('.preset').forEach((b) => {
    b.addEventListener('click', () => {
      const p = PRESETS[Number(b.dataset.i)];
      setPlace({ ...p, sub: '', srcKey: null });
    });
  });
}

function renderDates() {
  const today = localNowISO().slice(0, 10);
  el.dates.innerHTML = state.days.map((iso) => {
    const L = dayLabel(iso);
    return `<button type="button" class="day${iso === today ? ' day--today' : ''}"
              data-date="${iso}" aria-current="${iso === state.date}">
              <span class="day__wd">${esc(L.wd)}</span>
              <span class="day__num">${L.num}</span></button>`;
  }).join('');

  el.dates.querySelectorAll('.day').forEach((b) => {
    b.addEventListener('click', () => {
      state.date = b.dataset.date;
      state.openHour = null;
      renderDates(); renderHours();
      el.hours.scrollIntoView({ block:'start', behavior:'smooth' });
    });
  });

  const sel = el.dates.querySelector('[aria-current="true"]');
  if (sel) sel.scrollIntoView({ inline:'center', block:'nearest' });
}

function renderMetricBar() {
  el.metricBar.innerHTML = METRICS.map((m) => `
    <button type="button" class="mtoggle" data-key="${m.key}" aria-pressed="${state.metrics.has(m.key)}">
      <span class="mtoggle__dot" style="background:var(${m.color})"></span>${esc(t(m.shortKey))}
    </button>`).join('');

  el.metricBar.querySelectorAll('.mtoggle').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.key;
      if (state.metrics.has(k)) {
        if (state.metrics.size === 1) { toast(t('atLeastOne')); return; }
        state.metrics.delete(k);
      } else state.metrics.add(k);
      renderMetricBar(); renderHours();
    });
  });
}

function renderHours() {
  if (state.loading) {
    el.hours.innerHTML = `<div class="state"><div class="state__spin"></div>${esc(t('loading'))}</div>`;
    return;
  }
  if (!state.hourly || !state.date) return;

  const rows = state.index.get(state.date) || [];
  const active = METRICS.filter((m) => state.metrics.has(m.key));
  const nowStamp = localNowISO();

  el.hours.innerHTML = rows.map((idx) => {
    const stamp = state.hourly.time[idx];
    const hh = stamp.slice(11, 16);
    const isOpen = state.openHour === stamp;
    const isNow = stamp.slice(0, 13) === nowStamp.slice(0, 13);

    const cells = active.map((m) => {
      const s = summarize(idx, m.key);
      if (!s) {
        return `<div class="mcell mcell--empty">
          <svg class="mcell__icon"><use href="#${m.icon}"/></svg>
          <span class="mcell__vals"><span class="mcell__v">—</span></span></div>`;
      }
      const dir = Math.abs(s.delta) < 1e-9 ? 'flat' : (s.delta > 0 ? 'up' : 'down');
      const glyph = dir === 'flat' ? '→' : (dir === 'up' ? '↗' : '↘');
      const d = decOf(m), sfx = suffixOf(m);
      return `<div class="mcell" style="--accent:var(${m.color})">
        <svg class="mcell__icon"><use href="#${m.icon}"/></svg>
        <span class="mcell__vals">
          <span class="mcell__v">${nf(conv(m, s.min), d)}${sfx}</span>
          <span class="mcell__v">${nf(conv(m, s.max), d)}${sfx}</span>
        </span>
        <span class="mcell__arrow mcell__arrow--${dir}" aria-hidden="true">${glyph}</span>
      </div>`;
    }).join('');

    return `<section class="hour${isOpen ? ' hour--open' : ''}${isNow ? ' hour--now' : ''}" data-stamp="${stamp}">
      <button type="button" class="hour__head" aria-expanded="${isOpen}">
        <span class="hour__time">${hh}</span>
        <span class="hour__cells">${cells}</span>
      </button>
      ${isOpen ? `<div class="hour__body">${renderBody(idx, active)}</div>` : ''}
    </section>`;
  }).join('');

  el.hours.querySelectorAll('.hour__head').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stamp = btn.closest('.hour').dataset.stamp;
      state.openHour = (state.openHour === stamp) ? null : stamp;
      renderHours();
      if (state.openHour) {
        const n = el.hours.querySelector(`[data-stamp="${CSS.escape(stamp)}"]`);
        if (n) n.scrollIntoView({ block:'nearest', behavior:'smooth' });
      }
    });
  });

  drawOpenCharts();
}

function renderBody(idx, active) {
  const parts = [];
  const allSame = active.every((m) => { const s = summarize(idx, m.key); return s && s.identical; });

  if (allSame) {
    parts.push(`<div class="spread"><span class="spread__ico" aria-hidden="true">🔁</span>
      <span>${esc(t('spreadSame'))}</span></div>`);
  } else {
    const worst = active.map((m) => ({ m, s: summarize(idx, m.key) })).filter((x) => x.s)
      .sort((a, b) => (b.s.max - b.s.min) / (Math.abs(b.s.max) || 1)
                    - (a.s.max - a.s.min) / (Math.abs(a.s.max) || 1))[0];
    if (worst) {
      const d = decOf(worst.m);
      const range = conv(worst.m, worst.s.max) - conv(worst.m, worst.s.min);
      parts.push(`<div class="spread"><span class="spread__ico" aria-hidden="true">📊</span>
        <span>${t('spreadMost', {
          m: `<strong>${esc(t(worst.m.nameKey))}</strong>`,
          v: nf(Math.abs(range), d), u: esc(symOf(worst.m)), n: worst.s.count,
        })}</span></div>`);
    }
  }

  for (const m of active) {
    parts.push(`<figure class="chart" data-metric="${m.key}" data-row="${idx}">
      <figcaption class="chart__title">
        <span class="chart__dot" style="background:var(${m.color})"></span>
        ${esc(t(m.nameKey))} (${esc(symOf(m))})
      </figcaption>
      <div class="chart__holder"></div>
    </figure>`);
  }
  return parts.join('');
}

function drawOpenCharts() {
  el.hours.querySelectorAll('.chart').forEach((fig) => {
    const m = METRICS.find((x) => x.key === fig.dataset.metric);
    drawChart(fig.querySelector('.chart__holder'), m, Number(fig.dataset.row));
  });
}

/* --------------------------------------------------------------------------
 * 12. График: как менялся прогноз от обновления к обновлению
 * ----------------------------------------------------------------------- */

function drawChart(holder, metric, rowIdx) {
  const s = summarize(rowIdx, metric.key);
  const W = Math.max(holder.clientWidth || 300, 240);
  const H = 132;
  const P = { t:10, r:16, b:20, l:36 };

  if (!s) {
    holder.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text class="c-empty" x="${W/2}" y="${H/2}"
      text-anchor="middle">${esc(t('noData'))}</text></svg>`;
    return;
  }

  const dec = decOf(metric);
  const pts = s.ups.filter((r) => r.value !== null)
                   .map((r) => ({ age: r.age, value: conv(metric, r.value) }))
                   .sort((a, b) => b.age - a.age);   // слева старое, справа свежее

  let vMin = Math.min(...pts.map((p) => p.value));
  let vMax = Math.max(...pts.map((p) => p.value));
  const span = vMax - vMin;
  const padY = span < 1e-9 ? Math.max(Math.abs(vMax) * 0.1, 1) : span * 0.22;
  vMin -= padY; vMax += padY;
  if (metric.floor !== null) vMin = Math.max(vMin, conv(metric, metric.floor));
  if (metric.ceil !== undefined) vMax = Math.min(vMax, conv(metric, metric.ceil));
  if (vMax - vMin < 1e-9) vMax = vMin + 1;

  const maxAge = Math.max(...pts.map((p) => p.age), 1);
  const x = (age) => P.l + (maxAge - age) / maxAge * (W - P.l - P.r);
  const y = (v) => P.t + (vMax - clamp(v, vMin, vMax)) / (vMax - vMin) * (H - P.t - P.b);

  let svg = `<rect class="c-frame" x="${P.l}" y="${P.t}" width="${W-P.l-P.r}" height="${H-P.t-P.b}"/>`;

  const TICKS = 3;
  for (let i = 0; i <= TICKS; i++) {
    const v = vMin + (vMax - vMin) * (i / TICKS);
    const yy = y(v);
    if (i > 0 && i < TICKS) {
      svg += `<line class="c-grid" x1="${P.l}" y1="${yy.toFixed(1)}" x2="${W-P.r}" y2="${yy.toFixed(1)}"/>`;
    }
    // Подписи оси не могут быть точнее данных
    const td = Math.min((vMax - vMin) > 8 ? 0 : 1, dec);
    svg += `<text class="c-tick" x="${P.l-4}" y="${(yy+3.2).toFixed(1)}" text-anchor="end">${nf(v, td)}</text>`;
  }

  const step = (W - P.l - P.r) / maxAge;
  const sparse = step < 34;
  pts.forEach((p, i) => {
    const px = x(p.age);
    if (i > 0) svg += `<line class="c-sep" x1="${px.toFixed(1)}" y1="${P.t}" x2="${px.toFixed(1)}" y2="${H-P.b}"/>`;
    if (!sparse || p.age % 2 === 0) {
      svg += `<text class="c-tick" x="${px.toFixed(1)}" y="${H-P.b+12}" text-anchor="middle">${updateLabel(p.age)}</text>`;
    }
  });

  // Ступень: значение обновления держится, пока не вышло следующее
  const color = cssVar(metric.color) || '#2a78d6';
  let d = '';
  pts.forEach((p, i) => {
    const px = x(p.age), py = y(p.value);
    if (i === 0) d += `M${px.toFixed(1)},${py.toFixed(1)}`;
    else d += `L${px.toFixed(1)},${y(pts[i-1].value).toFixed(1)}L${px.toFixed(1)},${py.toFixed(1)}`;
  });
  svg += `<path class="c-area" fill="${color}" d="${d}L${x(pts[pts.length-1].age).toFixed(1)},${H-P.b}L${x(pts[0].age).toFixed(1)},${H-P.b}Z"/>`;
  svg += `<path class="c-line" stroke="${color}" d="${d}"/>`;
  svg += `<line class="c-cross" data-slot="cross" y1="${P.t}" y2="${H-P.b}"/>`;

  for (const p of pts) {
    svg += `<circle class="c-dot${p.age === 0 ? ' c-dot--sel' : ''}" cx="${x(p.age).toFixed(1)}"
      cy="${y(p.value).toFixed(1)}" r="${p.age === 0 ? 4 : 3}" fill="${color}"/>`;
  }
  for (const p of pts) {
    svg += `<rect class="c-hit" data-age="${p.age}" x="${(x(p.age)-step/2).toFixed(1)}" y="${P.t}"
      width="${step.toFixed(1)}" height="${(H-P.t-P.b).toFixed(1)}"/>`;
  }

  const desc = pts.map((p) =>
    `${p.age === 0 ? t('fcNow') : updateLabel(p.age)}: ${nf(p.value, dec)}`).join('; ');
  holder.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${esc(t(metric.nameKey))}: ${esc(desc)}">${svg}</svg>`;

  wireHover(holder, rowIdx, x);
}

function wireHover(holder, rowIdx, x) {
  const svg = holder.querySelector('svg');
  const cross = svg.querySelector('[data-slot="cross"]');

  const move = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    const r = el.tooltip.getBoundingClientRect();
    let left = pt.clientX + 12, top = pt.clientY - r.height - 12;
    if (left + r.width > innerWidth - 8) left = pt.clientX - r.width - 12;
    if (top < 8) top = pt.clientY + 16;
    el.tooltip.style.left = `${Math.max(8, left)}px`;
    el.tooltip.style.top = `${top}px`;
  };

  const show = (e, rect) => {
    const age = Number(rect.dataset.age);
    const px = x(age).toFixed(1);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    cross.style.opacity = '1';

    const rows = METRICS.filter((m) => state.metrics.has(m.key)).map((m) => {
      const u = updatesAt(rowIdx, m.key).find((r) => r.age === age);
      const v = (u && u.value !== null)
        ? `${nf(conv(m, u.value), decOf(m))} ${symOf(m)}` : '—';
      return `<div class="tooltip__r"><span>${esc(t(m.shortKey))}</span><b>${esc(v)}</b></div>`;
    }).join('');

    el.tooltip.innerHTML =
      `<div class="tooltip__t">${esc(age === 0 ? t('fcNow') : t('fcFrom', { d: updateLabel(age) }))}</div>${rows}`;
    el.tooltip.hidden = false;
    move(e);
  };

  const hide = () => { cross.style.opacity = '0'; el.tooltip.hidden = true; };

  svg.querySelectorAll('.c-hit').forEach((rect) => {
    rect.addEventListener('mouseenter', (e) => show(e, rect));
    rect.addEventListener('mousemove', move);
    rect.addEventListener('mouseleave', hide);
    rect.addEventListener('touchstart', (e) => show(e, rect), { passive: true });
    rect.addEventListener('touchmove', move, { passive: true });
    rect.addEventListener('touchend', hide);
  });
  svg.addEventListener('mouseleave', hide);
}

/* --------------------------------------------------------------------------
 * 13. Служебное
 * ----------------------------------------------------------------------- */

function renderError(msg) {
  el.hours.innerHTML = `<div class="state">${esc(t('loadErr'))}: ${esc(msg)}
    <br><button type="button" class="state__retry" id="retryBtn">${esc(t('retry'))}</button></div>`;
  const r = $('#retryBtn');
  if (r) r.addEventListener('click', loadWeather);
}

function scrollToCurrentHour() {
  const now = localNowISO();
  if (state.date !== now.slice(0, 10)) return;
  const n = el.hours.querySelector(`[data-stamp="${CSS.escape(now.slice(0,13) + ':00')}"]`);
  if (n) n.scrollIntoView({ block:'center', behavior:'smooth' });
}

function syncHeadOffset() {
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--head-h', `${el.topbar.offsetHeight}px`);
  });
}

/** Тема: «как в системе», светлая или тёмная. Живёт в настройках вместе с языком и единицами. */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('wf-theme'); } catch (_) {}
  state.theme = (saved === 'dark' || saved === 'light' || saved === 'auto') ? saved : 'auto';
  document.documentElement.setAttribute('data-theme', state.theme);
}

function applyTheme(mode) {
  state.theme = mode;
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem('wf-theme', mode); } catch (_) {}
  renderThemeList();
  drawOpenCharts();          // цвета линий берутся из CSS-переменных
}

function renderThemeList() {
  const opts = [['auto', 'themeAuto'], ['light', 'themeLight'], ['dark', 'themeDark']];
  el.themeList.innerHTML = `
    <div class="seg seg--wide" role="group">
      ${opts.map(([v, k]) => `<button type="button" class="seg__btn" data-theme="${v}"
        aria-pressed="${state.theme === v}">${esc(t(k))}</button>`).join('')}
    </div>`;
  el.themeList.querySelectorAll('.seg__btn').forEach((b) => {
    b.addEventListener('click', () => applyTheme(b.dataset.theme));
  });
}

/* --------------------------------------------------------------------------
 * 13б. Поделиться ссылкой
 * ----------------------------------------------------------------------- */

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  return ok;
}

/**
 * Подзаголовок в связке «Meteo Dynamics — …». Отдельно, вне этой конструкции,
 * используется исходный t('tagline') с заглавной: в og:description он стоит
 * самостоятельной фразой, и строчная там читалась бы как обрубок.
 */
function taglineAfterDash() {
  const s = t('tagline');
  if (!LOWER_AFTER_DASH.has(state.lang)) return s;
  return s.charAt(0).toLocaleLowerCase(state.lang) + s.slice(1);
}

/** Название сервиса и что он делает — иначе в мессенджере видна только ссылка. */
function shareMessage() {
  return `${APP_NAME} — ${taglineAfterDash()}. ${t('shareText')}`;
}

async function shareApp() {
  const url = location.href;

  // На телефонах открывается системное меню «Поделиться»
  if (navigator.share) {
    try {
      await navigator.share({ title: APP_NAME, text: shareMessage(), url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // пользователь закрыл меню
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast(t('shareCopied'));
    return;
  } catch (_) {}

  toast(copyFallback(url) ? t('shareCopied') : url, 6000);
}

/* --------------------------------------------------------------------------
 * 13в. Предложение добавить на главный экран
 * ----------------------------------------------------------------------- */

const INSTALL_MAX = 5;          // после пятого показа баннер больше не появляется
let deferredPrompt = null;      // событие beforeinstallprompt, если браузер его дал

/** Приложение уже открыто как установленное? */
function isStandalone() {
  return (matchMedia('(display-mode: standalone)').matches
       || matchMedia('(display-mode: window-controls-overlay)').matches
       || navigator.standalone === true);
}

/** iOS-браузеры не дают beforeinstallprompt — там только ручная инструкция. */
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua)
      || (/Macintosh/.test(ua) && typeof document.ontouchend !== 'undefined');
}

function lsGet(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

function markInstalled() {
  lsSet('wf-installed', '1');
  if (el.installBar) el.installBar.hidden = true;
}

/** Показывается один раз за загрузку страницы, пока не исчерпан счётчик. */
function maybeShowInstall() {
  if (isStandalone()) { markInstalled(); return; }
  if (lsGet('wf-installed', '') === '1') return;
  if (lsGet('wf-install-off', '') === '1') return;

  const shows = Number(lsGet('wf-install-shows', '0')) + 1;
  if (shows > INSTALL_MAX) return;

  lsSet('wf-install-shows', String(shows));
  state.installShows = shows;
  renderInstallBar();
  el.installBar.hidden = false;
}

function renderInstallBar() {
  if (!state.installShows) return;
  const canPrompt = !!deferredPrompt;
  el.installTitle.textContent = t('installTitle');
  el.installText.textContent  = canPrompt ? '' : (isIOS() ? t('installHowIOS') : t('installHowOther'));
  el.installText.hidden = canPrompt;
  el.installLeft.textContent  = t('installLeft', { n: state.installShows });
  el.installGo.textContent    = t('installBtn');
  el.installGo.hidden = !canPrompt;
}

function initInstall() {
  // Браузер сообщает, что сайт можно установить — показываем настоящую кнопку
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!el.installBar.hidden) renderInstallBar();
  });

  addEventListener('appinstalled', () => { deferredPrompt = null; markInstalled(); });

  el.installGo.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    let outcome = '';
    try { outcome = (await deferredPrompt.userChoice).outcome; } catch (_) {}
    deferredPrompt = null;
    if (outcome === 'accepted') markInstalled();
    el.installBar.hidden = true;
  });

  el.installClose.addEventListener('click', () => {
    lsSet('wf-install-off', '1');
    el.installBar.hidden = true;
  });
}

/**
 * Манифест собирается на лету и подключается как data-URL: отдельный
 * manifest.json нарушил бы условие «строго четыре файла». Если браузер
 * откажется его читать, установка просто пойдёт по ручной инструкции.
 */
function injectManifest() {
  const icon = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
    "<rect width='512' height='512' rx='96' fill='#e2e0da'/>" +
    "<text x='256' y='366' font-size='300' text-anchor='middle'>🌦️</text></svg>");

  const mf = {
    name: APP_NAME,
    short_name: 'Meteo',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    background_color: '#e2e0da',
    theme_color: '#e2e0da',
    icons: [{ src: icon, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }],
  };

  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(mf));
  document.head.appendChild(link);
}

/** Язык при первом запуске: сохранённый → язык браузера → английский. */
function initialLang() {
  let saved = null;
  try { saved = localStorage.getItem('wf-lang'); } catch (_) {}
  if (saved && LANG_NAMES[saved]) { state.langPinned = true; return saved; }

  for (const l of (navigator.languages || [navigator.language || 'en'])) {
    const base = String(l).toLowerCase().split('-')[0];
    if (LANG_NAMES[base]) return base;
  }
  return 'en';
}

/* --------------------------------------------------------------------------
 * 14. Старт
 * ----------------------------------------------------------------------- */

function init() {
  el.topbar    = $('.topbar');
  el.placeBtn  = $('#placeBtn');
  el.placeName = $('#placeName');
  el.placeSub  = $('#placeSub');
  el.panel     = $('#placePanel');
  el.prefs     = $('#prefsPanel');
  el.prefsBtn  = $('#prefsBtn');
  el.langList  = $('#langList');
  el.unitList  = $('#unitList');
  el.enBtn     = $('#enBtn');
  el.detectBtn = $('#detectBtn');
  el.detectLabel = $('#detectLabel');
  el.search    = $('#searchInput');
  el.results   = $('#searchResults');
  el.presets   = $('#presetList');
  el.dates     = $('#dateStrip');
  el.metricBar = $('#metricBar');
  el.hours     = $('#hours');
  el.tooltip   = $('#tooltip');
  el.toast     = $('#toast');
  el.shareBtn  = $('#shareBtn');
  el.themeList = $('#themeList');
  el.footerSrc = $('#footerSrc');
  el.legendDemo= $('#legendDemo');
  el.installBar   = $('#installBar');
  el.installTitle = $('#installTitle');
  el.installText  = $('#installText');
  el.installLeft  = $('#installLeft');
  el.installGo    = $('#installGo');
  el.installClose = $('#installClose');

  initTheme();

  try {
    const u = JSON.parse(localStorage.getItem('wf-units') || 'null');
    if (u && u.temp && u.wind && u.prec) { state.units = u; state.unitsPinned = true; }
  } catch (_) {}

  applyLang(initialLang(), false);

  el.placeBtn.addEventListener('click', () => togglePanel('place'));
  el.prefsBtn.addEventListener('click', () => togglePanel('prefs'));
  el.enBtn.addEventListener('click', () => applyLang('en', true));
  el.shareBtn.addEventListener('click', shareApp);
  el.detectBtn.addEventListener('click', () => detectPlace(true));
  el.search.addEventListener('input', onSearchInput);

  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { drawOpenCharts(); syncHeadOffset(); }, 160);
  });
  syncHeadOffset();

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('wf-place') || 'null'); } catch (_) {}

  if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
    setPlace(saved, { save: false });
  } else {
    setPlace({ ...PRESETS[0], sub:'', srcKey: 'byDefault' }, { save: false });
    detectPlace(false);
  }

  injectManifest();
  initInstall();
  maybeShowInstall();
}

document.addEventListener('DOMContentLoaded', init);
