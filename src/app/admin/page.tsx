import { redirect } from 'next/navigation';

/**
 * The staff panel has no visible login page. Reaching /admin directly just
 * sends you home — the only way in is the secret gesture on the home page,
 * which opens the vault pinpad (see StaffUnlock).
 */
export default function AdminIndex() {
  redirect('/');
}
