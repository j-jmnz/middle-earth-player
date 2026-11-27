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
  // The damage the attack has dealt to characters, noted while a shadow effect waits to read it after the attack (families/defense/excess.ts).
  landed?: number;
  // The damage beyond the remaining hit points of the character the attack damaged, noted for an enemy that sends it on (excessToShip).
  excess?: number;
  // The hit points (with their modifiers) of each character whose damage went beyond them, noted when a card reads the excess (excessOf, 18049:A:2): the excess is the damage left on the destroyed character beyond them.
  hitPointsOn?: Readonly<Record<string, number>>;
  // The cards this attack placed combat damage on, as the damage went to them (a redirect of Song of Mocking or Alcaron's Scroll that ends with the attack, or its host that left play, is not read again at the attack's end): destroyedByAttack reads them.
  hit?: readonly string[];
  // The attacking enemy's Attack when its shadow cards began to resolve, to tell whether one increased it.
  attackBefore?: number;
  // The characters this attack placed damage on, each with the damage it held before, noted while a card hears `attackDamagedCharacter` (families/angmar/damage.ts).
  hurt?: Readonly<Record<string, number>>;
};
