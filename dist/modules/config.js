export const TIME_ZONE = "America/Sao_Paulo";
export const STATUSES = {
  waiting: "Aguardando",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};
export const ACTIVE_STATUSES = ["waiting", "confirmed"];
export const OCCUPIED_STATUSES = [
  "waiting",
  "confirmed",
  "completed",
  "no_show",
];
export const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DEFAULT_SERVICES = [
  {
    id: "svc-corte",
    name: "Corte de cabelo",
    description: "Do clássico ao degradê. Precisão em cada linha.",
    priceCents: 5000,
    duration: 40,
    buffer: 0,
    category: "Cabelo",
    order: 1,
    active: true,
    promoCents: null,
    comboIds: [],
  },
  {
    id: "svc-barba",
    name: "Barba completa",
    description: "Desenho, toalha quente e acabamento impecável.",
    priceCents: 3500,
    duration: 30,
    buffer: 0,
    category: "Barba",
    order: 2,
    active: true,
    promoCents: null,
    comboIds: [],
  },
  {
    id: "svc-combo",
    name: "Corte + barba",
    description: "A experiência completa para renovar seu estilo.",
    priceCents: 7500,
    duration: 70,
    buffer: 0,
    category: "Combo",
    order: 3,
    active: true,
    promoCents: null,
    comboIds: ["svc-corte", "svc-barba"],
  },
];
export const DEFAULT_SCHEDULE = {
  days: [1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "19:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
};
export const DEFAULT_BARBERS = [
  {
    id: "barber-rafael",
    name: "Rafael",
    specialties: "Cortes clássicos & degradê",
    active: true,
    schedule: structuredClone(DEFAULT_SCHEDULE),
    commissionPercent: 40,
    vacations: [],
    blocks: [],
  },
  {
    id: "barber-lucas",
    name: "Lucas",
    specialties: "Barba & visagismo",
    active: true,
    schedule: structuredClone(DEFAULT_SCHEDULE),
    commissionPercent: 40,
    vacations: [],
    blocks: [],
  },
];
export const SLOT_STEP = 30;
export const STORAGE_KEY = "brava-v2";
export const BACKUP_KEY = "brava-v2-backup";
