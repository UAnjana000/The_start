import { LanguageKey } from '../types/tactical';

export interface TranslationDict {
  // Navigation
  navHome: string;
  navDashboard: string;
  navSimulate: string;
  navNodes: string;
  navAlerts: string;
  navDataGraphs: string;
  navSettings: string;

  // Header & Common
  c2Title: string;
  viewDashboard: string;
  demoSimulation: string;
  liveHwMode: string;
  online: string;
  offline: string;
  standby: string;
  jammerActive: string;
  reCenter: string;
  resetSquad: string;
  rangeRings: string;
  adhocBeams: string;
  
  // Home Tab
  projectTitle: string;
  projectSubtitle: string;
  problemStatement: string;
  problemDesc: string;
  keyInnovations: string;
  innovation1Title: string;
  innovation1Desc: string;
  innovation2Title: string;
  innovation2Desc: string;
  innovation3Title: string;
  innovation3Desc: string;
  innovation4Title: string;
  innovation4Desc: string;
  umlArchitecture: string;
  launchConsole: string;

  // Nodes Tab
  nodesTitle: string;
  nodesSubtitle: string;
  activeNodesTab: string;
  hiddenNodesTab: string;
  editDisplayName: string;
  save: string;
  cancel: string;
  hideDeleteNode: string;
  restoreNode: string;
  simulateDisconnect: string;
  simulateReconnect: string;
  batteryLevel: string;
  activeBeamSector: string;
  signalSinr: string;
  lastKnownPos: string;
  statusConnected: string;
  statusDisconnected: string;

  // Alerts & Graphs Placeholders
  alertsTitle: string;
  alertsEmptyMsg: string;
  dataGraphsTitle: string;
  dataGraphsEmptyMsg: string;

  // Settings
  settingsTitle: string;
  settingsSubtitle: string;
  themePreference: string;
  darkMode: string;
  lightMode: string;
  languageSelect: string;
  radioFreqConfig: string;
  systemHealth: string;
}

export const translations: Record<LanguageKey, TranslationDict> = {
  en: {
    navHome: 'HOME',
    navDashboard: 'DASHBOARD',
    navSimulate: 'SIMULATE',
    navNodes: 'NODES',
    navAlerts: 'ALERTS',
    navDataGraphs: 'DATA & GRAPHS',
    navSettings: 'SETTINGS',

    c2Title: 'NSG CQB-MANET // C2',
    viewDashboard: 'VIEW DASHBOARD',
    demoSimulation: 'DEMO SIMULATION',
    liveHwMode: 'LIVE HW MODE',
    online: 'ONLINE',
    offline: 'OFFLINE',
    standby: 'STANDBY',
    jammerActive: 'EW JAMMER ON',
    reCenter: 'RE-CENTER',
    resetSquad: 'RESET SQUAD',
    rangeRings: 'RANGE RINGS',
    adhocBeams: 'ADHOC BEAMS',

    projectTitle: 'SMART CQB-MANET HELMET WITH CONFORMAL ANTENNA ARRAY',
    projectSubtitle: 'SIH PS 26185 — Wearable Ad-Hoc Mesh, AMC SAR Shield & AI Ghost Healing',
    problemStatement: 'MISSION PROBLEM STATEMENT',
    problemDesc: 'In GPS-denied Close Quarter Battle (CQB) environments (subterranean bunkers, reinforced concrete multi-story compounds), tactical radio lines-of-sight are frequently blocked, multipath fading causes dead zones, and omnidirectional antenna radiation exposes commando operators to severe Specific Absorption Rate (SAR) tissue heating. This system provides a non-intrusive conformal patch antenna helmet array with beam steering, autonomous ad-hoc multi-hop MANET relay, and predictive AI ghost waypoint healing.',
    keyInnovations: 'CORE ARCHITECTURAL INNOVATIONS',
    innovation1Title: 'Conformal Microstrip Patch Array (4-Sector Steering)',
    innovation1Desc: 'Four 1.42 GHz directional patches embedded flush into the composite helmet exterior with PIN-diode switching, concentrating RF gain towards upstream relays and avoiding dead zones.',
    innovation2Title: 'Metamaterial AMC Ground Plane (SAR Suppression)',
    innovation2Desc: 'Artificial Magnetic Conductor (AMC) high-impedance surface shielding reduces head tissue absorption to <0.08 W/kg, dramatically below the 1.6 W/kg safety limit.',
    innovation3Title: 'Self-Organizing Multi-Hop MANET Mesh (B.A.T.M.A.N. / OLSR)',
    innovation3Desc: 'Dynamic ad-hoc routing tree automatically pivots data around thick walls through intermediate squadmates without central base station dependency.',
    innovation4Title: 'AI Spatial Ghost Healing Engine',
    innovation4Desc: 'Predictive SINR spatial optimizer computes millimeter-accurate physical repositioning vectors ("Ghost Nodes") to instantly repair broken or degraded comms links.',
    umlArchitecture: 'PALANTIR FOUNDRY ARCHITECTURE & UML DATA PIPELINE',
    launchConsole: 'LAUNCH TACTICAL C2 DASHBOARD',

    nodesTitle: 'TACTICAL MESH NODE DIRECTORY & TELEMETRY',
    nodesSubtitle: 'Real-time node telemetry, display callsign customization, and failover status',
    activeNodesTab: 'ACTIVE NODES',
    hiddenNodesTab: 'DELETED / HIDDEN NODES',
    editDisplayName: 'Edit Callsign / Name',
    save: 'SAVE',
    cancel: 'CANCEL',
    hideDeleteNode: 'DELETE / HIDE NODE',
    restoreNode: 'RESTORE TO MESH',
    simulateDisconnect: 'SIMULATE DISCONNECT',
    simulateReconnect: 'RECONNECT NODE',
    batteryLevel: 'BATTERY',
    activeBeamSector: 'BEAM SECTOR',
    signalSinr: 'LINK SINR',
    lastKnownPos: 'LAST ONLINE POS',
    statusConnected: 'CONNECTED',
    statusDisconnected: 'CONNECTION LOST',

    alertsTitle: 'TACTICAL ALERTS & THREAT INTELLIGENCE',
    alertsEmptyMsg: 'Alerts engine initialized. Dynamic jamming triggers, perimeter anomaly thresholds, and low-SINR warnings will appear here.',
    dataGraphsTitle: 'ANALYTICS, TELEMETRY TRENDS & SPECTROGRAPH',
    dataGraphsEmptyMsg: 'Real-time spectral waterfall, SINR over time, packet loss distributions, and multi-hop latency graphs will appear here.',

    settingsTitle: 'SYSTEM SETTINGS & WORKSPACE PREFERENCES',
    settingsSubtitle: 'Customize operational interface theme, tactical language, and radio frequency parameters',
    themePreference: 'DISPLAY THEME',
    darkMode: 'DARK MODE (C2 NIGHT OPS)',
    lightMode: 'LIGHT MODE (FOUNDRY SPEC)',
    languageSelect: 'OPERATIONAL LANGUAGE',
    radioFreqConfig: 'RF SPECTRUM CARRIER FREQUENCY',
    systemHealth: 'DIAGNOSTICS & SYSTEM INTEGRITY',
  },
  hi: {
    navHome: 'होम',
    navDashboard: 'डैशबोर्ड',
    navSimulate: 'सिमुलेट',
    navNodes: 'नोड्स',
    navAlerts: 'अलर्ट',
    navDataGraphs: 'डेटा और ग्राफ',
    navSettings: 'सेटिंग्स',

    c2Title: 'एनएसजी सीक्यूबी-मानेत // सी2',
    viewDashboard: 'डैशबोर्ड देखें',
    demoSimulation: 'डेमो सिमुलेशन',
    liveHwMode: 'लाइव हार्डवेयर मोड',
    online: 'ऑनलाइन',
    offline: 'ऑफलाइन',
    standby: 'स्टैंडबाय',
    jammerActive: 'ईडब्ल्यू जैमर चालू',
    reCenter: 'री-सेंटर',
    resetSquad: 'स्क्वाड रीसेट',
    rangeRings: 'दूरी के छल्ले',
    adhocBeams: 'बीम सेक्टर',

    projectTitle: 'स्मार्ट सीक्यूबी-मानेत हेलमेट एवं कॉन्फॉर्मल एंटेना सरणी',
    projectSubtitle: 'एसआईएच पीएस 26185 — एड-हॉक मेश, एएमसी सार शील्ड और एआई घोस्ट हीलिंग',
    problemStatement: 'मिशन समस्या विवरण',
    problemDesc: 'जीपीएस-अवरुद्ध सीक्यूबी वातावरण में दीवारों और बाधाओं के कारण रेडियो संचार बाधित होता है। यह प्रणाली 4-दिशात्मक पैच एंटेना, सुरक्षित मेश नेटवर्क और एआई घोस्ट हीलिंग द्वारा विश्वसनीय संचार प्रदान करती है।',
    keyInnovations: 'मुख्य तकनीकी नवाचार',
    innovation1Title: 'कॉन्फॉर्मल पैच सरणी (4-सेक्टर बीम स्टीयरिंग)',
    innovation1Desc: 'हेलमेट में अंतर्निहित 1.42 गीगाहर्ट्ज पैच एंटेना सिग्नल को सीधे साथी नोड की दिशा में केंद्रित करते हैं।',
    innovation2Title: 'मेटामटीरियल एएमसी शील्ड (सार सुरक्षा)',
    innovation2Desc: 'कमांडो के मस्तिष्क पर विकिरण अवशोषण को 0.08 W/kg से कम करता है।',
    innovation3Title: 'स्व-संगठित मल्टी-हॉप मेश नेटवर्क',
    innovation3Desc: 'बिना बेस स्टेशन के स्वयं मार्ग खोजने वाला गतिशील नेटवर्क।',
    innovation4Title: 'एआई स्थानिक घोस्ट हीलिंग इंजन',
    innovation4Desc: 'टूटे हुए कनेक्शन को जोड़ने हेतु सटीक नई स्थिति का सुझाव देता है।',
    umlArchitecture: 'सिस्टम आर्किटेक्चर एवं यूएमएल डेटा पाइपलाइन',
    launchConsole: 'कमांड कंसोल प्रारंभ करें',

    nodesTitle: 'टैक्टिकल नोड डायरेक्टरी एवं टेलीमेट्री',
    nodesSubtitle: 'वास्तविक समय नोड टेलीमेट्री और प्रदर्शन नाम संपादन',
    activeNodesTab: 'सक्रिय नोड्स',
    hiddenNodesTab: 'हटाए गए / छिपे हुए नोड्स',
    editDisplayName: 'नाम / कॉलसाइन बदलें',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    hideDeleteNode: 'नोड हटाएं / छिपाएं',
    restoreNode: 'मेश में पुनः जोड़ें',
    simulateDisconnect: 'डिस्कनेक्ट सिमुलेट करें',
    simulateReconnect: 'पुनः कनेक्ट करें',
    batteryLevel: 'बैटरी',
    activeBeamSector: 'बीम सेक्टर',
    signalSinr: 'सिग्नल SINR',
    lastKnownPos: 'अंतिम ऑनलाइन स्थिति',
    statusConnected: 'सक्रिय',
    statusDisconnected: 'संपर्क टूटा (लाल वृत्त)',

    alertsTitle: 'टैक्टिकल अलर्ट्स एवं सूचनाएं',
    alertsEmptyMsg: 'अलर्ट सिस्टम सक्रिय है। जैमिंग चेतावनियाँ और थ्रेशोल्ड अलर्ट यहाँ प्रदर्शित होंगे।',
    dataGraphsTitle: 'एनालिटिक्स एवं टेलीमेट्री ग्राफ',
    dataGraphsEmptyMsg: 'ऐतिहासिक SINR रुझान, पैकेट हानि और स्पेक्ट्रम विश्लेषण चार्ट यहाँ दिखाई देंगे।',

    settingsTitle: 'सिस्टम सेटिंग्स एवं प्राथमिकताएं',
    settingsSubtitle: 'इंटरफ़ेस थीम, भाषा और रेडियो फ्रीक्वेंसी प्राथमिकताएं प्रबंधित करें',
    themePreference: 'थीम चयन',
    darkMode: 'डार्क मोड (नाइट ऑप्स)',
    lightMode: 'लाइट मोड (फाउंड्री मानक)',
    languageSelect: 'भाषा चयन',
    radioFreqConfig: 'रेडियो फ्रीक्वेंसी कॉन्फ़िगरेशन',
    systemHealth: 'सिस्टम डायग्नोस्टिक्स',
  },
  es: {
    navHome: 'INICIO',
    navDashboard: 'PANEL C2',
    navSimulate: 'SIMULAR',
    navNodes: 'NODOS',
    navAlerts: 'ALERTAS',
    navDataGraphs: 'DATOS Y GRÁFICOS',
    navSettings: 'AJUSTES',

    c2Title: 'NSG CQB-MANET // C2',
    viewDashboard: 'VER PANEL C2',
    demoSimulation: 'SIMULACIÓN DEMO',
    liveHwMode: 'MODO HW EN VIVO',
    online: 'EN LÍNEA',
    offline: 'DESCONECTADO',
    standby: 'EN ESPERA',
    jammerActive: 'INHIBIDOR ACTIVO',
    reCenter: 'RE-CENTRAR',
    resetSquad: 'REINICIAR ESCUADRÓN',
    rangeRings: 'ANILLOS DE ALCANCE',
    adhocBeams: 'SECTORES DE HAZ',

    projectTitle: 'CASCO INTELIGENTE CQB-MANET CON CONJUNTO DE ANTENAS CONFORMAL',
    projectSubtitle: 'SIH PS 26185 — Malla Ad-Hoc Portátil, Blindaje SAR AMC y Auto-Curación IA',
    problemStatement: 'DECLARACIÓN DEL PROBLEMA DE MISIÓN',
    problemDesc: 'En entornos CQB sin GPS, las paredes bloquean las señales de radio. Este sistema proporciona antenas conformales integradas en casco con enrutamiento ad-hoc y optimización espacial con IA.',
    keyInnovations: 'INNOVACIONES CLAVE',
    innovation1Title: 'Matriz Parche Conformal (4 Sectores)',
    innovation1Desc: 'Antenas de 1.42 GHz integradas en casco con conmutación dinámica de haz.',
    innovation2Title: 'Blindaje AMC Metamaterial',
    innovation2Desc: 'Reduce la absorción de radiación a <0.08 W/kg en el operador.',
    innovation3Title: 'Malla MANET Auto-Organizable',
    innovation3Desc: 'Enrutamiento dinámico salto a salto sin necesidad de estación base.',
    innovation4Title: 'Motor de Curación Espacial IA',
    innovation4Desc: 'Calcula vectores de reposicionamiento milimétricos ("Ghost Nodes") para restaurar enlaces.',
    umlArchitecture: 'ARQUITECTURA PALANTIR FOUNDRY Y PIPELINE UML',
    launchConsole: 'INICIAR CONSOLA TÁCTICA',

    nodesTitle: 'DIRECTORIO DE NODOS TÁCTICOS Y TELEMETRÍA',
    nodesSubtitle: 'Telemetría en tiempo real, edición de nombre y estado de redundancia',
    activeNodesTab: 'NODOS ACTIVOS',
    hiddenNodesTab: 'NODOS ELIMINADOS / OCULTOS',
    editDisplayName: 'Editar Nombre / Indicativo',
    save: 'GUARDAR',
    cancel: 'CANCELAR',
    hideDeleteNode: 'ELIMINAR / OCULTAR NODO',
    restoreNode: 'RESTAURAR A LA MALLA',
    simulateDisconnect: 'SIMULAR DESCONEXIÓN',
    simulateReconnect: 'RECONECTAR NODO',
    batteryLevel: 'BATERÍA',
    activeBeamSector: 'SECTOR DE HAZ',
    signalSinr: 'SINR DE ENLACE',
    lastKnownPos: 'ÚLTIMA POSICIÓN EN LÍNEA',
    statusConnected: 'CONECTADO',
    statusDisconnected: 'CONEXIÓN PERDIDA (CÍRCULO ROJO)',

    alertsTitle: 'ALERTAS TÁCTICAS E INTELIGENCIA DE AMENAZAS',
    alertsEmptyMsg: 'Sistema de alertas inicializado. Las reglas de detección de inhibición y advertencias aparecerán aquí.',
    dataGraphsTitle: 'ANALÍTICA Y GRÁFICOS DE TELEMETRÍA',
    dataGraphsEmptyMsg: 'Los gráficos de densidad espectral, curvas de SINR y pérdida de paquetes aparecerán aquí.',

    settingsTitle: 'AJUSTES DEL SISTEMA Y PREFERENCIAS',
    settingsSubtitle: 'Personalice el tema visual, idioma y parámetros de radiofrecuencia',
    themePreference: 'TEMA DE INTERFAZ',
    darkMode: 'MODO OSCURO (OPERACIONES NOCTURNAS)',
    lightMode: 'MODO CLARO (ESTÁNDAR FOUNDRY)',
    languageSelect: 'IDIOMA OPERATIVO',
    radioFreqConfig: 'CONFIGURACIÓN DE FRECUENCIA RF',
    systemHealth: 'INTEGRIDAD Y DIAGNÓSTICO',
  },
  fr: {
    navHome: 'ACCUEIL',
    navDashboard: 'TABLEAU DE BORD',
    navSimulate: 'SIMULER',
    navNodes: 'NŒUDS',
    navAlerts: 'ALERTES',
    navDataGraphs: 'DONNÉES & GRAPHIQUES',
    navSettings: 'PARAMÈTRES',

    c2Title: 'NSG CQB-MANET // C2',
    viewDashboard: 'VOIR TABLEAU DE BORD',
    demoSimulation: 'SIMULATION DÉMO',
    liveHwMode: 'MODE MATÉRIEL DIRECT',
    online: 'EN LIGNE',
    offline: 'HORS LIGNE',
    standby: 'EN ATTENTE',
    jammerActive: 'BROUILLEUR ACTIF',
    reCenter: 'RE-CENTRER',
    resetSquad: 'RÉINITIALISER ESCOUADE',
    rangeRings: 'ANNEAUX DE PORTÉE',
    adhocBeams: 'FAISCEAUX SECTORIELS',

    projectTitle: 'CASQUE CQB-MANET INTELLIGENT AVEC ANTENNE CONFORME',
    projectSubtitle: 'SIH PS 26185 — Maillage Ad-Hoc Portable, Bouclier SAR AMC & Auto-Guérison IA',
    problemStatement: 'ÉNONCÉ DU PROBLÈME DE MISSION',
    problemDesc: 'En milieu clos sans GPS, les murs en béton affaiblissent les signaux radio. Ce système fournit un réseau d’antennes conformes et un maillage autonome avec réorientation spatiale par IA.',
    keyInnovations: 'INNOVATIONS ARCHITECTURALES',
    innovation1Title: 'Réseau Micro-Ruban Conforme (4 Secteurs)',
    innovation1Desc: 'Antennes 1.42 GHz orientables à diodes PIN intégrées au casque.',
    innovation2Title: 'Blindage Métamatériau AMC',
    innovation2Desc: 'Réduit l’absorption des tissus cérébraux sous 0.08 W/kg.',
    innovation3Title: 'Réseau Maillé Auto-Organisé MANET',
    innovation3Desc: 'Routage multi-sauts dynamique sans station de base.',
    innovation4Title: 'Moteur de Guérison Spatiale IA',
    innovation4Desc: 'Calcule les points de repositionnement précis ("Ghost Nodes") pour rétablir la communication.',
    umlArchitecture: 'ARCHITECTURE PALANTIR FOUNDRY & PIPELINE UML',
    launchConsole: 'LANCER LA CONSOLE DE COMMANDEMENT',

    nodesTitle: 'RÉPERTOIRE DES NŒUDS TACTIQUES & TÉLÉMÉTRIE',
    nodesSubtitle: 'Télémétrie en temps réel, édition du nom et état de secours',
    activeNodesTab: 'NŒUDS ACTIFS',
    hiddenNodesTab: 'NŒUDS SUPPRIMÉS / MASQUÉS',
    editDisplayName: 'Modifier Nom / Indicatif',
    save: 'ENREGISTRER',
    cancel: 'ANNULER',
    hideDeleteNode: 'SUPPRIMER / MASQUER NŒUD',
    restoreNode: 'RESTAURER DANS LE MAILLAGE',
    simulateDisconnect: 'SIMULER DÉCONNEXION',
    simulateReconnect: 'RECONNECTER NŒUD',
    batteryLevel: 'BATTERIE',
    activeBeamSector: 'SECTEUR FAISCEAU',
    signalSinr: 'SINR LIAISON',
    lastKnownPos: 'DERNIÈRE POS. EN LIGNE',
    statusConnected: 'CONNECTÉ',
    statusDisconnected: 'LIAISON PERDUE (CERCLE ROUGE)',

    alertsTitle: 'ALERTES TACTIQUES & INTELLIGENCE DES MENACES',
    alertsEmptyMsg: 'Moteur d’alertes initialisé. Les règles de détection et avertissements apparaîtront ici.',
    dataGraphsTitle: 'ANALYTIQUE & HISTORIQUE DE TÉLÉMÉTRIE',
    dataGraphsEmptyMsg: 'Les graphiques de densité spectrale, courbes de SINR et latence apparaîtront ici.',

    settingsTitle: 'PARAMÈTRES SYSTÈME & PRÉFÉRENCES',
    settingsSubtitle: 'Personnalisez le thème d’interface, la langue et les fréquences radio',
    themePreference: 'THÈME D’AFFICHAGE',
    darkMode: 'MODE SOMBRE (OPÉRATIONS DE NUIT)',
    lightMode: 'MODE CLAIR (STANDARD FOUNDRY)',
    languageSelect: 'LANGUE OPÉRATIONNELLE',
    radioFreqConfig: 'FRÉQUENCE PORTEUSE RF',
    systemHealth: 'DIAGNOSTIC & INTÉGRITÉ',
  },
  de: {
    navHome: 'STARTSEITE',
    navDashboard: 'DASHBOARD',
    navSimulate: 'SIMULATION',
    navNodes: 'KNOTEN',
    navAlerts: 'ALARME',
    navDataGraphs: 'DATEN & DIAGRAMME',
    navSettings: 'EINSTELLUNGEN',

    c2Title: 'NSG CQB-MANET // C2',
    viewDashboard: 'DASHBOARD ÖFFNEN',
    demoSimulation: 'DEMO-SIMULATION',
    liveHwMode: 'LIVE-HARDWARE-MODUS',
    online: 'ONLINE',
    offline: 'OFFLINE',
    standby: 'STANDBY',
    jammerActive: 'STÖRSENDER AKTIV',
    reCenter: 'NEU ZENTRIEREN',
    resetSquad: 'TRUPP ZURÜCKSETZEN',
    rangeRings: 'REICHWEITENRINGE',
    adhocBeams: 'STRAHLENSEKTOREN',

    projectTitle: 'INTELLIGENTER CQB-MANET-HELM MIT KONFORMEM ANTENNEN-ARRAY',
    projectSubtitle: 'SIH PS 26185 — Tragbares Ad-Hoc-Mesh, AMC-SAR-Schild & KI-Ghost-Heilung',
    problemStatement: 'MISSIONS-PROBLEMSTELLUNG',
    problemDesc: 'In GPS-verweigerten CQB-Umgebungen blockieren Betonwände Funksignale. Dieses System bietet konforme Patch-Antennen mit Ad-Hoc-Mesh-Relais und KI-basierter räumlicher Selbstheilung.',
    keyInnovations: 'KERNINNOVATIONEN',
    innovation1Title: 'Konformes Patch-Array (4-Sektor-Steuerung)',
    innovation1Desc: '1.42 GHz Richtstrahl-Patches mit PIN-Dioden-Umschaltung direkt im Helm integriert.',
    innovation2Title: 'Metamaterial-AMC-Abschirmung',
    innovation2Desc: 'Reduziert die SAR-Strahlungsabsorption auf unter 0.08 W/kg.',
    innovation3Title: 'Selbstorganisierendes MANET-Mesh',
    innovation3Desc: 'Dynamisches Multi-Hop-Routing ohne zentrale Basisstation.',
    innovation4Title: 'KI-Räumliche Ghost-Heilung',
    innovation4Desc: 'Berechnet millimetergenaue Neupositionierungsvektoren ("Ghost Nodes") zur Signalwiederherstellung.',
    umlArchitecture: 'PALANTIR FOUNDRY ARCHITEKTUR & UML-DATENPIPELINE',
    launchConsole: 'EINSATZZENTRALE STARTEN',

    nodesTitle: 'TAKTIK-KNOTEN-VERZEICHNIS & TELEMETRIE',
    nodesSubtitle: 'Echtzeit-Telemetrie, Rufzeichen-Anpassung und Redundanzstatus',
    activeNodesTab: 'AKTIVE KNOTEN',
    hiddenNodesTab: 'GELÖSCHTE / AUSGEBLENDETE KNOTEN',
    editDisplayName: 'Rufzeichen / Name bearbeiten',
    save: 'SPEICHERN',
    cancel: 'ABBRECHEN',
    hideDeleteNode: 'KNOTEN LÖSCHEN / AUSBLENDEN',
    restoreNode: 'IN MESH WIEDERHERSTELLEN',
    simulateDisconnect: 'VERBINDUNGSVERLUST SIMULIEREN',
    simulateReconnect: 'KNOTEN WIEDER VERBINDEN',
    batteryLevel: 'BATTERIE',
    activeBeamSector: 'STRAHLENSEKTOR',
    signalSinr: 'SIGNAL-SINR',
    lastKnownPos: 'LETZTE ONLINE-POSITION',
    statusConnected: 'VERBUNDEN',
    statusDisconnected: 'VERBINDUNG VERLOREN (ROTER KREIS)',

    alertsTitle: 'TAKTIKSCHE ALARME & BEDROHUNGSERKENNUNG',
    alertsEmptyMsg: 'Alarm-Engine initialisiert. Störsender-Warnungen und Grenzwert-Alarme erscheinen hier.',
    dataGraphsTitle: 'ANALYTIK & HISTORISCHE TELEMETRIE',
    dataGraphsEmptyMsg: 'Spektraldichte-Diagramme, SINR-Verläufe und Paketverlust-Statistiken erscheinen hier.',

    settingsTitle: 'SYSTEMEINSTELLUNGEN & PRÄFERENZEN',
    settingsSubtitle: 'Passen Sie Oberflächendesign, Einsatzsprache und Funkfrequenzen an',
    themePreference: 'FARBSCHEMA',
    darkMode: 'DUNKLER MODUS (NACHTEINSATZ)',
    lightMode: 'HELLER MODUS (FOUNDRY-STANDARD)',
    languageSelect: 'EINSATZSPRACHE',
    radioFreqConfig: 'HF-TRÄGERFREQUENZ',
    systemHealth: 'DIAGNOSE & SYSTEMINTEGRITÄT',
  },
};
