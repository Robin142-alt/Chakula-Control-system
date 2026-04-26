import { USERS } from "../data/demoData.js";

const DEMO_PIN_HASHES = {
  1: "bfa0ec8bdf2946547879d50a68687ea32e2fa628db187357415858b633d194d9",
  2: "b3282a2f2a28757b3a18ab833de16a9c54518c0b0cf493e3f0a7cf09386f326a",
  3: "15fc36b3e80b9d7f87f7dc90cd7a2845c5d8501c30f03379fcf14154f1680380",
  4: "dec1ab2f6d6e994cfe718666751e27a22a3c8c2e7c2708b995fb1e021197136e",
  5: "16740bf13991fe083fbe5820cc8da08a5d88e5a48f44a3cfcc283c27b2797ba7",
};

export const DEMO_AUTH_USERS = USERS.map((user) => ({
  ...user,
  pin_hash: DEMO_PIN_HASHES[user.id] || null,
}));

