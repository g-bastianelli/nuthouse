const EFFECT_SIGNAL = Symbol("nuthouse.monkey-maestro.orchestration-effect-signal");

export class OrchestrationEffectRequired extends Error {
  constructor(effect) {
    super(`effect response required: ${effect.adapter}`);
    this.name = "OrchestrationEffectRequired";
    this.code = "ORCHESTRATION_EFFECT_REQUIRED";
    this.effect = effect;
    this[EFFECT_SIGNAL] = true;
  }
}

export class OrchestrationEffectsRequired extends Error {
  constructor(effects) {
    super("provider effect responses required");
    this.name = "OrchestrationEffectsRequired";
    this.code = "ORCHESTRATION_EFFECTS_REQUIRED";
    this.effects = effects;
    this[EFFECT_SIGNAL] = true;
  }
}

export function isOrchestrationEffectSignal(error) {
  return (
    error?.[EFFECT_SIGNAL] === true &&
    (error instanceof OrchestrationEffectRequired || error instanceof OrchestrationEffectsRequired)
  );
}

export function requiredOrchestrationEffects(error) {
  if (!isOrchestrationEffectSignal(error)) return undefined;
  return error instanceof OrchestrationEffectsRequired ? error.effects : [error.effect];
}
