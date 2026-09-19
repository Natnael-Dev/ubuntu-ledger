// Pure Deterministic USSD Session Reducer
// Authoritative sources: docs/specs/06-voice-and-ussd.md §1, §2, §3, §4, §11 (CH-02, CH-05, CH-07),
// docs/specs/05-api-contracts.md §1, docs/specs/11-tasks.md T-14

import {
  formatMessage,
  composeProvenanceSentence,
  type Locale,
} from '../content';
import type {
  UssdSessionContext,
  UssdResponse,
  ProjectLookup,
  ServiceLookup,
  CompletedObservation,
} from './types';

export * from './types';

interface SessionState {
  nodeId: string;
  projectCode?: string;
  serviceCode?: string;
  assetCode?: string;
  answers: Record<string, boolean>;
  invalidHint?: boolean;
}

const DEFAULT_PROJECTS: Record<string, ProjectLookup> = {
  '4412': {
    projectCode: '4412',
    title: 'Health post generator overhaul',
    amount: '320,000',
    currency: 'ETB',
    contractor: 'AfroTech Infra',
    due: 'Aug 30',
    isOfficial: true,
    taskId: 'task-4412',
    assetType: 'generator',
    provenance: {
      count: 9,
      weekday: 'Tuesday',
      yesCount: 7,
      noCount: 2,
      ago: '2 days ago',
    },
    observationResult: {
      counted: true,
      witnessCount: 3,
      witnessTarget: 3,
      narrative: 'FIELD_DISCREPANCY',
    },
  },
};

const DEFAULT_SERVICES: Record<string, ServiceLookup> = {
  'ET-ID-REPLACE': {
    serviceCode: 'ET-ID-REPLACE',
    name: 'ID replacement',
    fee: '50',
    currency: 'ETB',
    documents: 'Kebele ID, photo',
    visits: 1,
    source: 'Circular 14/2026',
    divergence: {
      kSatisfied: true,
      pct: 78,
      n: 14,
      median: '200',
    },
  },
  'ET-CLINIC-INTAKE': {
    serviceCode: 'ET-CLINIC-INTAKE',
    name: 'Clinic intake',
    fee: '0',
    currency: 'ETB',
    documents: 'Patient card',
    visits: 1,
    source: 'Health Bureau Directive',
    divergence: {
      kSatisfied: false,
    },
  },
};

interface QuestionDef {
  id: string;
  messageKey: string;
}

const ASSET_QUESTIONS: Record<string, QuestionDef[]> = {
  borehole: [
    { id: 'q1', messageKey: 'q.borehole.head_fitted' },
    { id: 'q2', messageKey: 'q.borehole.water_flows' },
    { id: 'q3', messageKey: 'q.borehole.board_posted' },
  ],
  generator: [
    { id: 'q1', messageKey: 'q.generator.runs_on_outage' },
    { id: 'q2', messageKey: 'q.generator.fridge_green' },
    { id: 'q3', messageKey: 'q.generator.board_posted' },
  ],
  latrine_block: [
    { id: 'q1', messageKey: 'q.latrine.doors_fitted' },
    { id: 'q2', messageKey: 'q.latrine.water_present' },
    { id: 'q3', messageKey: 'q.latrine.board_posted' },
  ],
};

/**
 * Normalizes input keypress sequence by cleaning delimiters and service codes.
 */
export function normalizeUssdInput(rawText: string): string[] {
  if (!rawText) {
    return [];
  }

  // Strip leading service code if present (e.g. *890# or *890*...)
  let clean = rawText.trim();
  clean = clean.replace(/^\*890#?\*?/, '');
  clean = clean.replace(/\*+/g, '*');
  clean = clean.replace(/^\*|\*$/g, '');

  if (!clean) {
    return [];
  }

  return clean.split('*');
}

/**
 * Pure deterministic USSD session reducer.
 * Statelessly replays keypress history from root to current node.
 */
export function reduceUssdSession(
  text: string,
  context: UssdSessionContext = {}
): UssdResponse {
  let currentLocale: Locale = context.locale || 'en';
  const steps = normalizeUssdInput(text);

  const getProject = (code: string): ProjectLookup | null => {
    if (context.lookupProject) {
      return context.lookupProject(code);
    }
    return context.projects?.[code] || DEFAULT_PROJECTS[code] || null;
  };

  const getService = (code: string): ServiceLookup | null => {
    if (context.lookupService) {
      return context.lookupService(code);
    }
    return context.services?.[code] || DEFAULT_SERVICES[code] || null;
  };

  // Traversal history stack for '0' (back) and '00' (home)
  const history: SessionState[] = [];

  let state: SessionState = {
    nodeId: 'ROOT',
    answers: {},
    invalidHint: false,
  };

  // Replay steps sequentially
  for (const token of steps) {
    // 1. Universal Navigation: '00' -> Return to Main Menu
    if (token === '00') {
      history.length = 0;
      state = {
        nodeId: 'ROOT',
        answers: {},
        invalidHint: false,
      };
      continue;
    }

    // 2. Universal Navigation: '0' -> Back One Level
    if (token === '0') {
      if (history.length > 0) {
        const prevState = history.pop()!;
        state = {
          ...prevState,
          invalidHint: false,
        };
      } else {
        state = {
          nodeId: 'ROOT',
          answers: {},
          invalidHint: false,
        };
      }
      continue;
    }

    // 3. State-specific transition handling
    const nextState = evaluateTransition(state, token, getProject, getService);

    if (nextState.invalidHint) {
      // Retain state, show hint
      state = {
        ...state,
        invalidHint: true,
      };
    } else {
      // Valid transition: save to history stack if current state was non-terminal
      if (!isTerminalNode(state.nodeId)) {
        history.push({ ...state });
      }
      state = nextState;

      // Check if language was selected mid-session
      if (state.nodeId === 'LANGUAGE_UPDATED') {
        if (token === '1') currentLocale = 'en';
        if (token === '2') currentLocale = 'am';
        if (token === '3') currentLocale = 'om';
        if (token === '4') currentLocale = 'sw';
      }
    }
  }

  return renderNode(state, currentLocale, getProject, getService);
}

function isTerminalNode(nodeId: string): boolean {
  return [
    'CHECK_PROJECT_NOT_FOUND',
    'CHECK_PROJECT_PROVENANCE',
    'OBSERVATION_COMPLETED',
    'SERVICE_REFUSAL_SCRIPT',
    'SERVICE_DIVERGENCE',
    'SERVICE_OUTCOME_RECORDED',
    'FAULT_RECORDED',
    'LANGUAGE_UPDATED',
  ].includes(nodeId);
}

function evaluateTransition(
  current: SessionState,
  token: string,
  getProject: (code: string) => ProjectLookup | null,
  getService?: (code: string) => ServiceLookup | null
): SessionState {
  switch (current.nodeId) {
    case 'ROOT': {
      if (token === '1') {
        return { nodeId: 'CHECK_PROJECT_ENTER_CODE', answers: {} };
      }
      if (token === '2') {
        return { nodeId: 'SERVICES_SELECT', answers: {} };
      }
      if (token === '3') {
        return { nodeId: 'FAULT_ENTER_ASSET', answers: {} };
      }
      if (token === '4') {
        return { nodeId: 'LANGUAGE_SELECT', answers: {} };
      }
      return { ...current, invalidHint: true };
    }

    case 'CHECK_PROJECT_ENTER_CODE': {
      const code = token.trim();
      if (!/^[0-9A-Za-z_-]{2,10}$/.test(code)) {
        return { ...current, invalidHint: true };
      }
      const project = getProject(code);
      if (!project) {
        return { nodeId: 'CHECK_PROJECT_NOT_FOUND', projectCode: code, answers: {} };
      }
      return { nodeId: 'CHECK_PROJECT_RECEIPT', projectCode: code, answers: {} };
    }

    case 'CHECK_PROJECT_RECEIPT': {
      if (token === '1') {
        return { ...current, nodeId: 'QUESTION_1' };
      }
      if (token === '2') {
        // IVR replay -> stays on receipt
        return { ...current, invalidHint: false };
      }
      if (token === '3') {
        return { ...current, nodeId: 'CHECK_PROJECT_PROVENANCE' };
      }
      return { ...current, invalidHint: true };
    }

    case 'QUESTION_1': {
      if (token === '1' || token === '2') {
        return {
          ...current,
          nodeId: 'QUESTION_2',
          answers: { ...current.answers, q1: token === '1' },
        };
      }
      return { ...current, invalidHint: true };
    }

    case 'QUESTION_2': {
      if (token === '1' || token === '2') {
        const project = current.projectCode ? getProject(current.projectCode) : null;
        const assetType = project?.assetType || 'generator';
        const questions = ASSET_QUESTIONS[assetType] || ASSET_QUESTIONS.generator;

        if (questions.length >= 3) {
          return {
            ...current,
            nodeId: 'QUESTION_3',
            answers: { ...current.answers, q2: token === '1' },
          };
        }
        return {
          ...current,
          nodeId: 'OBSERVATION_COMPLETED',
          answers: { ...current.answers, q2: token === '1' },
        };
      }
      return { ...current, invalidHint: true };
    }

    case 'QUESTION_3': {
      if (token === '1' || token === '2') {
        return {
          ...current,
          nodeId: 'OBSERVATION_COMPLETED',
          answers: { ...current.answers, q3: token === '1' },
        };
      }
      return { ...current, invalidHint: true };
    }

    case 'SERVICES_SELECT': {
      if (token === '1') {
        return { nodeId: 'SERVICE_CARD', serviceCode: 'ET-ID-REPLACE', answers: {} };
      }
      if (token === '2') {
        return { nodeId: 'SERVICE_CARD', serviceCode: 'ET-CLINIC-INTAKE', answers: {} };
      }
      const svc = getService ? (getService(token) || getService(token.trim().toUpperCase())) : null;
      if (svc) {
        return { nodeId: 'SERVICE_CARD', serviceCode: svc.serviceCode, answers: {} };
      }
      return { ...current, invalidHint: true };
    }

    case 'SERVICE_CARD': {
      if (token === '1') {
        return { ...current, nodeId: 'SERVICE_REFUSAL_SCRIPT' };
      }
      if (token === '2') {
        return { ...current, nodeId: 'SERVICE_DIVERGENCE' };
      }
      if (token === '3') {
        return { ...current, nodeId: 'SERVICE_OUTCOME_MENU' };
      }
      return { ...current, invalidHint: true };
    }

    case 'SERVICE_OUTCOME_MENU': {
      const choice = Number(token);
      if (choice >= 1 && choice <= 5) {
        return { ...current, nodeId: 'SERVICE_OUTCOME_RECORDED', answers: { outcome: true } };
      }
      return { ...current, invalidHint: true };
    }

    case 'FAULT_ENTER_ASSET': {
      const code = token.trim();
      if (!code || code.length > 20) {
        return { ...current, invalidHint: true };
      }
      return { nodeId: 'FAULT_SELECT_STATUS', assetCode: code, answers: {} };
    }

    case 'FAULT_SELECT_STATUS': {
      if (token === '1' || token === '2') {
        return {
          ...current,
          nodeId: 'FAULT_RECORDED',
          answers: { working: token === '2' },
        };
      }
      return { ...current, invalidHint: true };
    }

    case 'LANGUAGE_SELECT': {
      if (token === '1' || token === '2' || token === '3' || token === '4') {
        return { nodeId: 'LANGUAGE_UPDATED', answers: {} };
      }
      return { ...current, invalidHint: true };
    }

    default:
      return { ...current, invalidHint: true };
  }
}

function renderNode(
  state: SessionState,
  locale: Locale,
  getProject: (code: string) => ProjectLookup | null,
  getService: (code: string) => ServiceLookup | null
): UssdResponse {
  const prefixHint = state.invalidHint ? formatMessage('hint.invalid_input', locale) : '';

  switch (state.nodeId) {
    case 'ROOT': {
      const raw = formatMessage('menu.root', locale);
      return makeResponse('CON', prefixHint + raw, 'ROOT', locale);
    }

    case 'CHECK_PROJECT_ENTER_CODE': {
      const raw = formatMessage('prompt.enter_project_code', locale);
      return makeResponse('CON', prefixHint + raw, 'CHECK_PROJECT_ENTER_CODE', locale);
    }

    case 'CHECK_PROJECT_NOT_FOUND': {
      const raw = formatMessage('error.code_not_found', locale);
      return makeResponse('END', raw, 'CHECK_PROJECT_NOT_FOUND', locale);
    }

    case 'CHECK_PROJECT_RECEIPT': {
      const p = state.projectCode ? getProject(state.projectCode) : null;
      if (!p) {
        const raw = formatMessage('error.code_not_found', locale);
        return makeResponse('END', raw, 'CHECK_PROJECT_NOT_FOUND', locale);
      }
      const templateKey = p.isOfficial ? 'receipt.summary' : 'receipt.unofficial';
      const summary = formatMessage(templateKey, locale, {
        title: p.title,
        currency: p.currency,
        amount: p.amount,
        contractor: p.contractor,
        due: p.due,
      });
      const menu = formatMessage('receipt.menu', locale);
      const raw = `${summary}\n${menu}`;
      return makeResponse('CON', prefixHint + raw, 'CHECK_PROJECT_RECEIPT', locale);
    }

    case 'CHECK_PROJECT_PROVENANCE': {
      const p = state.projectCode ? getProject(state.projectCode) : null;
      const prov = p?.provenance || {
        count: 0,
        weekday: 'Monday',
        yesCount: 0,
        noCount: 0,
        ago: 'recently',
      };
      const raw = composeProvenanceSentence(prov, locale);
      return makeResponse('END', raw, 'CHECK_PROJECT_PROVENANCE', locale);
    }

    case 'QUESTION_1':
    case 'QUESTION_2':
    case 'QUESTION_3': {
      const p = state.projectCode ? getProject(state.projectCode) : null;
      const assetType = p?.assetType || 'generator';
      const questions = ASSET_QUESTIONS[assetType] || ASSET_QUESTIONS.generator;
      const qIndex = state.nodeId === 'QUESTION_1' ? 0 : state.nodeId === 'QUESTION_2' ? 1 : 2;
      const qDef = questions[qIndex] || questions[0];

      const raw = formatMessage(qDef.messageKey, locale);
      return makeResponse('CON', prefixHint + raw, state.nodeId, locale);
    }

    case 'OBSERVATION_COMPLETED': {
      const p = state.projectCode ? getProject(state.projectCode) : null;
      const obsRes = p?.observationResult || {
        counted: true,
        witnessCount: 1,
        witnessTarget: 3,
      };

      const baseKey = obsRes.counted ? 'observation.counted' : 'observation.duplicate';
      const baseMsg = formatMessage(baseKey, locale, {
        count: obsRes.witnessCount,
        target: obsRes.witnessTarget,
      });

      let fullMsg = baseMsg;
      if (obsRes.narrative === 'FIELD_DISCREPANCY') {
        const narrative = formatMessage('narrative.reports_disagree', locale);
        fullMsg = `${baseMsg} ${narrative}`;
      }

      const completedObservation: CompletedObservation | undefined =
        state.projectCode && p?.taskId
          ? {
              taskId: p.taskId,
              projectCode: state.projectCode,
              answers: state.answers,
            }
          : undefined;

      const res = makeResponse('END', fullMsg, 'OBSERVATION_COMPLETED', locale);
      res.completedObservation = completedObservation;
      return res;
    }

    case 'SERVICES_SELECT': {
      const raw = formatMessage('services.menu', locale);
      return makeResponse('CON', prefixHint + raw, 'SERVICES_SELECT', locale);
    }

    case 'SERVICE_CARD': {
      const s = state.serviceCode ? getService(state.serviceCode) : null;
      if (!s) {
        const raw = formatMessage('services.menu', locale);
        return makeResponse('CON', prefixHint + raw, 'SERVICES_SELECT', locale);
      }
      const card = formatMessage('statutory.card', locale, {
        currency: s.currency,
        fee: s.fee,
        documents: s.documents,
        visits: s.visits,
      });
      const menu = formatMessage('statutory.menu', locale);
      const raw = `${card}\n${menu}`;
      return makeResponse('CON', prefixHint + raw, 'SERVICE_CARD', locale);
    }

    case 'SERVICE_REFUSAL_SCRIPT': {
      const s = state.serviceCode ? getService(state.serviceCode) : null;
      const raw = formatMessage('script.request_official_receipt', locale, {
        source: s?.source || 'Circular 14/2026',
        currency: s?.currency || 'ETB',
        fee: s?.fee || '50',
      });
      return makeResponse('END', raw, 'SERVICE_REFUSAL_SCRIPT', locale);
    }

    case 'SERVICE_DIVERGENCE': {
      const s = state.serviceCode ? getService(state.serviceCode) : null;
      const div = s?.divergence;
      let raw: string;
      if (div?.kSatisfied) {
        raw = formatMessage('divergence.summary', locale, {
          pct: div.pct ?? 0,
          n: div.n ?? 0,
          currency: s?.currency || 'ETB',
          median: div.median || '0',
        });
      } else {
        raw = formatMessage('divergence.not_enough_reports', locale);
      }
      return makeResponse('END', raw, 'SERVICE_DIVERGENCE', locale);
    }

    case 'SERVICE_OUTCOME_MENU': {
      const raw = formatMessage('outcome.menu', locale);
      return makeResponse('CON', prefixHint + raw, 'SERVICE_OUTCOME_MENU', locale);
    }

    case 'SERVICE_OUTCOME_RECORDED': {
      const raw = formatMessage('outcome.recorded', locale);
      const res = makeResponse('END', raw, 'SERVICE_OUTCOME_RECORDED', locale);
      if (state.serviceCode) {
        res.selectedOutcome = {
          serviceCode: state.serviceCode,
          outcomeCode: 1,
        };
      }
      return res;
    }

    case 'FAULT_ENTER_ASSET': {
      const raw = formatMessage('prompt.enter_asset_code', locale);
      return makeResponse('CON', prefixHint + raw, 'FAULT_ENTER_ASSET', locale);
    }

    case 'FAULT_SELECT_STATUS': {
      const raw = formatMessage('fault.menu', locale);
      return makeResponse('CON', prefixHint + raw, 'FAULT_SELECT_STATUS', locale);
    }

    case 'FAULT_RECORDED': {
      const raw = formatMessage('fault.recorded', locale);
      const res = makeResponse('END', raw, 'FAULT_RECORDED', locale);
      if (state.assetCode) {
        res.reportedFault = {
          assetCode: state.assetCode,
          working: Boolean(state.answers.working),
        };
      }
      return res;
    }

    case 'LANGUAGE_SELECT': {
      const raw = formatMessage('language.menu', locale);
      return makeResponse('CON', prefixHint + raw, 'LANGUAGE_SELECT', locale);
    }

    case 'LANGUAGE_UPDATED': {
      const raw = formatMessage('language.selected', locale);
      const res = makeResponse('END', raw, 'LANGUAGE_UPDATED', locale);
      res.selectedLocale = locale;
      return res;
    }

    default: {
      const raw = formatMessage('menu.root', locale);
      return makeResponse('CON', raw, 'ROOT', locale);
    }
  }
}

function makeResponse(
  action: 'CON' | 'END',
  message: string,
  nodeId: string,
  locale: Locale
): UssdResponse {
  const formattedText = `${action} ${message}`;
  return {
    action,
    text: formattedText,
    rawMessage: message,
    nodeId,
    locale,
  };
}
