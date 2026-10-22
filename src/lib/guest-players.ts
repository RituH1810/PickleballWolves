// Limits for guest players -- people an organizer adds to a round robin by name, without an account.
export const GUEST_NAME_MAX = 40;
export const GUEST_RATING_MIN = 1.0;
export const GUEST_RATING_MAX = 6.0;
// Prefilled when adding a guest. Their rating moves real players' ratings, so it's asked for rather
// than defaulting to a new account's 2.0.
export const GUEST_RATING_DEFAULT = 3.0;
