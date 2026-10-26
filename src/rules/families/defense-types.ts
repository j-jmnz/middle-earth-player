// Plain data the defense family keeps on the enemy attack in progress (PendingAttack.defense). No closures: it is cloned and
// replayed with the rest of the state.

// A ready the attack's end runs (ReadyAfterAttack): one card, or each defender that took no damage, maybe after a payment.
export type EndReady = {
  // The card to ready, or null for each defender that took no damage from the attack.
  id: string | null;
  // Only when the attack dealt no damage.
  ifNoDamage?: true;
  // The players as a group may first spend this many resources of the sphere.
  pay?: { amount: number; sphere: string };
  // The seat that decides on the payment.
  seat: number;
};

export type AttackDefense = {
  // The defenders declared beyond the first (rr.multiple-defenders), in the order declared.
  extra?: readonly string[];
  // Each defender's damage when it was declared (and the named hero's), to tell which took damage from this attack.
  marks?: Readonly<Record<string, number>>;
  // The defender the defending player assigned the attack's damage to.
  damageTo?: string;
  // The enemy the attack is resolved against instead of the defenders (Small Target, 06062).
  redirectTo?: string;
  // The attack was canceled: it ends with no shadow effect or damage left to resolve.
  canceled?: true;
  // The defenders' ends ("After ~ defends") have been announced.
  announced?: true;
  // Readies waiting for the end of the attack.
  readies?: readonly EndReady[];
  // The attacking enemy's Attack when its shadow cards began to resolve, to tell whether one increased it.
  attackBefore?: number;
};
