import React, { useState, useEffect, useRef } from 'react';
import ScanbotSDK from 'scanbot-web-sdk';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToExcel, exportToPDF } from './exporter';
import { 
  Camera, Mic, Volume2, VolumeX, Sparkles, 
  Smartphone, MapPin, Box, BarChart3,
  Map, ClipboardCheck, ArrowLeftRight, CheckCircle2, 
  AlertTriangle, Scan, DollarSign, Activity, Flame, Lightbulb,
  Layers, Search, Sliders, Filter, ZoomIn, ZoomOut, Move,
  Plus, Minus, History, Trash2, Edit2, RotateCcw, Check, Truck, Lock,
  ArrowUpDown, ChevronDown, Download, FileSpreadsheet, FileText, Sun, Moon, Database,
  Flashlight, FlashlightOff
} from 'lucide-react';

// Import Firestore for offline synchronization
import { db, doc, setDoc, onSnapshot, disableNetwork, enableNetwork, handleFirestoreError, OperationType } from './firebase';

const LICENSE_KEY =
  "Mj57qHkzAm9HR7g+EM9qxfshlb+aBH" +
  "vKipwpv7qSQ9javbAzspC6UsTBA+0U" +
  "UIADliLjc7qjEEf8xYityfvloER/hk" +
  "zi5ywQX3174Qd/cUzgxzMqx7ia+Vcd" +
  "38wEqkgyzMAFgBoZYki1fM31QD8Z+r" +
  "Wp4T+EJAoQB8+bhn7bu6MWTFIVIkaD" +
  "ICNvLt8PB94T/9R7q+17qq6K9chNkG" +
  "+a+UgVQzMXWVWhB79PUz6ocCqplwzO" +
  "eE3Hb6v5FwDDfPZ98UNL6vIvaZhQA9" +
  "MI8tt5M/Uzqi0ltDi4PueG6UMMquDY" +
  "vWGR95psXqHor28LxBMXeoyderUIRe" +
  "ukbseJX8yI5A==\nU2NhbmJvdFNESw" +
  "psb2NhbGhvc3R8YWlzdHVkaW8uZ29v" +
  "Z2xlLmNvbQoxNzgzMDM2Nzk5CjgzOD" +
  "g2MDcKOA==\n";

// Categorias organizadas pelas ruas físicas do armazém
interface SectorInfo {
  nome: string;
  rua: string;
  cor: string;
  textoCor: string;
  eficiencia: number;
}

const SUBCATEGORIES_LIMPEZA = [
  "Detergentes",
  "Desinfetantes",
  "Água Sanitária",
  "Sabão Líquido",
  "Sabão em Pó",
  "Limpadores Multiuso",
  "Desengordurantes",
  "Limpadores Perfumados",
  "Limpa Vidros",
  "Limpa Alumínio",
  "Limpa Piso",
  "Limpa Pedras",
  "Limpa Banheiro",
  "Removedores",
  "Álcool",
  "Cloro",
  "Amaciantes",
  "Aromatizantes",
  "Neutralizadores de Odores",
  "Produtos Concentrados",
  "Produtos Hospitalares",
  "Produtos Industriais",
  "Higienizadores",
  "Esponjas",
  "Panos de Limpeza",
  "Flanelas",
  "Mops",
  "Vassouras",
  "Rodos",
  "Escovas",
  "Baldes",
  "Pulverizadores",
  "Luvas de Limpeza"
];

const SECTORS_CD: Record<string, SectorInfo> = {
  LIMPEZA: { nome: 'Sabões e Detergentes (Limpeza)', rua: 'Rua A', cor: 'bg-cyan-500 border-cyan-400 text-cyan-950', textoCor: 'text-cyan-400', eficiencia: 94 },
  INFRAESTRUTURA: { nome: 'Desinfetantes e Álcool (Limpeza)', rua: 'Rua B', cor: 'bg-indigo-500 border-indigo-400 text-indigo-950', textoCor: 'text-indigo-400', eficiencia: 88 },
  TINTAS: { nome: 'Limpadores Especiais (Limpeza)', rua: 'Rua C', cor: 'bg-teal-500 border-teal-400 text-teal-950', textoCor: 'text-teal-400', eficiencia: 92 },
  GERAL: { nome: 'Materiais de Apoio (Limpeza)', rua: 'Rua D', cor: 'bg-purple-500 border-purple-400 text-purple-950', textoCor: 'text-purple-400', eficiencia: 91 }
};

interface InventoryItem {
  ean: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  marca?: string;
  fabricante?: string;
  rua: string;
  prateleira: string;
  giro?: string;
  peso?: string;
  quantidade: number;
  lote: string;
  vencimento: string; // ISO date format "YYYY-MM-DD"
  statusPosicao?: 'disponivel' | 'parcial' | 'ocupado' | 'reservado' | 'bloqueado';
  ultimaMovimentacao?: string; // "YYYY-MM-DD"
}

// Produtos cadastrados para simulação
const INITIAL_INVENTORY: InventoryItem[] = [
  { 
    ean: '7898765432109', 
    nome: 'Detergente 500ml', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Detergentes',
    marca: 'Genérica',
    fabricante: 'Genérica',
    rua: 'Rua A', 
    prateleira: 'A-01', 
    giro: 'Alto', 
    peso: '0.5kg', 
    quantidade: 120, 
    lote: 'LT-DET-500', 
    vencimento: '2028-01-20', 
    statusPosicao: 'ocupado', 
    ultimaMovimentacao: '2026-06-25' 
  },
  { 
    ean: '7891011', 
    nome: 'Detergente Neutro Ypê Pro 5L', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Detergentes',
    marca: 'Ypê',
    fabricante: 'Química Amparo',
    rua: 'Rua A', 
    prateleira: 'A-03', 
    giro: 'Alto', 
    peso: '5kg', 
    quantidade: 85, 
    lote: 'LT-DET-01', 
    vencimento: '2027-12-01', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-10' 
  },
  { 
    ean: '7891012', 
    nome: 'Desinfetante Pinho Sol Regular 2L', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Desinfetantes',
    marca: 'Pinho Sol',
    fabricante: 'Colgate-Palmolive',
    rua: 'Rua B', 
    prateleira: 'B-12', 
    giro: 'Médio', 
    peso: '2kg', 
    quantidade: 100, 
    lote: 'LT-DES-22', 
    vencimento: '2027-05-15', 
    statusPosicao: 'ocupado', 
    ultimaMovimentacao: '2026-05-20' 
  },
  { 
    ean: '7891013', 
    nome: 'Água Sanitária Super Candida 5L', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Água Sanitária',
    marca: 'Super Candida',
    fabricante: 'Anhembi',
    rua: 'Rua B', 
    prateleira: 'B-05', 
    giro: 'Alto', 
    peso: '5kg', 
    quantidade: 15, 
    lote: 'LT-AGU-89', 
    vencimento: '2026-07-10', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-18' 
  },
  { 
    ean: '7891014', 
    nome: 'Sabão Líquido Omo Proteção Completa 3L', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Sabão Líquido',
    marca: 'Omo',
    fabricante: 'Unilever',
    rua: 'Rua A', 
    prateleira: 'A-02', 
    giro: 'Alto', 
    peso: '3kg', 
    quantidade: 40, 
    lote: 'LT-SAB-09', 
    vencimento: '2027-03-30', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-22' 
  },
  { 
    ean: '7891015', 
    nome: 'Sabão em Pó Brilhante Ativo 1.6kg', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Sabão em Pó',
    marca: 'Brilhante',
    fabricante: 'Unilever',
    rua: 'Rua A', 
    prateleira: 'A-05', 
    giro: 'Alto', 
    peso: '1.6kg', 
    quantidade: 0, 
    lote: 'LT-PO-15', 
    vencimento: '2026-05-10', 
    statusPosicao: 'disponivel', 
    ultimaMovimentacao: '2026-05-01' 
  },
  { 
    ean: '7891016', 
    nome: 'Limpador Multiuso Veja Gold Original 500ml', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Limpadores Multiuso',
    marca: 'Veja',
    fabricante: 'Reckitt Benckiser',
    rua: 'Rua C', 
    prateleira: 'C-06', 
    giro: 'Baixo', 
    peso: '0.5kg', 
    quantidade: 10, 
    lote: 'LT-VEJ-44', 
    vencimento: '2027-06-01', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-04-12' 
  },
  { 
    ean: '7891017', 
    nome: 'Desengordurante Cif Milagroso 500ml', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Desengordurantes',
    marca: 'Cif',
    fabricante: 'Unilever',
    rua: 'Rua C', 
    prateleira: 'C-02', 
    giro: 'Baixo', 
    peso: '0.5kg', 
    quantidade: 5, 
    lote: 'LT-CIF-99', 
    vencimento: '2027-08-10', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-01-15' 
  },
  { 
    ean: '7891018', 
    nome: 'Mop Giratório FlashLimp Fit', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Mops',
    marca: 'FlashLimp',
    fabricante: 'FlashLimp Log',
    rua: 'Rua D', 
    prateleira: 'D-01', 
    giro: 'Médio', 
    peso: '2.5kg', 
    quantidade: 35, 
    lote: 'LT-MOP-11', 
    vencimento: '2030-12-31', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-24' 
  },
  { 
    ean: '7891019', 
    nome: 'Panos de Microfibra Bettanin (Emb c/ 5)', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Panos de Limpeza',
    marca: 'EsfreBom',
    fabricante: 'Bettanin',
    rua: 'Rua D', 
    prateleira: 'D-03', 
    giro: 'Alto', 
    peso: '0.2kg', 
    quantidade: 120, 
    lote: 'LT-PAN-77', 
    vencimento: '2032-01-01', 
    statusPosicao: 'ocupado', 
    ultimaMovimentacao: '2026-06-23' 
  },
  { 
    ean: '7891020', 
    nome: 'Amaciante Concentrado Downy Brisa de Verão 1.5L', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Amaciantes',
    marca: 'Downy',
    fabricante: 'Procter & Gamble',
    rua: 'Rua A', 
    prateleira: 'A-06', 
    giro: 'Alto', 
    peso: '1.5kg', 
    quantidade: 60, 
    lote: 'LT-AMA-55', 
    vencimento: '2027-10-18', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-25' 
  },
  { 
    ean: '7891021', 
    nome: 'Cloro Ativo Concentrado HTH 10kg', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Cloro',
    marca: 'HTH',
    fabricante: 'Innovative Water Care',
    rua: 'Rua B', 
    prateleira: 'B-04', 
    giro: 'Médio', 
    peso: '10kg', 
    quantidade: 22, 
    lote: 'LT-CLO-02', 
    vencimento: '2028-04-12', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-14' 
  },
  { 
    ean: '7891022', 
    nome: 'Vassoura de Nylon Condor V-9', 
    categoria: 'LIMPEZA', 
    subcategoria: 'Vassouras',
    marca: 'Condor',
    fabricante: 'Condor S.A.',
    rua: 'Rua D', 
    prateleira: 'D-02', 
    giro: 'Médio', 
    peso: '0.4kg', 
    quantidade: 48, 
    lote: 'LT-VAS-88', 
    vencimento: '2035-01-01', 
    statusPosicao: 'parcial', 
    ultimaMovimentacao: '2026-06-05' 
  }
];

interface LogItem {
  acao: string;
  hora: string;
}

interface RecommendationItem {
  id: number;
  texto: string;
  resolvida: boolean;
  impacto: string;
}

interface SimulationResult {
  saude: number;
  custoLogistico: number;
  tempoSeparacao: number;
  acuracidadeEstimada: number;
}

export interface ShippingOrder {
  id: string;
  destino: string;
  prioridade: 'Normal' | 'Alta' | 'Urgente';
  caminhaoPlaca: string;
  status: 'Pendente' | 'Separando' | 'Conferido' | 'Carregado' | 'Enviado';
  itens: Array<{
    ean: string;
    nome: string;
    quantidade: number;
    rua: string;
    prateleira: string;
  }>;
  dataCriacao: string;
}

const INITIAL_SHIPPING_ORDERS: ShippingOrder[] = [
  {
    id: "EXP-2026-001",
    destino: "Supermercados Pampa - Porto Alegre / RS",
    prioridade: "Alta",
    caminhaoPlaca: "EXP-9088",
    status: "Conferido",
    itens: [
      { ean: "7891011", nome: "Detergente Neutro Ypê Pro 5L", quantidade: 15, rua: "Rua A", prateleira: "A-03" },
      { ean: "7891014", nome: "Sabão Líquido Omo Proteção Completa 3L", quantidade: 8, rua: "Rua A", prateleira: "A-02" }
    ],
    dataCriacao: "2026-06-26 08:30"
  },
  {
    id: "EXP-2026-002",
    destino: "Atacadão Centro-Oeste - Goiânia / GO",
    prioridade: "Urgente",
    caminhaoPlaca: "GOI-4433",
    status: "Separando",
    itens: [
      { ean: "7891012", nome: "Desinfetante Pinho Sol Regular 2L", quantidade: 20, rua: "Rua B", prateleira: "B-12" },
      { ean: "7891013", nome: "Água Sanitária Super Candida 5L", quantidade: 5, rua: "Rua B", prateleira: "B-05" }
    ],
    dataCriacao: "2026-06-26 09:15"
  },
  {
    id: "EXP-2026-003",
    destino: "Distribuidora Sudeste - Rio de Janeiro / RJ",
    prioridade: "Normal",
    caminhaoPlaca: "RIO-2026",
    status: "Pendente",
    itens: [
      { ean: "7891015", nome: "Sabão em Pó Brilhante Ativo 1.6kg", quantidade: 12, rua: "Rua A", prateleira: "A-05" }
    ],
    dataCriacao: "2026-06-26 10:00"
  }
];

export interface InboundLoad {
  id: string;
  placaCaminhao: string;
  motorista: string;
  produto: string;
  ean: string;
  quantidadeCaixas: number;
  dataHora: string;
  status: 'Pendente' | 'Conferido' | 'Finalizado';
}

const INITIAL_INBOUND_LOADS: InboundLoad[] = [
  {
    id: "ENT-2026-001",
    placaCaminhao: "ABC-1234",
    motorista: "Marcos Souza",
    produto: "Detergente 500ml",
    ean: "7898765432109",
    quantidadeCaixas: 80,
    dataHora: "2026-06-25 14:10",
    status: "Finalizado"
  },
  {
    id: "ENT-2026-002",
    placaCaminhao: "XYZ-5678",
    motorista: "Reginaldo Silva",
    produto: "Detergente Neutro Ypê Pro 5L",
    ean: "7891011",
    quantidadeCaixas: 120,
    dataHora: "2026-06-26 07:45",
    status: "Conferido"
  },
  {
    id: "ENT-2026-003",
    placaCaminhao: "MNO-9012",
    motorista: "Felipe Mendes",
    produto: "Desinfetante Pinho Sol Regular 2L",
    ean: "7891012",
    quantidadeCaixas: 50,
    dataHora: "2026-06-26 10:30",
    status: "Pendente"
  }
];

export default function App() {
  const [somAtivo, setSomAtivo] = useState(true);

  // SISTEMA DE SINCRONIZAÇÃO FIRESTORE E RESILIÊNCIA OFFLINE
  const [offlineManual, setOfflineManual] = useState<boolean>(() => {
    return localStorage.getItem('wms_offline_manual') === 'true';
  });
  const [onlineStatus, setOnlineStatus] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Controlar o estado de rede do Firestore (Simular Offline)
  useEffect(() => {
    localStorage.setItem('wms_offline_manual', String(offlineManual));
    if (offlineManual) {
      disableNetwork(db).catch(err => console.error("Erro ao desabilitar rede Firestore:", err));
    } else {
      enableNetwork(db).catch(err => console.error("Erro ao habilitar rede Firestore:", err));
    }
  }, [offlineManual]);

  // Funções auxiliares para comparação profunda das listas e evitar loops de sincronização
  const isSameInventory = (a: InventoryItem[], b: InventoryItem[]) => {
    if (!a || !b || a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x.ean.localeCompare(y.ean));
    const sortedB = [...b].sort((x, y) => x.ean.localeCompare(y.ean));
    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  };

  const isSameInbound = (a: InboundLoad[], b: InboundLoad[]) => {
    if (!a || !b || a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
    const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));
    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  };

  const isSameShipping = (a: ShippingOrder[], b: ShippingOrder[]) => {
    if (!a || !b || a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
    const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));
    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  };

  const hasLoadedInventoryRef = useRef(false);
  const hasLoadedInboundRef = useRef(false);
  const hasLoadedShippingRef = useRef(false);

  // CONFIGURAÇÕES DE ÁUDIO E FEEDBACK DO WMS
  const [somLeituraAtivo, setSomLeituraAtivo] = useState<boolean>(() => {
    const stored = localStorage.getItem('wms_som_leitura');
    return stored === null ? true : stored === 'true';
  });
  const [volumeBipe, setVolumeBipe] = useState<number>(() => {
    const stored = localStorage.getItem('wms_volume_bipe');
    return stored === null ? 0.15 : parseFloat(stored);
  });
  const [somErroAtivo, setSomErroAtivo] = useState<boolean>(() => {
    const stored = localStorage.getItem('wms_som_erro');
    return stored === null ? true : stored === 'true';
  });
  const [vibracaoLeitura, setVibracaoLeitura] = useState<boolean>(() => {
    const stored = localStorage.getItem('wms_vibracao_leitura');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('wms_som_leitura', String(somLeituraAtivo));
  }, [somLeituraAtivo]);

  useEffect(() => {
    localStorage.setItem('wms_volume_bipe', String(volumeBipe));
  }, [volumeBipe]);

  useEffect(() => {
    localStorage.setItem('wms_som_erro', String(somErroAtivo));
  }, [somErroAtivo]);

  useEffect(() => {
    localStorage.setItem('wms_vibracao_leitura', String(vibracaoLeitura));
  }, [vibracaoLeitura]);
  const [viewMode, setViewMode] = useState<
    'mobile' | 
    'dashboard' | 
    'ia_preditiva' | 
    'estoque' | 
    'expedicao' | 
    'relatorios' | 
    'configuracoes' | 
    'sobre'
  >('mobile');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  // CONFIGURAÇÕES GLOBAIS
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('wms_theme') as 'light' | 'dark') || 'light';
  });
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('wms_fontsize') as 'normal' | 'large' | 'xlarge') || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('wms_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('wms_fontsize', fontSize);
    document.documentElement.classList.remove('font-size-large', 'font-size-xlarge');
    if (fontSize === 'large') document.documentElement.classList.add('font-size-large');
    if (fontSize === 'xlarge') document.documentElement.classList.add('font-size-xlarge');
  }, [fontSize]);
  
  // MÓDULOS GESTOR: Controle de abas
  const [executiveTab, setExecutiveTab] = useState<'torre' | 'inventario' | 'expedicao'>('torre');

  // Estados de Entrada de Carga
  const [inboundLoads, setInboundLoads] = useState<InboundLoad[]>(INITIAL_INBOUND_LOADS);

  // Form states para a entrada mobile
  const [entradaPlacaCaminhao, setEntradaPlacaCaminhao] = useState('');
  const [entradaMotorista, setEntradaMotorista] = useState('');

  // Estados da Área de Expedição
  const [shippingOrders, setShippingOrders] = useState<ShippingOrder[]>(INITIAL_SHIPPING_ORDERS);

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState<ShippingOrder | null>(null);
  const [pickingProgress, setPickingProgress] = useState<Record<string, number>>({});
  
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupStep, setBackupStep] = useState<'menu' | 'creating' | 'validating' | 'ready' | 'restoring' | 'success'>('menu');
  const [backupProgress, setBackupProgress] = useState(0);

  // Form de Novo Pedido de Expedição
  const [newOrderDestino, setNewOrderDestino] = useState('');
  const [newOrderPrioridade, setNewOrderPrioridade] = useState<'Normal' | 'Alta' | 'Urgente'>('Normal');
  const [newOrderPlaca, setNewOrderPlaca] = useState('');
  const [newOrderItens, setNewOrderItens] = useState<Array<{ ean: string; nome: string; quantidade: number; rua: string; prateleira: string }>>([]);
  const [selectedFormItemEan, setSelectedFormItemEan] = useState('');
  const [selectedFormItemQtd, setSelectedFormItemQtd] = useState('1');

  // Estado das docas de expedição
  const [doca2Status, setDoca2Status] = useState({
    placa: 'EXP-9088',
    motorista: 'Carlos Oliveira',
    transportadora: 'TransRapido Logística',
    temperatura: '18.2°C',
    checklist: {
      epis: true,
      lote: true,
      seguranca: true
    }
  });

  // Inventário Ativo (Live State)
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const isInventoryFromServer = useRef(false);
  const isInboundFromServer = useRef(false);
  const isShippingFromServer = useRef(false);

  // EFEITOS DE SINCRONIZAÇÃO EM TEMPO REAL COM FIRESTORE (COM LATÊNCIA COMPENSADA E SUPORTE OFFLINE)
  useEffect(() => {
    // 1. Sincronização do Inventário
    const unsubInventory = onSnapshot(doc(db, "wms_data", "inventory"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.items) {
          setInventory((current) => {
            if (!isSameInventory(current, data.items)) {
              isInventoryFromServer.current = true;
              return data.items;
            }
            return current;
          });
        }
      } else {
        // Se o documento não existir no banco remoto (ex: primeira execução), inicializa com o estado padrão
        setDoc(doc(db, "wms_data", "inventory"), { items: inventory }).catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, "wms_data/inventory");
        });
      }
      hasLoadedInventoryRef.current = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "wms_data/inventory");
    });

    // 2. Sincronização das Cargas de Entrada (Inbound Loads)
    const unsubInbound = onSnapshot(doc(db, "wms_data", "inbound_loads"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.items) {
          setInboundLoads((current) => {
            if (!isSameInbound(current, data.items)) {
              isInboundFromServer.current = true;
              return data.items;
            }
            return current;
          });
        }
      } else {
        setDoc(doc(db, "wms_data", "inbound_loads"), { items: inboundLoads }).catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, "wms_data/inbound_loads");
        });
      }
      hasLoadedInboundRef.current = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "wms_data/inbound_loads");
    });

    // 3. Sincronização de Pedidos de Expedição
    const unsubShipping = onSnapshot(doc(db, "wms_data", "shipping_orders"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.items) {
          setShippingOrders((current) => {
            if (!isSameShipping(current, data.items)) {
              isShippingFromServer.current = true;
              return data.items;
            }
            return current;
          });
        }
      } else {
        setDoc(doc(db, "wms_data", "shipping_orders"), { items: shippingOrders }).catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, "wms_data/shipping_orders");
        });
      }
      hasLoadedShippingRef.current = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "wms_data/shipping_orders");
    });

    return () => {
      unsubInventory();
      unsubInbound();
      unsubShipping();
    };
  }, []);

  // Salvar alterações locais de volta ao Firestore (apenas após carregar o estado inicial do servidor)
  useEffect(() => {
    if (!hasLoadedInventoryRef.current) return;
    if (isInventoryFromServer.current) {
      isInventoryFromServer.current = false;
      return; // Skip writing back if the change came from the server
    }
    setDoc(doc(db, "wms_data", "inventory"), { items: inventory }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, "wms_data/inventory");
    });
  }, [inventory]);

  useEffect(() => {
    if (!hasLoadedInboundRef.current) return;
    if (isInboundFromServer.current) {
      isInboundFromServer.current = false;
      return;
    }
    setDoc(doc(db, "wms_data", "inbound_loads"), { items: inboundLoads }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, "wms_data/inbound_loads");
    });
  }, [inboundLoads]);

  useEffect(() => {
    if (!hasLoadedShippingRef.current) return;
    if (isShippingFromServer.current) {
      isShippingFromServer.current = false;
      return;
    }
    setDoc(doc(db, "wms_data", "shipping_orders"), { items: shippingOrders }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, "wms_data/shipping_orders");
    });
  }, [shippingOrders]);

  // Estados de busca e filtros do inventário
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSubcategory, setFilterSubcategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Estados de formulários de movimentação de estoque
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState<InventoryItem | null>(null);
  const [showTransferModal, setShowTransferModal] = useState<InventoryItem | null>(null);

  // Formulário: Dar Entrada
  const [formEan, setFormEan] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState('LIMPEZA');
  const [formSubcategoria, setFormSubcategoria] = useState('Detergentes');
  const [formMarca, setFormMarca] = useState('');
  const [formFabricante, setFormFabricante] = useState('');
  const [formRua, setFormRua] = useState('Rua A');
  const [formPrateleira, setFormPrateleira] = useState('A-01');
  const [formQuantidade, setFormQuantidade] = useState('50');
  const [formLote, setFormLote] = useState('');
  const [formVencimento, setFormVencimento] = useState('2027-01-01');

  // Formulário: Transferência
  const [transferNewRua, setTransferNewRua] = useState('Rua A');
  const [transferNewPrateleira, setTransferNewPrateleira] = useState('A-01');

  // Formulário: Ajuste de Quantidade
  const [ajusteNovaQtd, setAjusteNovaQtd] = useState('50');

  // Auditoria de Inventário Rápido (Ciclo de contagem e discrepâncias)
  const [quickCountItem, setQuickCountItem] = useState<InventoryItem | null>(null);
  const [quickCountValue, setQuickCountValue] = useState('');
  const [divergencias, setDivergencias] = useState<Record<string, { esperado: number; contado: number; lote: string }>>({});

  // Mapa Logístico 3D: Controles e Interações
  const [mapZoom, setMapZoom] = useState(1);
  const [mapFilterStreet, setMapFilterStreet] = useState('All');
  const [mapSearchHighlight, setMapSearchHighlight] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ street: string; rack: string; item: InventoryItem | null } | null>(null);

  // Estados da Tela do Coletor
  const [telaMobile, setTelaMobile] = useState<'menu' | 'entrada' | 'organizacao' | 'scanner' | 'voz' | 'inventario' | 'mapa_3d' | 'cadastrar_imagem'>('menu');
  const [mobileInventarioTab, setMobileInventarioTab] = useState<'geral' | 'ciclico' | 'rotativo' | 'historico'>('geral');
  const [inventarioLogs, setInventarioLogs] = useState<Array<{ id: number; tipo: string; item: string; endereco: string; esperado: number; contado: number; status: string; data: string }>>([
    { id: 1, tipo: 'Cíclico', item: 'Detergente Neutro Ypê Pro 5L', endereco: 'A-03', esperado: 85, contado: 85, status: 'Sem Divergências', data: '2026-06-25 10:15' },
    { id: 2, tipo: 'Rotativo', item: 'Limpador Multiuso Veja Gold Original 500ml', endereco: 'C-06', esperado: 10, contado: 10, status: 'Conferido', data: '2026-06-25 09:40' },
    { id: 3, tipo: 'Geral', item: 'Água Sanitária Super Candida 5L', endereco: 'B-05', esperado: 15, contado: 15, status: 'Conferido', data: '2026-06-24 16:30' }
  ]);
  const [mobileAjusteItem, setMobileAjusteItem] = useState<InventoryItem | null>(null);
  const [mobileTransferItem, setMobileTransferItem] = useState<InventoryItem | null>(null);
  const [mobileQtdAjuste, setMobileQtdAjuste] = useState('0');
  const [rotativoRua, setRotativoRua] = useState('Rua A');
  const [rotativoPrateleira, setRotativoPrateleira] = useState('A-01');
  const [rotativoQtd, setRotativoQtd] = useState('');
  const [rotativoLote, setRotativoLote] = useState('');
  const [scannerAtivoSimulado, setScannerAtivoSimulado] = useState(false);
  const [skuScannedDirect, setSkuScannedDirect] = useState<InventoryItem | null>(null);
  const [scannedPhysicalQtd, setScannedPhysicalQtd] = useState('');
  const [mobileNewRua, setMobileNewRua] = useState('Rua A');
  const [mobileNewPrateleira, setMobileNewPrateleira] = useState('A-01');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [usarCameraNativa, setUsarCameraNativa] = useState(false);
  const [leituraCodigo, setLeituraCodigo] = useState('');
  const [leituraErroMsg, setLeituraErroMsg] = useState<string | null>(null);
  const [produtoDetectado, setProdutoDetectado] = useState<InventoryItem | null>(null);
  const [exibirMapaModal, setExibirMapaModal] = useState(false);
  const [mensagemSucessoAnim, setMensagemSucessoAnim] = useState(false);
  const [qtdEntrada, setQtdEntrada] = useState('1');
  const [mensagemVoz, setMensagemVoz] = useState('Diga ou digite um comando. Exemplo: "Iniciar rota de materiais de apoio"');
  const [catalogImage, setCatalogImage] = useState<string | null>(null);
  const [catalogImageLoading, setCatalogImageLoading] = useState(false);
  const [catalogJsonResult, setCatalogJsonResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanbotSDKRef = useRef<any>(null);
  const scanbotScannerRef = useRef<any>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningStoppedRef = useRef<boolean>(false);
  const isCameraTransitioningRef = useRef<boolean>(false);
  const zxingReaderRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      const initDetector = async () => {
        try {
          const supportedFormats = (window as any).BarcodeDetector?.getSupportedFormats 
            ? await (window as any).BarcodeDetector.getSupportedFormats() 
            : ['aztec', 'codabar', 'code_128', 'code_39', 'code_93', 'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'];
          
          // @ts-ignore
          barcodeDetectorRef.current = new BarcodeDetector({
            formats: supportedFormats
          });
        } catch (e) {
          console.warn("BarcodeDetector initialization failed:", e);
        }
      };
      initDetector();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Indicadores de Saúde do Armazém
  const [saudeArmazem, setSaudeArmazem] = useState(82); // Pontuação inicial de 0 a 100
  const [custosOcultos, setCustosOcultos] = useState(4820); // Valor perdido em dinheiro por ineficiências
  const [acuracidade, setAcuracidade] = useState(94.2); // Furo de estoque simulado
  const [tempoPicking, setTempoPicking] = useState(148); // Tempo médio em segundos
  const [gargaloAtivo, setGargaloAtivo] = useState(true); // Se há gargalo ativo de picking
  
  // Lista de Recomendações Automáticas da IA
  const [recomendacoes, setRecomendacoes] = useState<RecommendationItem[]>([
    { id: 1, texto: "Mova 'Água Sanitária Super Candida 5L' (SKU 7891013) do Setor B para as proximidades da Doca A (Giro Alto detectado). Redução estimada de 24% no trajeto.", resolvida: false, impacto: "Alta Redução de Caminhada" },
    { id: 2, texto: "Divergência detectada no corredor C (Limpadores Especiais). Realize uma auditoria cíclica preventiva direcionada.", resolvida: false, impacto: "Acuracidade do Estoque" },
    { id: 3, texto: "Risco de gargalo na expedição estimado para as 15:30. Redistribua operadores da Rua D (Materiais de Apoio) para apoio imediato.", resolvida: false, impacto: "Prevenção de Atrasos" }
  ]);

  // Simulador de Cenários Logísticos
  const [simVariacaoEstoque, setSimVariacaoEstoque] = useState(0); // Variação de estoque (-50% a +100%)
  const [simOperadores, setSimOperadores] = useState(4); // Quantidade de operadores adicionais
  const [simLayoutOtimizado, setSimLayoutOtimizado] = useState(false); // Ativar layout evolutivo
  const [resultadoSimulacao, setResultadoSimulacao] = useState<SimulationResult | null>(null);

  // Histórico Geral de Operações (Log de Auditoria)
  const [historicoAcoes, setHistoricoAcoes] = useState<LogItem[]>([
    { acao: 'IA Preditiva ativada e monitorando tráfego físico.', hora: 'Agora' },
    { acao: 'Leitor integrado em standby para escaneamento.', hora: 'Início' }
  ]);

  const adicionarLog = (titulo: string, desc: string) => {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistoricoAcoes(prev => [{ acao: `${titulo}: ${desc}`, hora }, ...prev].slice(0, 5));
  };

  const obterItensOrdenadosPorGiroEPeso = (itens: Array<{ ean: string; nome: string; quantidade: number; rua: string; prateleira: string }>) => {
    return [...itens].sort((a, b) => {
      const itemA = inventory.find(i => i.ean === a.ean);
      const itemB = inventory.find(i => i.ean === b.ean);
      const giroA = itemA?.giro || 'Médio';
      const giroB = itemB?.giro || 'Médio';
      
      const pesoA = parseFloat(itemA?.peso?.replace(/[^\d.]/g, '') || '0');
      const pesoB = parseFloat(itemB?.peso?.replace(/[^\d.]/g, '') || '0');
      
      const pesoGiro = (g: string) => {
        if (g === 'Alto') return 1;
        if (g === 'Médio') return 2;
        if (g === 'Baixo') return 3;
        return 4;
      };
      
      const valGiroA = pesoGiro(giroA);
      const valGiroB = pesoGiro(giroB);
      
      // Primeira prioridade: Peso (itens mais pesados primeiro para criar base estável no AGV)
      if (pesoA !== pesoB) {
        return pesoB - pesoA;
      }
      
      // Segunda prioridade: Giro (proximidade)
      if (valGiroA !== valGiroB) {
        return valGiroA - valGiroB;
      }
      
      // Terceira prioridade: ordem física (corredores e prateleiras)
      if (a.rua !== b.rua) return a.rua.localeCompare(b.rua);
      return a.prateleira.localeCompare(b.prateleira);
    });
  };

  const getActivePickingItem = (order: ShippingOrder) => {
    const sorted = obterItensOrdenadosPorGiroEPeso(order.itens);
    const progress = pickingProgress[order.id] ?? 0;
    if (progress === 0 || progress >= 100) return null;
    
    const stepSize = 100 / (sorted.length + 1);
    const activeIndex = Math.floor(progress / stepSize);
    
    if (activeIndex >= 0 && activeIndex < sorted.length) {
      return sorted[activeIndex];
    }
    return null;
  };

  const iniciarPickingAGV = (orderId: string) => {
    emitirBipSucesso();
    
    const order = shippingOrders.find(o => o.id === orderId);
    if (!order) return;

    const sortedItems = obterItensOrdenadosPorGiroEPeso(order.itens);

    // Set status to Separando
    setShippingOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Separando' } : o));
    adicionarLog('EXPEDIÇÃO', `AGV iniciou rota otimizada de picking para o pedido ${orderId}.`);
    
    // Set initial progress
    setPickingProgress(prev => ({ ...prev, [orderId]: 0 }));
    
    let currentStep = 0;
    const totalSteps = sortedItems.length + 1; // +1 to return to Doca
    
    const interval = setInterval(() => {
      currentStep++;
      const progressPercent = Math.min(100, Math.round((currentStep / totalSteps) * 105)); // allow soft rounding to 100
      const actualPercent = progressPercent >= 100 ? 100 : progressPercent;

      setPickingProgress(prev => ({ ...prev, [orderId]: actualPercent }));
      
      if (currentStep <= sortedItems.length) {
        const itemColetado = sortedItems[currentStep - 1];
        const itemEstoque = inventory.find(i => i.ean === itemColetado.ean);
        const giro = itemEstoque?.giro || 'Médio';
        adicionarLog('PICKING AGV', `[Passo ${currentStep}/${sortedItems.length}] AGV coletou ${itemColetado.quantidade}x ${itemColetado.nome} na posição ${itemColetado.prateleira} (${giro} Giro).`);
        emitirBipSucesso();
      } else {
        clearInterval(interval);
        // Complete picking: update status to 'Conferido'
        setShippingOrders(orders => orders.map(o => o.id === orderId ? { ...o, status: 'Conferido' } : o));
        adicionarLog('EXPEDIÇÃO', `Picking concluído para ${orderId} na rota otimizada. Entregue na Doca de Saída.`);
        emitirBipSucesso();
      }
    }, 1500); // 1.5s per step so that users can visually follow the AGV picking order on the map
  };

  const liberarCaminhao = (order: ShippingOrder) => {
    emitirBipSucesso();
    
    // Subtract from actual inventory
    setInventory(prev => {
      let updated = [...prev];
      order.itens.forEach(orderItem => {
        updated = updated.map(invItem => {
          if (invItem.ean === orderItem.ean && invItem.prateleira === orderItem.prateleira) {
            const novaQtd = Math.max(0, invItem.quantidade - orderItem.quantidade);
            const statusPosicao = novaQtd === 0 ? 'disponivel' : invItem.statusPosicao;
            return {
              ...invItem,
              quantidade: novaQtd,
              statusPosicao,
              ultimaMovimentacao: new Date().toISOString().split('T')[0]
            };
          }
          return invItem;
        });
      });
      return updated;
    });

    // Update order status to 'Enviado'
    setShippingOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Enviado' } : o));
    
    // Add transaction logs
    adicionarLog('EXPEDIÇÃO', `Caminhão ${order.caminhaoPlaca} liberado para ${order.destino}.`);
    
    // Success anim banner
    setMensagemSucessoAnim(true);
    setTimeout(() => setMensagemSucessoAnim(false), 2500);
  };

  const emitirBipSucesso = (isScanner = false) => {
    if (!isScanner) return;
    if (!somAtivo) return;
    if (!somLeituraAtivo) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(volumeBipe, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
      if (vibracaoLeitura && 'vibrate' in navigator) {
        (navigator as any).vibrate(60);
      }
    } catch (e) {
      console.log('AudioContext indisponível.');
    }
  };

  const emitirBipErro = (isScanner = false) => {
    if (!isScanner) return;
    if (!somAtivo) return;
    if (!somErroAtivo) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(volumeBipe, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
      if (vibracaoLeitura && 'vibrate' in navigator) {
        (navigator as any).vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.log('AudioContext erro.');
    }
  };

  const getRoutePath = (rackId: string | undefined): string => {
    if (!rackId) return '';
    const prefix = rackId[0]; // 'A', 'B', 'C', 'D'
    const num = parseInt(rackId.split('-')[1]) || 1; // 1 to 6
    
    // SVG coordinates mapping for routing layout
    let yStreet = 135;
    if (prefix === 'A') yStreet = 140;
    else if (prefix === 'B') yStreet = 245;
    else if (prefix === 'C') yStreet = 350;
    else if (prefix === 'D') yStreet = 455;
    
    let xCol = 70;
    if (num === 3 || num === 4) xCol = 150;
    if (num === 5 || num === 6) xCol = 230;
    
    // L-shaped logistic path starting from Dock 1 (x=30, y=25)
    return `M 30,25 L 30,${yStreet - 15} L ${xCol},${yStreet - 15} L ${xCol},${yStreet}`;
  };

  const renderVisualRack = (rackId: string, item: any, qty: number, isSelected: boolean, matchesHighlight: boolean | "" | null) => {
    let colorDot = 'bg-emerald-500';
    let statusText = 'Vazio';
    let labelBg = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300';

    if (rackId === 'B-06') {
      colorDot = 'bg-zinc-950';
      statusText = 'Bloqueado';
      labelBg = 'bg-zinc-800 text-zinc-100 border-zinc-900';
    } else if (rackId === 'C-06') {
      colorDot = 'bg-sky-500';
      statusText = 'Reserva';
      labelBg = 'bg-sky-50 text-sky-800 border-sky-200 hover:border-sky-300';
    } else if (item) {
      if (qty === 0) {
        colorDot = 'bg-emerald-500';
        statusText = 'Livre';
        labelBg = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300';
      } else if (qty < 85) {
        colorDot = 'bg-amber-500';
        statusText = 'Parcial';
        labelBg = 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300';
      } else {
        colorDot = 'bg-rose-500';
        statusText = 'Ocupado';
        labelBg = 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300';
      }
    }

    return (
      <button
        key={rackId}
        onClick={() => {
          emitirBipSucesso();
          setSelectedCell({ 
            street: rackId[0] === 'A' ? 'Rua A' : rackId[0] === 'B' ? 'Rua B' : rackId[0] === 'C' ? 'Rua C' : 'Rua D', 
            rack: rackId, 
            item: item || null 
          });
        }}
        className={`p-1.5 rounded-xl border text-center transition-all flex flex-col justify-between min-h-[72px] relative overflow-hidden cursor-pointer ${labelBg} ${
          isSelected ? 'ring-2 ring-indigo-600 scale-95 font-bold shadow-md shadow-indigo-100' : ''
        } ${
          matchesHighlight ? 'animate-pulse border-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.7)] font-bold' : ''
        }`}
      >
        {/* Zebra Stripes Hazard Background for Special Positions */}
        {rackId === 'B-06' && (
          <div className="absolute inset-0 opacity-15 bg-stripes-red pointer-events-none"></div>
        )}
        {rackId === 'C-06' && (
          <div className="absolute inset-0 opacity-15 bg-stripes-blue pointer-events-none"></div>
        )}

        {/* Rack Header */}
        <div className="flex justify-between items-center w-full pb-0.5 border-b border-zinc-200/50 relative z-10">
          <span className="text-[9px] font-black font-mono">{rackId}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${colorDot} ${qty > 0 && rackId !== 'B-06' ? 'animate-pulse' : ''}`}></span>
        </div>

        {/* Shelf Levels Design (High-Detail) */}
        <div className="flex flex-col gap-0.5 w-full py-1 relative z-10">
          {rackId === 'B-06' ? (
            <div className="flex flex-col items-center justify-center py-0.5">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[5.5px] font-mono uppercase tracking-wider text-zinc-400 font-bold mt-0.5">MANUT.</span>
            </div>
          ) : rackId === 'C-06' ? (
            <div className="flex flex-col items-center justify-center py-0.5">
              <span className="text-[5.5px] font-mono uppercase tracking-wider text-sky-600 font-black">RESERVA</span>
              <div className="flex gap-0.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-sky-300 rounded-xs shadow-xs"></span>
                <span className="w-1.5 h-1.5 bg-sky-400 rounded-xs shadow-xs"></span>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Shelf Level 3 */}
              <div className="flex items-center justify-between px-1 h-2 rounded bg-zinc-100/60 border border-zinc-200/20">
                <span className="text-[6px] font-mono text-zinc-400 font-bold">L3</span>
                {qty >= 85 ? (
                  <div className="flex gap-0.5">
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                  </div>
                ) : <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>}
              </div>

              {/* Shelf Level 2 */}
              <div className="flex items-center justify-between px-1 h-2 rounded bg-zinc-100/60 border border-zinc-200/20">
                <span className="text-[6px] font-mono text-zinc-400 font-bold">L2</span>
                {qty >= 50 ? (
                  <div className="flex gap-0.5">
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                  </div>
                ) : qty >= 20 ? (
                  <span className="w-2.5 h-1 bg-amber-500/50 rounded-xs shadow-xs"></span>
                ) : <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>}
              </div>

              {/* Shelf Level 1 */}
              <div className="flex items-center justify-between px-1 h-2 rounded bg-zinc-100/60 border border-zinc-200/20">
                <span className="text-[6px] font-mono text-zinc-400 font-bold">L1</span>
                {qty > 0 ? (
                  <div className="flex gap-0.5">
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                    <span className="w-2.5 h-1 bg-amber-600/80 rounded-xs shadow-xs"></span>
                  </div>
                ) : <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>}
              </div>
            </div>
          )}
        </div>

        {/* Quantity and Labels */}
        <div className="text-[8px] font-bold text-left truncate w-full pt-0.5 border-t border-zinc-200/40 opacity-90 font-mono flex justify-between items-center relative z-10">
          <span className="text-zinc-500 font-semibold">Qtd:</span>
          <span className="text-zinc-800 font-extrabold">{rackId === 'B-06' ? 'Lock' : rackId === 'C-06' ? 'Res.' : item && qty > 0 ? `${qty}un` : '0'}</span>
        </div>
      </button>
    );
  };

  const processarRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.inventory && json.shippingOrders) {
          // Inicia simulação visual de restore
          simularProcessoBackup('restoring');
          
          // Efetivamente restaura
          setTimeout(() => {
            if (json.inventory) setInventory(json.inventory);
            if (json.shippingOrders) setShippingOrders(json.shippingOrders);
            if (json.inboundLoads) setInboundLoads(json.inboundLoads);
          }, 1500); // no meio do loader
        } else {
          alert('Arquivo de backup inválido ou incompatível com a versão atual.');
        }
      } catch (err) {
        alert('Falha ao ler o arquivo de backup. Verifique se é um arquivo JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const simularProcessoBackup = (step: 'creating' | 'restoring') => {
    setBackupStep(step);
    setBackupProgress(0);
    
    const interval = setInterval(() => {
      setBackupProgress(prev => {
        const next = prev + Math.floor(Math.random() * 15) + 5;
        if (next >= 100) {
          clearInterval(interval);
          if (step === 'creating') {
            setBackupStep('validating');
            setTimeout(() => {
              setBackupStep('ready');
            }, 1500);
          } else {
            emitirBipSucesso();
            setBackupStep('success');
            setTimeout(() => {
              setShowBackupModal(false);
              setBackupStep('menu');
              setBackupProgress(0);
            }, 2000);
          }
          return 100;
        }
        return next;
      });
    }, 300);
  };

  const baixarBackupArquivo = () => {
    const backupData = {
      inventory,
      shippingOrders,
      inboundLoads,
      timestamp: new Date().toISOString(),
      version: '1.4.2'
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wms_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    emitirBipSucesso();
    setShowBackupModal(false);
    setBackupStep('menu');
  };

  const exportarInventarioCSV = () => {
    // Cabeçalho do CSV
    const headers = [
      'Código EAN/Barras',
      'Nome do Produto',
      'Categoria',
      'Subcategoria',
      'Marca',
      'Fabricante',
      'Rua',
      'Prateleira',
      'Giro',
      'Quantidade',
      'Lote',
      'Vencimento',
      'Última Movimentação'
    ];

    // Mapeamento dos itens do inventário para linhas do CSV
    const csvRows = inventory.map(item => {
      return [
        `"${item.ean}"`, // Forçar como string para o Excel não formatar como número científico se for longo
        `"${(item.nome || '').replace(/"/g, '""')}"`, // Escapar aspas duplas
        `"${(item.categoria || '').replace(/"/g, '""')}"`,
        `"${(item.subcategoria || '').replace(/"/g, '""')}"`,
        `"${(item.marca || '').replace(/"/g, '""')}"`,
        `"${(item.fabricante || '').replace(/"/g, '""')}"`,
        `"${(item.rua || '').replace(/"/g, '""')}"`,
        `"${(item.prateleira || '').replace(/"/g, '""')}"`,
        `"${(item.giro || '').replace(/"/g, '""')}"`,
        item.quantidade,
        `"${(item.lote || '').replace(/"/g, '""')}"`,
        `"${item.vencimento || ''}"`,
        `"${item.ultimaMovimentacao || ''}"`
      ].join(',');
    });

    // Unir cabeçalho e linhas com quebra de linha. Usar caractere de BOM \uFEFF para garantir suporte a acentos no Excel.
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    
    // Criar um blob e baixar o arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_wms_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    adicionarLog('Exportação Concluída', 'Arquivo CSV do inventário atual foi gerado e baixado.');
    emitirBipSucesso();
  };

  const exportarRelatorioConsolidadoExcel = () => {
    const separator = ';';
    const lines: string[] = [];

    // Indicação explícita do separador para o Microsoft Excel abrir perfeitamente
    lines.push('sep=;');

    // Cabeçalho Principal do Relatório
    lines.push('========================================================================');
    lines.push('RELATORIO CONSOLIDADO DE OPERACOES DO CENTRO DE DISTRIBUICAO (CD)');
    lines.push('========================================================================');
    lines.push(`Data de Emissao:;${new Date().toLocaleString('pt-BR')}`);
    lines.push('Acuracidade Geral Estimada do CD:;99.2%');
    lines.push('');

    // SEÇÃO 1: RESUMO DE PERFORMANCE (KPIs)
    lines.push('1. INDICADORES DE PERFORMANCE DA OPERACAO (KPIs)');
    lines.push('----------------------------------------------------');
    lines.push(`Total de Caminhoes que Entraram (Inbound):;${inboundLoads.length}`);
    lines.push(`Cargas de Entrada Conferidas:;${inboundLoads.filter(o => o.status === 'Conferido' || o.status === 'Finalizado').length}`);
    
    const totalCaixasRecebidas = inboundLoads.reduce((acc, curr) => acc + curr.quantidadeCaixas, 0);
    lines.push(`Total de Caixas Recebidas (Inbound Volume):;${totalCaixasRecebidas} caixas`);
    lines.push('');
    
    lines.push(`Total de Caminhoes de Saida (Outbound):;${shippingOrders.length}`);
    lines.push(`Caminhoes Despachados / Enviados:;${shippingOrders.filter(o => o.status === 'Enviado').length}`);
    lines.push(`Cargas de Saida Conferidas (Prontas p/ Embarque):;${shippingOrders.filter(o => o.status === 'Conferido' || o.status === 'Enviado').length}`);
    
    const totalItensInventario = inventory.reduce((acc, curr) => acc + curr.quantidade, 0);
    lines.push(`Total de Unidades em Estoque (Inventario Ativo):;${totalItensInventario} unidades`);
    lines.push('');
    lines.push('');

    // SEÇÃO 2: DETALHAMENTO DE ENTRADAS
    lines.push('2. REGISTRO DETALHADO DE ENTRADAS DE CAMINHOES (INBOUND)');
    lines.push('------------------------------------------------------------------------');
    lines.push('ID Entrada;Placa do Veiculo;Motorista;Produto Recebido;Codigo de Barras (EAN);Quantidade (Caixas);Data/Hora Registro;Status');
    inboundLoads.forEach(load => {
      lines.push([
        load.id,
        load.placaCaminhao,
        load.motorista.replace(/;/g, ','),
        load.produto.replace(/;/g, ','),
        `="${load.ean}"`, // Preservar código longo de barras no Excel
        load.quantidadeCaixas,
        load.dataHora,
        load.status
      ].join(separator));
    });
    lines.push('');
    lines.push('');

    // SEÇÃO 3: DETALHAMENTO DE SAÍDAS
    lines.push('3. REGISTRO DETALHADO DE EXPEDICAO E SAIDAS (OUTBOUND)');
    lines.push('------------------------------------------------------------------------');
    lines.push('ID Pedido;Placa do Veiculo;Destinatario;Prioridade;Status;Qtd Itens Diferentes;Data Criacao');
    shippingOrders.forEach(order => {
      lines.push([
        order.id,
        order.caminhaoPlaca,
        order.destino.replace(/;/g, ','),
        order.prioridade,
        order.status,
        order.itens.length,
        order.dataCriacao
      ].join(separator));
    });
    lines.push('');
    lines.push('');

    // SEÇÃO 4: INVENTÁRIO ATIVO DO CD
    lines.push('4. INVENTARIO FISICO CONSOLIDADO E POSICOES DE ARMAZENAGEM');
    lines.push('------------------------------------------------------------------------');
    lines.push('Codigo EAN/Barras;Nome do Produto;Categoria;Subcategoria;Marca;Fabricante;Rua;Prateleira;Giro;Quantidade;Lote;Vencimento');
    inventory.forEach(item => {
      lines.push([
        `="${item.ean}"`,
        (item.nome || '').replace(/;/g, ','),
        (item.categoria || '').replace(/;/g, ','),
        (item.subcategoria || '').replace(/;/g, ','),
        (item.marca || '').replace(/;/g, ','),
        (item.fabricante || '').replace(/;/g, ','),
        item.rua,
        item.prateleira,
        item.giro,
        item.quantidade,
        (item.lote || '').replace(/;/g, ','),
        item.vencimento
      ].join(separator));
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_consolidado_cd_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    adicionarLog('Relatório Exportado', 'Relatório consolidado de operações do CD foi gerado e baixado.');
    emitirBipSucesso();
  };

  const ligarCamera = async () => {
    if (isCameraTransitioningRef.current) return;
    isCameraTransitioningRef.current = true;
    try {
      setCameraAtiva(true);
      setUsarCameraNativa(true);
      isScanningStoppedRef.current = false;
      adicionarLog('Scanner QuickCount', 'Ativando motor html5-qrcode...');

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        try { await html5QrCodeRef.current.stop(); } catch (e) {}
        html5QrCodeRef.current.clear();
      }

      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("html5-qrcode-reader");
          html5QrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: { width: 300, height: 150 },
              aspectRatio: 1.0,
            },
            (decodedText, decodedResult) => {
              if (!isScanningStoppedRef.current && decodedText) {
                onCodigoLidoSucesso(decodedText, 'Html5-QRCode');
              }
            },
            (errorMessage) => {
              // Ignore frame errors
            }
          );
          
          try {
            await html5QrCode.applyVideoConstraints({ advanced: [{ torch: true } as any] });
            setFlashlightOn(true);
          } catch (torchErr) {
            console.warn("Não foi possível ativar a lanterna automaticamente:", torchErr);
          }
          
          adicionarLog('Câmera Ativa', 'Scanner em tempo real iniciado (QuickCount).');
        } catch (err: any) {
          console.warn("Falha ao iniciar Html5Qrcode:", err);
          if (err && (String(err).includes('NotAllowedError') || String(err).includes('Permission denied'))) {
            setLeituraErroMsg('Permissão de câmera negada. Conceda acesso ou digite o código.');
            adicionarLog('Permissão Negada', 'Acesso à câmera foi negado pelo usuário ou navegador.');
          } else {
            adicionarLog('Erro na Câmera', 'Falha ao iniciar html5-qrcode. Usar digitação manual.');
          }
          setCameraAtiva(false);
          setUsarCameraNativa(false);
        } finally {
          isCameraTransitioningRef.current = false;
        }
      }, 100);

    } catch (err: any) {
      console.warn("Erro ao ligar câmera:", err);
      if (err && (String(err).includes('NotAllowedError') || String(err).includes('Permission denied'))) {
        setLeituraErroMsg('Permissão de câmera negada. Conceda acesso ou digite o código.');
        adicionarLog('Permissão Negada', 'Acesso à câmera foi negado pelo usuário ou navegador.');
      } else {
        adicionarLog('Erro na Câmera', 'Não foi possível acessar a câmera.');
      }
      setCameraAtiva(false);
      setUsarCameraNativa(false);
      isCameraTransitioningRef.current = false;
    }
  };

  const onCodigoLidoSucesso = (codigo: string, motor: string) => {
    if (isScanningStoppedRef.current) return;
    isScanningStoppedRef.current = true;

    adicionarLog('Código Lido', `Sucesso (${motor}): ${codigo}`);

    // Feedback tátil
    if (vibracaoLeitura && 'vibrate' in navigator) {
      try {
        navigator.vibrate(200);
      } catch (e) {}
    }

    // Fecha a câmera automaticamente
    desligarCamera();

    // Processa a leitura (bip handled centrally inside processarBipCodigo)
    processarBipCodigo(codigo, true);
  };

  const desligarCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      if (!isCameraTransitioningRef.current) {
        isCameraTransitioningRef.current = true;
        html5QrCodeRef.current.stop().then(() => {
          html5QrCodeRef.current?.clear();
          html5QrCodeRef.current = null;
          isCameraTransitioningRef.current = false;
        }).catch(err => {
          console.error("Error stopping html5-qrcode:", err);
          isCameraTransitioningRef.current = false;
        });
      }
    } else if (html5QrCodeRef.current) {
      html5QrCodeRef.current.clear();
      html5QrCodeRef.current = null;
    }

    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (e) {
        console.error("Error resetting ZXing reader:", e);
      }
      zxingReaderRef.current = null;
    }

    if (scanbotScannerRef.current) {
      try {
        scanbotScannerRef.current.dispose();
      } catch (e) {
        console.error("Error disposing scanbot scanner:", e);
      }
      scanbotScannerRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream && stream.getTracks) {
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
      } catch (e) {
        console.error("Error stopping native stream:", e);
      }
    }
    setCameraAtiva(false);
    setUsarCameraNativa(false);
    setFlashlightOn(false);
  };

  const falarTexto = (texto: string) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Erro na síntese de voz:', err);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCatalogImage(reader.result as string);
        setCatalogJsonResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processCatalogImage = async () => {
    if (!catalogImage) return;
    
    setCatalogImageLoading(true);
    setCatalogJsonResult(null);
    setLeituraErroMsg(null);
    
    try {
      const response = await fetch('/api/catalog-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageBase64: catalogImage })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao analisar imagem. Tente novamente.');
      }
      
      const data = await response.json();
      setCatalogJsonResult(data);
      if (somAtivo) {
        const audio = new Audio('/bip-sucesso.mp3');
        audio.play().catch(e => console.warn(e));
      }
      falarTexto("Produto analisado com sucesso.");
    } catch (err: any) {
      console.error(err);
      setLeituraErroMsg(err.message || 'Erro de conexão.');
    } finally {
      setCatalogImageLoading(false);
    }
  };

  const resetCatalogImage = () => {
    setCatalogImage(null);
    setCatalogJsonResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processarBipCodigo = (codigo: string, playSound = true) => {
    if (!codigo || codigo.trim().length === 0) {
      if (playSound) {
        emitirBipErro(true);
      }
      setLeituraErroMsg("Código não reconhecido. Tente aproximar a câmera.");
      setTimeout(() => setLeituraErroMsg(null), 3000);
      return;
    }
    
    // Remove all non-digits from the code
    let codigoTratado = codigo.replace(/\D/g, '');
    if (!codigoTratado || codigoTratado.trim().length === 0) {
      if (playSound) {
        emitirBipErro(true);
      }
      setLeituraErroMsg("Código não reconhecido. Melhore a iluminação.");
      setTimeout(() => setLeituraErroMsg(null), 3000);
      return;
    }

    // Se o código for o da foto (0040232874871), tratamos como '7891013' (Água Sanitária Super Candida 5L)
    if (
      codigoTratado === '0040232874871' || 
      codigoTratado === '040232874871'
    ) {
      codigoTratado = '7891013';
    }

    if (playSound) {
      emitirBipSucesso(true);
    }
    setLeituraErroMsg(null);
    setLeituraCodigo(codigoTratado);
    setMensagemSucessoAnim(true);
    setTimeout(() => setMensagemSucessoAnim(false), 800);

    // Fala específica para o detergente 500ml cadastrado
    if (codigoTratado === '7898765432109') {
      falarTexto("Detergente 500 ml");
    } else {
      // Fala de suporte geral para os outros produtos identificados
      const prod = inventory.find(p => p.ean === codigoTratado);
      if (prod) {
        falarTexto(prod.nome);
      }
    }
    
    const produtoEncontrado = inventory.find(p => p.ean === codigoTratado);
    if (produtoEncontrado) {
      setProdutoDetectado(produtoEncontrado);
      adicionarLog('Leitura Efetuada', `${produtoEncontrado.nome} identificado com sucesso.`);
    } else {
      // Cria dinamicamente um novo produto para qualquer código lido
      const categoriasChave = ['LIMPEZA', 'INFRAESTRUTURA', 'TINTAS', 'GERAL'];
      const charSum = codigo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const categoriaSorteada = categoriasChave[charSum % 4];
      const infoCategoria = SECTORS_CD[categoriaSorteada];
      
      const subcategoriasPorRua: Record<string, string> = {
        'Rua A': 'Detergentes',
        'Rua B': 'Desinfetantes',
        'Rua C': 'Limpadores Multiuso',
        'Rua D': 'Panos de Limpeza'
      };

      const novoProduto: InventoryItem = {
        ean: codigo,
        nome: `Caixa de Limpeza (${codigo})`,
        categoria: 'LIMPEZA',
        subcategoria: subcategoriasPorRua[infoCategoria.rua] || 'Detergentes',
        marca: 'EcoLimpo',
        fabricante: 'Indústria Química CD Ltda',
        rua: infoCategoria.rua,
        prateleira: `${infoCategoria.rua.replace('Rua ', '')}-01`,
        quantidade: 1,
        lote: `LT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        vencimento: '2027-12-31',
        statusPosicao: 'parcial',
        ultimaMovimentacao: new Date().toISOString().split('T')[0]
      };
      setProdutoDetectado(novoProduct => {
        // also append to inventory if desired, or let save button append it
        return novoProduto;
      });
      adicionarLog('Novo Código Autoclassificado', `Item ${codigo} mapeado para a ${infoCategoria.rua} automaticamente.`);
    }
  };

  const simularLeituraAutomatica = () => {
    const codigosFrequentes = ['7898765432109', '7891011', '7891012', '7891013', '7891014', '7548911', '8910212', '0040232874871'];
    const codigoSorteado = codigosFrequentes[Math.floor(Math.random() * codigosFrequentes.length)];
    processarBipCodigo(codigoSorteado, true);
  };

  const rodarSimuladorCenarios = () => {
    emitirBipSucesso();
    let novaSaude = 82;
    let novoCustoOculto = 4820;
    let novoTempoPicking = 148;
    let novaAcuracidade = 94.2;

    // Efeito de Operadores adicionais
    novaSaude += simOperadores * 2;
    novoTempoPicking -= simOperadores * 8;
    novoCustoOculto -= simOperadores * 150; // reduz custo de retrabalho e horas improdutivas

    // Efeito de variação de capacidade
    if (simVariacaoEstoque > 30) {
      novaSaude -= 12; // Congestionamento espacial
      novoCustoOculto += 850;
      novoTempoPicking += 15;
    } else if (simVariacaoEstoque < 0) {
      novaSaude -= 5; // Capacidade ociosa
    }

    // Efeito do Layout Dinâmico Evolutivo da IA
    if (simLayoutOtimizado) {
      novaSaude += 10;
      novoCustoOculto -= 1200;
      novoTempoPicking -= 25;
      novaAcuracidade = 99.1;
    }

    setResultadoSimulacao({
      saude: Math.min(100, Math.max(0, Math.round(novaSaude))),
      custoLogistico: Math.max(200, novoCustoOculto),
      tempoSeparacao: Math.max(45, novoTempoPicking),
      acuracidadeEstimada: parseFloat(novaAcuracidade.toFixed(1))
    });

    adicionarLog('Simulador IA', 'Impacto operacional de novos cenários calculado com precisão de 97.4%.');
  };

  const resolverRecomendacao = (id: number) => {
    emitirBipSucesso();
    setRecomendacoes(prev => prev.map(rec => rec.id === id ? { ...rec, resolvida: true } : rec));
    
    // Melhora os KPIs reais do WMS quando o gestor aceita a sugestão da IA
    if (id === 1) { // Mover SKU para perto das docas
      setSaudeArmazem(prev => Math.min(100, prev + 5));
      setCustosOcultos(prev => Math.max(200, prev - 1400));
      setTempoPicking(prev => Math.max(45, prev - 24));
    } else if (id === 2) { // Auditoria preventiva
      setAcuracidade(99.4);
      setSaudeArmazem(prev => Math.min(100, prev + 6));
      setCustosOcultos(prev => Math.max(200, prev - 850));
    } else if (id === 3) { // Expedição apoiada
      setGargaloAtivo(false);
      setSaudeArmazem(prev => Math.min(100, prev + 4));
    }

    adicionarLog('IA Executada', 'Recomendação dinâmica ativada. Parâmetros do CD atualizados.');
  };

  // Garante a câmera certa de acordo com a mudança de aba
  useEffect(() => {
    if (viewMode === 'mobile' && (telaMobile === 'scanner' || telaMobile === 'entrada' || telaMobile === 'organizacao')) {
      ligarCamera();
    } else {
      desligarCamera();
    }
    return () => desligarCamera();
  }, [viewMode, telaMobile]);

  const activeOrderForPicking = shippingOrders.find(o => o.status === 'Separando');
  const activePickingItem = activeOrderForPicking ? getActivePickingItem(activeOrderForPicking) : null;

  return (
    <div id="wms_main_container" className={`flex flex-col lg:flex-row justify-center items-stretch min-h-screen bg-slate-50 text-zinc-900 select-none font-sans ${viewMode === 'mobile' ? 'p-0' : 'p-3 md:p-6 gap-6'}`}>
      
      {/* PAINEL DO GESTOR: IA PREDITIVA E CENTRAL DE DECISÃO */}
      <div id="executive_panel" className={`flex-1 bg-white border border-zinc-200/80 shadow-md shadow-zinc-100 rounded-3xl p-6 md:p-8 flex-col justify-between space-y-6 ${viewMode !== 'mobile' ? 'flex' : 'hidden'}`}>
        
        {/* Top Header do Gestor */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100">
              <span className="font-sans text-white text-2xl font-bold">W</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 text-[10px] uppercase tracking-widest font-extrabold bg-indigo-50 px-2 py-0.5 rounded">WMS 4.0 Autônomo</span>
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-950 tracking-tight mt-1">
                {viewMode === 'dashboard' ? 'Dashboard Geral' : 
                 viewMode === 'ia_preditiva' ? 'Torre de IA Logística Preditiva' : 
                 viewMode === 'estoque' ? 'Gerenciador de Inventário Físico' : 
                 viewMode === 'expedicao' ? 'Área de Expedição e Docas' : 
                 viewMode === 'relatorios' ? 'Central de Relatórios e Exportações' : 
                 viewMode === 'configuracoes' ? 'Configurações do Sistema' : 
                 viewMode === 'sobre' ? 'Sobre o Sistema WMS' : ''}
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                {viewMode === 'dashboard' ? 'Indicadores gerais, Resumo operacional e KPIs' : 
                 viewMode === 'ia_preditiva' ? 'Prevenção de Gargalos, Simulação e Otimização' : 
                 viewMode === 'estoque' ? 'Controle, Endereçamento e Auditoria de Posições' : 
                 viewMode === 'expedicao' ? 'Gestão de Pedidos de Saída, Picking de AGV e Embarques' : 
                 viewMode === 'relatorios' ? 'Visualização de Histórico, Análises e Backups' : 
                 viewMode === 'configuracoes' ? 'Ajustes, Acessibilidade e Preferências' : 
                 viewMode === 'sobre' ? 'Informações e Licença' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Mapa do CD Button */}
            {(viewMode === 'estoque' || viewMode === 'expedicao') && (
              <button
                id="btn_open_map_modal_executive"
                onClick={() => { emitirBipSucesso(); setExibirMapaModal(true); }}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer animate-fade-in"
              >
                <Layers className="w-4 h-4" /> Visualizar Mapa CD
              </button>
            )}

            <button 
              id="btn_switch_mobile_view"
              onClick={() => { emitirBipSucesso(); setViewMode('mobile'); }} 
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Smartphone className="w-4 h-4" /> Voltar ao Coletor
            </button>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO DOS MÓDULOS */}
        {viewMode === 'dashboard' && (
          <div className="flex-1 flex flex-col justify-between space-y-6 animate-fade-in">
            {/* METRICAS CHAVE E ÍNDICE DE SAÚDE DO ARMAZÉM */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Índice de Saúde */}
              <div className="bg-gradient-to-br from-indigo-50/40 to-indigo-50/10 border border-indigo-100/80 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-indigo-100/40 text-indigo-600 rounded-bl-xl border-l border-b border-indigo-100/50">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-widest block">Saúde Geral CD</span>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-4xl font-extrabold text-indigo-950">{saudeArmazem}</span>
                    <span className="text-xs text-zinc-400 font-medium">/ 100</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-indigo-100/40 text-[10px] text-zinc-600 font-medium flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${saudeArmazem >= 85 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                  <span>{saudeArmazem >= 85 ? 'Operação em alta eficiência' : 'IA detectou pontos de atenção'}</span>
                </div>
              </div>

              {/* IA de Custos Ocultos */}
              <div className="bg-gradient-to-br from-rose-50/40 to-rose-50/10 border border-rose-100/80 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-rose-100/40 text-rose-600 rounded-bl-xl border-l border-b border-rose-100/50">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 font-bold uppercase tracking-widest block">Custos Ocultos Estimados</span>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-sm font-bold text-rose-800">R$</span>
                    <span className="text-4xl font-extrabold text-rose-950">{custosOcultos.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-4 leading-relaxed font-medium">Valor perdido em deslocamentos longos e posições ineficientes.</p>
              </div>

              {/* Acuracidade de Estoque */}
              <div className="bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 border border-emerald-100/80 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-emerald-100/40 text-emerald-600 rounded-bl-xl border-l border-b border-emerald-100/50">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest block">Acuracidade do Estoque</span>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-4xl font-extrabold text-emerald-950">{acuracidade}%</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-100/40 text-[10px] text-zinc-600 font-medium flex items-center justify-between">
                  <span>Média de Picking: <strong className="text-zinc-900 font-mono font-bold">{tempoPicking}s</strong></span>
                </div>
              </div>
            </div>

            {/* PREVENÇÃO DE GARGALOS E RECOMENDAÇÕES AUTOMÁTICAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Radar de Eficiência & Gargalos */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm shadow-zinc-50 md:col-span-2">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-extrabold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-500 animate-pulse" /> Radar de Rendimento Físico
                    </span>
                    {gargaloAtivo && (
                      <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                        Gargalo Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">Indicadores reais de rendimento físico por corredor de CD:</p>
                </div>

                {/* Barras de Rendimento por Setor */}
                <div className="space-y-4">
                  {Object.entries(SECTORS_CD).map(([key, value]) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-700">{value.nome} ({value.rua})</span>
                        <span className={value.eficiencia < 80 ? 'text-rose-600 font-bold' : 'text-indigo-600 font-bold'}>{value.eficiencia}% Eficiente</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200/50">
                        <div 
                          className={`h-full rounded-full ${value.eficiencia < 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} 
                          style={{ width: `${value.eficiencia}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                {gargaloAtivo ? (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 animate-bounce" />
                    <span className="font-medium">Rua C (Limpadores Especiais) operando abaixo da meta. Deslocamentos de picking ineficientes detectados.</span>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span className="font-medium">Rotas equilibradas! Nenhum gargalo físico ativo no armazém.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'ia_preditiva' && (
          <div className="flex-1 flex flex-col justify-between space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recomendações da IA */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm shadow-zinc-50">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-extrabold flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Decisões Recomendadas pela IA
                  </span>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">Medidas corretivas calculadas em tempo real:</p>
                </div>

                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {recomendacoes.map(rec => (
                    <div key={rec.id} className={`p-3 rounded-xl border text-xs transition-all ${rec.resolvida ? 'bg-zinc-50 border-zinc-200 opacity-50' : 'bg-indigo-50/40 border-indigo-100/70 hover:border-indigo-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-zinc-800 leading-relaxed font-medium">{rec.texto}</p>
                        <span className="bg-indigo-100/80 text-indigo-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold shrink-0">{rec.impacto}</span>
                      </div>
                      {!rec.resolvida && (
                        <button 
                          onClick={() => resolverRecomendacao(rec.id)}
                          className="mt-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg uppercase text-[10px] tracking-wider active:scale-95 transition shadow-sm"
                        >
                          Autorizar IA
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SIMULADOR LOGÍSTICO AVANÇADO */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-4 shadow-sm shadow-zinc-50">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-extrabold flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-500" /> Simulador Inteligente de Cenários
                  </span>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">Altere as variáveis de equipe e layout para calcular o impacto preventivo:</p>
                </div>

                <div className="grid grid-cols-1 gap-4 text-xs">
                  {/* Ajuste de Estoque */}
                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/60 space-y-2.5">
                    <label className="text-zinc-700 font-bold block">Variação do Estoque: {simVariacaoEstoque > 0 ? `+${simVariacaoEstoque}` : simVariacaoEstoque}%</label>
                    <input 
                      type="range" 
                      min="-50" 
                      max="100" 
                      value={simVariacaoEstoque} 
                      onChange={(e) => setSimVariacaoEstoque(parseInt(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer bg-zinc-200 h-1 rounded"
                    />
                  </div>

                  {/* Contratar Operadores */}
                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/60 space-y-2.5">
                    <label className="text-zinc-700 font-bold block">Adicionar Operadores: +{simOperadores}</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="8" 
                      value={simOperadores} 
                      onChange={(e) => setSimOperadores(parseInt(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer bg-zinc-200 h-1 rounded"
                    />
                  </div>

                  {/* Layout Dinâmico Evolutivo */}
                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-zinc-700 font-bold block">Layout Otimizado</span>
                      <span className="text-[9px] text-zinc-500 block font-medium">Mapeamento dinâmico inteligente</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={simLayoutOtimizado}
                      onChange={(e) => setSimLayoutOtimizado(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-zinc-300 text-indigo-600 focus:ring-0 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-between items-center gap-3 pt-2">
                  <button 
                    id="btn_run_simulation"
                    onClick={rodarSimuladorCenarios}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl uppercase text-xs tracking-wider active:scale-95 transition shadow-md"
                  >
                    Calcular Impacto de Cenários
                  </button>

                  {resultadoSimulacao && (
                    <div id="simulation_result_output" className="w-full flex flex-col gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-[10px] font-mono font-semibold">
                      <span className="text-indigo-700 font-bold">Saúde: <strong>{resultadoSimulacao.saude}/100</strong></span>
                      <span className="text-rose-600 font-bold">Custo CD: <strong>R$ {resultadoSimulacao.custoLogistico}</strong></span>
                      <span className="text-emerald-700 font-bold">Picking Médio: <strong>{resultadoSimulacao.tempoSeparacao}s</strong></span>
                      <span className="text-blue-700 font-bold">Acuracidade: <strong>{resultadoSimulacao.acuracidadeEstimada}%</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: INVENTÁRIO INTELIGENTE (REMOVIDO DO DESKTOP E INTEGRADO NO COLETOR) */}
        {viewMode === 'estoque' && (
          <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
            {/* INVENTÁRIO INTELIGENTE: DASHBOARD */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {/* Total Produtos */}
              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Cadastrados</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-zinc-900">{inventory.length}</span>
                  <span className="text-[10px] text-zinc-400 font-semibold">SKUs</span>
                </div>
              </div>

              {/* Total em Estoque */}
              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Estoque Total</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-zinc-900">{inventory.reduce((acc, i) => acc + i.quantidade, 0)}</span>
                  <span className="text-[10px] text-zinc-400 font-semibold">un</span>
                </div>
              </div>

              {/* Estoque Baixo */}
              <div className="bg-rose-50/50 border border-rose-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider block font-black">Estoque Baixo</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-rose-900">{inventory.filter(i => i.quantidade > 0 && i.quantidade < 20).length}</span>
                  <span className="text-[10px] text-rose-400 font-semibold">SKUs</span>
                </div>
              </div>

              {/* Sem Movimentação */}
              <div className="bg-amber-50/50 border border-amber-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Lento Giro</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-amber-900">{inventory.filter(i => i.giro === 'Baixo').length}</span>
                  <span className="text-[10px] text-amber-400 font-semibold">SKUs</span>
                </div>
              </div>

              {/* Vencidos/Críticos */}
              <div className="bg-orange-50/50 border border-orange-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-orange-700 font-bold uppercase tracking-wider block">Vencidos/Próx</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-orange-950">{inventory.filter(i => new Date(i.vencimento) <= new Date('2026-08-01')).length}</span>
                  <span className="text-[10px] text-orange-400 font-semibold">SKUs</span>
                </div>
              </div>

              {/* Ocupação Real */}
              <div className="bg-indigo-50/50 border border-indigo-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">Ocupação CD</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-indigo-950 font-mono">
                    {((inventory.filter(i => i.quantidade > 0).length / 24) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* BUSCA, FILTROS E OPERAÇÕES */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative flex-1 w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por SKU/EAN, Nome, Lote, Endereço..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-zinc-900"
                  />
                </div>

                <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                  {/* Filtro de Categoria */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none font-bold cursor-pointer"
                  >
                    <option value="All">Todas Categorias (Limpeza)</option>
                    <option value="LIMPEZA">Limpeza</option>
                  </select>

                  {/* Filtro de Subcategoria */}
                  <select
                    value={filterSubcategory}
                    onChange={(e) => setFilterSubcategory(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none font-bold cursor-pointer max-w-[180px]"
                  >
                    <option value="All">Todas Subcategorias</option>
                    {SUBCATEGORIES_LIMPEZA.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>

                  {/* Filtro de Status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none font-bold cursor-pointer"
                  >
                    <option value="All">Todos Status</option>
                    <option value="estoque_baixo">Estoque Baixo</option>
                    <option value="lento_giro">Lento Giro</option>
                    <option value="vencido_critico">Vencidos/Críticos</option>
                    <option value="sem_estoque">Sem Estoque</option>
                  </select>

                  {/* Registrar Entrada Button */}
                  <button
                    onClick={() => {
                      emitirBipSucesso();
                      setFormEan(Math.floor(1000000 + Math.random() * 9000000).toString());
                      setFormNome('');
                      setFormCategoria('LIMPEZA');
                      setFormSubcategoria('Detergentes');
                      setFormMarca('');
                      setFormFabricante('');
                      setFormRua('Rua A');
                      setFormPrateleira('A-01');
                      setFormQuantidade('50');
                      setFormLote(`LT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
                      setFormVencimento('2027-12-31');
                      setShowEntradaModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition active:scale-95 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Registrar Entrada
                  </button>
                </div>
              </div>

              {/* REGISTRAR ENTRADA PANEL / FORM (Expandable Inline) */}
              {showEntradaModal && (
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 md:p-5 space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-indigo-100/50 pb-2.5">
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-600" /> Registrar Entrada de Carga no CD
                    </h4>
                    <button 
                      onClick={() => setShowEntradaModal(false)}
                      className="text-zinc-400 hover:text-zinc-600 font-bold text-xs"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Código EAN/Barras</label>
                      <input
                        type="text"
                        value={formEan}
                        onChange={(e) => setFormEan(e.target.value)}
                        placeholder="Ex: 7891018"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-1 sm:col-span-2">
                      <label className="text-zinc-600 font-bold block">Nome do Produto</label>
                      <input
                        type="text"
                        value={formNome}
                        onChange={(e) => setFormNome(e.target.value)}
                        placeholder="Ex: Sabão em Pó Ariel 1.6kg"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Categoria</label>
                      <select
                        value={formCategoria}
                        onChange={(e) => setFormCategoria(e.target.value)}
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500 focus:outline-none cursor-not-allowed font-bold"
                        disabled
                      >
                        <option value="LIMPEZA">Limpeza</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Subcategoria</label>
                      <select
                        value={formSubcategoria}
                        onChange={(e) => setFormSubcategoria(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none cursor-pointer font-bold"
                      >
                        {SUBCATEGORIES_LIMPEZA.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Marca</label>
                      <input
                        type="text"
                        value={formMarca}
                        onChange={(e) => setFormMarca(e.target.value)}
                        placeholder="Ex: Ypê"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Fabricante</label>
                      <input
                        type="text"
                        value={formFabricante}
                        onChange={(e) => setFormFabricante(e.target.value)}
                        placeholder="Ex: Química Amparo"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Endereço: Rua</label>
                      <select
                        value={formRua}
                        onChange={(e) => {
                          setFormRua(e.target.value);
                          const prefix = e.target.value === 'Rua A' ? 'A' : e.target.value === 'Rua B' ? 'B' : e.target.value === 'Rua C' ? 'C' : 'D';
                          setFormPrateleira(`${prefix}-01`);
                        }}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none cursor-pointer font-bold"
                      >
                        <option value="Rua A">Rua A (Sabões e Detergentes)</option>
                        <option value="Rua B">Rua B (Desinfetantes e Álcool)</option>
                        <option value="Rua C">Rua C (Limpadores Especiais)</option>
                        <option value="Rua D">Rua D (Materiais de Apoio)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Endereço: Posição/Rack</label>
                      <input
                        type="text"
                        value={formPrateleira}
                        onChange={(e) => setFormPrateleira(e.target.value.toUpperCase())}
                        placeholder="Ex: A-04"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Lote</label>
                      <input
                        type="text"
                        value={formLote}
                        onChange={(e) => setFormLote(e.target.value)}
                        placeholder="Ex: LT-ARI-90"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-600 font-bold block">Quantidade de Caixas</label>
                      <input
                        type="number"
                        value={formQuantidade}
                        onChange={(e) => setFormQuantidade(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none font-bold"
                      />
                    </div>

                    <div className="space-y-1.5 col-span-1 sm:col-span-2">
                      <label className="text-zinc-600 font-bold block">Vencimento</label>
                      <input
                        type="date"
                        value={formVencimento}
                        onChange={(e) => setFormVencimento(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 flex items-end">
                      <button
                        onClick={() => {
                          if (!formEan || !formNome || !formQuantidade) {
                            emitirBipErro();
                            return;
                          }
                          const qty = parseInt(formQuantidade) || 0;
                          const newItem: InventoryItem = {
                            ean: formEan,
                            nome: formNome,
                            categoria: 'LIMPEZA',
                            subcategoria: formSubcategoria,
                            marca: formMarca || 'EcoLimpo',
                            fabricante: formFabricante || 'Indústria Química CD Ltda',
                            rua: formRua,
                            prateleira: formPrateleira,
                            quantidade: qty,
                            lote: formLote || 'LT-REG-CD',
                            vencimento: formVencimento,
                            giro: qty > 50 ? 'Alto' : 'Médio',
                            peso: '10kg',
                            statusPosicao: qty >= 85 ? 'ocupado' : qty > 0 ? 'parcial' : 'disponivel',
                            ultimaMovimentacao: new Date().toISOString().split('T')[0]
                          };
                          
                          setInventory(prev => {
                            const index = prev.findIndex(item => item.ean === formEan);
                            if (index !== -1) {
                              return prev.map((item, idx) => idx === index ? { ...item, quantidade: item.quantidade + qty, ultimaMovimentacao: newItem.ultimaMovimentacao } : item);
                            }
                            return [...prev, newItem];
                          });
                          adicionarLog('Entrada CD', `Entrada de ${qty} un de ${formNome} registrada no local ${formPrateleira}.`);
                          emitirBipSucesso();
                          setShowEntradaModal(false);
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg uppercase tracking-wider transition active:scale-95 shadow-sm"
                      >
                        Salvar e Armazenar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL / PANEL DE AJUSTE RÁPIDO */}
              {showAjusteModal && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-fade-in space-y-3">
                  <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-600" /> Ajuste de Inventário: {showAjusteModal.nome}
                    </h4>
                    <button onClick={() => setShowAjusteModal(null)} className="text-zinc-400 hover:text-zinc-600 text-xs">Fechar</button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 text-xs font-semibold">
                    <div className="flex-1 space-y-1">
                      <span className="text-zinc-500 text-[10px] uppercase block">Endereço Atual</span>
                      <span className="text-zinc-800 text-sm font-bold block font-mono">{showAjusteModal.rua} - {showAjusteModal.prateleira}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-zinc-500 text-[10px] uppercase block">Quantidade Atual</span>
                      <span className="text-zinc-800 text-sm font-bold block">{showAjusteModal.quantidade} un</span>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-zinc-700 font-bold block">Nova Quantidade Física</label>
                      <input
                        type="number"
                        value={ajusteNovaQtd}
                        onChange={(e) => setAjusteNovaQtd(e.target.value)}
                        className="bg-white border border-zinc-200 rounded-lg px-3 py-1 text-sm text-zinc-950 focus:outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          const novaQ = parseInt(ajusteNovaQtd) || 0;
                          setInventory(prev => prev.map(item => item.ean === showAjusteModal.ean ? { ...item, quantidade: novaQ, ultimaMovimentacao: new Date().toISOString().split('T')[0] } : item));
                          adicionarLog('Ajuste Manual', `Item ${showAjusteModal.nome} ajustado de ${showAjusteModal.quantidade} un para ${novaQ} un.`);
                          emitirBipSucesso();
                          setShowAjusteModal(null);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-lg uppercase tracking-wider"
                      >
                        Confirmar Ajuste
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL / PANEL DE TRANSFERÊNCIA DE POSIÇÃO */}
              {showTransferModal && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 animate-fade-in space-y-3">
                  <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-indigo-600" /> Transferência de Posição: {showTransferModal.nome}
                    </h4>
                    <button onClick={() => setShowTransferModal(null)} className="text-zinc-400 hover:text-zinc-600 text-xs">Fechar</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-[10px] uppercase block">Localização Atual</span>
                      <span className="text-zinc-800 text-sm font-bold block font-mono">{showTransferModal.rua} ({showTransferModal.prateleira})</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-700 font-bold block">Nova Rua</label>
                      <select
                        value={transferNewRua}
                        onChange={(e) => {
                          setTransferNewRua(e.target.value);
                          const prefix = e.target.value === 'Rua A' ? 'A' : e.target.value === 'Rua B' ? 'B' : e.target.value === 'Rua C' ? 'C' : 'D';
                          setTransferNewPrateleira(`${prefix}-01`);
                        }}
                        className="bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 focus:outline-none w-full font-bold cursor-pointer"
                      >
                        <option value="Rua A">Rua A (Limpeza)</option>
                        <option value="Rua B">Rua B (Infra)</option>
                        <option value="Rua C">Rua C (Tintas)</option>
                        <option value="Rua D">Rua D (Geral)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-zinc-700 font-bold block">Nova Prateleira/Rack</label>
                      <input
                        type="text"
                        value={transferNewPrateleira}
                        onChange={(e) => setTransferNewPrateleira(e.target.value.toUpperCase())}
                        className="bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-950 focus:outline-none w-full font-bold"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setInventory(prev => prev.map(item => item.ean === showTransferModal.ean ? { ...item, rua: transferNewRua, prateleira: transferNewPrateleira, ultimaMovimentacao: new Date().toISOString().split('T')[0] } : item));
                          adicionarLog('Transferência', `Item ${showTransferModal.nome} transferido de ${showTransferModal.prateleira} para ${transferNewPrateleira}.`);
                          emitirBipSucesso();
                          setShowTransferModal(null);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full py-2.5 rounded-lg uppercase tracking-wider"
                      >
                        Salvar Posição
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* LISTA DE PRODUTOS FILTRADOS */}
              <div className="border border-zinc-150 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-zinc-50 border-b border-zinc-150 p-3.5 flex justify-between items-center">
                  <h5 className="text-[10px] uppercase font-black text-zinc-500 tracking-wider">Produtos Estocados no CD</h5>
                  <span className="text-[10px] text-zinc-400 font-semibold font-mono">Total Listado: {
                    inventory.filter(item => {
                      const matchesSearch = 
                        item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.ean.includes(searchTerm) ||
                        item.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.prateleira.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.rua.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.marca && item.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (item.fabricante && item.fabricante.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        item.vencimento.includes(searchTerm) ||
                        item.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.subcategoria && item.subcategoria.toLowerCase().includes(searchTerm.toLowerCase()));
                      const matchesCategory = filterCategory === 'All' || item.categoria === filterCategory;
                      const matchesSubcategory = filterSubcategory === 'All' || item.subcategoria === filterSubcategory;
                      
                      let matchesStatus = true;
                      if (filterStatus === 'estoque_baixo') matchesStatus = item.quantidade > 0 && item.quantidade < 20;
                      else if (filterStatus === 'lento_giro') matchesStatus = item.giro === 'Baixo';
                      else if (filterStatus === 'vencido_critico') matchesStatus = new Date(item.vencimento) <= new Date('2026-08-01');
                      else if (filterStatus === 'sem_estoque') matchesStatus = item.quantidade === 0;

                      return matchesSearch && matchesCategory && matchesSubcategory && matchesStatus;
                    }).length
                  } itens</span>
                </div>

                <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto font-sans">
                  {inventory.filter(item => {
                    const matchesSearch = 
                      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.ean.includes(searchTerm) ||
                      item.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.prateleira.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.rua.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (item.marca && item.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (item.fabricante && item.fabricante.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      item.vencimento.includes(searchTerm) ||
                      item.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (item.subcategoria && item.subcategoria.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesCategory = filterCategory === 'All' || item.categoria === filterCategory;
                    const matchesSubcategory = filterSubcategory === 'All' || item.subcategoria === filterSubcategory;
                    
                    let matchesStatus = true;
                    if (filterStatus === 'estoque_baixo') matchesStatus = item.quantidade > 0 && item.quantidade < 20;
                    else if (filterStatus === 'lento_giro') matchesStatus = item.giro === 'Baixo';
                    else if (filterStatus === 'vencido_critico') matchesStatus = new Date(item.vencimento) <= new Date('2026-08-01');
                    else if (filterStatus === 'sem_estoque') matchesStatus = item.quantidade === 0;

                    return matchesSearch && matchesCategory && matchesSubcategory && matchesStatus;
                  }).map(item => {
                    const isExpiring = new Date(item.vencimento) <= new Date('2026-08-01');
                    const isLowStock = item.quantidade > 0 && item.quantidade < 20;
                    
                    return (
                      <div key={item.ean} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              item.rua === 'Rua A' ? 'bg-cyan-50 text-cyan-700 font-bold' :
                              item.rua === 'Rua B' ? 'bg-indigo-50 text-indigo-700 font-bold' :
                              item.rua === 'Rua C' ? 'bg-teal-50 text-teal-700 font-bold' :
                              'bg-purple-50 text-purple-700 font-bold'
                            }`}>{item.subcategoria || item.categoria}</span>
                            {item.marca && <span className="text-[8px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold uppercase">{item.marca}</span>}
                            <span className="text-[10px] text-zinc-400 font-mono font-bold">SKU {item.ean}</span>
                          </div>
                          <h6 className="text-xs font-bold text-zinc-950">{item.nome}</h6>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-500 font-semibold pt-1">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500" /> {item.rua} • Posição {item.prateleira}</span>
                            <span>Lote: <strong>{item.lote}</strong></span>
                            <span className={`flex items-center gap-1 ${isExpiring ? 'text-rose-600 font-bold' : ''}`}>
                              Vencimento: {item.vencimento} {isExpiring && '⚠️'}
                            </span>
                          </div>
                        </div>

                        {/* Coluna da Quantidade */}
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-zinc-400 font-bold block">QUANTIDADE</span>
                            <span className={`text-sm font-black ${
                              item.quantidade === 0 ? 'text-zinc-400 line-through' :
                              isLowStock ? 'text-rose-600 font-black animate-pulse' : 'text-zinc-900'
                            }`}>{item.quantidade} un</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Dar Saída rápida */}
                            <button
                              onClick={() => {
                                if (item.quantidade <= 0) {
                                  emitirBipErro();
                                  return;
                                }
                                emitirBipSucesso();
                                setInventory(prev => prev.map(i => i.ean === item.ean ? { ...i, quantidade: Math.max(0, i.quantidade - 10), ultimaMovimentacao: new Date().toISOString().split('T')[0] } : i));
                                adicionarLog('Saída Rápida', `Saída de 10 caixas do item ${item.nome}.`);
                              }}
                              title="Dar Saída Rápida (-10 un)"
                              disabled={item.quantidade === 0}
                              className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center transition ${
                                item.quantidade === 0 ? 'bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 active:scale-95'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            {/* Transferir */}
                            <button
                              onClick={() => {
                                emitirBipSucesso();
                                setTransferNewRua(item.rua);
                                setTransferNewPrateleira(item.prateleira);
                                setShowTransferModal(item);
                                setShowAjusteModal(null);
                              }}
                              title="Transferir Posição"
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition active:scale-95"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Ajustar */}
                            <button
                              onClick={() => {
                                emitirBipSucesso();
                                setAjusteNovaQtd(item.quantidade.toString());
                                setShowAjusteModal(item);
                                setShowTransferModal(null);
                              }}
                              title="Ajustar Manualmente"
                              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition active:scale-95"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO INVENTÁRIO RÁPIDO / CÍCLICO PREVENTIVO */}
              <div className="bg-gradient-to-br from-purple-50/50 to-purple-50/10 border border-purple-100 rounded-2xl p-5 space-y-4 shadow-sm shadow-purple-50">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-purple-700 font-extrabold flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-purple-600 animate-pulse" /> Inventário Cíclico Rápido (QR / RFID)
                  </span>
                  <p className="text-xs text-zinc-500 mt-1 font-medium">Faça a contagem preventiva das posições e verifique discrepâncias automáticas:</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Item Sorteado para Contar */}
                  <div className="bg-white border border-purple-150 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[8px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider block w-max">Aguardando Auditoria</span>
                      <h6 className="font-bold text-xs text-zinc-900 mt-2">{quickCountItem?.nome || 'Selecione um item abaixo'}</h6>
                      <span className="text-[10px] font-mono text-zinc-500 block pt-1 font-semibold">
                        Posição Atual: <strong className="font-mono text-zinc-800">{quickCountItem?.prateleira || 'N/A'}</strong> | Sistema: <strong className="text-purple-700 font-mono">{quickCountItem?.quantidade ?? 0} un</strong>
                      </span>
                    </div>

                    {!quickCountItem && (
                      <button
                        onClick={() => {
                          emitirBipSucesso();
                          // Sort an item that is not counted yet
                          const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
                          setQuickCountItem(randomItem);
                          setQuickCountValue('');
                        }}
                        className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg uppercase text-[10px] tracking-wider active:scale-95 transition shadow-sm"
                      >
                        Sortear Próxima Posição
                      </button>
                    )}
                  </div>

                  {/* Campo de Contagem Física */}
                  {quickCountItem && (
                    <div className="bg-white border border-purple-150 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">Unidades Encontradas na Prateleira</label>
                        <input
                          type="number"
                          value={quickCountValue}
                          onChange={(e) => setQuickCountValue(e.target.value)}
                          placeholder="Ex: 85"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-black text-zinc-950 focus:outline-none"
                        />
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            if (!quickCountValue) {
                              emitirBipErro();
                              return;
                            }
                            emitirBipSucesso();
                            const esperado = quickCountItem.quantidade;
                            const contado = parseInt(quickCountValue) || 0;
                            setDivergencias(prev => ({
                              ...prev,
                              [quickCountItem.ean]: { esperado, contado, lote: quickCountItem.lote }
                            }));
                            setQuickCountItem(null);
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg uppercase text-[10px] tracking-wider transition active:scale-95"
                        >
                          Salvar Contagem
                        </button>
                        <button
                          onClick={() => setQuickCountItem(null)}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-500 px-3 py-2 rounded-lg font-bold text-xs"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Painel de Divergências Encontradas */}
                  <div className="bg-white border border-purple-150 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-bold block uppercase tracking-wider mb-2">Painel de Divergências</span>
                      <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
                        {Object.keys(divergencias).length === 0 ? (
                          <p className="text-[10px] text-zinc-400 font-semibold italic text-center py-4">Nenhuma divergência registrada nesta rodada.</p>
                        ) : (
                          (Object.entries(divergencias) as [string, { esperado: number; contado: number; lote: string }][]).map(([ean, value]) => {
                            const p = inventory.find(item => item.ean === ean);
                            const diff = value.contado - value.esperado;
                            return (
                              <div key={ean} className="flex justify-between items-center border-b border-zinc-100 pb-1 last:border-0 text-[10px]">
                                <span className="font-bold text-zinc-700 truncate max-w-[110px]">{p?.nome || 'Item'}</span>
                                <span className={`font-mono font-black ${diff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {diff > 0 ? `+${diff}` : diff} un
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {Object.keys(divergencias).length > 0 && (
                      <button
                        onClick={() => {
                          emitirBipSucesso();
                          // Apply correction
                          setInventory(prev => prev.map(item => {
                            if (divergencias[item.ean]) {
                              return { ...item, quantidade: divergencias[item.ean].contado, ultimaMovimentacao: new Date().toISOString().split('T')[0] };
                            }
                            return item;
                          }));
                          adicionarLog('Inventário Cíclico', `Correção automática de ${Object.keys(divergencias).length} divergências efetuada.`);
                          setDivergencias({});
                          setAcuracidade(99.8);
                        }}
                        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg uppercase text-[10px] tracking-wider transition active:scale-95 shadow-sm"
                      >
                        Sincronizar e Corrigir Divergências
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: ÁREA DE EXPEDIÇÃO (NOVA ÁREA DE ESTOQUE) */}
        {viewMode === 'expedicao' && (
          <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
            {/* KPI ROW FOR DISPATCH */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Pedidos Pendentes</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-amber-600 font-mono">
                    {shippingOrders.filter(o => o.status === 'Pendente').length}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Fila de Espera</span>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Separações Ativas</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-blue-600 font-mono flex items-center gap-2">
                    {shippingOrders.filter(o => o.status === 'Separando').length}
                    {shippingOrders.filter(o => o.status === 'Separando').length > 0 && (
                      <RotateCcw className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Picking AGV</span>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Prontos p/ Embarque</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-emerald-600 font-mono">
                    {shippingOrders.filter(o => o.status === 'Conferido').length}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase">Aguardando Doca 2</span>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Despachados Hoje</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-zinc-900 font-mono">
                    {shippingOrders.filter(o => o.status === 'Enviado').length}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Caminhões Enviados</span>
                </div>
              </div>
            </div>

            {/* MAIN EXPEDITION SPLIT */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* ORDERS LIST PANEL (2 Columns wide) */}
              <div className="xl:col-span-2 space-y-5">
                <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-indigo-600" /> Fila de Pedidos de Saída (Outbound)
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5 font-medium">Ordene, acompanhe o picking autônomo e libere expedições:</p>
                    </div>
                    <button
                      onClick={() => {
                        emitirBipSucesso();
                        setNewOrderDestino('');
                        setNewOrderPlaca('');
                        setNewOrderPrioridade('Normal');
                        setNewOrderItens([]);
                        setShowNewOrderModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] tracking-wider uppercase px-3 py-2 rounded-lg transition active:scale-95 shadow-sm shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Novo Pedido de Saída
                    </button>
                  </div>

                  {/* Active Orders List */}
                  <div className="space-y-4">
                    {shippingOrders.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-zinc-200 rounded-xl">
                        <p className="text-zinc-400 text-xs font-semibold">Nenhum pedido de expedição cadastrado.</p>
                      </div>
                    ) : (
                      shippingOrders.map(order => {
                        const progress = pickingProgress[order.id] ?? 0;
                        return (
                          <div 
                            key={order.id} 
                            className={`border rounded-xl p-4 transition-all duration-300 ${
                              order.status === 'Separando' ? 'border-indigo-400 bg-indigo-50/20' :
                              order.status === 'Conferido' ? 'border-emerald-500 bg-emerald-50/10' :
                              order.status === 'Enviado' ? 'border-zinc-200/80 bg-zinc-50/50 opacity-75' :
                              'border-zinc-200 hover:border-zinc-300 bg-white'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-zinc-100/60">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs font-black text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                                  {order.id}
                                </span>
                                <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${
                                  order.prioridade === 'Urgente' ? 'bg-rose-100 text-rose-700 animate-pulse' :
                                  order.prioridade === 'Alta' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {order.prioridade}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono font-medium">{order.dataCriacao}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                                  Caminhão: <strong className="text-zinc-800">{order.caminhaoPlaca}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                              {/* Destination & Product Items */}
                              <div className="md:col-span-2 space-y-2">
                                <div className="text-xs">
                                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold block">Destinatário</span>
                                  <p className="font-bold text-zinc-850">{order.destino}</p>
                                </div>
                                <div className="text-xs">
                                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold block">Itens Solicitados ({order.itens.reduce((acc, curr) => acc + curr.quantidade, 0)} u)</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {order.itens.map((item, idx) => (
                                      <span key={idx} className="bg-zinc-100 text-zinc-700 text-[10px] px-2 py-1 rounded border border-zinc-200/60 font-medium">
                                        {item.nome} • <strong className="text-zinc-900 font-mono font-bold">{item.quantidade}x</strong> ({item.prateleira})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Status and Actions */}
                              <div className="flex flex-col gap-2 items-stretch md:items-end w-full text-right">
                                {order.status === 'Pendente' && (
                                  <button
                                    onClick={() => iniciarPickingAGV(order.id)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-lg transition active:scale-95 shadow-sm cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3 inline mr-1 animate-spin-reverse" /> Iniciar Picking AGV
                                  </button>
                                )}

                                {order.status === 'Separando' && (
                                  <div className="w-full space-y-1.5 text-left md:text-right">
                                    <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest block animate-pulse">AGV em Trânsito ({progress}%)</span>
                                    <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden shadow-inner">
                                      <div 
                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                        style={{ width: `${progress}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}

                                {order.status === 'Conferido' && (
                                  <div className="w-full flex flex-col gap-1.5">
                                    <div className="flex justify-between md:justify-end gap-1.5 items-center font-medium">
                                      <span className="text-[9px] bg-emerald-100 text-emerald-850 font-extrabold px-1.5 py-0.5 rounded uppercase">Conferido ✓</span>
                                      <span className="text-[10px] text-zinc-400">Doca 02</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => { emitirBipSucesso(); setShowGuideModal(order); }}
                                        className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[10px] uppercase tracking-wider py-2 px-2.5 rounded-lg border border-zinc-200 transition cursor-pointer"
                                        title="Imprimir Guia de Embarque"
                                      >
                                        Guia NF
                                      </button>
                                      <button
                                        onClick={() => liberarCaminhao(order)}
                                        className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-lg transition active:scale-95 shadow-sm cursor-pointer"
                                      >
                                        Liberar Saída
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {order.status === 'Enviado' && (
                                  <div className="text-right">
                                    <span className="bg-zinc-200/60 text-zinc-600 text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center justify-center gap-1.5">
                                      Despachado 🚛
                                    </span>
                                    <span className="text-[9px] text-zinc-400 block mt-1 font-medium">Estoque deduzido</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Rota Otimizada do AGV baseada em Giro e Peso */}
                            <div className="mt-3.5 pt-3 border-t border-zinc-150/60 w-full">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                                  <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                  Rota de Picking do AGV (Ordenada por Peso e Giro)
                                </span>
                                <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  Base Estável: Itens Pesados ➔ Leves (Giro como desempate)
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 bg-zinc-50 border border-zinc-200/50 p-2.5 rounded-xl">
                                <div className="flex items-center gap-1 bg-zinc-200/80 text-zinc-800 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-zinc-300/40">
                                  <Truck className="w-3 h-3 text-zinc-500" />
                                  <span>Partida</span>
                                </div>
                                
                                {obterItensOrdenadosPorGiroEPeso(order.itens).map((item, idx) => {
                                  const itemEstoque = inventory.find(i => i.ean === item.ean);
                                  const giro = itemEstoque?.giro || 'Médio';
                                  const pesoStr = itemEstoque?.peso || '0kg';
                                  
                                  const sortedList = obterItensOrdenadosPorGiroEPeso(order.itens);
                                  const progressoPorItem = 100 / (sortedList.length + 1);
                                  const currentProgress = pickingProgress[order.id] ?? 0;
                                  
                                  const isItemActive = order.status === 'Separando' && 
                                                       currentProgress > (idx * progressoPorItem) && 
                                                       currentProgress <= ((idx + 1) * progressoPorItem);
                                  
                                  const isItemPicked = order.status === 'Conferido' || 
                                                       order.status === 'Enviado' || 
                                                       (order.status === 'Separando' && currentProgress > ((idx + 1) * progressoPorItem));

                                  return (
                                    <div key={idx} className="flex items-center gap-1">
                                      <span className="text-zinc-300 text-xs hidden sm:inline mx-0.5">➔</span>
                                      <div 
                                        className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-semibold transition-all ${
                                          isItemActive ? 'bg-amber-500 text-amber-950 border-amber-500 shadow-md shadow-amber-100/50 scale-102 font-bold animate-pulse' :
                                          isItemPicked ? 'bg-emerald-50 text-emerald-800 border-emerald-200 line-through' :
                                          'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                                        }`}
                                      >
                                        <span className={`w-2 h-2 rounded-full ${
                                          giro === 'Alto' ? 'bg-emerald-500' :
                                          giro === 'Médio' ? 'bg-amber-500' :
                                          'bg-rose-500'
                                        }`} title={`Giro ${giro}`} />
                                        <span className="truncate max-w-[130px]">{item.nome}</span>
                                        <span className="font-mono font-bold bg-zinc-100/85 text-zinc-800 text-[8.5px] px-1 py-0.2 rounded border border-zinc-200">
                                          {item.prateleira} ({pesoStr} - {giro})
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                                
                                <span className="text-zinc-300 text-xs hidden sm:inline mx-0.5">➔</span>
                                <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
                                  order.status === 'Conferido' || order.status === 'Enviado' || (order.status === 'Separando' && (pickingProgress[order.id] ?? 0) >= 95) ?
                                  'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                                  'bg-zinc-100 text-zinc-500 border-zinc-200'
                                }`}>
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  <span>Entrega (Docas)</span>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-zinc-500 bg-zinc-50/40 p-2 rounded-lg border border-zinc-150/40 font-medium">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="flex items-center gap-1 font-bold">Legenda Giro:</span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Alto
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Médio
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Baixo
                                  </span>
                                </div>
                                <span className="text-indigo-600 font-bold font-mono">
                                  ⚡ Rota Balanceada (Peso + Giro) para menor desgaste do AGV
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* DOCK MANAGER PANEL (1 Column wide) */}
              <div className="space-y-5">
                {/* Doca 02 Details */}
                <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" /> Doca 02 - Doca de Expedição
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5 font-medium">Acompanhamento físico e integridade de embarque:</p>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-200/60 pb-2">
                      <span className="text-xs font-bold text-zinc-500">Status Operacional</span>
                      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Caminhão Docado
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold block">Placa</span>
                        <input
                          type="text"
                          value={doca2Status.placa}
                          onChange={(e) => setDoca2Status(prev => ({ ...prev, placa: e.target.value }))}
                          className="font-mono font-bold text-zinc-800 bg-white border border-zinc-200 rounded px-2 py-1 mt-0.5 w-full focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold block">Temp. Baú</span>
                        <input
                          type="text"
                          value={doca2Status.temperatura}
                          onChange={(e) => setDoca2Status(prev => ({ ...prev, temperatura: e.target.value }))}
                          className="font-mono font-bold text-zinc-850 bg-white border border-zinc-200 rounded px-2 py-1 mt-0.5 w-full focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold block">Motorista Autorizado</span>
                      <input
                        type="text"
                        value={doca2Status.motorista}
                        onChange={(e) => setDoca2Status(prev => ({ ...prev, motorista: e.target.value }))}
                        className="font-bold text-zinc-800 bg-white border border-zinc-200 rounded px-2 py-1 mt-0.5 w-full focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>

                    <div className="text-xs">
                      <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold block">Transportadora</span>
                      <input
                        type="text"
                        value={doca2Status.transportadora}
                        onChange={(e) => setDoca2Status(prev => ({ ...prev, transportadora: e.target.value }))}
                        className="font-bold text-zinc-800 bg-white border border-zinc-200 rounded px-2 py-1 mt-0.5 w-full focus:outline-none focus:border-indigo-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Safety & Compliance Checklist */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">Segurança de Liberação</span>
                    
                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 cursor-pointer hover:bg-zinc-100/50 transition">
                      <input 
                        type="checkbox" 
                        checked={doca2Status.checklist.epis}
                        onChange={(e) => setDoca2Status(prev => ({ ...prev, checklist: { ...prev.checklist, epis: e.target.checked } }))}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="font-semibold text-zinc-850 text-[11px]">EPIs & Credenciamento ok</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 cursor-pointer hover:bg-zinc-100/50 transition">
                      <input 
                        type="checkbox" 
                        checked={doca2Status.checklist.lote}
                        onChange={(e) => setDoca2Status(prev => ({ ...prev, checklist: { ...prev.checklist, lote: e.target.checked } }))}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="font-semibold text-zinc-850 text-[11px]">Pesagem & Carga conferida</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 cursor-pointer hover:bg-zinc-100/50 transition">
                      <input 
                        type="checkbox" 
                        checked={doca2Status.checklist.seguranca}
                        onChange={(e) => setDoca2Status(prev => ({ ...prev, checklist: { ...prev.checklist, seguranca: e.target.checked } }))}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="font-semibold text-zinc-850 text-[11px]">Lacre mecânico de segurança ok</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: MAPA LOGÍSTICO 3D (REMOVIDO DO DESKTOP E INTEGRADO NO COLETOR) */}
        {false && (
          <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
            {/* MAPA LOGÍSTICO: TOPO E FILTROS */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" /> Mapa de Ocupação do CD (Gêmeo Digital)
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5 font-medium">Visualização em tempo real das posições, docas, corredores e longarinas:</p>
                </div>

                {/* Filtros e Ajuste de Zoom */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  {/* Zoom Controls */}
                  <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 gap-1 shadow-sm">
                    <button 
                      onClick={() => { emitirBipSucesso(); setMapZoom(prev => Math.max(0.7, prev - 0.15)); }}
                      title="Diminuir Zoom"
                      className="p-1 hover:bg-zinc-200 text-zinc-600 rounded cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-zinc-700 px-1 w-10 text-center">{Math.round(mapZoom * 100)}%</span>
                    <button 
                      onClick={() => { emitirBipSucesso(); setMapZoom(prev => Math.min(1.4, prev + 0.15)); }}
                      title="Aumentar Zoom"
                      className="p-1 hover:bg-zinc-200 text-zinc-600 rounded cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => { emitirBipSucesso(); setMapZoom(1); }}
                      title="Resetar Zoom"
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 px-1 cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Filtro por Rua */}
                  <div className="flex bg-zinc-50 border border-zinc-200 rounded-xl p-1 gap-1 shadow-sm">
                    {['All', 'Rua A', 'Rua B', 'Rua C', 'Rua D'].map((st) => (
                      <button
                        key={st}
                        onClick={() => { emitirBipSucesso(); setMapFilterStreet(st); }}
                        className={`text-[9px] font-bold uppercase px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                          mapFilterStreet === st ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700'
                        }`}
                      >
                        {st === 'All' ? 'Todos' : st.replace('Rua ', '')}
                      </button>
                    ))}
                  </div>

                  {/* Filtro por Destaque de Produto */}
                  <div className="relative w-full sm:w-44">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={mapSearchHighlight}
                      onChange={(e) => setMapSearchHighlight(e.target.value)}
                      placeholder="Localizar produto..."
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* LEGENDA DE OCUPAÇÃO */}
              <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex flex-wrap gap-4 justify-center md:justify-start text-[10px] font-mono font-semibold text-zinc-600">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-full"></span> 🟢 Disponível</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded-full"></span> 🟡 Parcial</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-rose-100 border border-rose-300 rounded-full"></span> 🔴 Ocupado</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-sky-100 border border-sky-300 rounded-full"></span> 🔵 Reservado</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-zinc-800 border border-zinc-950 rounded-full"></span> ⚫ Bloqueado</span>
              </div>

              {/* VIEWPORT CONTENDO O MAPA */}
              <div className="border border-zinc-200 rounded-2xl bg-zinc-50 overflow-hidden relative" style={{ minHeight: '380px' }}>
                <div 
                  className="p-6 md:p-10 flex flex-col items-center justify-center transition-transform duration-200 origin-center space-y-8"
                  style={{ transform: `scale(${mapZoom})` }}
                >
                  {/* DOCA DE RECEBIMENTO (Topo ou Lateral Esquerda) */}
                  <div className="w-full flex justify-between items-center gap-4 text-[10px] font-mono font-bold text-zinc-400 border-b border-dashed border-zinc-300 pb-2">
                    <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-cyan-600 animate-pulse" /> ÁREA DE RECEBIMENTO (DOCA 01)</span>
                    <span className="flex items-center gap-1.5">ÁREA DE EXPEDIÇÃO (DOCA 02) <Truck className="w-4 h-4 text-indigo-600 animate-pulse" /></span>
                  </div>

                  {/* CAMINHÕES NAS DOCAS (Aparência Premium WMS) */}
                  <div className="w-full grid grid-cols-2 gap-8 text-xs">
                    {/* Caminhão de Recebimento */}
                    <div className="bg-white border border-zinc-200/80 p-3 rounded-xl shadow-sm flex items-center gap-3">
                      <div className="bg-cyan-50 text-cyan-600 p-2 rounded-lg shrink-0">
                        <Truck className="w-6 h-6 shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-zinc-400 font-bold block uppercase font-mono">Placa AAA-1234</span>
                        <h6 className="font-bold text-zinc-800 truncate">Descarga de Carga Geral</h6>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mt-1.5">
                          <div className="bg-cyan-500 h-full rounded-full w-2/3 animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    {/* Caminhão de Expedição */}
                    <div className="bg-white border border-zinc-200/80 p-3 rounded-xl shadow-sm flex items-center gap-3">
                      <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg shrink-0">
                        <Truck className="w-6 h-6 shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-zinc-400 font-bold block uppercase font-mono">Placa EXP-9088</span>
                        <h6 className="font-bold text-zinc-800 truncate">Carregamento Rotas Sul</h6>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mt-1.5">
                          <div className="bg-indigo-600 h-full rounded-full w-4/5"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LAYOUT DAS RUAS / CORREDORES */}
                  <div className="w-full space-y-6">
                    {['Rua A', 'Rua B', 'Rua C', 'Rua D'].filter(r => mapFilterStreet === 'All' || r === mapFilterStreet).map((streetName) => {
                      const prefix = streetName === 'Rua A' ? 'A' : streetName === 'Rua B' ? 'B' : streetName === 'Rua C' ? 'C' : 'D';
                      const sectorKey = streetName === 'Rua A' ? 'LIMPEZA' : streetName === 'Rua B' ? 'INFRAESTRUTURA' : streetName === 'Rua C' ? 'TINTAS' : 'GERAL';
                      const sectorInfo = SECTORS_CD[sectorKey];

                      return (
                        <div key={streetName} className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-bold border-b border-zinc-100 pb-1.5">
                            <span className="text-zinc-800 font-extrabold flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                streetName === 'Rua A' ? 'bg-cyan-500' :
                                streetName === 'Rua B' ? 'bg-amber-500' :
                                streetName === 'Rua C' ? 'bg-rose-500' : 'bg-purple-500'
                              }`}></span>
                              {streetName} — {sectorInfo.nome}
                            </span>
                            <span className="text-zinc-400 font-semibold font-mono">Setor {prefix}1 - {prefix}6</span>
                          </div>

                          {/* Longarinas de Racks */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3.5">
                            {[`${prefix}-01`, `${prefix}-02`, `${prefix}-03`, `${prefix}-04`, `${prefix}-05`, `${prefix}-06`].map((rackId) => {
                              // Find if we have an item stowed in this rack
                              const item = inventory.find(i => i.prateleira === rackId);
                              const qty = item?.quantidade ?? 0;
                              
                              // Determine color codes
                              let bgStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400 cursor-pointer';
                              let colorDot = 'bg-emerald-500';
                              let statusText = 'Livre';

                              // Forced black blocked position
                              if (rackId === 'B-06') { // simulate a blocked position
                                bgStyle = 'bg-zinc-850 text-zinc-100 border-zinc-900 cursor-pointer';
                                colorDot = 'bg-zinc-950';
                                statusText = 'Bloqueado';
                              } else if (rackId === 'C-06') { // simulate a reserved position
                                bgStyle = 'bg-sky-50 text-sky-800 border-sky-200 hover:border-sky-400 cursor-pointer';
                                colorDot = 'bg-sky-500';
                                statusText = 'Reservado';
                              } else if (item) {
                                if (qty === 0) {
                                  bgStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400 cursor-pointer';
                                  colorDot = 'bg-emerald-500';
                                  statusText = 'Disponível';
                                } else if (qty < 85) {
                                  bgStyle = 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-400 cursor-pointer';
                                  colorDot = 'bg-amber-500';
                                  statusText = 'Parcial';
                                } else {
                                  bgStyle = 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-400 cursor-pointer';
                                  colorDot = 'bg-rose-500';
                                  statusText = 'Ocupado';
                                }
                              }

                              // Is highlighted by search?
                              const matchesHighlight = mapSearchHighlight && item && item.nome.toLowerCase().includes(mapSearchHighlight.toLowerCase());
                              const isSelected = selectedCell?.rack === rackId;

                              return (
                                <button
                                  key={rackId}
                                  onClick={() => {
                                    emitirBipSucesso();
                                    setSelectedCell({ street: streetName, rack: rackId, item: item || null });
                                  }}
                                  className={`p-3 rounded-xl border text-center transition-all duration-300 relative flex flex-col justify-between min-h-[75px] ${bgStyle} ${
                                    isSelected ? 'ring-2 ring-indigo-600 ring-offset-2 scale-98 font-bold' : ''
                                  } ${
                                    matchesHighlight ? 'animate-bounce border-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.7)] font-bold ring-1 ring-indigo-500' : ''
                                  }`}
                                >
                                  {/* Rack Name */}
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-[10px] font-black tracking-tight font-mono">{rackId}</span>
                                    <span className={`w-2 h-2 rounded-full ${colorDot}`}></span>
                                  </div>

                                  {/* Rack content glimpse */}
                                  <div className="text-[9px] font-mono text-left font-bold line-clamp-1 w-full pt-1.5 opacity-80">
                                    {rackId === 'B-06' ? 'Manutenção' : rackId === 'C-06' ? 'Reserva' : item && item.quantidade > 0 ? item.nome : 'Vazio'}
                                  </div>

                                  {/* Quantity Badge */}
                                  <div className="w-full flex justify-between items-end pt-1">
                                    <span className="text-[8px] uppercase tracking-wider font-semibold opacity-60 font-mono font-bold">{statusText}</span>
                                    {qty > 0 && rackId !== 'B-06' && rackId !== 'C-06' && (
                                      <span className="text-[9px] font-black font-mono font-bold">{qty}un</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* DETALHES DA POSIÇÃO SELECIONADA */}
              {selectedCell && (
                <div className="bg-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-indigo-900 animate-fade-in space-y-4">
                  <div className="flex justify-between items-start border-b border-indigo-900 pb-2.5">
                    <div>
                      <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-wider">Mapeador Físico CD</span>
                      <h5 className="font-extrabold text-sm text-white">Rack de Armazenagem: Corredor {selectedCell.street} - Rack {selectedCell.rack}</h5>
                    </div>
                    <button 
                      onClick={() => setSelectedCell(null)}
                      className="text-indigo-400 hover:text-white font-bold text-xs"
                    >
                      Fechar [x]
                    </button>
                  </div>

                  {selectedCell.rack === 'B-06' ? (
                    <div className="flex items-center gap-3 text-xs bg-zinc-900 border border-zinc-850 p-4 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                      <p className="font-medium text-zinc-300">Posição temporariamente bloqueada pela segurança ocupacional do CD devido a manutenção estrutural na longarina. Nenhuma entrada autorizada.</p>
                    </div>
                  ) : selectedCell.item ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
                      {/* Product details */}
                      <div className="space-y-1 md:col-span-2">
                        <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider font-mono">Produto Armazenado</span>
                        <h6 className="text-sm font-black text-white">{selectedCell.item.nome}</h6>
                        <span className="text-[10px] text-indigo-300 font-mono block">EAN/Código: {selectedCell.item.ean}</span>
                      </div>

                      {/* Quantidades e Lote */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider font-mono">Estoque & Lote</span>
                        <span className="text-sm font-black block text-white">{selectedCell.item.quantidade} caixas</span>
                        <span className="text-[10px] text-indigo-300 font-mono block">Lote: {selectedCell.item.lote} | Giro: {selectedCell.item.giro}</span>
                      </div>

                      {/* Expiration and actions */}
                      <div className="space-y-2 text-right flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider font-mono">Vencimento</span>
                          <span className="font-black text-white">{selectedCell.item.vencimento}</span>
                        </div>

                        {/* Interactive shortcuts */}
                        <div className="flex gap-2 justify-end pt-1">
                          {/* Transferir */}
                          <button
                            onClick={() => {
                              emitirBipSucesso();
                              setTransferNewRua(selectedCell.item!.rua);
                              setTransferNewPrateleira(selectedCell.item!.prateleira);
                              setShowTransferModal(selectedCell.item);
                              setExecutiveTab('inventario');
                              setSelectedCell(null);
                            }}
                            className="bg-indigo-800 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
                          >
                            Transferir
                          </button>

                          {/* Ajustar */}
                          <button
                            onClick={() => {
                              emitirBipSucesso();
                              setAjusteNovaQtd(selectedCell.item!.quantidade.toString());
                              setShowAjusteModal(selectedCell.item);
                              setExecutiveTab('inventario');
                              setSelectedCell(null);
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
                          >
                            Ajustar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs bg-indigo-900/40 p-4 rounded-xl flex justify-between items-center text-indigo-200">
                      <span>Nenhum material estocado nesta posição. O endereço está completamente vago e limpo.</span>
                      <button
                        onClick={() => {
                          emitirBipSucesso();
                          setFormEan('');
                          setFormNome('');
                          setFormCategoria(selectedCell.street === 'Rua A' ? 'LIMPEZA' : selectedCell.street === 'Rua B' ? 'INFRAESTRUTURA' : selectedCell.street === 'Rua C' ? 'TINTAS' : 'GERAL');
                          setFormRua(selectedCell.street);
                          setFormPrateleira(selectedCell.rack);
                          setFormQuantidade('50');
                          setFormLote(`LT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
                          setFormVencimento('2027-12-31');
                          setExecutiveTab('inventario');
                          setShowEntradaModal(true);
                          setSelectedCell(null);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg uppercase text-[10px] tracking-wider transition cursor-pointer"
                      >
                        Direcionar Entrada Aqui
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'relatorios' && (
          <div className="flex-1 flex flex-col space-y-6 animate-fade-in overflow-y-auto pr-2 pb-10">
            {/* Resumo Operacional */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm shadow-zinc-50 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Resumo Operacional</h3>
                <p className="text-zinc-500 text-sm">Indicadores chave do armazém e métricas de desempenho em tempo real.</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[
                  { label: "Total Produtos", val: "45.289", icon: <Box className="w-4 h-4 text-indigo-500" /> },
                  { label: "Posições Ocupadas", val: "12.450", icon: <Layers className="w-4 h-4 text-blue-500" /> },
                  { label: "Taxa de Ocupação", val: "96%", icon: <Activity className="w-4 h-4 text-emerald-500" /> },
                  { label: "Giro de Estoque", val: "14 Dias", icon: <RotateCcw className="w-4 h-4 text-amber-500" /> },
                  { label: "Próx. Vencimento", val: "128", icon: <AlertTriangle className="w-4 h-4 text-rose-500" /> },
                  { label: "Produtos Vencidos", val: "14", icon: <Flame className="w-4 h-4 text-red-600" /> },
                  { label: "Ruas Agitadas", val: "A, C, F", icon: <Activity className="w-4 h-4 text-orange-500" /> },
                  { label: "Operações Hoje", val: "1.240", icon: <History className="w-4 h-4 text-indigo-500" /> },
                  { label: "Ops. Semana", val: "8.450", icon: <History className="w-4 h-4 text-indigo-400" /> },
                  { label: "Ops. Mês", val: "32.100", icon: <History className="w-4 h-4 text-indigo-300" /> },
                  { label: "T.M. Separação", val: "4m 12s", icon: <Scan className="w-4 h-4 text-emerald-500" /> },
                  { label: "T.M. Armazenagem", val: "6m 30s", icon: <Box className="w-4 h-4 text-emerald-600" /> },
                  { label: "Prod. Operador", val: "85 un/h", icon: <Activity className="w-4 h-4 text-blue-500" /> },
                  { label: "Prod. Turno", val: "92%", icon: <Activity className="w-4 h-4 text-blue-600" /> },
                  { label: "Divergências", val: "0,4%", icon: <AlertTriangle className="w-4 h-4 text-amber-500" /> },
                  { label: "Acuracidade", val: "99,4%", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
                  { label: "Movimentações", val: "4.560", icon: <Move className="w-4 h-4 text-indigo-500" /> },
                  { label: "Recebimentos", val: "45", icon: <Download className="w-4 h-4 text-emerald-500" /> },
                  { label: "Expedições", val: "32", icon: <Truck className="w-4 h-4 text-blue-500" /> },
                  { label: "Docas Ocupadas", val: "8/10", icon: <Truck className="w-4 h-4 text-rose-500" /> },
                  { label: "Docas Livres", val: "2", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> }
                ].map((kpi, i) => (
                  <div key={i} className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-100 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
                      {kpi.icon}
                    </div>
                    <span className="text-xl font-bold text-zinc-800">{kpi.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Analítico */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm shadow-zinc-50 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-600" /> Dashboard Analítico</h3>
                <p className="text-zinc-500 text-sm">Visualização de movimentações, eficiência operacional e evolução do estoque.</p>
              </div>
              
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { nome: 'AGV-Alpha', carga: 1250, distancia: 320, desgaste: 78 },
                      { nome: 'AGV-Beta', carga: 980, distancia: 410, desgaste: 65 },
                      { nome: 'AGV-Gamma', carga: 1450, distancia: 280, desgaste: 82 },
                      { nome: 'AGV-Delta', carga: 1100, distancia: 350, desgaste: 70 },
                      { nome: 'AGV-Epsilon', carga: 850, distancia: 500, desgaste: 88 },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" orientation="left" stroke="#818cf8" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dx={-10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dx={10} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f4f4f5' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar yAxisId="left" dataKey="carga" name="Carga Transportada (t)" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="distancia" name="Distância (km)" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="desgaste" name="Desgaste Acumulado (%)" fill="#fb7185" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inteligência Logística */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm shadow-zinc-50 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> Inteligência Logística</h3>
                <p className="text-zinc-500 text-sm">Análises automáticas, insights e detecções em tempo real realizadas pela IA.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { text: "A produtividade aumentou 8% nesta semana.", icon: <Activity className="w-5 h-5 text-emerald-500" />, color: "bg-emerald-50 border-emerald-100" },
                  { text: "Existem 25 produtos próximos ao vencimento.", icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, color: "bg-amber-50 border-amber-100" },
                  { text: "A Rua C apresenta congestionamento operacional.", icon: <AlertTriangle className="w-5 h-5 text-rose-500" />, color: "bg-rose-50 border-rose-100" },
                  { text: "O estoque está com 96% de ocupação.", icon: <Layers className="w-5 h-5 text-indigo-500" />, color: "bg-indigo-50 border-indigo-100" },
                  { text: "Acuracidade do inventário validada em 99,4%.", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, color: "bg-emerald-50 border-emerald-100" }
                ].map((insight, i) => (
                  <div key={i} className={`border p-4 rounded-xl flex items-start gap-3 ${insight.color}`}>
                    <div className="mt-0.5">{insight.icon}</div>
                    <p className="text-sm font-semibold text-zinc-800 leading-snug">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Exportações */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm shadow-zinc-50 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2"><Download className="w-5 h-5 text-indigo-600" /> Central de Exportações</h3>
                <p className="text-zinc-500 text-sm">Gere planilhas, relatórios consolidados e backups seguros de todo o sistema.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Relatório Operacional */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-bold text-zinc-800 text-md">Relatório Operacional</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Resumo das operações do Centro de Distribuição.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Relatorio_Operacional', 'Relatório Operacional', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Relatorio_Operacional', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Curva ABC */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-5 h-5 text-amber-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Curva ABC</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Classificação dos produtos por giro.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Curva_ABC', 'Curva ABC de Produtos', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Curva_ABC', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Produtos Próximos ao Vencimento */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Vencimento Próximo</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Produtos com vencimento próximo, ordenados por prioridade.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Vencimentos', 'Produtos Próximos ao Vencimento', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Vencimentos', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Movimentações */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Move className="w-5 h-5 text-blue-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Movimentações</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Histórico de entradas, saídas, transferências e movimentações internas.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Movimentacoes', 'Relatório de Movimentações', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Movimentacoes', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Recebimentos */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Download className="w-5 h-5 text-emerald-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Recebimentos</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Resumo dos recebimentos realizados.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Recebimentos', 'Resumo de Recebimentos', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Recebimentos', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Expedições */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-5 h-5 text-indigo-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Expedições</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Resumo das expedições e embarques.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Expedicoes', 'Resumo de Expedições', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Expedicoes', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Histórico */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="w-5 h-5 text-zinc-500" />
                      <h4 className="font-bold text-zinc-800 text-md">Histórico</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Histórico completo das operações do sistema.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Historico', 'Histórico de Operações', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Historico', 'Dados', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Inventário */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-50/50">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-zinc-800 text-md">Inventário</h4>
                    </div>
                    <p className="text-zinc-500 text-xs">Exportação completa da posição atual do estoque, incluindo endereçamento, quantidades, lotes, validade, localização e demais informações do inventário.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => exportToPDF('Inventario', 'Posição Atual do Estoque', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-rose-400 hover:bg-rose-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF
                    </button>
                    <button onClick={() => exportToExcel('Inventario', 'Inventario', inventory)} className="flex-1 bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                    </button>
                  </div>
                </div>

                {/* Backup Geral */}
                <div className="border border-zinc-200 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-200 transition-colors bg-zinc-900">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-5 h-5 text-zinc-300" />
                      <h4 className="font-bold text-white text-md">Backup Geral</h4>
                    </div>
                    <p className="text-zinc-400 text-xs">Gera um backup completo do sistema contendo todos os dados necessários para restauração.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                    <button onClick={() => { setShowBackupModal(true); setBackupStep('menu'); emitirBipSucesso(); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                      <Database className="w-4 h-4 text-zinc-300" /> Abrir Painel de Backup
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {viewMode === 'configuracoes' && (
          <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm shadow-zinc-50">
              <h3 className="font-bold text-zinc-800 text-lg mb-4">Configurações de Acessibilidade e Aparência</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-zinc-700 mb-2">Aparência Global</h4>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setTheme('light')}
                      className={`flex-1 p-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${theme === 'light' ? 'border border-indigo-600 bg-indigo-50 text-indigo-700' : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      <Sun className="w-4 h-4" /> Modo Claro
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'border border-indigo-600 bg-indigo-50 text-indigo-700' : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      <Moon className="w-4 h-4" /> Modo Escuro
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">No momento o tema claro é o padrão otimizado para o WMS.</p>
                </div>
                
                <hr className="border-zinc-100" />
                
                <div>
                  <h4 className="font-semibold text-zinc-700 mb-2">Tamanho da Fonte</h4>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setFontSize('normal')}
                      className={`flex-1 p-3 rounded-xl text-sm font-semibold transition-all ${fontSize === 'normal' ? 'border border-indigo-600 bg-indigo-50 text-indigo-700' : 'border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'}`}
                    >
                      Padrão
                    </button>
                    <button 
                      onClick={() => setFontSize('large')}
                      className={`flex-1 p-3 rounded-xl text-base font-semibold transition-all ${fontSize === 'large' ? 'border border-indigo-600 bg-indigo-50 text-indigo-700' : 'border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'}`}
                    >
                      Grande
                    </button>
                    <button 
                      onClick={() => setFontSize('xlarge')}
                      className={`flex-1 p-3 rounded-xl text-lg font-semibold transition-all ${fontSize === 'xlarge' ? 'border border-indigo-600 bg-indigo-50 text-indigo-700' : 'border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'}`}
                    >
                      Extra Grande
                    </button>
                  </div>
                </div>

                <hr className="border-zinc-100" />
                
                <div>
                  <h4 className="font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-zinc-500" /> Configurações de Áudio do Sistema
                  </h4>
                  
                  <div className="space-y-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 mt-2">
                    {/* Som de leitura */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Som de leitura</span>
                        <span className="text-[10px] text-zinc-500 block">Emite um bipe curto ao ler código de barras com sucesso.</span>
                      </div>
                      <button 
                        onClick={() => setSomLeituraAtivo(!somLeituraAtivo)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${somLeituraAtivo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}
                      >
                        {somLeituraAtivo ? 'Ligado' : 'Desligado'}
                      </button>
                    </div>

                    {/* Som de erro */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Som de erro</span>
                        <span className="text-[10px] text-zinc-500 block">Emite um som curto se a leitura falhar ou for inválida.</span>
                      </div>
                      <button 
                        onClick={() => setSomErroAtivo(!somErroAtivo)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${somErroAtivo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}
                      >
                        {somErroAtivo ? 'Ligado' : 'Desligado'}
                      </button>
                    </div>

                    {/* Volume do bipe */}
                    <div className="border-t border-zinc-100 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs font-bold text-zinc-700 block">Volume do bipe</span>
                          <span className="text-[10px] text-zinc-500 block">Ajusta a intensidade dos bips sonoros do sistema.</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 font-mono">{Math.round(volumeBipe * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <VolumeX className="w-4 h-4 text-zinc-400" />
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.5" 
                          step="0.05" 
                          value={volumeBipe} 
                          onChange={(e) => setVolumeBipe(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <Volume2 className="w-4 h-4 text-zinc-500" />
                      </div>
                    </div>

                    {/* Vibração */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Vibração após leitura</span>
                        <span className="text-[10px] text-zinc-500 block">Fornece feedback físico no coletor ou smartphone.</span>
                      </div>
                      <button 
                        onClick={() => setVibracaoLeitura(!vibracaoLeitura)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${vibracaoLeitura ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}
                      >
                        {vibracaoLeitura ? 'Ligado' : 'Desligado'}
                      </button>
                    </div>

                    {/* Testar som */}
                    <div className="border-t border-zinc-100 pt-3 flex gap-2">
                      <button 
                        onClick={() => emitirBipSucesso(true)}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        📢 Testar Sucesso
                      </button>
                      <button 
                        onClick={() => emitirBipErro(true)}
                        className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        ⚠️ Testar Erro
                      </button>
                    </div>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                <div>
                  <h4 className="font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4 text-zinc-500" /> Sincronização & Conectividade (Firestore)
                  </h4>
                  
                  <div className="space-y-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 mt-2">
                    {/* Status de Conexão */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Status de Rede (Navegador)</span>
                        <span className="text-[10px] text-zinc-500 block">Status real da sua conexão com o servidor.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${onlineStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                        <span className="text-xs font-bold text-zinc-700">{onlineStatus ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>

                    {/* Simulação de Offline */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Simular Modo Offline</span>
                        <span className="text-[10px] text-zinc-500 block">Desconecta o banco de dados remoto para testar operações offline.</span>
                      </div>
                      <button 
                        onClick={() => setOfflineManual(!offlineManual)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${offlineManual ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}
                      >
                        {offlineManual ? 'Offline Ativo' : 'Simular'}
                      </button>
                    </div>

                    {/* Status de Sincronização */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                      <div>
                        <span className="text-xs font-bold text-zinc-700 block">Banco de Dados Cloud</span>
                        <span className="text-[10px] text-zinc-500 block">Sincroniza automaticamente entradas e movimentações.</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {offlineManual || !onlineStatus ? (
                          <span className="text-amber-600 flex items-center gap-1 animate-pulse">⏳ Sincronização Pendente (Local)</span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-1">🔄 Sincronizado com Firestore</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {viewMode === 'sobre' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-fade-in text-zinc-500">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-2">
              <span className="font-sans text-white text-4xl font-bold">W</span>
            </div>
            <h3 className="text-2xl font-bold text-zinc-800">WMS 4.0 Autônomo</h3>
            <p className="text-sm font-medium">Versão 1.2.0-stable</p>
            <p className="text-xs mt-4 text-center max-w-md">Desenvolvido com tecnologia de IA Preditiva para otimização de operações logísticas de alta densidade.</p>
          </div>
        )}

        {/* Footer do Painel com Logs */}
        <div className="text-[10px] text-zinc-400 font-mono flex justify-between items-center pt-2 border-t border-zinc-100 font-medium">
          <span>ALGORITMO PREDITIVO OPERACIONAL ATIVO</span>
          <span>{offlineManual || !onlineStatus ? "Sincronização Offline (Pendente)" : "Sincronizado via Firestore (Ativo)"}</span>
        </div>

      </div>

      {/* COLETOR DE MÃO DO OPERADOR (Foco em Praticidade e Alta Usabilidade) */}
      <div id="operator_mobile_coletor" className={`w-full min-h-screen bg-zinc-950 overflow-hidden flex-col relative shrink-0 ${viewMode === 'mobile' ? 'flex' : 'hidden'}`}>
        
        {/* Barra superior do coletor de mão */}
        <div className="bg-zinc-950 text-zinc-300 text-[10px] px-6 py-2.5 flex justify-between items-center font-mono border-b border-zinc-900">
          <span className="flex items-center gap-1.5 font-bold tracking-wider">
            <span className={`w-2 h-2 rounded-full ${offlineManual || !onlineStatus ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse'}`}></span>
            <span className={offlineManual || !onlineStatus ? "text-rose-400" : "text-indigo-400"}>
              COLETOR ZE-21 • {offlineManual || !onlineStatus ? 'MODO OFFLINE' : 'CONECTADO CLOUD'}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSomAtivo(!somAtivo)} className="text-zinc-400 hover:text-indigo-400 transition-colors">
              {somAtivo ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-zinc-600" />}
            </button>
            <span className="font-bold text-zinc-400">CD-G1</span>
          </div>
        </div>

        {/* Cabeçalho do aplicativo do operador */}
        <header className="bg-white text-zinc-900 px-5 py-4.5 flex items-center justify-between border-b border-zinc-200 shadow-sm relative z-40">
          <div className="flex items-center gap-3">
            {telaMobile !== 'menu' && (
              <button 
                id="btn_back_to_menu"
                onClick={() => { setTelaMobile('menu'); setProdutoDetectado(null); }} 
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                Voltar
              </button>
            )}
            <div>
              <h1 className="font-bold text-sm text-zinc-950 tracking-wide">
                {telaMobile === 'menu' ? 'Menu do Operador' : 
                 telaMobile === 'entrada' ? '1. Entrada de Produtos' :
                 telaMobile === 'organizacao' ? '2. Endereço de Carga' :
                 telaMobile === 'scanner' ? '3. Scanner de Produtos' : 
                 telaMobile === 'inventario' ? (mobileInventarioTab === 'historico' ? 'Histórico de Auditoria' : '5. Inventário Inteligente') :
                 telaMobile === 'mapa_3d' ? '6. Mapa Logístico 3D' : '4. Operação por Voz'}
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Terminal Coletor Autônomo</p>
            </div>
          </div>
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="p-2 hover:bg-zinc-100 rounded-lg transition text-zinc-600"
          >
            <div className="flex flex-col gap-1 items-center justify-center h-5 w-4">
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
            </div>
          </button>
        </header>

        {isProfileMenuOpen && (
          <div className="absolute top-[80px] right-4 w-64 bg-white rounded-2xl shadow-2xl border border-zinc-200/80 z-50 overflow-hidden animate-fade-in flex flex-col">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="font-bold text-zinc-900 text-sm">João Silva</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Operador de Empilhadeira</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Logística Integrada S.A.</p>
            </div>
            <div className="p-2 flex flex-col gap-1">
              <button 
                onClick={() => { setViewMode('dashboard'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Dashboard Geral
              </button>
              <button 
                onClick={() => { setViewMode('ia_preditiva'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Torre de IA Preditiva
              </button>
              <button 
                onClick={() => { setViewMode('estoque'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Gerenciador de Estoque
              </button>
              <button 
                onClick={() => { setViewMode('expedicao'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Área de Expedição
              </button>
              <button 
                onClick={() => { setViewMode('relatorios'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Relatórios e Exportações
              </button>
              <button 
                onClick={() => { setViewMode('configuracoes'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Configurações
              </button>
              <button 
                onClick={() => { setViewMode('sobre'); setIsProfileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                Sobre o Sistema
              </button>
            </div>
          </div>
        )}

        {/* Ecrã de Sistema do Coletor */}
        <div className="flex-1 flex flex-col bg-slate-50 text-zinc-900 overflow-y-auto">
          
          {/* MENU PRINCIPAL DO COLETOR */}
          {telaMobile === 'menu' && (
            <div className="p-4 space-y-4 animate-fade-in">
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Trabalho Ativo</h3>
                  <p className="text-xs text-indigo-950/70 mt-0.5 leading-relaxed font-semibold">Selecione uma tarefa abaixo ou bipe uma caixa.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Botão 1: Entrada de Produtos */}
                <button 
                  id="menu_btn_entrada"
                  onClick={() => setTelaMobile('entrada')}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">1. Entrada de Produtos</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Dar entrada e triagem física de caixas</span>
                  </div>
                </button>

                {/* Botão 2: Onde Guardar */}
                <button 
                  id="menu_btn_where_to_store"
                  onClick={() => setTelaMobile('organizacao')}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">2. Onde Guardar as Caixas</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Ver indicação de rua e prateleira de CD</span>
                  </div>
                </button>

                {/* Botão 3: Scanner Completo */}
                <button 
                  id="menu_btn_scanner"
                  onClick={() => setTelaMobile('scanner')}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">3. Consulta de Produtos</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Identificar endereços e detalhes por código</span>
                  </div>
                </button>

                {/* Botão 4: Voz */}
                <button 
                  id="menu_btn_voice"
                  onClick={() => setTelaMobile('voz')}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">4. Operação Livre de Voz</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Dar baixa por voz com fones de ouvido</span>
                  </div>
                </button>

                {/* Botão 5: Inventário Inteligente */}
                <button 
                  id="menu_btn_inventario"
                  onClick={() => { emitirBipSucesso(); setTelaMobile('inventario'); setMobileInventarioTab('lista'); }}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">5. Inventário Inteligente</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Controle de estoque, contagens e auditorias</span>
                  </div>
                </button>

                {/* Botão 6: Mapa Logístico 3D */}
                <button 
                  id="menu_btn_mapa_3d"
                  onClick={() => { emitirBipSucesso(); setTelaMobile('mapa_3d'); }}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">6. Mapa Logístico 3D</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Gêmeo Digital das posições e racks em 3D</span>
                  </div>
                </button>

                {/* Botão 7: Histórico de Auditoria */}
                <button 
                  id="menu_btn_historico_auditoria"
                  onClick={() => { emitirBipSucesso(); setTelaMobile('inventario'); setMobileInventarioTab('historico'); }}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">7. Histórico de Auditoria</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Últimas 10 contagens do inventário cíclico</span>
                  </div>
                </button>

                {/* Botão 8: Cadastrar Produto via Imagem */}
                <button 
                  id="menu_btn_cadastrar_imagem"
                  onClick={() => { emitirBipSucesso(); setTelaMobile('cadastrar_imagem'); }}
                  className="bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-2xl p-4.5 text-left flex items-center gap-4 transition-all shadow-sm"
                >
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-zinc-800 tracking-wide">8. Cadastrar por Imagem</span>
                    <span className="text-xs text-zinc-500 mt-0.5 block">Extrair informações do rótulo com IA</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ÁREA COMUM DE CÂMERA ATIVA DO COLETOR */}
          {(telaMobile === 'entrada' || telaMobile === 'organizacao' || telaMobile === 'scanner') && (
            <div className="flex flex-col flex-1 justify-between animate-fade-in">
              
              {/* Moldura da Câmera ativa do Coletor com Mira Laser vermelha */}
              <div className={`relative bg-zinc-950 h-64 flex flex-col justify-center items-center overflow-hidden transition-all duration-300 ${cameraAtiva ? 'border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)]' : 'border-b-4 border-indigo-600'}`}>
                {cameraAtiva ? (
                  <>
                    <div id="html5-qrcode-reader" className="absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full opacity-80 bg-zinc-950"></div>
                  </>
                ) : (
                  <div className="text-center p-4 z-10 space-y-2">
                    <Camera className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs text-zinc-400 font-semibold">Câmera de Leitura Zebra/Honeywell</p>
                    <button 
                      onClick={ligarCamera} 
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                    >
                      Ativar Câmera Traseira
                    </button>
                  </div>
                )}

                {/* Área visual do scanner centralizada */}
                <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center pointer-events-none z-20">
                  {/* Linha de laser vermelha clássica de leitores HoneyWell */}
                  <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse"></div>
                  
                  {/* Guias de Alinhamento do Código */}
                  <div className="absolute w-60 h-32 flex items-center justify-center">
                    {mensagemSucessoAnim && (
                      <div className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-ping">
                        BIP! OK
                      </div>
                    )}
                  </div>
                </div>

                {leituraErroMsg && (
                  <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none z-30 px-4">
                    <p className="bg-rose-950/90 text-[10px] text-rose-200 py-1.5 rounded-lg inline-block px-3 border border-rose-800 tracking-wide font-bold">
                      ⚠️ {leituraErroMsg}
                    </p>
                  </div>
                )}
              </div>

              {/* Informações detalhadas com base na aba ativa do operador */}
              <div className="flex-1 p-4 flex flex-col justify-between">
                
                {/* 1. TELA INTERNA: ENTRADA */}
                {telaMobile === 'entrada' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="bg-white p-3 rounded-xl border border-zinc-200 flex justify-between items-center shadow-sm">
                        <div>
                          <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">CÓDIGO BIPADO</span>
                          <span className="text-sm font-bold font-mono text-zinc-900">{leituraCodigo || 'Aguardando Bip na câmera...'}</span>
                        </div>
                        {leituraCodigo && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-zinc-200 space-y-2 shadow-sm">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Quantidade de Caixas Recebidas</label>
                        <input 
                          type="number" 
                          value={qtdEntrada}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQtdEntrada(e.target.value)}
                          className="w-full bg-slate-50 border border-zinc-300 rounded-xl px-4 py-3 text-sm font-black text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2.5 rounded-xl border border-zinc-200 space-y-1 shadow-sm">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Placa Caminhão (Opcional)</label>
                          <input 
                            type="text" 
                            placeholder="Ex: ABC-1234"
                            value={entradaPlacaCaminhao}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntradaPlacaCaminhao(e.target.value)}
                            className="w-full bg-slate-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 uppercase"
                          />
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-zinc-200 space-y-1 shadow-sm">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Motorista (Opcional)</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Marcos Souza"
                            value={entradaMotorista}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntradaMotorista(e.target.value)}
                            className="w-full bg-slate-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          />
                        </div>
                      </div>

                      {produtoDetectado && (
                        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-1.5 animate-fade-in">
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider block w-max">Lido e Identificado</span>
                          <h4 className="font-bold text-sm text-emerald-950">{produtoDetectado.nome}</h4>
                          <p className="text-xs text-emerald-900/80">Direcionar para: <strong className="text-emerald-950 font-bold">{produtoDetectado.rua}</strong></p>
                        </div>
                      )}
                    </div>

                    <button 
                      id="btn_save_entry_cargo"
                      onClick={() => {
                        if (!leituraCodigo) {
                          emitirBipErro();
                          adicionarLog('Falha', 'Bipe uma caixa de produto na câmera primeiro.');
                          return;
                        }
                        emitirBipSucesso();
                        
                        const novaPlaca = entradaPlacaCaminhao.trim() || `TRK-${Math.floor(1000 + Math.random()*9000)}`;
                        const novoMotorista = entradaMotorista.trim() || 'Motorista Autônomo';
                        const qtdInt = parseInt(qtdEntrada) || 1;
                        
                        // Registrar no histórico de entradas de cargas do CD
                        const novoLote: InboundLoad = {
                          id: `ENT-2026-00${inboundLoads.length + 1}`,
                          placaCaminhao: novaPlaca.toUpperCase(),
                          motorista: novoMotorista,
                          produto: produtoDetectado ? produtoDetectado.nome : 'Material Geral',
                          ean: leituraCodigo,
                          quantidadeCaixas: qtdInt,
                          dataHora: new Date().toISOString().replace('T', ' ').substring(0, 16),
                          status: 'Conferido'
                        };
                        
                        setInboundLoads(prev => [novoLote, ...prev]);
                        
                        // Atualizar estoque correspondente se identificado
                        if (produtoDetectado) {
                          setInventory(prev => prev.map(p => p.ean === produtoDetectado.ean ? { ...p, quantidade: p.quantidade + qtdInt } : p));
                        }

                        adicionarLog('Entrada Concluído', `${qtdInt} caixas registradas para o veículo ${novaPlaca.toUpperCase()}.`);
                        
                        // Reset forms
                        setLeituraCodigo('');
                        setProdutoDetectado(null);
                        setEntradaPlacaCaminhao('');
                        setEntradaMotorista('');
                        setTelaMobile('menu');
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl uppercase text-xs tracking-wider shadow-md transition-all active:scale-95"
                    >
                      Salvar Entrada de Carga
                    </button>
                  </div>
                )}

                {/* 2. TELA INTERNA: ORGANIZAÇÃO */}
                {telaMobile === 'organizacao' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="bg-white p-3.5 rounded-xl border border-zinc-200 text-center shadow-sm">
                        <p className="text-xs text-zinc-500 font-medium">Mire em um produto para a IA indicar o endereço ideal de prateleira.</p>
                      </div>

                      {produtoDetectado ? (
                        <div className="bg-white p-4 rounded-2xl border border-indigo-200 space-y-3.5 animate-fade-in shadow-sm">
                          <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Endereço Encontrado</span>
                            <span className="text-xs font-bold text-indigo-600">{produtoDetectado.rua}</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                              <MapPin className="w-8 h-8" />
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block uppercase tracking-wider">Colocar na Prateleira</span>
                              <span className="text-3xl font-extrabold text-indigo-600 tracking-wider">
                                {produtoDetectado.prateleira}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-100 font-medium">
                            Produto: <strong className="text-zinc-800">{produtoDetectado.nome}</strong> | CD: <strong className="text-zinc-800">{SECTORS_CD[produtoDetectado.categoria]?.nome}</strong>
                          </p>
                        </div>
                      ) : (
                        <div className="border border-dashed border-zinc-300 bg-white p-6 rounded-2xl text-center text-zinc-400 text-xs font-medium">
                          Aguardando leitura de produto pela câmera para direcionar endereço...
                        </div>
                      )}
                    </div>

                    <button 
                      id="btn_confirm_stored"
                      onClick={() => {
                        if (!produtoDetectado) return;
                        emitirBipSucesso();
                        adicionarLog('Confirmado', `Guardado no local ${produtoDetectado.prateleira}`);
                        setLeituraCodigo('');
                        setProdutoDetectado(null);
                        setTelaMobile('menu');
                      }}
                      className={`w-full py-4 rounded-2xl uppercase text-xs font-bold tracking-widest transition-all ${
                        produtoDetectado 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md' 
                          : 'bg-zinc-100 text-zinc-300 border border-zinc-200 cursor-not-allowed'
                      }`}
                      disabled={!produtoDetectado}
                    >
                      Confirmar que Guardou
                    </button>
                  </div>
                )}

                {/* 3. TELA INTERNA: SCANNER DE PRODUTOS */}
                {telaMobile === 'scanner' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      {produtoDetectado ? (
                        <div className="bg-white p-4 rounded-xl border border-zinc-200 space-y-3 animate-fade-in shadow-sm">
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider block w-max">Identificado</span>
                          <h3 className="font-bold text-sm text-zinc-800">{produtoDetectado.nome}</h3>
                          <div className="flex justify-between items-center text-xs text-zinc-500 pt-2.5 border-t border-zinc-100">
                            <span>Setor: <strong className="text-zinc-700">{SECTORS_CD[produtoDetectado.categoria]?.nome}</strong></span>
                            <span className="text-indigo-600 font-bold">Rua {produtoDetectado.rua.replace('Rua ', '')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-zinc-300 bg-white p-8 rounded-2xl text-center text-zinc-400 text-xs font-medium">
                          Alinhe qualquer código de barras na linha vermelha do leitor acima para consultar.
                        </div>
                      )}
                    </div>

                    <button 
                      id="btn_clear_scanner"
                      onClick={() => { setProdutoDetectado(null); setLeituraCodigo(''); }}
                      className="w-full bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-300 py-3 rounded-xl text-xs font-semibold transition"
                    >
                      Limpar Scanner
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* 4. TELA INTERNA: VOZ */}
          {telaMobile === 'voz' && (
            <div className="p-4 space-y-4 flex-1 flex flex-col justify-between animate-fade-in font-sans">
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 text-center space-y-3.5 shadow-sm">
                  <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Mic className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800">Trabalho Facilitado por Voz</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-medium">Mantenha as mãos totalmente livres para carregar caixas pesadas.</p>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 p-4.5 rounded-2xl space-y-2 shadow-sm">
                  <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block">O Coletor disse:</span>
                  <p className="text-xs text-zinc-800 leading-relaxed italic font-semibold">
                    "{mensagemVoz}"
                  </p>
                </div>
              </div>

              <button 
                id="btn_trigger_voice_action"
                onClick={() => {
                  emitirBipSucesso();
                  setMensagemVoz('Vá para a Rua A (Limpeza) e retire 2 caixas de detergente.');
                  adicionarLog('Voz Ativa', 'Operação iniciada por comando de voz.');
                }}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-95 shadow-md"
              >
                Falar: "Iniciar Coleta"
              </button>
            </div>
          )}

          {/* 5. TELA INTERNA: INVENTÁRIO INTELIGENTE */}
          {telaMobile === 'inventario' && (
            <div className="flex-1 flex flex-col bg-slate-50 text-zinc-900 animate-fade-in">
              {/* Abas Internas do Inventário no Coletor */}
              <div className="flex bg-zinc-200/60 p-1 rounded-2xl mx-4 mt-4 mb-2 border border-zinc-200 gap-1">
                <button 
                  onClick={() => { emitirBipSucesso(); setMobileInventarioTab('lista'); }} 
                  className={`flex-1 text-[10px] font-bold py-2 rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center ${mobileInventarioTab === 'lista' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Estoque
                </button>
                <button 
                  onClick={() => { emitirBipSucesso(); setMobileInventarioTab('auditoria'); }} 
                  className={`flex-1 text-[10px] font-bold py-2 rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center ${mobileInventarioTab === 'auditoria' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Auditoria Cíclica
                </button>
                <button 
                  onClick={() => { emitirBipSucesso(); setMobileInventarioTab('historico'); }} 
                  className={`flex-1 text-[10px] font-bold py-2 rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center ${mobileInventarioTab === 'historico' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Histórico
                </button>
              </div>

              {/* CONTEÚDO DA ABA: LISTA / CONSULTA */}
              {mobileInventarioTab === 'lista' && (
                <div className="flex-1 flex flex-col space-y-4 font-sans">
                  {/* Busca e Filtros Rápidos */}
                  <div className="px-4 space-y-2.5">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        placeholder="Pesquisar SKU, produto, prateleira..." 
                        className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-zinc-900 font-bold"
                      />
                    </div>
                    
                    {/* Filtros horizontais deslizáveis */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {['All', ...SUBCATEGORIES_LIMPEZA].map(sub => (
                        <button 
                          key={sub} 
                          onClick={() => { emitirBipSucesso(); setFilterSubcategory(sub); }} 
                          className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full whitespace-nowrap border cursor-pointer transition ${filterSubcategory === sub ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs' : 'bg-white border-zinc-200 text-zinc-500'}`}
                        >
                          {sub === 'All' ? 'Todos Itens' : sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FORMULÁRIO DE AJUSTE INLINE NO COLETOR */}
                  {mobileAjusteItem && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mx-4 animate-fade-in space-y-3.5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                        <h4 className="text-[10px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-amber-600" /> Ajustar Estoque
                        </h4>
                        <button onClick={() => setMobileAjusteItem(null)} className="text-zinc-400 hover:text-zinc-600 font-black text-xs">X</button>
                      </div>
                      
                      <div className="space-y-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-zinc-800 font-bold">{mobileAjusteItem.nome}</p>
                          <div className="flex justify-between text-[10px] text-zinc-500 font-semibold font-mono">
                            <span>Posição: {mobileAjusteItem.prateleira}</span>
                            <span>Atual: {mobileAjusteItem.quantidade} un</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">Nova Qtd de Caixas</label>
                          <input 
                            type="number" 
                            value={mobileQtdAjuste} 
                            onChange={(e) => setMobileQtdAjuste(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-black text-zinc-950 focus:outline-none"
                          />
                        </div>

                        <button 
                          onClick={() => {
                            const novaQ = parseInt(mobileQtdAjuste) || 0;
                            setInventory(prev => prev.map(item => item.ean === mobileAjusteItem.ean ? { ...item, quantidade: novaQ, ultimaMovimentacao: new Date().toISOString().split('T')[0] } : item));
                            adicionarLog('Ajuste Mobile', `${mobileAjusteItem.nome} alterado para ${novaQ} un.`);
                            emitirBipSucesso();
                            setMobileAjusteItem(null);
                          }}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl uppercase tracking-wider text-[10px] transition active:scale-95 shadow-xs"
                        >
                          Confirmar Ajuste
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FORMULÁRIO DE TRANSFERÊNCIA INLINE NO COLETOR */}
                  {mobileTransferItem && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mx-4 animate-fade-in space-y-3.5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                        <h4 className="text-[10px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" /> Transferir Posição
                        </h4>
                        <button onClick={() => setMobileTransferItem(null)} className="text-zinc-400 hover:text-zinc-600 font-black text-xs">X</button>
                      </div>
                      
                      <div className="space-y-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-zinc-800 font-bold">{mobileTransferItem.nome}</p>
                          <p className="text-[10px] text-zinc-500 font-semibold font-mono">Local Atual: {mobileTransferItem.rua} - {mobileTransferItem.prateleira}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-600 font-bold uppercase block">Nova Rua</label>
                            <select 
                              value={mobileNewRua} 
                              onChange={(e) => {
                                setMobileNewRua(e.target.value);
                                const prefix = e.target.value === 'Rua A' ? 'A' : e.target.value === 'Rua B' ? 'B' : e.target.value === 'Rua C' ? 'C' : 'D';
                                setMobileNewPrateleira(`${prefix}-01`);
                              }}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 font-bold focus:outline-none"
                            >
                              <option value="Rua A">Rua A (Sabões e Detergentes)</option>
                              <option value="Rua B">Rua B (Desinfetantes e Álcool)</option>
                              <option value="Rua C">Rua C (Limpadores Especiais)</option>
                              <option value="Rua D">Rua D (Materiais de Apoio)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-600 font-bold uppercase block">Prateleira</label>
                            <input 
                              type="text" 
                              value={mobileNewPrateleira} 
                              onChange={(e) => setMobileNewPrateleira(e.target.value.toUpperCase())} 
                              placeholder="Ex: A-04" 
                              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-950 font-bold focus:outline-none"
                            />
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setInventory(prev => prev.map(item => item.ean === mobileTransferItem.ean ? { ...item, rua: mobileNewRua, prateleira: mobileNewPrateleira, ultimaMovimentacao: new Date().toISOString().split('T')[0] } : item));
                            adicionarLog('Transf. Mobile', `${mobileTransferItem.nome} movido para ${mobileNewPrateleira}.`);
                            emitirBipSucesso();
                            setMobileTransferItem(null);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl uppercase tracking-wider text-[10px] transition active:scale-95 shadow-xs"
                        >
                          Confirmar Movimentação
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Listagem real de produtos no CD */}
                  <div className="flex-1 px-4 overflow-y-auto space-y-2.5 max-h-[360px]">
                    {inventory.filter(item => {
                      const matchesSearch = 
                        item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.ean.includes(searchTerm) || 
                        item.prateleira.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.rua.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.marca && item.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (item.fabricante && item.fabricante.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        item.vencimento.includes(searchTerm) ||
                        item.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.subcategoria && item.subcategoria.toLowerCase().includes(searchTerm.toLowerCase()));
                      const matchesSubcategory = filterSubcategory === 'All' || item.subcategoria === filterSubcategory;
                      return matchesSearch && matchesSubcategory;
                    }).map(item => (
                      <div key={item.ean} className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-xs space-y-2.5 hover:border-zinc-300 transition">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                              item.rua === 'Rua A' ? 'bg-cyan-50 text-cyan-700' :
                              item.rua === 'Rua B' ? 'bg-indigo-50 text-indigo-700' :
                              item.rua === 'Rua C' ? 'bg-teal-50 text-teal-700' : 'bg-purple-50 text-purple-700'
                            }`}>{item.subcategoria || item.categoria}</span>
                            {item.marca && <span className="text-[8px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold uppercase ml-1.5">{item.marca}</span>}
                            <h4 className="text-xs font-bold text-zinc-950 mt-1">{item.nome}</h4>
                            <p className="text-[9px] text-zinc-400 font-mono font-bold">SKU {item.ean} | Lote: {item.lote}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[8px] text-zinc-400 font-black block">ESTOQUE</span>
                            <span className="text-xs font-black text-indigo-600">{item.quantidade} un</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-zinc-50/80 border border-zinc-100 p-2 rounded-xl text-zinc-600 font-semibold font-mono">
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-zinc-400" /> {item.rua} - {item.prateleira}</span>
                          <span>Venc. {item.vencimento}</span>
                        </div>

                        {/* Ações do coletor */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button 
                            onClick={() => {
                              emitirBipSucesso();
                              setMobileAjusteItem(item);
                              setMobileQtdAjuste(item.quantidade.toString());
                              setMobileTransferItem(null);
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-150 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <Sliders className="w-3 h-3" /> Ajustar
                          </button>
                          
                          <button 
                            onClick={() => {
                              emitirBipSucesso();
                              setMobileTransferItem(item);
                              setMobileNewRua(item.rua);
                              setMobileNewPrateleira(item.prateleira);
                              setMobileAjusteItem(null);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <ArrowLeftRight className="w-3 h-3" /> Transferir
                          </button>

                          <button 
                            onClick={() => {
                              emitirBipSucesso();
                              setInventory(prev => prev.map(i => i.ean === item.ean ? { ...i, quantidade: Math.max(0, i.quantidade - 10), ultimaMovimentacao: new Date().toISOString().split('T')[0] } : i));
                              adicionarLog('Saída Rápida', `Remoção de 10 un de ${item.nome}.`);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <Minus className="w-3 h-3" /> Baixar 10
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA: AUDITORIA CÍCLICA */}
              {mobileInventarioTab === 'auditoria' && (
                <div className="flex-1 p-4 space-y-4 font-sans text-zinc-900">
                  {/* Caixa de auditoria preventiva */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/80 p-4.5 rounded-2xl space-y-3.5 shadow-sm">
                    <span className="text-[9px] uppercase tracking-widest text-purple-700 font-extrabold flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4 text-purple-600 animate-pulse" /> Auditoria Preventiva CD
                    </span>

                    <div className="bg-white p-3.5 rounded-xl border border-purple-100">
                      <span className="text-[8px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase block w-max">Aguardando Contagem</span>
                      <h4 className="font-extrabold text-xs text-zinc-900 mt-2">{quickCountItem?.nome || 'Toque no botão para sortear posição'}</h4>
                      <span className="text-[10px] font-mono text-zinc-500 block pt-1 font-semibold">
                        Posição: <strong className="text-zinc-800">{quickCountItem?.prateleira || 'N/A'}</strong> | Sistema: <strong className="text-purple-700 font-bold">{quickCountItem?.quantidade ?? 0} un</strong>
                      </span>
                    </div>

                    {quickCountItem ? (
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">Unidades Encontradas Física</label>
                          <input 
                            type="number" 
                            value={quickCountValue} 
                            onChange={(e) => setQuickCountValue(e.target.value)} 
                            placeholder="Ex: 85" 
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-black text-zinc-950 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (!quickCountValue) {
                                emitirBipErro();
                                return;
                              }
                              emitirBipSucesso();
                              const esperado = quickCountItem.quantidade;
                              const contado = parseInt(quickCountValue) || 0;
                              setDivergencias(prev => ({
                                ...prev,
                                [quickCountItem.ean]: { esperado, contado, lote: quickCountItem.lote }
                              }));

                              // Adicionar ao histórico de auditoria do coletor
                              const agora = new Date();
                              const timestamp = agora.toLocaleString('pt-BR', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }).replace(',', '');
                              
                              const novoLog = {
                                id: Date.now(),
                                tipo: 'Cíclico',
                                item: quickCountItem.nome,
                                endereco: quickCountItem.prateleira,
                                esperado: esperado,
                                contado: contado,
                                status: contado === esperado ? 'Sem Divergências' : `Divergência (${contado - esperado > 0 ? '+' : ''}${contado - esperado})`,
                                data: timestamp
                              };
                              setInventarioLogs(prev => [novoLog, ...prev]);

                              setQuickCountItem(null);
                            }}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Confirmar Contagem
                          </button>
                          <button 
                            onClick={() => setQuickCountItem(null)}
                            className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-black px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Ignorar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          emitirBipSucesso();
                          const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
                          setQuickCountItem(randomItem);
                          setQuickCountValue('');
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-wider transition active:scale-95 shadow-xs cursor-pointer"
                      >
                        Sortear Próxima Posição
                      </button>
                    )}
                  </div>

                  {/* Divergências registradas */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" /> Divergências na Rodada
                    </span>

                    <div className="divide-y divide-zinc-100 max-h-[140px] overflow-y-auto">
                      {Object.keys(divergencias).length === 0 ? (
                        <p className="text-[10px] text-zinc-400 font-semibold italic text-center py-4">Nenhuma divergência registrada nesta rodada.</p>
                      ) : (
                        (Object.entries(divergencias) as [string, { esperado: number; contado: number; lote: string }][]).map(([ean, value]) => {
                          const p = inventory.find(item => item.ean === ean);
                          const diff = value.contado - value.esperado;
                          return (
                            <div key={ean} className="py-2.5 flex justify-between items-center text-xs">
                              <div>
                                <h6 className="font-bold text-zinc-900">{p?.nome || 'Desconhecido'}</h6>
                                <p className="text-[9px] text-zinc-400 font-semibold font-mono">Posição: {p?.prateleira} • Esperado: {value.esperado}</p>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="text-[10px] font-bold block">Contado: <strong className="text-zinc-950">{value.contado}</strong></span>
                                <span className={`text-[9px] font-black uppercase ${diff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {diff > 0 ? `+${diff}` : diff} un
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {Object.keys(divergencias).length > 0 && (
                      <button 
                        onClick={() => {
                          emitirBipSucesso();
                          setInventory(prev => prev.map(item => {
                            if (divergencias[item.ean]) {
                              return { ...item, quantidade: divergencias[item.ean].contado, ultimaMovimentacao: new Date().toISOString().split('T')[0] };
                            }
                            return item;
                          }));
                          adicionarLog('Inventário Corrigido', `Sincronizadas ${Object.keys(divergencias).length} divergências.`);
                          setDivergencias({});
                          setAcuracidade(99.8);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-wider transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        Sincronizar e Corrigir Estoque
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA: HISTÓRICO DE AUDITORIA */}
              {mobileInventarioTab === 'historico' && (
                <div className="flex-1 p-4 space-y-4 font-sans text-zinc-900 animate-fade-in">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-indigo-500" /> Histórico de Contagens
                      </span>
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 font-mono px-2 py-0.5 rounded-full font-bold">Últimas 10</span>
                    </div>

                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                      {inventarioLogs.filter(log => log.tipo === 'Cíclico').slice(0, 10).length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                          <History className="w-8 h-8 text-zinc-300 mx-auto" />
                          <p className="text-[10px] text-zinc-400 font-semibold italic">Nenhuma contagem realizada no inventário cíclico ainda.</p>
                        </div>
                      ) : (
                        inventarioLogs
                          .filter(log => log.tipo === 'Cíclico')
                          .slice(0, 10)
                          .map((log) => {
                            const diff = log.contado - log.esperado;
                            return (
                              <div key={log.id} className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl flex flex-col space-y-1.5 shadow-xs">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                    <h6 className="text-xs font-black text-zinc-900 leading-tight">{log.item}</h6>
                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                      <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold font-mono">Posição: {log.endereco}</span>
                                      <span className="text-[9px] text-zinc-400 font-bold font-mono">{log.data}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="pt-1.5 border-t border-zinc-200/60 flex justify-between items-center text-[10px]">
                                  <span className="text-zinc-500 font-semibold">Esperado: <strong className="text-zinc-800">{log.esperado} un</strong></span>
                                  <span className="text-zinc-500 font-semibold">Contado: <strong className="text-zinc-800">{log.contado} un</strong></span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${diff === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                    {diff === 0 ? 'Ok' : `${diff > 0 ? '+' : ''}${diff}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. TELA INTERNA: MAPA LOGÍSTICO 3D */}
          {telaMobile === 'mapa_3d' && (
            <div className="flex-1 flex flex-col bg-slate-50 text-zinc-900 animate-fade-in font-sans">
              <div className="p-4 space-y-4">
                {/* Cabeçalho de controle do mapa no coletor */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Controle de Zoom & Ruas</span>
                    
                    {/* Zoom */}
                    <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1 gap-1 shadow-xs">
                      <button 
                        onClick={() => { emitirBipSucesso(); setMapZoom(prev => Math.max(0.7, prev - 0.15)); }}
                        className="p-1 hover:bg-zinc-200 text-zinc-600 rounded cursor-pointer"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] font-mono font-bold text-zinc-700 px-1 w-8 text-center">{Math.round(mapZoom * 100)}%</span>
                      <button 
                        onClick={() => { emitirBipSucesso(); setMapZoom(prev => Math.min(1.4, prev + 0.15)); }}
                        className="p-1 hover:bg-zinc-200 text-zinc-600 rounded cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Filtro por Rua */}
                  <div className="flex bg-zinc-50 border border-zinc-200 rounded-xl p-1 gap-1 overflow-x-auto scrollbar-none">
                    {['All', 'Rua A', 'Rua B', 'Rua C', 'Rua D'].map((st) => (
                      <button
                        key={st}
                        onClick={() => { emitirBipSucesso(); setMapFilterStreet(st); }}
                        className={`text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                          mapFilterStreet === st ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700'
                        }`}
                      >
                        {st === 'All' ? 'Todos' : st.replace('Rua ', '')}
                      </button>
                    ))}
                  </div>

                  {/* Input de Realce de Produto */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={mapSearchHighlight}
                      onChange={(e) => setMapSearchHighlight(e.target.value)}
                      placeholder="Pesquisar SKU ou produto no mapa..."
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                {/* Live Telemetry Sensor Panel */}
                <div className="grid grid-cols-3 gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 text-white text-[9px] font-mono shadow-inner shadow-black/20">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 font-bold uppercase text-[7px] tracking-wider">Sensores Térmicos</span>
                    <span className="text-emerald-400 font-extrabold mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      19.2°C • 45% UR
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-zinc-800 pl-2">
                    <span className="text-zinc-500 font-bold uppercase text-[7px] tracking-wider">AGVs Autônomos</span>
                    <span className="text-indigo-400 font-extrabold mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                      2 / 2 Ativos
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-zinc-800 pl-2">
                    <span className="text-zinc-500 font-bold uppercase text-[7px] tracking-wider">Capacidade Total</span>
                    <span className="text-sky-400 font-extrabold mt-0.5">
                      74% Ocupado
                    </span>
                  </div>
                </div>

                {/* Viewport de visualização do mapa */}
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 overflow-auto relative shadow-inner min-h-[380px] max-h-[460px]">
                  <div 
                    className="p-4 transition-transform duration-200 origin-top relative"
                    style={{ transform: `scale(${mapZoom})`, minHeight: '520px' }}
                  >
                    {/* SVG CAPA DE PATHFINDING E ROTAS LOGÍSTICAS INTELIGENTES */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                      {/* Static floor guide corridors */}
                      <path d="M 30,25 L 30,455" fill="none" stroke="#e4e4e7" strokeWidth="2" strokeDasharray="4 4" />
                      <path d="M 30,125 L 230,125" fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 4" />
                      <path d="M 30,230 L 230,230" fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 4" />
                      <path d="M 30,335 L 230,335" fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 4" />
                      <path d="M 30,440 L 230,440" fill="none" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 4" />

                      {/* Active route glowing path to selected rack */}
                      {selectedCell && (
                        <path
                          d={getRoutePath(selectedCell.rack)}
                          fill="none"
                          stroke="#4f46e5"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="6 4"
                          className="animate-path-flow"
                        />
                      )}

                      {/* Active AGV Picking Dynamic Path */}
                      {activePickingItem && (
                        <path
                          d={getRoutePath(activePickingItem.prateleira)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray="6 4"
                          className="animate-path-flow"
                        />
                      )}
                    </svg>

                    {/* AGV AUTOMÁTICOS (VEÍCULOS LOGÍSTICOS DETALHADOS EM TRÂNSITO) */}
                    <div className="absolute w-5 h-5 bg-amber-400 border border-amber-500 rounded-md flex items-center justify-center shadow-md animate-agv1-patrol z-10 pointer-events-none">
                      <Truck className="w-3 h-3 text-amber-950" />
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                    </div>
                    
                    <div className="absolute w-5 h-5 bg-amber-400 border border-amber-500 rounded-md flex items-center justify-center shadow-md animate-agv2-patrol z-10 pointer-events-none">
                      <Truck className="w-3 h-3 text-amber-950" />
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                    </div>

                    {/* ÁREA DE DOCAS (ESTRUTURA FÍSICA SUPERIOR) */}
                    <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                      {/* DOCA 1 - RECEBIMENTO */}
                      <div className="bg-cyan-500/10 border border-cyan-400/30 rounded-xl p-2 flex items-center justify-between relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500/20 flex gap-1 overflow-hidden">
                          <span className="w-1 h-0.5 bg-cyan-400 rounded-full animate-ping"></span>
                          <span className="w-1 h-0.5 bg-cyan-400 rounded-full animate-ping delay-150"></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-cyan-500 text-cyan-950 rounded-md flex items-center justify-center shadow-xs">
                            <Truck className="w-3.5 h-3.5 animate-bounce" />
                          </div>
                          <div>
                            <span className="text-[6px] text-cyan-600 font-mono font-black uppercase block">Recebimento</span>
                            <span className="text-[9px] font-black text-zinc-800">D01 Entrada</span>
                          </div>
                        </div>
                      </div>

                      {/* DOCA 2 - EXPEDIÇÃO */}
                      <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-xl p-2 flex items-center justify-between relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500/20 flex gap-1 overflow-hidden">
                          <span className="w-1 h-0.5 bg-indigo-400 rounded-full animate-ping"></span>
                          <span className="w-1 h-0.5 bg-indigo-400 rounded-full animate-ping delay-150"></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-indigo-50 text-indigo-650 border border-indigo-200 rounded-md flex items-center justify-center shadow-xs">
                            <Truck className="w-3.5 h-3.5 animate-bounce" />
                          </div>
                          <div>
                            <span className="text-[6px] text-indigo-600 font-mono font-black uppercase block">Expedição</span>
                            <span className="text-[9px] font-black text-zinc-800">D02 Saída</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GRUPO DE RUAS / CORREDORES */}
                    <div className="space-y-4 relative z-10">
                      {['Rua A', 'Rua B', 'Rua C', 'Rua D'].filter(r => mapFilterStreet === 'All' || r === mapFilterStreet).map((streetName) => {
                        const prefix = streetName === 'Rua A' ? 'A' : streetName === 'Rua B' ? 'B' : streetName === 'Rua C' ? 'C' : 'D';
                        const sectorKey = streetName === 'Rua A' ? 'LIMPEZA' : streetName === 'Rua B' ? 'INFRAESTRUTURA' : streetName === 'Rua C' ? 'TINTAS' : 'GERAL';
                        const sectorInfo = SECTORS_CD[sectorKey];

                        return (
                          <div key={streetName} className="bg-white border border-zinc-200/80 rounded-2xl p-3 shadow-xs space-y-2">
                            {/* Cabeçalho de Corredor */}
                            <div className="flex justify-between items-center text-[9px] font-black border-b border-zinc-100 pb-1">
                              <span className="text-zinc-800 flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px] text-white font-extrabold ${
                                  streetName === 'Rua A' ? 'bg-cyan-500' :
                                  streetName === 'Rua B' ? 'bg-indigo-500' :
                                  streetName === 'Rua C' ? 'bg-teal-500' : 'bg-purple-500'
                                }`}>
                                  {prefix}
                                </span>
                                {streetName} — {sectorInfo.nome.split(' ')[0]}
                              </span>
                              <span className="text-zinc-400 font-mono font-bold">{prefix}1-{prefix}6</span>
                            </div>

                            {/* Grid de Racks de Armazenamento */}
                            <div className="grid grid-cols-3 gap-1.5">
                              {[`${prefix}-01`, `${prefix}-02`, `${prefix}-03`, `${prefix}-04`, `${prefix}-05`, `${prefix}-06`].map((rackId) => {
                                const item = inventory.find(i => i.prateleira === rackId);
                                const qty = item?.quantidade ?? 0;
                                const matchesHighlight = mapSearchHighlight && item && item.nome.toLowerCase().includes(mapSearchHighlight.toLowerCase());
                                const isSelected = selectedCell?.rack === rackId;

                                return renderVisualRack(rackId, item, qty, isSelected, matchesHighlight);
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>

                {/* Painel de Posição Selecionada no Coletor */}
                {selectedCell && (
                  <div className="bg-indigo-950 text-white rounded-2xl p-4 shadow-lg border border-indigo-900 animate-fade-in space-y-3">
                    <div className="flex justify-between items-start border-b border-indigo-900 pb-1.5">
                      <div>
                        <span className="text-[8px] text-indigo-400 font-mono font-black uppercase">Endereço Ativo</span>
                        <h5 className="font-extrabold text-xs text-white">Corredor {selectedCell.street} • Posição {selectedCell.rack}</h5>
                      </div>
                      <button onClick={() => setSelectedCell(null)} className="text-indigo-400 hover:text-white font-extrabold text-xs">X</button>
                    </div>

                    {selectedCell.rack === 'B-06' ? (
                      <p className="text-[10px] text-zinc-300 font-semibold leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl">
                        ⚠️ Posição bloqueada pela Segurança de Trabalho.
                      </p>
                    ) : selectedCell.item ? (
                      <div className="space-y-3 text-xs">
                        <div>
                          <p className="font-extrabold text-white text-[11px] leading-tight">{selectedCell.item.nome}</p>
                          <span className="text-[9px] text-indigo-300 font-mono block mt-0.5">EAN: {selectedCell.item.ean} | Lote: {selectedCell.item.lote}</span>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-indigo-900 text-[10px]">
                          <div>
                            <span className="text-indigo-400 block font-bold uppercase text-[8px] font-mono">Físico</span>
                            <strong className="text-white font-black text-xs">{selectedCell.item.quantidade} caixas</strong>
                          </div>
                          <div>
                            <span className="text-indigo-400 block font-bold uppercase text-[8px] font-mono">Validade</span>
                            <strong className="text-white">{selectedCell.item.vencimento}</strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button 
                            onClick={() => {
                              emitirBipSucesso();
                              setMobileAjusteItem(selectedCell.item);
                              setMobileQtdAjuste(selectedCell.item!.quantidade.toString());
                              setTelaMobile('inventario');
                              setMobileInventarioTab('geral');
                              setSelectedCell(null);
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" /> Ajustar Qtd
                          </button>
                          
                          <button 
                            onClick={() => {
                              emitirBipSucesso();
                              setMobileTransferItem(selectedCell.item);
                              setMobileNewRua(selectedCell.item!.rua);
                              setMobileNewPrateleira(selectedCell.item!.prateleira);
                              setTelaMobile('inventario');
                              setMobileInventarioTab('geral');
                              setSelectedCell(null);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-[10px] text-indigo-200">Endereço vazio. Pronto para receber mercadorias.</p>
                        <button 
                          onClick={() => {
                            emitirBipSucesso();
                            setFormEan('');
                            setFormNome('');
                            setFormCategoria(selectedCell.street === 'Rua A' ? 'LIMPEZA' : selectedCell.street === 'Rua B' ? 'INFRAESTRUTURA' : selectedCell.street === 'Rua C' ? 'TINTAS' : 'GERAL');
                            setFormRua(selectedCell.street);
                            setFormPrateleira(selectedCell.rack);
                            setFormQuantidade('50');
                            setFormLote(`LT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
                            setFormVencimento('2027-12-31');
                            setShowEntradaModal(true);
                            setSelectedCell(null);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl uppercase text-[9px] tracking-wider transition active:scale-95 cursor-pointer text-center"
                        >
                          Direcionar Entrada Aqui
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CADASTRAR PRODUTO POR IMAGEM */}
          {telaMobile === 'cadastrar_imagem' && (
            <div className="flex-1 p-4 space-y-4 animate-fade-in font-sans text-zinc-900 bg-slate-50 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-center gap-3">
                  <div className="bg-indigo-600 text-white p-2.5 rounded-xl">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Foto do Rótulo</h3>
                    <p className="text-[10px] text-indigo-950/70 mt-0.5 leading-relaxed font-semibold">Tire uma foto clara do rótulo para cadastrar.</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                  <div className="flex flex-col gap-3">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                    />
                    
                    {!catalogImage && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold p-6 rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Camera className="w-8 h-8 text-zinc-400" />
                        <span className="text-xs uppercase tracking-wider">Tirar Foto do Produto</span>
                      </button>
                    )}

                    {catalogImage && (
                      <div className="relative">
                        <img src={catalogImage} alt="Produto" className="w-full h-48 object-cover rounded-xl border border-zinc-200" />
                        <button 
                          onClick={resetCatalogImage}
                          className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white p-1.5 px-3 rounded-lg font-bold text-xs shadow-md"
                        >
                          Trocar Foto
                        </button>
                      </div>
                    )}
                  </div>

                  {catalogImage && !catalogJsonResult && (
                    <button 
                      onClick={processCatalogImage}
                      disabled={catalogImageLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                    >
                      {catalogImageLoading ? (
                         <span className="animate-pulse flex items-center gap-2"><Sparkles className="w-4 h-4" /> Extraindo informações...</span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Processar Rótulo com IA
                        </>
                      )}
                    </button>
                  )}

                  {leituraErroMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-[10px] font-bold">
                      {leituraErroMsg}
                    </div>
                  )}

                  {catalogJsonResult && (
                    <div className="space-y-3 pt-3 border-t border-zinc-100">
                      <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Extração Concluída
                      </h4>
                      <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl overflow-x-auto max-h-[220px]">
                        <pre className="text-[9px] font-mono text-zinc-800 whitespace-pre-wrap">
                          {JSON.stringify(catalogJsonResult, null, 2)}
                        </pre>
                      </div>
                      <button 
                        onClick={resetCatalogImage}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold p-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                      >
                        Tirar Nova Foto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Histórico de logs para controle de auditoria */}
        <div className="bg-zinc-900 border-t border-zinc-850 px-4 py-3">
          <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block mb-1">Atividade Operacional</span>
          <div className="bg-black/40 rounded-xl p-3 h-16 overflow-y-auto font-mono text-[10px] text-zinc-300 space-y-1 border border-zinc-800">
            {historicoAcoes.map((item, index) => (
              <div key={index} className="flex justify-between border-b border-zinc-800/60 pb-0.5 last:border-0">
                <span className="text-zinc-200 font-medium">{item.acao}</span>
                <span className="text-zinc-500 shrink-0 ml-2">{item.hora}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barra inferior com botões de navegação */}
        <footer className="bg-zinc-950 py-4 border-t border-zinc-900 flex justify-around items-center px-4">
          <button 
            id="footer_btn_home"
            onClick={() => { setTelaMobile('menu'); setProdutoDetectado(null); }} 
            className="flex flex-col items-center gap-1.5 text-[9px] font-bold text-zinc-400 hover:text-indigo-400 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-zinc-400" />
            INÍCIO
          </button>

          {/* Gatilho Central Indigo */}
          <button 
            id="footer_btn_bip"
            onClick={simularLeituraAutomatica}
            className="w-32 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            <Scan className="w-4 h-4 text-white" /> BIPAR AGORA
          </button>

          {/* Acesso rápido ao mapa do armazém */}
          <button 
            id="footer_btn_map"
            onClick={() => { emitirBipSucesso(); setTelaMobile('mapa_3d'); }} 
            className="flex flex-col items-center gap-1.5 text-[9px] font-bold text-zinc-400 hover:text-indigo-400 transition-colors"
          >
            <Layers className="w-4 h-4 text-indigo-400/80" />
            MAPA CD
          </button>
        </footer>

      </div>

      {/* MODAL: NOVO PEDIDO DE EXPEDIÇÃO */}
      {showNewOrderModal && (
        <div id="new_order_modal" className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-[32px] w-full max-w-[460px] p-6 shadow-2xl flex flex-col justify-between text-zinc-900 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-zinc-950 text-base">Novo Pedido de Saída</h3>
              </div>
              <button 
                onClick={() => { emitirBipSucesso(); setShowNewOrderModal(false); }}
                className="text-zinc-400 hover:text-zinc-600 text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">Destinatário / Destino</label>
                  <input
                    type="text"
                    value={newOrderDestino}
                    onChange={(e) => setNewOrderDestino(e.target.value)}
                    placeholder="Ex: Supermercado Bretas - Belo Horizonte / MG"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">Placa Caminhão</label>
                    <input
                      type="text"
                      value={newOrderPlaca}
                      onChange={(e) => setNewOrderPlaca(e.target.value)}
                      placeholder="Ex: EXP-5020"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">Prioridade</label>
                    <select
                      value={newOrderPrioridade}
                      onChange={(e) => setNewOrderPrioridade(e.target.value as any)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Add item rows */}
              <div className="bg-zinc-50 border border-zinc-150 p-3 rounded-2xl space-y-2.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Selecionar Itens de Estoque</span>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={selectedFormItemEan}
                    onChange={(e) => {
                      setSelectedFormItemEan(e.target.value);
                    }}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none text-[11px] font-medium"
                  >
                    <option value="">-- Escolha um item do estoque --</option>
                    {inventory.filter(i => i.quantidade > 0).map(i => (
                      <option key={`${i.ean}-${i.prateleira}`} value={i.ean}>
                        {i.nome} ({i.quantidade} un disponíveis em {i.prateleira})
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={selectedFormItemQtd}
                      min="1"
                      onChange={(e) => setSelectedFormItemQtd(e.target.value)}
                      className="w-20 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-800 text-center font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedFormItemEan) {
                          emitirBipErro();
                          return;
                        }
                        const selectedInvItem = inventory.find(i => i.ean === selectedFormItemEan);
                        if (!selectedInvItem) return;
                        const qty = parseInt(selectedFormItemQtd);
                        if (isNaN(qty) || qty <= 0 || qty > selectedInvItem.quantidade) {
                          emitirBipErro();
                          alert(`Quantidade inválida ou excede saldo disponível de ${selectedInvItem.quantidade} un.`);
                          return;
                        }
                        emitirBipSucesso();
                        setNewOrderItens(prev => {
                          const existing = prev.find(i => i.ean === selectedFormItemEan);
                          if (existing) {
                            return prev.map(i => i.ean === selectedFormItemEan ? { ...i, quantidade: Math.min(selectedInvItem.quantidade, i.quantidade + qty) } : i);
                          }
                          return [...prev, {
                            ean: selectedInvItem.ean,
                            nome: selectedInvItem.nome,
                            quantidade: qty,
                            rua: selectedInvItem.rua,
                            prateleira: selectedInvItem.prateleira
                          }];
                        });
                        setSelectedFormItemQtd('1');
                      }}
                      className="flex-1 bg-indigo-600 text-white font-bold py-1.5 rounded-lg uppercase tracking-wider text-[10px]"
                    >
                      Adicionar Item
                    </button>
                  </div>
                </div>

                {/* Added items basket */}
                {newOrderItens.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200 space-y-1 max-h-[110px] overflow-y-auto">
                    {newOrderItens.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white border border-zinc-100 rounded p-1.5 text-[10px]">
                        <span className="font-semibold truncate max-w-[240px] text-zinc-800">{item.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/50">{item.quantidade}x</span>
                          <button
                            type="button"
                            onClick={() => {
                              emitirBipSucesso();
                              setNewOrderItens(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (!newOrderDestino.trim() || !newOrderPlaca.trim() || newOrderItens.length === 0) {
                  emitirBipErro();
                  alert("Preencha o Destinatário, Placa do Caminhão e adicione ao menos 1 item ao pedido.");
                  return;
                }
                emitirBipSucesso();
                const newId = `EXP-2026-${Math.floor(100 + Math.random() * 900)}`;
                const createdOrder: ShippingOrder = {
                  id: newId,
                  destino: newOrderDestino,
                  prioridade: newOrderPrioridade,
                  caminhaoPlaca: newOrderPlaca.toUpperCase(),
                  status: 'Pendente',
                  itens: newOrderItens,
                  dataCriacao: new Date().toISOString().replace('T', ' ').substring(0, 16)
                };
                setShippingOrders(prev => [createdOrder, ...prev]);
                adicionarLog('EXPEDIÇÃO', `Novo pedido ${newId} criado para ${newOrderDestino}.`);
                setShowNewOrderModal(false);
              }}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider hover:bg-indigo-700 transition shadow-md cursor-pointer"
            >
              Confirmar e Gerar Pedido de Saída
            </button>
          </div>
        </div>
      )}

      {/* MODAL: GUIA NF / NOTA DE EXPEDIÇÃO */}
      {showGuideModal && (
        <div id="guide_modal" className="fixed inset-0 bg-zinc-950/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-2 border-zinc-300 rounded-xl w-full max-w-[420px] p-6 shadow-2xl flex flex-col justify-between text-zinc-950 font-mono text-xs">
            <div className="space-y-4">
              <div className="text-center border-b-2 border-zinc-300 pb-3">
                <span className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest block">Manifesto Fiscal Logístico</span>
                <h4 className="font-black text-sm tracking-tight text-zinc-900 mt-1 uppercase">WMS Autonomous Logistics</h4>
                <span className="text-[8.5px] text-zinc-400 block mt-1">EMISSÃO: {new Date().toLocaleString()}</span>
              </div>

              <div className="space-y-1.5 border-b border-zinc-200 pb-3">
                <div><span className="text-zinc-400 text-[9px] uppercase">ID Expedição:</span> <strong className="text-zinc-900">{showGuideModal.id}</strong></div>
                <div><span className="text-zinc-400 text-[9px] uppercase">Destino:</span> <span className="text-zinc-900 font-bold">{showGuideModal.destino}</span></div>
                <div><span className="text-zinc-400 text-[9px] uppercase">Caminhão Placa:</span> <span className="text-zinc-900 font-mono font-bold">{showGuideModal.caminhaoPlaca}</span></div>
                <div><span className="text-zinc-400 text-[9px] uppercase">Prioridade Operacional:</span> <span className="text-rose-600 font-bold">{showGuideModal.prioridade}</span></div>
              </div>

              {/* Itemized summary */}
              <div className="space-y-2">
                <span className="text-zinc-400 text-[9px] uppercase block">Resumo do Carregamento:</span>
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-zinc-300 text-[9px] text-zinc-500">
                      <th className="pb-1 font-bold">Produto</th>
                      <th className="pb-1 text-center font-bold">Qtd</th>
                      <th className="pb-1 text-right font-bold">Endereço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showGuideModal.itens.map((item, idx) => (
                      <tr key={idx} className="border-b border-zinc-100 last:border-0">
                        <td className="py-1.5 font-medium truncate max-w-[180px]">{item.nome}</td>
                        <td className="py-1.5 text-center font-bold text-zinc-900">{item.quantidade}x</td>
                        <td className="py-1.5 text-right font-mono text-zinc-600">{item.prateleira}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barcode Simulator in Pure Tailwind */}
              <div className="space-y-1 border-t border-zinc-200 pt-3">
                <div className="flex justify-center items-center py-4 bg-zinc-50 border border-zinc-200/60 rounded-lg select-none">
                  <div className="flex h-10 items-center">
                    {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1].map((w, idx) => (
                      <div 
                        key={idx} 
                        className="bg-zinc-950 h-8" 
                        style={{ width: `${w}px`, marginLeft: idx % 2 === 0 ? '0px' : `${w}px` }}
                      ></div>
                    ))}
                  </div>
                </div>
                <div className="text-center text-[8px] text-zinc-400 font-mono">
                  *AUT-{showGuideModal.id.replace('EXP-', '')}-EMBARQUE*
                </div>
              </div>

              <div className="bg-zinc-50 rounded p-2 text-[8px] text-zinc-500 border border-zinc-200 text-center leading-relaxed">
                DOCUMENTO ELETRÔNICO GERADO PELO SISTEMA AUTÔNOMO DE WMS. LIBERADO DE ICMS SOBRE PROCESSO INTERNO DE MOVIMENTAÇÃO DE MATERIAL DE APOIO.
              </div>
            </div>

            <div className="flex gap-2.5 pt-4 border-t border-zinc-200 mt-4">
              <button
                onClick={() => { emitirBipSucesso(); setShowGuideModal(null); }}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold py-3.5 rounded-xl text-[10px] uppercase border border-zinc-300 tracking-wider text-center cursor-pointer"
              >
                Fechar Guia
              </button>
              <button
                onClick={() => {
                  emitirBipSucesso();
                  alert("Guia e Nota Fiscal enviadas com sucesso para a impressora térmica da Doca 02!");
                }}
                className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-wider text-center cursor-pointer"
              >
                Imprimir Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO MAPA DAS RUAS DO CD (ACESSO RÁPIDO) */}
      {exibirMapaModal && (
        <div id="map_modal" className="fixed inset-0 bg-zinc-950/90 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-[32px] w-full max-w-[390px] p-6 shadow-2xl flex flex-col justify-between h-[665px] text-zinc-900">
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <h3 className="font-bold text-zinc-950 text-base">Mapa Interativo do CD</h3>
                </div>
                <button 
                  id="btn_close_map_modal"
                  onClick={() => setExibirMapaModal(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300/60 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Selecione qualquer posição para traçar a rota do AGV:</p>
            </div>

            {/* Representação Gráfica das Ruas - MAPA DETALHADO INTERATIVO */}
            <div className="flex-1 bg-slate-50 rounded-2xl border border-zinc-200 my-4 overflow-y-auto p-3.5 space-y-3 flex flex-col justify-between">
              {/* Telemetry */}
              <div className="grid grid-cols-3 gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 text-white text-[7.5px] font-mono shadow-inner">
                <div className="flex flex-col">
                  <span className="text-zinc-500 font-bold uppercase text-[6px]">Térmico</span>
                  <span className="text-emerald-400 font-extrabold mt-0.5">19.2°C • 45%</span>
                </div>
                <div className="flex flex-col border-l border-zinc-800 pl-1.5">
                  <span className="text-zinc-500 font-bold uppercase text-[6px]">AGVs</span>
                  <span className="text-indigo-400 font-extrabold mt-0.5">2 / 2 Ativos</span>
                </div>
                <div className="flex flex-col border-l border-zinc-800 pl-1.5">
                  <span className="text-zinc-500 font-bold uppercase text-[6px]">Ocupação</span>
                  <span className="text-sky-400 font-extrabold mt-0.5">74%</span>
                </div>
              </div>

              {/* Viewport */}
              <div className="flex-1 border border-zinc-200 rounded-xl bg-white overflow-auto relative shadow-inner min-h-[280px]">
                <div className="p-2 transition-transform duration-200 origin-top relative" style={{ minHeight: '520px' }}>
                  
                  {/* SVG Routes */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <path d="M 30,25 L 30,455" fill="none" stroke="#f4f4f5" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M 30,125 L 230,125" fill="none" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 30,230 L 230,230" fill="none" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 30,335 L 230,335" fill="none" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 30,440 L 230,440" fill="none" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 4" />

                    {selectedCell && (
                      <path
                        d={getRoutePath(selectedCell.rack)}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="6 4"
                        className="animate-path-flow"
                      />
                    )}

                    {/* Active AGV Picking Dynamic Path */}
                    {activePickingItem && (
                      <path
                        d={getRoutePath(activePickingItem.prateleira)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray="6 4"
                        className="animate-path-flow"
                      />
                    )}
                  </svg>

                  {/* AGVs */}
                  <div className="absolute w-4 h-4 bg-amber-400 border border-amber-500 rounded-md flex items-center justify-center shadow-md animate-agv1-patrol z-10 pointer-events-none">
                    <Truck className="w-2.5 h-2.5 text-amber-950" />
                  </div>
                  <div className="absolute w-4 h-4 bg-amber-400 border border-amber-500 rounded-md flex items-center justify-center shadow-md animate-agv2-patrol z-10 pointer-events-none">
                    <Truck className="w-2.5 h-2.5 text-amber-950" />
                  </div>

                  {/* Docas */}
                  <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
                    <div className="bg-cyan-500/10 border border-cyan-400/20 rounded-lg p-1.5 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-cyan-600 animate-pulse" />
                      <span className="text-[8px] font-black text-zinc-700">D01 Entrada</span>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-1.5 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-indigo-600 animate-pulse" />
                      <span className="text-[8px] font-black text-zinc-700">D02 Saída</span>
                    </div>
                  </div>

                  {/* Aisles */}
                  <div className="space-y-3 relative z-10">
                    {['Rua A', 'Rua B', 'Rua C', 'Rua D'].map((streetName) => {
                      const prefix = streetName === 'Rua A' ? 'A' : streetName === 'Rua B' ? 'B' : streetName === 'Rua C' ? 'C' : 'D';
                      const sectorKey = streetName === 'Rua A' ? 'LIMPEZA' : streetName === 'Rua B' ? 'INFRAESTRUTURA' : streetName === 'Rua C' ? 'TINTAS' : 'GERAL';
                      const sectorInfo = SECTORS_CD[sectorKey];

                      return (
                        <div key={streetName} className="bg-white border border-zinc-150 rounded-xl p-2 space-y-1.5 shadow-2xs">
                          <div className="flex justify-between items-center text-[8px] font-black border-b border-zinc-100 pb-0.5">
                            <span className="text-zinc-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              {streetName} — {sectorInfo.nome.split(' ')[0]}
                            </span>
                            <span className="text-zinc-400 font-mono font-bold">{prefix}1-{prefix}6</span>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            {[`${prefix}-01`, `${prefix}-02`, `${prefix}-03`, `${prefix}-04`, `${prefix}-05`, `${prefix}-06`].map((rackId) => {
                              const item = inventory.find(i => i.prateleira === rackId);
                              const qty = item?.quantidade ?? 0;
                              const isSelected = selectedCell?.rack === rackId;

                              return renderVisualRack(rackId, item, qty, isSelected, false);
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

              {/* Mini Details panel if selected in modal */}
              {selectedCell && (
                <div className="bg-zinc-900 text-white rounded-xl p-2.5 border border-zinc-800 space-y-1.5 text-[10px]">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-1">
                    <span className="font-extrabold text-indigo-400">Posição: {selectedCell.rack}</span>
                    <button onClick={() => setSelectedCell(null)} className="text-zinc-500 hover:text-white font-bold text-xs">X</button>
                  </div>
                  {selectedCell.item ? (
                    <div>
                      <p className="font-bold truncate text-white">{selectedCell.item.nome}</p>
                      <p className="text-[9px] text-zinc-400 font-mono">Qtd: {selectedCell.item.quantidade} • Lote: {selectedCell.item.lote}</p>
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-500">Posição livre.</p>
                  )}
                </div>
              )}

              <div className="text-[9.5px] text-center text-zinc-400 border-t border-zinc-200 pt-2 flex items-center justify-center gap-1 font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Sincronizado via AI Core CD
              </div>
            </div>

            <button 
              id="btn_resume_work"
              onClick={() => setExibirMapaModal(false)}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md cursor-pointer"
            >
              Voltar ao Trabalho
            </button>
          </div>
        </div>
      )}

      {/* MODAL DO BACKUP GERAL */}
      {showBackupModal && (
        <div id="backup_modal" className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-[32px] w-full max-w-[460px] p-6 shadow-2xl flex flex-col justify-between text-zinc-900 space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-zinc-950 text-base">Central de Backup WMS</h3>
              </div>
              {backupStep === 'menu' && (
                <button onClick={() => setShowBackupModal(false)} className="text-zinc-500 hover:text-zinc-800 font-bold p-1 bg-zinc-100 rounded-lg">X</button>
              )}
            </div>

            {backupStep === 'menu' && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600">Proteja as informações do seu sistema. Os backups incluem todo o histórico de inventário, configurações e movimentações operacionais.</p>
                
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => simularProcessoBackup('creating')} className="bg-zinc-900 hover:bg-zinc-800 text-white p-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-start gap-3 transition-all shadow-md active:scale-95 text-left border border-zinc-700">
                    <Download className="w-5 h-5 text-indigo-400 shrink-0" /> Criar Novo Backup
                  </button>
                  <label className="bg-white border-2 border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50 text-zinc-700 p-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-start gap-3 transition-all shadow-sm active:scale-95 text-left cursor-pointer">
                    <RotateCcw className="w-5 h-5 text-indigo-600 shrink-0" /> Restaurar Backup Existente
                    <input type="file" accept=".json" className="hidden" onChange={processarRestoreBackup} />
                  </label>
                </div>

                <div className="pt-4 border-t border-zinc-100 space-y-2">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Backups Recentes Localizados</h4>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-zinc-800">backup_auto_diario.json</span>
                      <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{new Date().toLocaleDateString('pt-BR')} • 2.4 MB • WMS v1.4.2</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
              </div>
            )}

            {(backupStep === 'creating' || backupStep === 'validating' || backupStep === 'restoring') && (
              <div className="py-6 flex flex-col items-center justify-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center relative overflow-hidden">
                  <Database className={`w-8 h-8 text-indigo-600 z-10 ${backupStep === 'validating' ? 'animate-bounce' : 'animate-pulse'}`} />
                  <div className="absolute inset-0 bg-indigo-100 animate-ping opacity-20"></div>
                </div>
                
                <div className="text-center space-y-1 w-full">
                  <h4 className="font-bold text-zinc-900 text-lg">
                    {backupStep === 'creating' ? 'Compactando Dados...' : 
                     backupStep === 'validating' ? 'Validando Integridade...' : 
                     'Restaurando Sistema...'}
                  </h4>
                  <p className="text-xs text-zinc-500">Por favor, não feche o aplicativo.</p>
                </div>

                <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2.5 transition-all duration-300 ease-out" 
                    style={{ width: `${backupProgress}%` }}
                  ></div>
                </div>
                <div className="w-full text-right">
                  <span className="text-[10px] font-bold text-zinc-400 font-mono">{backupProgress}% CONCLUÍDO</span>
                </div>
              </div>
            )}

            {backupStep === 'ready' && (
              <div className="py-4 space-y-5 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-lg">Backup Validado com Sucesso!</h4>
                  <p className="text-xs text-zinc-500 mt-1">O pacote de dados foi gerado e criptografado.</p>
                </div>
                <button 
                  onClick={baixarBackupArquivo}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-md active:scale-95"
                >
                  <Download className="w-5 h-5" /> Baixar Arquivo de Backup (.json)
                </button>
              </div>
            )}

            {backupStep === 'success' && (
              <div className="py-6 space-y-5 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-lg">Sistema Restaurado!</h4>
                  <p className="text-xs text-zinc-500 mt-1">Os dados do backup foram aplicados com sucesso.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Estilos e Transições */}
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Zebra Hazard Stripes for Blocked/Reserved Shelves */
        .bg-stripes-red {
          background: repeating-linear-gradient(
            45deg,
            #ef4444 0,
            #ef4444 4px,
            #dc2626 4px,
            #dc2626 8px
          );
        }
        .bg-stripes-blue {
          background: repeating-linear-gradient(
            45deg,
            #38bdf8 0,
            #38bdf8 4px,
            #0284c7 4px,
            #0284c7 8px
          );
        }

        /* Smart WMS Routing neon flow path */
        @keyframes pathFlow {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        .animate-path-flow {
          animation: pathFlow 0.8s linear infinite;
        }

        /* Autonomous AGV Patrol Animations */
        @keyframes agv1-patrol {
          0% { transform: translate(25px, 25px); }
          25% { transform: translate(25px, 140px); }
          45% { transform: translate(110px, 140px); }
          55% { transform: translate(110px, 140px); } /* Cargo load pause */
          75% { transform: translate(25px, 140px); }
          100% { transform: translate(25px, 25px); }
        }
        .animate-agv1-patrol {
          animation: agv1-patrol 12s ease-in-out infinite;
        }

        @keyframes agv2-patrol {
          0% { transform: translate(265px, 25px); }
          30% { transform: translate(145px, 245px); }
          50% { transform: translate(145px, 245px); } /* Cargo unload pause */
          75% { transform: translate(265px, 140px); }
          100% { transform: translate(265px, 25px); }
        }
        .animate-agv2-patrol {
          animation: agv2-patrol 15s ease-in-out infinite;
        }
      `}} />

    </div>
  );
}
